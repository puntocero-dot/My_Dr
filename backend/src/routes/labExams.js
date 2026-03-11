const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { authenticateToken, requireMedicalStaff } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');
const geminiService = require('../services/geminiService');

const router = express.Router();

const multerS3 = require('multer-s3');
const { s3Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/s3');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

// Configure multer to upload directly to Cloudflare R2
const storage = multerS3({
  s3: s3Client,
  bucket: R2_BUCKET,
  acl: 'public-read', // or private depending on your bucket settings
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `lab-exams/${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPG, PNG, WebP o PDF.'));
    }
  }
});

// Get all lab exams for a patient
router.get('/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT le.*, 
              u.first_name as created_by_name,
              r.first_name as reviewed_by_name
       FROM lab_exams le
       LEFT JOIN users u ON le.created_by = u.id
       LEFT JOIN users r ON le.reviewed_by = r.id
       WHERE le.patient_id = $1
       ORDER BY le.exam_date DESC, le.created_at DESC`,
      [req.params.patientId]
    );

    res.json(result.rows.map(e => ({
      id: e.id,
      patientId: e.patient_id,
      consultationId: e.consultation_id,
      examType: e.exam_type,
      examName: e.exam_name,
      examDate: e.exam_date,
      labName: e.lab_name,
      status: e.status,
      results: e.results,
      aiInterpretation: e.ai_interpretation,
      notes: e.notes,
      fileUrl: e.file_url,
      fileType: e.file_type,
      fileName: e.file_name,
      createdBy: e.created_by_name,
      reviewedBy: e.reviewed_by_name,
      reviewedAt: e.reviewed_at,
      createdAt: e.created_at
    })));
  } catch (error) {
    logger.error('Get lab exams error:', error);
    res.status(500).json({ error: 'Failed to get lab exams' });
  }
});

// Get single lab exam
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM lab_exams WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lab exam not found' });
    }

    const e = result.rows[0];
    res.json({
      id: e.id,
      patientId: e.patient_id,
      consultationId: e.consultation_id,
      examType: e.exam_type,
      examName: e.exam_name,
      examDate: e.exam_date,
      labName: e.lab_name,
      status: e.status,
      results: e.results,
      aiInterpretation: e.ai_interpretation,
      notes: e.notes,
      fileUrl: e.file_url,
      fileType: e.file_type,
      fileName: e.file_name,
      createdAt: e.created_at
    });
  } catch (error) {
    logger.error('Get lab exam error:', error);
    res.status(500).json({ error: 'Failed to get lab exam' });
  }
});

