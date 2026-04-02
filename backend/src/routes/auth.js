const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Stricter rate limit for login to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // Reduced to 5 minutes
  max: 20, // Increased to 20 requests per window during testing/stable config
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor, intente de nuevo después de 5 minutos.' },
  keyGenerator: (req) => {
    // Trust proxy logic might be needed if behind a load balancer
    const ip = req.headers['x-forwarded-for'] || req.ip;
    return req.body.email ? `${ip}_${req.body.email}` : ip;
  }
});

// Login
router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await query(
      `SELECT u.*, d.id as doctor_id, d.clinic_id, d.medical_license, d.specialty
       FROM users u
       LEFT JOIN doctors d ON u.id = d.user_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Usuario desactivado: Contacte a soporte' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Security Alert: Log failed attempt for admins
      const failedEmail = email;
      try {
        const admins = await query("SELECT id FROM users WHERE role = 'admin'");
        for (const admin of admins.rows) {
          await query(
            `INSERT INTO notifications (user_id, type, title, message, data)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              admin.id, 
              'SECURITY_ALERT', 
              'Intento de Acceso Fallido', 
              `Se detectó un intento de inicio de sesión fallido para el correo: ${failedEmail}. Posible actividad sospechosa.`,
              JSON.stringify({ attemptedEmail: failedEmail, timestamp: new Date() })
            ]
          );
        }
      } catch (logLimitErr) {
        logger.error('Failed to log security notification:', logLimitErr);
      }
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Update last login
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await logAudit(user.id, 'LOGIN', 'users', user.id, null, null, req);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        profileImageUrl: user.profile_image_url,
        doctorId: user.doctor_id,
        clinicId: user.clinic_id,
        medicalLicense: user.medical_license,
        specialty: user.specialty
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register (admin only or self-registration for parents)
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('role').isIn(['admin', 'doctor', 'secretary', 'insurer', 'parent'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, firstName, lastName, role, phone, dui } = req.body;

  try {
    // Check if email exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
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
    if (role === 'parent') {
      await query('INSERT INTO parents (user_id) VALUES ($1)', [newUser.id]);
    } else if (role === 'secretary') {
      await query('INSERT INTO secretaries (user_id) VALUES ($1)', [newUser.id]);
    }

    logger.info(`New user registered: ${email} with role ${role}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Logout (Revoke token)
router.post('/logout', authenticateToken, async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const decoded = jwt.decode(token);
    const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO revoked_tokens (token, expires_at) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING`,
      [token, expiresAt]
    );

    // Optional: Cleanup old tokens occasionally
    if (Math.random() < 0.1) {
      await query('SELECT cleanup_revoked_tokens()').catch(err => logger.error('Cleanup error', err));
    }

    await logAudit(req.user.id, 'LOGOUT', 'users', req.user.id, null, null, req);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, d.id as doctor_id, d.clinic_id, d.medical_license, d.specialty,
              c.name as clinic_name,
              s.scope as secretary_scope, s.assigned_doctor_id
       FROM users u
       LEFT JOIN doctors d ON u.id = d.user_id
       LEFT JOIN clinics c ON d.clinic_id = c.id
       LEFT JOIN secretaries s ON u.id = s.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      profileImageUrl: user.profile_image_url,
      doctorId: user.doctor_id,
      clinicId: user.clinic_id,
      clinicName: user.clinic_name,
      medicalLicense: user.medical_license,
      specialty: user.specialty,
      secretaryScope: user.secretary_scope || null,
      assignedDoctorId: user.assigned_doctor_id || null
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update own profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, phone } = req.body;

  try {
    const result = await query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, role, first_name, last_name, phone`,
      [firstName || null, lastName || null, phone !== undefined ? phone : null, req.user.id]
    );

    await logAudit(req.user.id, 'UPDATE_PROFILE', 'users', req.user.id, null, { firstName, lastName, phone }, req);

    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      role: u.role,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
      [newPasswordHash, req.user.id]);

    await logAudit(req.user.id, 'PASSWORD_CHANGE', 'users', req.user.id, null, null, req);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
