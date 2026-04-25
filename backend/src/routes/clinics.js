const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { query } = require('../config/database');
const { authenticateToken, requireAdmin, requireMedicalStaff } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');
const { s3Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/s3');

const router = express.Router();

// Configure multer to upload directly to Cloudflare R2
const storage = multerS3({
  s3: s3Client,
  bucket: R2_BUCKET,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const folder = file.fieldname === 'loginBg' ? 'clinics/login-bg' : 'clinics/logos';
    cb(null, `${folder}/${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPG, PNG, WebP o SVG.'));
    }
  }
});

const uploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'loginBg', maxCount: 1 }
]);

// Get all clinics
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM clinics ORDER BY name');

    res.json(result.rows.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      phone: c.phone,
      email: c.email,
      logoUrl: c.logo_url,
      settings: c.settings,
      createdAt: c.created_at
    })));
  } catch (error) {
    logger.error('Get clinics error:', error);
    res.status(500).json({ error: 'Failed to get clinics' });
  }
});

// Public branding endpoint — no auth required (used by login page)
router.get('/public/branding', async (req, res) => {
  const { clinicId } = req.query;
  try {
    let result;
    if (clinicId) {
      result = await query('SELECT name, logo_url, settings FROM clinics WHERE id = $1', [clinicId]);
    } else {
      result = await query('SELECT name, logo_url, settings FROM clinics ORDER BY created_at ASC LIMIT 1');
    }
    if (result.rows.length === 0) {
      return res.json({ name: 'My_Dr', logoUrl: null, loginBgUrl: null, loginBgPosition: 'top center', primaryColor: null });
    }
    const c = result.rows[0];
    res.json({
      name: c.name,
      logoUrl: c.logo_url || null,
      loginBgUrl: c.settings?.loginBgUrl || null,
      loginBgPosition: c.settings?.loginBgPosition || 'top center',
      primaryColor: c.settings?.primaryColor || null
    });
  } catch (error) {
    logger.error('Get branding error:', error);
    res.json({ name: 'My_Dr', logoUrl: null, loginBgUrl: null, loginBgPosition: 'top center', primaryColor: null });
  }
});

// Get clinic by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM clinics WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const c = result.rows[0];
    res.json({
      id: c.id,
      name: c.name,
      address: c.address,
      phone: c.phone,
      email: c.email,
      logoUrl: c.logo_url,
      settings: c.settings,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    });
  } catch (error) {
    logger.error('Get clinic error:', error);
    res.status(500).json({ error: 'Failed to get clinic' });
  }
});

// Create clinic (admin only)
router.post('/', authenticateToken, requireAdmin, uploadFields, [
  body('name').notEmpty().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, address, phone, email } = req.body;
  let { settings, logoUrl } = req.body;

  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings);
    } catch (e) {
      settings = {};
    }
  }

  // Handle uploaded files
  if (req.files?.logo?.[0]) {
    logoUrl = `${R2_PUBLIC_URL}/${req.files.logo[0].key}`;
  }
  if (req.files?.loginBg?.[0]) {
    settings = settings || {};
    settings.loginBgUrl = `${R2_PUBLIC_URL}/${req.files.loginBg[0].key}`;
  }

  try {
    const result = await query(
      `INSERT INTO clinics (name, address, phone, email, logo_url, settings)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, address, phone, email, logoUrl || null, settings || {}]
    );

    await logAudit(req.user.id, 'CREATE_CLINIC', 'clinics', result.rows[0].id, null, { name }, req);

    res.status(201).json({
      id: result.rows[0].id,
      name: result.rows[0].name
    });
  } catch (error) {
    logger.error('Create clinic error:', error);
    res.status(500).json({ error: 'Failed to create clinic' });
  }
});

// Update clinic
router.put('/:id', authenticateToken, requireAdmin, uploadFields, async (req, res) => {
  const { name, address, phone, email } = req.body;
  let { settings, logoUrl } = req.body;

  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings);
    } catch (e) {
      settings = {};
    }
  }

  // Handle uploaded files
  if (req.files?.logo?.[0]) {
    logoUrl = `${R2_PUBLIC_URL}/${req.files.logo[0].key}`;
  }
  if (req.files?.loginBg?.[0]) {
    settings = settings || {};
    settings.loginBgUrl = `${R2_PUBLIC_URL}/${req.files.loginBg[0].key}`;
  }

  try {
    const result = await query(
      `UPDATE clinics SET
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        logo_url = COALESCE($5, logo_url),
        settings = COALESCE($6, settings),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name, address, phone, email, logoUrl, settings, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    res.json({
      id: result.rows[0].id,
      name: result.rows[0].name
    });
  } catch (error) {
    logger.error('Update clinic error:', error);
    res.status(500).json({ error: 'Failed to update clinic' });
  }
});

// Get clinic doctors
router.get('/:id/doctors', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              d.id as doctor_id, d.medical_license, d.specialty, d.consultation_duration_minutes
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.clinic_id = $1 AND u.status = 'active'
       ORDER BY u.last_name, u.first_name`,
      [req.params.id]
    );

    res.json(result.rows.map(d => ({
      id: d.id,
      doctorId: d.doctor_id,
      firstName: d.first_name,
      lastName: d.last_name,
      email: d.email,
      phone: d.phone,
      medicalLicense: d.medical_license,
      specialty: d.specialty,
      consultationDuration: d.consultation_duration_minutes
    })));
  } catch (error) {
    logger.error('Get clinic doctors error:', error);
    res.status(500).json({ error: 'Failed to get doctors' });
  }
});

// Get clinic services
router.get('/:id/services', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM services WHERE clinic_id = $1 AND is_active = true ORDER BY name',
      [req.params.id]
    );

    res.json(result.rows.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      durationMinutes: s.duration_minutes
    })));
  } catch (error) {
    logger.error('Get clinic services error:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

// Create service
router.post('/:id/services', authenticateToken, requireAdmin, [
  body('name').notEmpty(),
  body('price').isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, price, durationMinutes } = req.body;

  try {
    const result = await query(
      `INSERT INTO services (clinic_id, name, description, price, duration_minutes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, name, description, price, durationMinutes]
    );

    res.status(201).json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      price: result.rows[0].price
    });
  } catch (error) {
    logger.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Get clinic stats
router.get('/:id/stats', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const clinicId = req.params.id;

    // Total patients
    const patientsResult = await query(
      'SELECT COUNT(*) FROM patients WHERE clinic_id = $1 AND is_active = true',
      [clinicId]
    );

    // Today's appointments
    const todayAppointmentsResult = await query(
      `SELECT COUNT(*) FROM appointments 
       WHERE clinic_id = $1 AND scheduled_date = CURRENT_DATE`,
      [clinicId]
    );

    // This month's consultations
    const monthConsultationsResult = await query(
      `SELECT COUNT(*) FROM consultations 
       WHERE clinic_id = $1 
       AND consultation_date >= DATE_TRUNC('month', CURRENT_DATE)`,
      [clinicId]
    );

    // Active doctors
    const doctorsResult = await query(
      `SELECT COUNT(*) FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.clinic_id = $1 AND u.status = 'active'`,
      [clinicId]
    );

    res.json({
      totalPatients: parseInt(patientsResult.rows[0].count),
      todayAppointments: parseInt(todayAppointmentsResult.rows[0].count),
      monthConsultations: parseInt(monthConsultationsResult.rows[0].count),
      activeDoctors: parseInt(doctorsResult.rows[0].count)
    });
  } catch (error) {
    logger.error('Get clinic stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
