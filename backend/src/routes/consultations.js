const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Get consultations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { patientId, doctorId, startDate, endDate, limit = 50 } = req.query;

    let sql = `
      SELECT c.*,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.first_name as doctor_first_name, u.last_name as doctor_last_name
      FROM consultations c
      JOIN patients p ON c.patient_id = p.id
      JOIN doctors d ON c.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === 'doctor') {
      const doctorResult = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (doctorResult.rows.length > 0) {
        sql += ` AND c.doctor_id = $${paramIndex++}`;
        params.push(doctorResult.rows[0].id);
      }
    }

    if (patientId) {
      sql += ` AND c.patient_id = $${paramIndex++}`;
      params.push(patientId);
    }

    if (doctorId) {
      sql += ` AND c.doctor_id = $${paramIndex++}`;
      params.push(doctorId);
    }

    if (startDate && endDate) {
      sql += ` AND c.consultation_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    sql += ` ORDER BY c.consultation_date DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);

    res.json(result.rows.map(c => ({
      id: c.id,
      appointmentId: c.appointment_id,
      patientId: c.patient_id,
      doctorId: c.doctor_id,
      consultationDate: c.consultation_date,
      status: c.status,
      reasonForVisit: c.reason_for_visit,
      symptoms: c.symptoms,
      diagnosisCodes: c.diagnosis_codes,
      diagnosisDescriptions: c.diagnosis_descriptions,
      patient: {
        firstName: c.patient_first_name,
        lastName: c.patient_last_name
      },
      doctor: {
        firstName: c.doctor_first_name,
        lastName: c.doctor_last_name
      }
    })));
  } catch (error) {
    logger.error('Get consultations error:', error);
    res.status(500).json({ error: 'Failed to get consultations' });
  }
});

// Get consultation by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*,
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.date_of_birth, p.allergies, p.chronic_conditions,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name,
              d.specialty
       FROM consultations c
       JOIN patients p ON c.patient_id = p.id
       JOIN doctors d ON c.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    const c = result.rows[0];

    // Doctors can only access their own consultations
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0 || c.doctor_id !== docRes.rows[0].id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({
      id: c.id,
      appointmentId: c.appointment_id,
      patientId: c.patient_id,
      doctorId: c.doctor_id,
      clinicId: c.clinic_id,
      consultationDate: c.consultation_date,
      status: c.status,
      reasonForVisit: c.reason_for_visit,
      symptoms: c.symptoms,
      symptomDuration: c.symptom_duration,
      vitals: {
        weightKg: c.weight_kg,
        heightCm: c.height_cm,
        headCircumferenceCm: c.head_circumference_cm,
        temperatureCelsius: c.temperature_celsius,
        heartRateBpm: c.heart_rate_bpm,
        respiratoryRate: c.respiratory_rate,
        bloodPressureSystolic: c.blood_pressure_systolic,
        bloodPressureDiastolic: c.blood_pressure_diastolic,
        oxygenSaturation: c.oxygen_saturation,
        bmi: c.bmi
      },
      physicalExam: c.physical_exam,
      diagnosisCodes: c.diagnosis_codes,
      diagnosisDescriptions: c.diagnosis_descriptions,
      differentialDiagnoses: c.differential_diagnoses,
      treatmentPlan: c.treatment_plan,
      followUpInstructions: c.follow_up_instructions,
      nextAppointmentSuggested: c.next_appointment_suggested,
      aiSuggestions: c.ai_suggestions,
      privateNotes: c.private_notes,
      patient: {
        id: c.patient_id,
        firstName: c.patient_first_name,
        lastName: c.patient_last_name,
        dateOfBirth: c.date_of_birth,
        allergies: c.allergies,
        chronicConditions: c.chronic_conditions
      },
      doctor: {
        firstName: c.doctor_first_name,
        lastName: c.doctor_last_name,
        specialty: c.specialty
      }
    });
  } catch (error) {
    logger.error('Get consultation error:', error);
    res.status(500).json({ error: 'Failed to get consultation' });
  }
});

// Create consultation
router.post('/', authenticateToken, requireRole('doctor', 'admin'), [
  body('patientId').isUUID(),
  body('doctorId').optional({ nullable: true }).isUUID()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    appointmentId, patientId, doctorId, clinicId, reasonForVisit, symptoms, symptomDuration,
    consultationDate
  } = req.body;

  try {
    // Check for existing in_progress consultation for same patient today
    const today = consultationDate || new Date().toISOString().split('T')[0];
    const existingResult = await query(
      `SELECT id FROM consultations 
       WHERE patient_id = $1 AND status = 'in_progress' 
       AND DATE(consultation_date) = $2
       ORDER BY created_at DESC LIMIT 1`,
      [patientId, today]
    );
    if (existingResult.rows.length > 0) {
      return res.json({ id: existingResult.rows[0].id, patientId, status: 'in_progress', reused: true });
    }

    // Use provided doctorId, or try to find doctor record for current user
    let effectiveDoctorId = doctorId;
    if (!effectiveDoctorId) {
      const doctorResult = await query(
        'SELECT id FROM doctors WHERE user_id = $1',
        [req.user.id]
      );
      effectiveDoctorId = doctorResult.rows[0]?.id || null;
    }

    // If still no doctor_id and user is admin, create a temporary doctor record
    if (!effectiveDoctorId && req.user.role === 'admin') {
      const createDoctorResult = await query(
        `INSERT INTO doctors (user_id, medical_license, specialty, is_active)
         VALUES ($1, 'ADMIN-LICENSE', 'General', true)
         ON CONFLICT (user_id) DO UPDATE SET is_active = true
         RETURNING id`,
        [req.user.id]
      );
      effectiveDoctorId = createDoctorResult.rows[0]?.id;
    }

    if (!effectiveDoctorId) {
      return res.status(400).json({ error: 'No doctor record found for this user' });
    }

    const result = await query(
      `INSERT INTO consultations (
        appointment_id, patient_id, doctor_id, clinic_id, reason_for_visit, symptoms, symptom_duration, consultation_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))
      RETURNING *`,
      [appointmentId, patientId, effectiveDoctorId, clinicId, reasonForVisit, symptoms, symptomDuration, consultationDate || null]
    );

    // Update appointment status if linked
    if (appointmentId) {
      await query(
        `UPDATE appointments SET status = 'in_progress', started_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [appointmentId]
      );
    }

    await logAudit(req.user.id, 'CREATE_CONSULTATION', 'consultations', result.rows[0].id, null, { patientId }, req);

    res.status(201).json({
      id: result.rows[0].id,
      patientId: result.rows[0].patient_id,
      status: result.rows[0].status
    });
  } catch (error) {
    logger.error('Create consultation error:', error);
    res.status(500).json({ error: 'Failed to create consultation' });
  }
});

