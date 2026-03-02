const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireAdmin, requireMedicalStaff } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, status, search } = req.query;
    
    let sql = `
      SELECT u.id, u.email, u.role, u.status, u.first_name, u.last_name, 
             u.phone, u.dui, u.created_at, u.last_login,
             d.medical_license, d.specialty, c.name as clinic_name
      FROM users u
      LEFT JOIN doctors d ON u.id = d.user_id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (role) {
      sql += ` AND u.role = $${paramIndex++}`;
      params.push(role);
    }

    if (status) {
      sql += ` AND u.status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ' ORDER BY u.created_at DESC';

    const result = await query(sql, params);

    res.json(result.rows.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      dui: u.dui,
      createdAt: u.created_at,
      lastLogin: u.last_login,
      medicalLicense: u.medical_license,
      specialty: u.specialty,
      clinicName: u.clinic_name
    })));
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios: ' + error.message });
  }
});

// Get doctors list (MUST be before /:id to avoid route conflict)
router.get('/role/doctors', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              d.id as doctor_id, d.medical_license, d.specialty, d.clinic_id,
              c.name as clinic_name
       FROM users u
       JOIN doctors d ON u.id = d.user_id
       LEFT JOIN clinics c ON d.clinic_id = c.id
       WHERE u.status = 'active'
       ORDER BY u.last_name, u.first_name`
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
      clinicId: d.clinic_id,
      clinicName: d.clinic_name
    })));
  } catch (error) {
    logger.error('Get doctors error:', error);
    res.status(500).json({ error: 'Error al obtener doctores' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, d.id as doctor_id, d.medical_license, d.specialty, d.clinic_id,
              c.name as clinic_name
       FROM users u
       LEFT JOIN doctors d ON u.id = d.user_id
       LEFT JOIN clinics c ON d.clinic_id = c.id
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      dui: u.dui,
      profileImageUrl: u.profile_image_url,
      createdAt: u.created_at,
      doctorId: u.doctor_id,
      medicalLicense: u.medical_license,
      specialty: u.specialty,
      clinicId: u.clinic_id,
      clinicName: u.clinic_name
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create user (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('role').isIn(['admin', 'doctor', 'secretary', 'insurer', 'parent'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Error de validación: ' + errors.array().map(e => `${e.param}: ${e.msg}`).join(', ') 
    });
  }

  const { email, password, firstName, lastName, role, phone, dui, clinicId, medicalLicense, specialty } = req.body;

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, dui)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, role, first_name, last_name`,
      [email, passwordHash, role, firstName, lastName, phone, dui]
    );

    const newUser = result.rows[0];

    // Create role-specific record
    if (role === 'doctor' && medicalLicense) {
      await query(
        `INSERT INTO doctors (user_id, clinic_id, medical_license, specialty)
         VALUES ($1, $2, $3, $4)`,
        [newUser.id, clinicId, medicalLicense, specialty || 'Pediatría']
      );
    } else if (role === 'parent') {
      await query('INSERT INTO parents (user_id) VALUES ($1)', [newUser.id]);
    } else if (role === 'secretary') {
      const secResult = await query('INSERT INTO secretaries (user_id) VALUES ($1) RETURNING id', [newUser.id]);
      if (clinicId) {
        await query('INSERT INTO secretary_clinics (secretary_id, clinic_id) VALUES ($1, $2)', 
          [secResult.rows[0].id, clinicId]);
      }
    }

    await logAudit(req.user.id, 'CREATE_USER', 'users', newUser.id, null, { email, role }, req);

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      firstName: newUser.first_name,
      lastName: newUser.last_name
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ error: 'Error al crear usuario: ' + error.message });
  }
});

// Update user
router.put('/:id', authenticateToken, requireAdmin, [
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('phone').optional(),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, phone, status, dui } = req.body;

  try {
    const oldResult = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await query(
      `UPDATE users SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        status = COALESCE($4, status),
        dui = COALESCE($5, dui),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, email, role, status, first_name, last_name, phone`,
      [firstName, lastName, phone, status, dui, req.params.id]
    );

    await logAudit(req.user.id, 'UPDATE_USER', 'users', req.params.id, oldResult.rows[0], result.rows[0], req);

    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (soft delete - set inactive)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `UPDATE users SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logAudit(req.user.id, 'DELETE_USER', 'users', req.params.id, null, null, req);

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
