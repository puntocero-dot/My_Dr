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
             d.medical_license, d.specialty, c.name as clinic_name,
             s.scope as secretary_scope, s.assigned_doctor_id
      FROM users u
      LEFT JOIN doctors d ON u.id = d.user_id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      LEFT JOIN secretaries s ON u.id = s.user_id
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
      clinicName: u.clinic_name,
      secretaryScope: u.secretary_scope || null,
      assignedDoctorId: u.assigned_doctor_id || null
    })));
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios: ' + error.message });
  }
});

// Get doctors list (MUST be before /:id to avoid route conflict)
router.get('/role/doctors', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    let sql = `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              d.id as doctor_id, d.medical_license, d.specialty, d.clinic_id,
              c.name as clinic_name
       FROM users u
       JOIN doctors d ON u.id = d.user_id
       LEFT JOIN clinics c ON d.clinic_id = c.id
       WHERE u.status = 'active' AND u.role = 'doctor'`;
       
    const params2 = [];
    if (req.user.role === 'secretary') {
      sql += ` AND d.clinic_id IN (SELECT clinic_id FROM secretary_clinics WHERE secretary_id = (SELECT id FROM secretaries WHERE user_id = $1))`;
      params2.push(req.user.id);
    }

    sql += ` ORDER BY u.last_name, u.first_name`;
    const result = await query(sql, params2);

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
      `SELECT u.*, d.id as doctor_id, d.medical_license, d.specialty, 
              COALESCE(d.clinic_id, sc.clinic_id) as clinic_id,
              COALESCE(c.name, c2.name) as clinic_name,
              s.scope as secretary_scope, s.assigned_doctor_id
       FROM users u
       LEFT JOIN doctors d ON u.id = d.user_id
       LEFT JOIN clinics c ON d.clinic_id = c.id
       LEFT JOIN secretaries s ON u.id = s.user_id
       LEFT JOIN secretary_clinics sc ON s.id = sc.secretary_id
       LEFT JOIN clinics c2 ON sc.clinic_id = c2.id
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
      clinicName: u.clinic_name,
      secretaryScope: u.secretary_scope || null,
      assignedDoctorId: u.assigned_doctor_id || null
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
      error: 'Error de validación: ' + errors.array().map(e => `${e.path || e.param || 'campo'}: ${e.msg}`).join(', ')
    });
  }

  const { email, password, firstName, lastName, role, phone, dui, clinicId, medicalLicense, specialty, scope, assignedDoctorId } = req.body;

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Check duplicate DUI
    if (dui) {
      const existingDui = await query('SELECT id FROM users WHERE dui = $1', [dui]);
      if (existingDui.rows.length > 0) {
        return res.status(400).json({ error: 'El número de DUI ya está registrado en otro usuario' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, dui)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, role, first_name, last_name`,
      [email, passwordHash, role, firstName, lastName, phone, dui ? dui.trim() : null]
    );

    const newUser = result.rows[0];

    // Create role-specific record
    if (role === 'doctor') {
      await query(
        `INSERT INTO doctors (user_id, clinic_id, medical_license, specialty)
         VALUES ($1, $2, $3, $4)`,
        [newUser.id, clinicId || null, medicalLicense || null, specialty || 'Pediatría']
      );
    } else if (role === 'parent') {
      await query('INSERT INTO parents (user_id) VALUES ($1)', [newUser.id]);
    } else if (role === 'secretary') {
      const validScope = scope === 'personal' ? 'personal' : 'clinic';
      const secResult = await query(
        `INSERT INTO secretaries (user_id, scope, assigned_doctor_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [newUser.id, validScope, (validScope === 'personal' && assignedDoctorId) ? assignedDoctorId : null]
      );
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
    // Handle PostgreSQL unique constraint violations
    if (error.code === '23505') {
      if (error.constraint === 'users_dui_key') {
        return res.status(400).json({ error: 'El número de DUI ya está registrado en otro usuario' });
      }
      if (error.constraint === 'users_email_key') {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      }
      return res.status(400).json({ error: 'Dato duplicado: este registro ya existe' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Update user
router.put('/:id', authenticateToken, requireAdmin, [
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('phone').optional(),
  body('status').optional().isIn(['active', 'inactive', 'suspended']),
  body('password').optional().isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, phone, status, dui, password, scope, assignedDoctorId } = req.body;

  try {
    const oldResult = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let queryStr = `UPDATE users SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        status = COALESCE($4, status),
        dui = COALESCE($5, dui),
        updated_at = CURRENT_TIMESTAMP`;
    
    const finalDui = (dui && dui.trim() !== '') ? dui.trim() : null;
    const params = [firstName, lastName, phone, status, finalDui];
    let paramIndex = 6;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      queryStr += `, password_hash = $${paramIndex}`;
      params.push(passwordHash);
      paramIndex++;
    }

    queryStr += ` WHERE id = $${paramIndex} RETURNING id, email, role, status, first_name, last_name, phone`;
    params.push(req.params.id);

    const result = await query(queryStr, params);

    // Update secretary-specific fields if applicable
    if (oldResult.rows[0].role === 'secretary') {
      if (scope !== undefined || assignedDoctorId !== undefined) {
        const validScope = scope === 'personal' ? 'personal' : 'clinic';
        await query(
          `UPDATE secretaries SET
             scope = $1,
             assigned_doctor_id = $2
           WHERE user_id = $3`,
          [validScope, (validScope === 'personal' && assignedDoctorId) ? assignedDoctorId : null, req.params.id]
        );
      }
      if (clinicId) {
        // Delete old clinic assignment and assign new one
        const secRes = await query('SELECT id FROM secretaries WHERE user_id = $1', [req.params.id]);
        if (secRes.rows.length > 0) {
          const secId = secRes.rows[0].id;
          await query('DELETE FROM secretary_clinics WHERE secretary_id = $1', [secId]);
          await query('INSERT INTO secretary_clinics (secretary_id, clinic_id) VALUES ($1, $2)', [secId, clinicId]);
        }
      }
    }

    await logAudit(req.user.id, 'UPDATE_USER', 'users', req.params.id, oldResult.rows[0], { ...result.rows[0], passwordChanged: !!password }, req);

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
    if (error.code === '23505' && error.constraint === 'users_dui_key') {
      return res.status(400).json({ error: 'El número de DUI ya está registrado en otro usuario' });
    }
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete user (smart delete: hard delete if no records, soft delete otherwise)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Attempt Hard Delete inside a transaction
    try {
      await query('BEGIN');
      // Remove auxiliary records
      await query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
      await query('DELETE FROM patient_parents WHERE parent_id IN (SELECT id FROM parents WHERE user_id = $1)', [userId]);
      await query('DELETE FROM parents WHERE user_id = $1', [userId]);
      await query('DELETE FROM secretary_clinics WHERE secretary_id IN (SELECT id FROM secretaries WHERE user_id = $1)', [userId]);
      await query('DELETE FROM secretaries WHERE user_id = $1', [userId]);
      // If the doctor has consultations, THIS next line will throw a 23503 foreign_key_violation
      await query('DELETE FROM doctors WHERE user_id = $1', [userId]);
      await query('DELETE FROM revoked_tokens WHERE token IN (SELECT token FROM revoked_tokens WHERE token = $1)', ['invalid']); // Dummy query or cleanup if needed
      
      // Finally delete user
      await query('DELETE FROM users WHERE id = $1', [userId]);
      await query('COMMIT');
      
      await logAudit(req.user.id, 'DELETE_USER', 'users', userId, null, null, req);
      return res.json({ message: 'Usuario eliminado permanentemente del sistema', hardDelete: true });
    } catch (dbError) {
      await query('ROLLBACK');
      // 23503 is foreign_key_violation
      if (dbError.code === '23503') {
        // Fallback to Soft Delete
        await query(`UPDATE users SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);
        await logAudit(req.user.id, 'SOFT_DELETE_USER', 'users', userId, null, null, req);
        return res.json({ message: 'Usuario desactivado (tiene historial médico retenido)', softDelete: true });
      }
      throw dbError; // Rethrow if it's not a FK violation
    }
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

module.exports = router;
