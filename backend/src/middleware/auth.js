const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../config/logger');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const revokedCheck = await query('SELECT token FROM revoked_tokens WHERE token = $1', [token]);
    if (revokedCheck.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query(
      'SELECT id, email, role, status, first_name, last_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (result.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${req.user.role}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requireAnyRole = (...roles) => requireRole(...roles);

const requireAdmin = requireRole('admin');
const requireDoctor = requireRole('doctor');
const requireSecretary = requireRole('secretary');
const requireMedicalStaff = requireRole('admin', 'doctor', 'secretary');

module.exports = {
  authenticateToken,
  requireRole,
  requireAnyRole,
  requireAdmin,
  requireDoctor,
  requireSecretary,
  requireMedicalStaff
};