// Serve file
router.get('/file/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT file_url, file_type, file_name FROM lab_exams WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0 || !result.rows[0].file_url) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = result.rows[0].file_url;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', result.rows[0].file_type);
    res.setHeader('Content-Disposition', `inline; filename="${result.rows[0].file_name}"`);
    res.sendFile(filePath);
  } catch (error) {
    logger.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Create lab exam with optional file upload
router.post('/', authenticateToken, requireMedicalStaff, upload.single('file'), async (req, res) => {
  try {
    const { patientId, consultationId, examType, examName, examDate, labName, notes, results } = req.body;

    if (!patientId || !examType || !examName) {
      return res.status(400).json({ error: 'patientId, examType and examName are required' });
    }

    let fileUrl = null;
    let fileType = null;
    let fileName = null;

    if (req.file) {
      // The public URL generated by combining R2_PUBLIC_URL and the file key
      fileUrl = `${R2_PUBLIC_URL}/${req.file.key}`;
      fileType = req.file.mimetype;
      fileName = req.file.originalname;
    }

    const result = await query(
      `INSERT INTO lab_exams (
        patient_id, consultation_id, exam_type, exam_name, exam_date, 
        lab_name, notes, results, file_url, file_type, file_name, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [patientId, consultationId || null, examType, examName, examDate || new Date(),
        labName, notes, results ? JSON.parse(results) : null, fileUrl, fileType, fileName, req.user.id]
    );

    await logAudit(req.user.id, 'CREATE_LAB_EXAM', 'lab_exams', result.rows[0].id, null, result.rows[0], req);

    const e = result.rows[0];
    res.status(201).json({
      id: e.id,
      patientId: e.patient_id,
      examType: e.exam_type,
      examName: e.exam_name,
      examDate: e.exam_date,
      status: e.status,
      fileUrl: e.file_url,
      fileName: e.file_name
    });
  } catch (error) {
    logger.error('Create lab exam error:', error);
    res.status(500).json({ error: 'Failed to create lab exam' });
  }
});

// Analyze lab exam image with AI
router.post('/:id/analyze', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM lab_exams WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lab exam not found' });
    }

    const exam = result.rows[0];

    if (!exam.file_url) {
      return res.status(400).json({ error: 'No file attached to analyze' });
    }

    // Get patient info for context
    const patientResult = await query(
      `SELECT *, EXTRACT(YEAR FROM AGE(date_of_birth)) as age_years FROM patients WHERE id = $1`,
      [exam.patient_id]
    );
    const patient = patientResult.rows[0];

    // Read file from S3 and convert to base64
    if (!exam.file_url) {
      return res.status(400).json({ error: 'El archivo del examen no está disponible.' });
    }

    // Extract key from the URL
    const fileKey = exam.file_url.split(`${R2_PUBLIC_URL}/`)[1];
    if (!fileKey) {
       return res.status(400).json({ error: 'URL de archivo inválida' });
    }

    const getObjectParams = {
      Bucket: R2_BUCKET,
      Key: fileKey
    };

    const command = new GetObjectCommand(getObjectParams);
    const S3Response = await s3Client.send(command);
    
    // Convert stream to Buffer
    const streamToBuffer = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });

    const fileBuffer = await streamToBuffer(S3Response.Body);
    const base64File = fileBuffer.toString('base64');

    // Use Gemini Vision to analyze
    const interpretation = await geminiService.analyzeLabExam(
      base64File,
      exam.file_type,
      exam.exam_type,
      exam.exam_name,
      {
        age: patient?.age_years || 'desconocida',
        gender: patient?.gender === 'male' ? 'masculino' : 'femenino'
      }
    );

    // Update exam with AI interpretation
    await query(
      `UPDATE lab_exams SET ai_interpretation = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [interpretation, req.params.id]
    );

    res.json({ interpretation });
  } catch (error) {
    logger.error('Analyze lab exam error:', error);
    res.status(500).json({ error: 'Failed to analyze lab exam', message: error.message });
  }
});

// Update lab exam results manually
router.put('/:id', authenticateToken, requireMedicalStaff, async (req, res) => {
  const { examType, examName, examDate, labName, notes, results, status } = req.body;

  try {
    const oldResult = await query('SELECT * FROM lab_exams WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lab exam not found' });
    }

    const result = await query(
      `UPDATE lab_exams SET
        exam_type = COALESCE($1, exam_type),
        exam_name = COALESCE($2, exam_name),
        exam_date = COALESCE($3, exam_date),
        lab_name = COALESCE($4, lab_name),
        notes = COALESCE($5, notes),
        results = COALESCE($6, results),
        status = COALESCE($7, status),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [examType, examName, examDate, labName, notes, results, status, req.params.id]
    );

    await logAudit(req.user.id, 'UPDATE_LAB_EXAM', 'lab_exams', req.params.id, oldResult.rows[0], result.rows[0], req);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update lab exam error:', error);
    res.status(500).json({ error: 'Failed to update lab exam' });
  }
});

// Mark as reviewed
router.patch('/:id/review', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const result = await query(
      `UPDATE lab_exams SET 
        status = 'reviewed', 
        reviewed_by = $1, 
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lab exam not found' });
    }

    res.json({ message: 'Lab exam marked as reviewed' });
  } catch (error) {
    logger.error('Review lab exam error:', error);
    res.status(500).json({ error: 'Failed to review lab exam' });
  }
});

// Delete lab exam
router.delete('/:id', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const result = await query('SELECT * FROM lab_exams WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lab exam not found' });
    }

    // Delete file if exists
    if (result.rows[0].file_url) {
      try {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const fileKey = result.rows[0].file_url.split(`${R2_PUBLIC_URL}/`)[1];
        if (fileKey) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: fileKey
          }));
        }
      } catch (err) {
        logger.error('Failed to delete S3 file during lab exam deletion:', err);
      }
    }

    await query('DELETE FROM lab_exams WHERE id = $1', [req.params.id]);
    await logAudit(req.user.id, 'DELETE_LAB_EXAM', 'lab_exams', req.params.id, result.rows[0], null, req);

    res.json({ message: 'Lab exam deleted' });
  } catch (error) {
    logger.error('Delete lab exam error:', error);
    res.status(500).json({ error: 'Failed to delete lab exam' });
  }
});

module.exports = router;
