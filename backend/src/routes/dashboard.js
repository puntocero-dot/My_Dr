const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole, requireMedicalStaff } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Doctor dashboard
router.get('/doctor', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    // Get doctor ID
    const doctorResult = await query('SELECT id, clinic_id FROM doctors WHERE user_id = $1', [req.user.id]);
    
    if (doctorResult.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const doctorId = doctorResult.rows[0]?.id;
    const clinicId = doctorResult.rows[0]?.clinic_id;

    if (req.user.role === 'doctor' && !doctorId) {
      return res.status(403).json({ error: 'Doctor record required' });
    }

    // Today's appointments
    const todayAppointments = await query(
      `SELECT a.*, p.first_name, p.last_name, p.date_of_birth, p.allergies
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = $1 AND a.scheduled_date = CURRENT_DATE
       ORDER BY a.scheduled_time`,
      [doctorId]
    );

    // Patients seen today
    const patientsToday = await query(
      `SELECT COUNT(*) FROM consultations 
       WHERE doctor_id = $1 AND DATE(consultation_date) = CURRENT_DATE`,
      [doctorId]
    );

    // Patients this week
    const patientsWeek = await query(
      `SELECT COUNT(*) FROM consultations 
       WHERE doctor_id = $1 
       AND consultation_date >= DATE_TRUNC('week', CURRENT_DATE)`,
      [doctorId]
    );

    // Patients this month
    const patientsMonth = await query(
      `SELECT COUNT(*) FROM consultations 
       WHERE doctor_id = $1 
       AND consultation_date >= DATE_TRUNC('month', CURRENT_DATE)`,
      [doctorId]
    );

    // Top diagnoses this month
    const topDiagnoses = await query(
      `SELECT unnest(diagnosis_descriptions) as diagnosis, COUNT(*) as count
       FROM consultations
       WHERE doctor_id = $1 
       AND consultation_date >= DATE_TRUNC('month', CURRENT_DATE)
       AND diagnosis_descriptions IS NOT NULL
       GROUP BY diagnosis
       ORDER BY count DESC
       LIMIT 5`,
      [doctorId]
    );

    // Pending appointments (not completed)
    const pendingCount = await query(
      `SELECT COUNT(*) FROM appointments 
       WHERE doctor_id = $1 AND scheduled_date = CURRENT_DATE 
       AND status NOT IN ('completed', 'cancelled', 'no_show')`,
      [doctorId]
    );

    // Recent patients
    const recentPatients = await query(
      `SELECT DISTINCT ON (p.id) p.id, p.first_name, p.last_name, p.date_of_birth,
              c.consultation_date, c.diagnosis_descriptions
       FROM consultations c
       JOIN patients p ON c.patient_id = p.id
       WHERE c.doctor_id = $1
       ORDER BY p.id, c.consultation_date DESC
       LIMIT 5`,
      [doctorId]
    );

    res.json({
      todayAppointments: todayAppointments.rows.map(a => ({
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
      })),
      stats: {
        patientsToday: parseInt(patientsToday.rows[0].count),
        patientsWeek: parseInt(patientsWeek.rows[0].count),
        patientsMonth: parseInt(patientsMonth.rows[0].count),
        pendingToday: parseInt(pendingCount.rows[0].count)
      },
      topDiagnoses: topDiagnoses.rows.map(d => ({
        diagnosis: d.diagnosis,
        count: parseInt(d.count)
      })),
      recentPatients: recentPatients.rows.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        dateOfBirth: p.date_of_birth,
        lastVisit: p.consultation_date,
        lastDiagnosis: p.diagnosis_descriptions
      }))
    });
  } catch (error) {
    logger.error('Doctor dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Admin dashboard
router.get('/admin', authenticateToken, requireRole('admin'), async (req, res) => {
  const { clinicId, doctorId } = req.query;
  const whereProject = clinicId ? ` AND clinic_id = '${clinicId}'` : '';
  const whereDoctor = doctorId ? ` AND doctor_id = '${doctorId}'` : '';
  const whereCombined = whereProject + whereDoctor;
  
  try {
    // Total users by role - only filtered by clinic if it's medical staff related
    // For simplicity, we keep users global for now or filter doctors by clinic
    const usersByRoleQuery = clinicId 
      ? `SELECT role, COUNT(*) FROM users 
         WHERE (role != 'doctor' AND status = 'active') 
         OR (role = 'doctor' AND id IN (SELECT user_id FROM doctors WHERE clinic_id = $1))
         GROUP BY role`
      : `SELECT role, COUNT(*) FROM users WHERE status = 'active' GROUP BY role`;
    const usersByRoleParams = clinicId ? [clinicId] : [];
    const usersByRole = await query(usersByRoleQuery, usersByRoleParams);

    // Total patients
    const totalPatients = await query(
      `SELECT COUNT(*) FROM patients WHERE is_active = true ${whereCombined}`
    );

    // Appointments today
    const appointmentsToday = await query(
      `SELECT COUNT(*) FROM appointments WHERE scheduled_date = CURRENT_DATE ${whereCombined}`
    );

    // Consultations this month
    const consultationsMonth = await query(
      `SELECT COUNT(*) FROM consultations 
       WHERE consultation_date >= DATE_TRUNC('month', CURRENT_DATE) ${whereCombined}`
    );

    // New patients this month
    const newPatientsMonth = await query(
      `SELECT COUNT(*) FROM patients 
       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) ${whereCombined}`
    );

    // Appointments by status today
    const appointmentsByStatus = await query(
      `SELECT status, COUNT(*) FROM appointments 
       WHERE scheduled_date = CURRENT_DATE ${whereCombined}
       GROUP BY status`
    );

    // Top diagnoses this month
    const topDiagnoses = await query(
      `SELECT unnest(diagnosis_descriptions) as diagnosis, COUNT(*) as count
       FROM consultations
       WHERE consultation_date >= DATE_TRUNC('month', CURRENT_DATE) ${whereCombined}
       AND diagnosis_descriptions IS NOT NULL
       GROUP BY diagnosis
       ORDER BY count DESC
       LIMIT 10`
    );

    // Consultations per day (last 7 days)
    const consultationsPerDay = await query(
      `SELECT DATE(consultation_date) as date, COUNT(*) as count
       FROM consultations
       WHERE consultation_date >= CURRENT_DATE - INTERVAL '7 days' ${whereCombined}
       GROUP BY DATE(consultation_date)
       ORDER BY date`
    );

    // Clinics summary
    const clinicsSummary = await query(
      `SELECT c.id, c.name,
              (SELECT COUNT(*) FROM doctors d WHERE d.clinic_id = c.id) as doctors,
              (SELECT COUNT(*) FROM patients p WHERE p.clinic_id = c.id) as patients,
              (SELECT COUNT(*) FROM appointments a WHERE a.clinic_id = c.id AND a.scheduled_date = CURRENT_DATE) as today_appointments
       FROM clinics c`
    );

    res.json({
      usersByRole: usersByRole.rows.reduce((acc, r) => {
        acc[r.role] = parseInt(r.count);
        return acc;
      }, {}),
      stats: {
        totalPatients: parseInt(totalPatients.rows[0].count),
        appointmentsToday: parseInt(appointmentsToday.rows[0].count),
        consultationsMonth: parseInt(consultationsMonth.rows[0].count),
        newPatientsMonth: parseInt(newPatientsMonth.rows[0].count)
      },
      appointmentsByStatus: appointmentsByStatus.rows.reduce((acc, r) => {
        acc[r.status] = parseInt(r.count);
        return acc;
      }, {}),
      topDiagnoses: topDiagnoses.rows.map(d => ({
        diagnosis: d.diagnosis,
        count: parseInt(d.count)
      })),
      consultationsPerDay: consultationsPerDay.rows.map(d => ({
        date: d.date,
        count: parseInt(d.count)
      })),
      clinics: clinicsSummary.rows.map(c => ({
        id: c.id,
        name: c.name,
        doctors: parseInt(c.doctors),
        patients: parseInt(c.patients),
        todayAppointments: parseInt(c.today_appointments)
      }))
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Secretary dashboard
router.get('/secretary', authenticateToken, requireRole('secretary', 'admin'), async (req, res) => {
  try {
    // Get secretary's clinics
    let clinicIds = [];
    if (req.user.role === 'secretary') {
      const secretaryResult = await query(
        `SELECT sc.clinic_id FROM secretary_clinics sc
         JOIN secretaries s ON sc.secretary_id = s.id
         WHERE s.user_id = $1`,
        [req.user.id]
      );
      clinicIds = secretaryResult.rows.map(r => r.clinic_id);
    }

    const clinicFilter = clinicIds.length > 0 
      ? `AND a.clinic_id = ANY($1)` 
      : '';
    const params = clinicIds.length > 0 ? [clinicIds] : [];

    // Today's appointments
    const todayAppointments = await query(
      `SELECT a.*, p.first_name, p.last_name, p.phone as patient_phone,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE a.scheduled_date = CURRENT_DATE ${clinicFilter}
       ORDER BY a.scheduled_time`,
      params
    );

    // Pending confirmations
    const pendingConfirmations = await query(
      `SELECT COUNT(*) FROM appointments 
       WHERE scheduled_date >= CURRENT_DATE 
       AND status = 'scheduled' 
       AND confirmed_at IS NULL ${clinicFilter}`,
      params
    );

    // Waiting room (checked in but not started)
    const waitingRoom = await query(
      `SELECT a.*, p.first_name, p.last_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.scheduled_date = CURRENT_DATE 
       AND a.status = 'confirmed'
       AND a.checked_in_at IS NOT NULL
       AND a.started_at IS NULL ${clinicFilter}
       ORDER BY a.checked_in_at`,
      params
    );

    res.json({
      todayAppointments: todayAppointments.rows.map(a => ({
        id: a.id,
        scheduledTime: a.scheduled_time,
        status: a.status,
        type: a.type,
        confirmedAt: a.confirmed_at,
        checkedInAt: a.checked_in_at,
        patient: {
          id: a.patient_id,
          firstName: a.first_name,
          lastName: a.last_name,
          phone: a.patient_phone
        },
        doctor: {
          firstName: a.doctor_first_name,
          lastName: a.doctor_last_name
        }
      })),
      stats: {
        totalToday: todayAppointments.rows.length,
        pendingConfirmations: parseInt(pendingConfirmations.rows[0].count),
        inWaitingRoom: waitingRoom.rows.length
      },
      waitingRoom: waitingRoom.rows.map(a => ({
        id: a.id,
        checkedInAt: a.checked_in_at,
        patient: {
          firstName: a.first_name,
          lastName: a.last_name
        }
      }))
    });
  } catch (error) {
    logger.error('Secretary dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
