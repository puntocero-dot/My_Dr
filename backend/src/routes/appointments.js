const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireMedicalStaff, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Get appointments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { doctorId, clinicId, patientId, date, startDate, endDate, status } = req.query;

    let sql = `
      SELECT a.*,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             p.date_of_birth as patient_dob, p.allergies as patient_allergies,
             u.first_name as doctor_first_name, u.last_name as doctor_last_name,
             d.specialty as doctor_specialty
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filter by role
    if (req.user.role === 'doctor') {
      const doctorResult = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (doctorResult.rows.length > 0) {
        sql += ` AND a.doctor_id = $${paramIndex++}`;
        params.push(doctorResult.rows[0].id);
      }
    } else if (req.user.role === 'parent') {
      const parentResult = await query('SELECT id FROM parents WHERE user_id = $1', [req.user.id]);
      if (parentResult.rows.length > 0) {
        sql += ` AND a.parent_id = $${paramIndex++}`;
        params.push(parentResult.rows[0].id);
      }
    }

    if (doctorId) {
      sql += ` AND a.doctor_id = $${paramIndex++}`;
      params.push(doctorId);
    }

    if (clinicId) {
      sql += ` AND a.clinic_id = $${paramIndex++}`;
      params.push(clinicId);
    }

    if (patientId) {
      sql += ` AND a.patient_id = $${paramIndex++}`;
      params.push(patientId);
    }

    if (date) {
      sql += ` AND a.scheduled_date = $${paramIndex++}`;
      params.push(date);
    }

    if (startDate && endDate) {
      sql += ` AND a.scheduled_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    if (status) {
      sql += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY a.scheduled_date, a.scheduled_time';

    const result = await query(sql, params);

    res.json(result.rows.map(a => ({
      id: a.id,
      clinicId: a.clinic_id,
      doctorId: a.doctor_id,
      patientId: a.patient_id,
      parentId: a.parent_id,
      scheduledDate: a.scheduled_date,
      scheduledTime: a.scheduled_time,
      durationMinutes: a.duration_minutes,
      type: a.type,
      status: a.status,
      reason: a.reason,
      preVisitInstructions: a.pre_visit_instructions,
      notes: a.notes,
      confirmedAt: a.confirmed_at,
      checkedInAt: a.checked_in_at,
      patient: {
        firstName: a.patient_first_name,
        lastName: a.patient_last_name,
        dateOfBirth: a.patient_dob,
        allergies: a.patient_allergies
      },
      doctor: {
        firstName: a.doctor_first_name,
        lastName: a.doctor_last_name,
        specialty: a.doctor_specialty
      }
    })));
  } catch (error) {
    logger.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to get appointments' });
  }
});

// Get appointment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*,
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.date_of_birth as patient_dob, p.allergies, p.chronic_conditions,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name,
              d.specialty, c.name as clinic_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN clinics c ON a.clinic_id = c.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const a = result.rows[0];
    res.json({
      id: a.id,
      clinicId: a.clinic_id,
      clinicName: a.clinic_name,
      doctorId: a.doctor_id,
      patientId: a.patient_id,
      scheduledDate: a.scheduled_date,
      scheduledTime: a.scheduled_time,
      durationMinutes: a.duration_minutes,
      type: a.type,
      status: a.status,
      reason: a.reason,
      preVisitInstructions: a.pre_visit_instructions,
      notes: a.notes,
      patient: {
        firstName: a.patient_first_name,
        lastName: a.patient_last_name,
        dateOfBirth: a.patient_dob,
        allergies: a.allergies,
        chronicConditions: a.chronic_conditions
      },
      doctor: {
        firstName: a.doctor_first_name,
        lastName: a.doctor_last_name,
        specialty: a.specialty
      }
    });
  } catch (error) {
    logger.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to get appointment' });
  }
});