// Update consultation vitals
router.patch('/:id/vitals', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  const {
    weightKg, heightCm, headCircumferenceCm, temperatureCelsius,
    heartRateBpm, respiratoryRate, bloodPressureSystolic, bloodPressureDiastolic, oxygenSaturation,
    consultationDate
  } = req.body;

  try {
    const consultRes = await query('SELECT doctor_id FROM consultations WHERE id = $1', [req.params.id]);
    if (consultRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0 || consultRes.rows[0].doctor_id !== docRes.rows[0].id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Calculate BMI if weight and height provided
    let bmi = null;
    if (weightKg && heightCm) {
      bmi = (weightKg / Math.pow(heightCm / 100, 2)).toFixed(2);
    }

    const result = await query(
      `UPDATE consultations SET
        weight_kg = COALESCE($1, weight_kg),
        height_cm = COALESCE($2, height_cm),
        head_circumference_cm = COALESCE($3, head_circumference_cm),
        temperature_celsius = COALESCE($4, temperature_celsius),
        heart_rate_bpm = COALESCE($5, heart_rate_bpm),
        respiratory_rate = COALESCE($6, respiratory_rate),
        blood_pressure_systolic = COALESCE($7, blood_pressure_systolic),
        blood_pressure_diastolic = COALESCE($8, blood_pressure_diastolic),
        oxygen_saturation = COALESCE($9, oxygen_saturation),
        bmi = COALESCE($10, bmi),
        consultation_date = COALESCE($11, consultation_date),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 RETURNING *`,
      [weightKg, heightCm, headCircumferenceCm, temperatureCelsius,
        heartRateBpm, respiratoryRate, bloodPressureSystolic, bloodPressureDiastolic,
        oxygenSaturation, bmi, consultationDate || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Save to growth measurements
    if (weightKg || heightCm || headCircumferenceCm) {
      const consultation = result.rows[0];
      const patientResult = await query('SELECT date_of_birth FROM patients WHERE id = $1', [consultation.patient_id]);
      const dob = new Date(patientResult.rows[0].date_of_birth);
      const now = new Date();
      const ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());

      await query(
        `INSERT INTO growth_measurements (patient_id, consultation_id, measurement_date, age_months, weight_kg, height_cm, head_circumference_cm, bmi)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7)`,
        [consultation.patient_id, consultation.id, ageMonths, weightKg, heightCm, headCircumferenceCm, bmi]
      );
    }

    res.json({ message: 'Vitals updated', bmi });
  } catch (error) {
    logger.error('Update vitals error:', error);
    res.status(500).json({ error: 'Failed to update vitals' });
  }
});

// Update consultation diagnosis and plan
router.patch('/:id/diagnosis', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  const {
    physicalExam, diagnosisCodes, diagnosisDescriptions, differentialDiagnoses,
    treatmentPlan, followUpInstructions, nextAppointmentSuggested, privateNotes
  } = req.body;

  try {
    const consultRes = await query('SELECT doctor_id FROM consultations WHERE id = $1', [req.params.id]);
    if (consultRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0 || consultRes.rows[0].doctor_id !== docRes.rows[0].id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await query(
      `UPDATE consultations SET
        physical_exam = COALESCE($1, physical_exam),
        diagnosis_codes = COALESCE($2, diagnosis_codes),
        diagnosis_descriptions = COALESCE($3, diagnosis_descriptions),
        differential_diagnoses = COALESCE($4, differential_diagnoses),
        treatment_plan = COALESCE($5, treatment_plan),
        follow_up_instructions = COALESCE($6, follow_up_instructions),
        next_appointment_suggested = COALESCE($7, next_appointment_suggested),
        private_notes = COALESCE($8, private_notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [physicalExam, diagnosisCodes, diagnosisDescriptions, differentialDiagnoses,
        treatmentPlan, followUpInstructions, nextAppointmentSuggested, privateNotes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    res.json({ message: 'Diagnosis updated' });
  } catch (error) {
    logger.error('Update diagnosis error:', error);
    res.status(500).json({ error: 'Failed to update diagnosis' });
  }
});

// Complete consultation
router.patch('/:id/complete', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const consultRes = await query('SELECT doctor_id FROM consultations WHERE id = $1', [req.params.id]);
    if (consultRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0 || consultRes.rows[0].doctor_id !== docRes.rows[0].id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await query(
      `UPDATE consultations SET status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING appointment_id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Update appointment status
    if (result.rows[0].appointment_id) {
      await query(
        `UPDATE appointments SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [result.rows[0].appointment_id]
      );
    }

    await logAudit(req.user.id, 'COMPLETE_CONSULTATION', 'consultations', req.params.id, null, null, req);

    res.json({ message: 'Consultation completed' });
  } catch (error) {
    logger.error('Complete consultation error:', error);
    res.status(500).json({ error: 'Failed to complete consultation' });
  }
});

// Delete consultation
router.delete('/:id', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const consultation = await query('SELECT * FROM consultations WHERE id = $1', [req.params.id]);
    if (consultation.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0 || consultation.rows[0].doctor_id !== docRes.rows[0].id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Cascade delete related records
    await query('DELETE FROM growth_measurements WHERE consultation_id = $1', [req.params.id]);
    await query('DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE consultation_id = $1)', [req.params.id]);
    await query('DELETE FROM prescriptions WHERE consultation_id = $1', [req.params.id]);
    await query('DELETE FROM consultations WHERE id = $1', [req.params.id]);

    await logAudit(req.user.id, 'DELETE_CONSULTATION', 'consultations', req.params.id, consultation.rows[0], null, req);

    res.json({ message: 'Consulta eliminada' });
  } catch (error) {
    logger.error('Delete consultation error:', error);
    res.status(500).json({ error: 'Failed to delete consultation' });
  }
});

// Get patient's consultation history
router.get('/patient/:patientId/history', authenticateToken, async (req, res) => {
  try {
    if (!req.params.patientId || req.params.patientId === 'undefined') {
      return res.status(400).json({ error: 'Valid patient ID is required' });
    }
    // Get patient DOB for age calculation
    const patientResult = await query(
      'SELECT date_of_birth FROM patients WHERE id = $1',
      [req.params.patientId]
    );
    const dob = patientResult.rows.length > 0 ? new Date(patientResult.rows[0].date_of_birth) : null;

    const result = await query(
      `SELECT c.id, c.consultation_date, c.reason_for_visit, c.symptoms,
              c.diagnosis_codes, c.diagnosis_descriptions, c.treatment_plan,
              c.status, c.weight_kg, c.height_cm,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM consultations c
       JOIN doctors d ON c.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE c.patient_id = $1 AND c.status IN ('completed', 'in_progress')
       ORDER BY c.consultation_date DESC`,
      [req.params.patientId]
    );

    res.json(result.rows.map(c => {
      const consultDate = new Date(c.consultation_date);
      const ageMonths = dob ? Math.floor((consultDate - dob) / (1000 * 60 * 60 * 24 * 30.44)) : null;
      return {
        id: c.id,
        consultationDate: c.consultation_date,
        reasonForVisit: c.reason_for_visit,
        symptoms: c.symptoms,
        diagnosisCodes: c.diagnosis_codes,
        diagnosisDescriptions: c.diagnosis_descriptions,
        treatmentPlan: c.treatment_plan,
        status: c.status,
        weightKg: c.weight_kg ? parseFloat(c.weight_kg) : null,
        heightCm: c.height_cm ? parseFloat(c.height_cm) : null,
        ageMonths,
        doctor: `Dr. ${c.doctor_first_name} ${c.doctor_last_name}`
      };
    }));
  } catch (error) {
    logger.error('Get patient history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

module.exports = router;
