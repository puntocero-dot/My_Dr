const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticateToken, requireMedicalStaff } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Get documents
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { patientId, type, limit = 50 } = req.query;

    let sql = `
      SELECT d.*,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.first_name as doctor_first_name, u.last_name as doctor_last_name
      FROM documents d
      JOIN patients p ON d.patient_id = p.id
      LEFT JOIN doctors doc ON d.doctor_id = doc.id
      LEFT JOIN users u ON doc.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (patientId) {
      sql += ` AND d.patient_id = $${paramIndex++}`;
      params.push(patientId);
    }

    if (type) {
      sql += ` AND d.type = $${paramIndex++}`;
      params.push(type);
    }

    sql += ` ORDER BY d.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);

    res.json(result.rows.map(d => ({
      id: d.id,
      patientId: d.patient_id,
      consultationId: d.consultation_id,
      type: d.type,
      title: d.title,
      fileUrl: d.file_url,
      qrVerificationCode: d.qr_verification_code,
      sentToEmail: d.sent_to_email,
      sentAt: d.sent_at,
      createdAt: d.created_at,
      patient: {
        firstName: d.patient_first_name,
        lastName: d.patient_last_name
      },
      doctor: d.doctor_first_name ? {
        firstName: d.doctor_first_name,
        lastName: d.doctor_last_name
      } : null
    })));
  } catch (error) {
    logger.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// Get document by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*,
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.date_of_birth, p.medical_record_number,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name,
              doc.medical_license, doc.specialty, doc.signature_url, doc.stamp_url,
              c.name as clinic_name, c.address as clinic_address, c.phone as clinic_phone, c.logo_url
       FROM documents d
       JOIN patients p ON d.patient_id = p.id
       LEFT JOIN doctors doc ON d.doctor_id = doc.id
       LEFT JOIN users u ON doc.user_id = u.id
       LEFT JOIN clinics c ON doc.clinic_id = c.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const d = result.rows[0];
    res.json({
      id: d.id,
      type: d.type,
      title: d.title,
      content: d.content,
      fileUrl: d.file_url,
      qrVerificationCode: d.qr_verification_code,
      sentToEmail: d.sent_to_email,
      sentAt: d.sent_at,
      createdAt: d.created_at,
      patient: {
        id: d.patient_id,
        firstName: d.patient_first_name,
        lastName: d.patient_last_name,
        dateOfBirth: d.date_of_birth,
        medicalRecordNumber: d.medical_record_number
      },
      doctor: d.doctor_first_name ? {
        id: d.doctor_id,
        firstName: d.doctor_first_name,
        lastName: d.doctor_last_name,
        medicalLicense: d.medical_license,
        specialty: d.specialty,
        signatureUrl: d.signature_url,
        stampUrl: d.stamp_url
      } : null,
      clinic: d.clinic_name ? {
        name: d.clinic_name,
        address: d.clinic_address,
        phone: d.clinic_phone,
        logoUrl: d.logo_url
      } : null
    });
  } catch (error) {
    logger.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Create document
router.post('/', authenticateToken, requireMedicalStaff, [
  body('patientId').isUUID(),
  body('type').isIn(['prescription', 'medical_certificate', 'disability', 'referral', 'lab_order', 'health_certificate', 'vaccination_card'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { patientId, consultationId, doctorId, type, title, content } = req.body;

  try {
    // Generate QR verification code
    const qrCode = `MYDR-${uuidv4().toUpperCase()}`;

    const result = await query(
      `INSERT INTO documents (patient_id, consultation_id, doctor_id, type, title, content, qr_verification_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [patientId, consultationId, doctorId, type, title, content, qrCode]
    );

    await logAudit(req.user.id, 'CREATE_DOCUMENT', 'documents', result.rows[0].id, null, { type, patientId }, req);

    res.status(201).json({
      id: result.rows[0].id,
      type: result.rows[0].type,
      title: result.rows[0].title,
      qrVerificationCode: result.rows[0].qr_verification_code,
      createdAt: result.rows[0].created_at
    });
  } catch (error) {
    logger.error('Create document error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Verify document by QR code
router.get('/verify/:qrCode', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.type, d.title, d.created_at,
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name,
              doc.medical_license
       FROM documents d
       JOIN patients p ON d.patient_id = p.id
       LEFT JOIN doctors doc ON d.doctor_id = doc.id
       LEFT JOIN users u ON doc.user_id = u.id
       WHERE d.qr_verification_code = $1`,
      [req.params.qrCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Document not found' });
    }

    const d = result.rows[0];
    res.json({
      valid: true,
      document: {
        id: d.id,
        type: d.type,
        title: d.title,
        createdAt: d.created_at,
        patient: `${d.patient_first_name} ${d.patient_last_name}`,
        doctor: d.doctor_first_name ? `Dr. ${d.doctor_first_name} ${d.doctor_last_name}` : null,
        medicalLicense: d.medical_license
      }
    });
  } catch (error) {
    logger.error('Verify document error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get document templates
router.get('/templates/list', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const { clinicId, type } = req.query;

    let sql = 'SELECT * FROM document_templates WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (clinicId) {
      sql += ` AND (clinic_id = $${paramIndex++} OR clinic_id IS NULL)`;
      params.push(clinicId);
    }

    if (type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    sql += ' ORDER BY is_default DESC, name';

    const result = await query(sql, params);

    res.json(result.rows.map(t => ({
      id: t.id,
      clinicId: t.clinic_id,
      type: t.type,
      name: t.name,
      contentTemplate: t.content_template,
      variables: t.variables,
      isDefault: t.is_default
    })));
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Create document template
router.post('/templates', authenticateToken, requireMedicalStaff, [
  body('type').isIn(['prescription', 'medical_certificate', 'disability', 'referral', 'lab_order', 'health_certificate', 'vaccination_card']),
  body('name').notEmpty(),
  body('contentTemplate').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { clinicId, type, name, contentTemplate, variables, isDefault } = req.body;

  try {
    const result = await query(
      `INSERT INTO document_templates (clinic_id, type, name, content_template, variables, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [clinicId, type, name, contentTemplate, variables || [], isDefault || false]
    );

    res.status(201).json({
      id: result.rows[0].id,
      type: result.rows[0].type,
      name: result.rows[0].name
    });
  } catch (error) {
    logger.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Mark document as sent
router.patch('/:id/sent', authenticateToken, requireMedicalStaff, async (req, res) => {
  const { email } = req.body;

  try {
    const result = await query(
      `UPDATE documents SET sent_to_email = $1, sent_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [email, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document marked as sent', sentAt: result.rows[0].sent_at });
  } catch (error) {
    logger.error('Mark sent error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

module.exports = router;