// Create appointment
router.post('/', authenticateToken, [
  body('doctorId').isUUID(),
  body('patientId').isUUID(),
  body('scheduledDate').isDate(),
  body('scheduledTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('type').isIn(['first_visit', 'follow_up', 'emergency', 'vaccination', 'teleconsultation'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Error de validación: ' + errors.array().map(e => `${e.path || e.param || 'campo'}: ${e.msg}`).join(', ')
    });
  }

  const {
    clinicId, doctorId, patientId, parentId, scheduledDate, scheduledTime,
    durationMinutes, type, reason, preVisitInstructions, notes
  } = req.body;

  // Sanitize clinicId: empty string -> null to avoid UUID cast error
  const safeClinicId = clinicId && clinicId.length > 0 ? clinicId : null;
  const safeParentId = parentId && parentId.length > 0 ? parentId : null;

  try {
    // Check for conflicts
    const conflictCheck = await query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND scheduled_date = $2 AND scheduled_time = $3
       AND status NOT IN ('cancelled')`,
      [doctorId, scheduledDate, scheduledTime]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }

    // Get doctor's default duration if not provided
    let duration = durationMinutes;
    if (!duration) {
      const doctorResult = await query('SELECT consultation_duration_minutes FROM doctors WHERE id = $1', [doctorId]);
      duration = doctorResult.rows[0]?.consultation_duration_minutes || 30;
    }

    const result = await query(
      `INSERT INTO appointments (
        clinic_id, doctor_id, patient_id, parent_id, scheduled_date, scheduled_time,
        duration_minutes, type, reason, pre_visit_instructions, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [safeClinicId, doctorId, patientId, safeParentId, scheduledDate, scheduledTime,
        duration, type, reason, preVisitInstructions, notes, req.user.id]
    );

    await logAudit(req.user.id, 'CREATE_APPOINTMENT', 'appointments', result.rows[0].id, null, { patientId, scheduledDate }, req);

    res.status(201).json({
      id: result.rows[0].id,
      scheduledDate: result.rows[0].scheduled_date,
      scheduledTime: result.rows[0].scheduled_time,
      status: result.rows[0].status,
      type: result.rows[0].type
    });
  } catch (error) {
    logger.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment status
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
], async (req, res) => {
  const { status } = req.body;

  try {
    let updateFields = 'status = $1, updated_at = CURRENT_TIMESTAMP';
    const params = [status, req.params.id];

    if (status === 'confirmed') {
      updateFields += ', confirmed_at = CURRENT_TIMESTAMP';
    } else if (status === 'in_progress') {
      updateFields += ', checked_in_at = CURRENT_TIMESTAMP, started_at = CURRENT_TIMESTAMP';
    } else if (status === 'completed') {
      updateFields += ', completed_at = CURRENT_TIMESTAMP';
    }

    const result = await query(
      `UPDATE appointments SET ${updateFields} WHERE id = $2 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await logAudit(req.user.id, 'UPDATE_APPOINTMENT_STATUS', 'appointments', req.params.id, null, { status }, req);

    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (error) {
    logger.error('Update appointment status error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Reschedule appointment
router.patch('/:id/reschedule', authenticateToken, [
  body('scheduledDate').isDate(),
  body('scheduledTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
], async (req, res) => {
  const { scheduledDate, scheduledTime } = req.body;

  try {
    // Get current appointment
    const current = await query('SELECT doctor_id FROM appointments WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check for conflicts
    const conflictCheck = await query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND scheduled_date = $2 AND scheduled_time = $3
       AND id != $4 AND status NOT IN ('cancelled')`,
      [current.rows[0].doctor_id, scheduledDate, scheduledTime, req.params.id]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }

    const result = await query(
      `UPDATE appointments SET 
        scheduled_date = $1, scheduled_time = $2, 
        status = 'scheduled', confirmed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [scheduledDate, scheduledTime, req.params.id]
    );

    await logAudit(req.user.id, 'RESCHEDULE_APPOINTMENT', 'appointments', req.params.id, null, { scheduledDate, scheduledTime }, req);

    res.json({
      id: result.rows[0].id,
      scheduledDate: result.rows[0].scheduled_date,
      scheduledTime: result.rows[0].scheduled_time,
      status: result.rows[0].status
    });
  } catch (error) {
    logger.error('Reschedule appointment error:', error);
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
});

// Get available slots for a doctor on a date
router.get('/slots/:doctorId/:date', authenticateToken, async (req, res) => {
  try {
    const { doctorId, date } = req.params;

    // Get doctor's schedule
    const dayOfWeek = new Date(date).getDay();
    const scheduleResult = await query(
      `SELECT start_time, end_time FROM schedule_blocks 
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true`,
      [doctorId, dayOfWeek]
    );

    // Get doctor's consultation duration
    const doctorResult = await query(
      'SELECT consultation_duration_minutes FROM doctors WHERE id = $1',
      [doctorId]
    );
    const duration = doctorResult.rows[0]?.consultation_duration_minutes || 30;

    // Get booked appointments
    const bookedResult = await query(
      `SELECT scheduled_time, duration_minutes FROM appointments 
       WHERE doctor_id = $1 AND scheduled_date = $2 AND status NOT IN ('cancelled')`,
      [doctorId, date]
    );

    const bookedSlots = bookedResult.rows.map(a => a.scheduled_time);

    // Generate available slots (default 8am-5pm if no schedule)
    const startHour = scheduleResult.rows[0]?.start_time || '08:00';
    const endHour = scheduleResult.rows[0]?.end_time || '17:00';

    const slots = [];
    let currentTime = new Date(`2000-01-01T${startHour}`);
    const endTime = new Date(`2000-01-01T${endHour}`);

    while (currentTime < endTime) {
      const timeStr = currentTime.toTimeString().slice(0, 5);
      if (!bookedSlots.includes(timeStr + ':00')) {
        slots.push(timeStr);
      }
      currentTime.setMinutes(currentTime.getMinutes() + duration);
    }

    res.json({ date, doctorId, duration, availableSlots: slots });
  } catch (error) {
    logger.error('Get available slots error:', error);
    res.status(500).json({ error: 'Failed to get available slots' });
  }
});

// Today's appointments (for dashboard)
router.get('/today/list', authenticateToken, async (req, res) => {
  try {
    let doctorFilter = '';
    const params = [];

    if (req.user.role === 'doctor') {
      const doctorResult = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (doctorResult.rows.length > 0) {
        doctorFilter = 'AND a.doctor_id = $1';
        params.push(doctorResult.rows[0].id);
      }
    }

    const result = await query(
      `SELECT a.*, p.first_name, p.last_name, p.date_of_birth, p.allergies
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.scheduled_date = CURRENT_DATE ${doctorFilter}
       ORDER BY a.scheduled_time`,
      params
    );

    res.json(result.rows.map(a => ({
      id: a.id,
      scheduledTime: a.scheduled_time,
      status: a.status,
      type: a.type,
      reason: a.reason,
      patient: {
        id: a.patient_id,
        firstName: a.first_name,
        lastName: a.last_name,
        dateOfBirth: a.date_of_birth,
        allergies: a.allergies
      }
    })));
  } catch (error) {
    logger.error('Get today appointments error:', error);
    res.status(500).json({ error: 'Failed to get appointments' });
  }
});

module.exports = router;
