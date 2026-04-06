const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Helper: get doctor id from user id
async function getDoctorId(userId) {
  const res = await query('SELECT id FROM doctors WHERE user_id = $1', [userId]);
  return res.rows[0]?.id || null;
}

// Helper: secretary can authorize if they have access to from_doctor
async function secretaryCanAuthorize(userId, fromDoctorId) {
  const sec = await query(
    `SELECT s.scope, s.assigned_doctor_id
     FROM secretaries s WHERE s.user_id = $1`,
    [userId]
  );
  if (sec.rows.length === 0) return false;
  const { scope, assigned_doctor_id } = sec.rows[0];
  if (scope === 'personal') return assigned_doctor_id === fromDoctorId;
  // scope = clinic: verify from_doctor is in same clinic as secretary
  const clinicCheck = await query(
    `SELECT 1 FROM secretary_clinics sc
     JOIN doctors d ON d.clinic_id = sc.clinic_id
     WHERE sc.secretary_id = (SELECT id FROM secretaries WHERE user_id = $1)
       AND d.id = $2`,
    [userId, fromDoctorId]
  );
  return clinicCheck.rows.length > 0;
}

// GET /api/referrals?patientId=&status=
// Doctors see referrals where they are from or to; secretaries see by clinic
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { patientId, status } = req.query;
    let sql = `
      SELECT r.*,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             fu.first_name as from_doctor_first_name, fu.last_name as from_doctor_last_name,
             tu.first_name as to_doctor_first_name, tu.last_name as to_doctor_last_name,
             au.first_name as authorized_by_first_name, au.last_name as authorized_by_last_name,
             r.to_external_doctor_name
      FROM referrals r
      JOIN patients p ON r.patient_id = p.id
      JOIN doctors fd ON r.from_doctor_id = fd.id
      JOIN users fu ON fd.user_id = fu.id
      JOIN doctors td ON r.to_doctor_id = td.id
      JOIN users tu ON td.user_id = tu.id
      LEFT JOIN users au ON r.authorized_by = au.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (req.user.role === 'doctor') {
      const doctorId = await getDoctorId(req.user.id);
      if (!doctorId) return res.json([]);
      sql += ` AND (r.from_doctor_id = $${idx} OR r.to_doctor_id = $${idx})`;
      params.push(doctorId);
      idx++;
    }

    if (patientId) {
      sql += ` AND r.patient_id = $${idx++}`;
      params.push(patientId);
    }

    if (status) {
      sql += ` AND r.status = $${idx++}`;
      params.push(status);
    }

    sql += ' ORDER BY r.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows.map(r => ({
      id: r.id,
      patientId: r.patient_id,
      patientName: `${r.patient_first_name} ${r.patient_last_name}`,
      fromDoctorId: r.from_doctor_id,
      fromDoctorName: `${r.from_doctor_first_name} ${r.from_doctor_last_name}`,
      toDoctorId: r.to_doctor_id,
      toDoctorName: `${r.to_doctor_first_name} ${r.to_doctor_last_name}`,
      authorizedBy: r.authorized_by,
      authorizedByName: r.authorized_by_first_name
        ? `${r.authorized_by_first_name} ${r.authorized_by_last_name}`
        : null,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      toExternalDoctorName: r.to_external_doctor_name,
      createdAt: r.created_at
    })));
  } catch (error) {
    logger.error('Get referrals error:', error);
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

// POST /api/referrals — doctor or secretary creates a referral
router.post('/', authenticateToken, [
  body('patientId').isUUID(),
  body('toDoctorId').optional({ nullable: true }).isUUID(),
  body('toExternalDoctorName').optional().trim(),
  body('reason').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { patientId, toDoctorId, toExternalDoctorName, reason, notes } = req.body;

  try {
    let fromDoctorId;

    if (req.user.role === 'doctor') {
      fromDoctorId = await getDoctorId(req.user.id);
      if (!fromDoctorId) return res.status(403).json({ error: 'Doctor profile not found' });

      // Doctor must own the patient
      const owns = await query(
        'SELECT 1 FROM patients WHERE id = $1 AND doctor_id = $2',
        [patientId, fromDoctorId]
      );
      if (owns.rows.length === 0) {
        return res.status(403).json({ error: 'You can only refer your own patients' });
      }
    } else if (req.user.role === 'secretary' || req.user.role === 'admin') {
      // Secretary/admin must supply fromDoctorId in body
      const { fromDoctorId: fdId } = req.body;
      if (!fdId) return res.status(400).json({ error: 'fromDoctorId is required for secretary/admin' });
      fromDoctorId = fdId;

      if (req.user.role === 'secretary') {
        const canAuth = await secretaryCanAuthorize(req.user.id, fromDoctorId);
        if (!canAuth) return res.status(403).json({ error: 'Access denied to this doctor' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (fromDoctorId === toDoctorId) {
      return res.status(400).json({ error: 'Cannot refer to the same doctor' });
    }

    // Avoid duplicate active referrals for same patient+to_doctor
    const dup = await query(
      `SELECT id FROM referrals
       WHERE patient_id = $1 AND to_doctor_id = $2 AND status = 'active'`,
      [patientId, toDoctorId]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'An active referral to this doctor already exists' });
    }

    const result = await query(
      `INSERT INTO referrals (patient_id, from_doctor_id, to_doctor_id, to_external_doctor_name, authorized_by, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [patientId, fromDoctorId, toDoctorId || null, toExternalDoctorName || null, req.user.id, reason || null, notes || null]
    );

    await logAudit(req.user.id, 'CREATE_REFERRAL', 'referrals', result.rows[0].id, null,
      { patientId, fromDoctorId, toDoctorId }, req);

    res.status(201).json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (error) {
    logger.error('Create referral error:', error);
    res.status(500).json({ error: 'Failed to create referral' });
  }
});

// PATCH /api/referrals/:id/status — doctor who owns the referral or admin can update
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['active', 'completed', 'revoked'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { status } = req.body;

  try {
    const ref = await query('SELECT * FROM referrals WHERE id = $1', [req.params.id]);
    if (ref.rows.length === 0) return res.status(404).json({ error: 'Referral not found' });

    if (req.user.role === 'doctor') {
      const doctorId = await getDoctorId(req.user.id);
      if (ref.rows[0].from_doctor_id !== doctorId && ref.rows[0].to_doctor_id !== doctorId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (req.user.role === 'secretary') {
      const canAuth = await secretaryCanAuthorize(req.user.id, ref.rows[0].from_doctor_id);
      if (!canAuth) return res.status(403).json({ error: 'Access denied' });
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      'UPDATE referrals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    await logAudit(req.user.id, 'UPDATE_REFERRAL_STATUS', 'referrals', req.params.id,
      ref.rows[0], { status }, req);

    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (error) {
    logger.error('Update referral status error:', error);
    res.status(500).json({ error: 'Failed to update referral' });
  }
});

module.exports = router;
