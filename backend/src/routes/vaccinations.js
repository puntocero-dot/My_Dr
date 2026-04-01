const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireMedicalStaff } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Get vaccine catalog
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM vaccines WHERE is_active = true ORDER BY recommended_ages_months[1], name`
    );

    res.json(result.rows.map(v => ({
      id: v.id,
      name: v.name,
      abbreviation: v.abbreviation,
      diseasePrevented: v.disease_prevented,
      recommendedAgesMonths: v.recommended_ages_months,
      maxApplicationAgeMonths: v.max_application_age_months,
      doseNumber: v.dose_number,
      route: v.route,
      notes: v.notes
    })));
  } catch (error) {
    logger.error('Get vaccine catalog error:', error);
    res.status(500).json({ error: 'Failed to get vaccine catalog' });
  }
});

// Get patient's vaccination record
router.get('/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    if (!req.params.patientId || req.params.patientId === 'undefined') {
      return res.status(400).json({ error: 'Valid patient ID is required' });
    }
    // Get patient info and verify ownership
    let sql = 'SELECT first_name, last_name, date_of_birth FROM patients WHERE id = $1';
    const params = [req.params.patientId];

    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0) return res.status(403).json({ error: 'Doctor not found' });
      sql += ' AND doctor_id = $2';
      params.push(docRes.rows[0].id);
    }

    const patientResult = await query(sql, params);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found or access denied' });
    }

    const patient = patientResult.rows[0];
    const dob = new Date(patient.date_of_birth);
    const now = new Date();
    const ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());

    // Get applied vaccinations
    const appliedResult = await query(
      `SELECT pv.*, v.name as vaccine_name, v.abbreviation, v.disease_prevented,
              u.first_name as admin_first_name, u.last_name as admin_last_name
       FROM patient_vaccinations pv
       JOIN vaccines v ON pv.vaccine_id = v.id
       LEFT JOIN users u ON pv.administered_by = u.id
       WHERE pv.patient_id = $1
       ORDER BY pv.administration_date DESC`,
      [req.params.patientId]
    );

    // Get all vaccines to determine pending
    const allVaccinesResult = await query(
      'SELECT * FROM vaccines WHERE is_active = true'
    );

    // Calculate pending and expired vaccinations
    const appliedVaccineIds = appliedResult.rows.map(v => v.vaccine_id);
    const pendingVaccines = [];
    const expiredVaccines = [];

    allVaccinesResult.rows.forEach(v => {
      const isRecommended = v.recommended_ages_months.some(age => age <= ageMonths);
      const isApplied = appliedVaccineIds.includes(v.id);
      
      if (isRecommended && !isApplied) {
        if (v.max_application_age_months && ageMonths > v.max_application_age_months) {
          expiredVaccines.push(v);
        } else {
          pendingVaccines.push(v);
        }
      }
    });

    // Calculate upcoming vaccinations
    const upcomingVaccines = allVaccinesResult.rows.filter(v => {
      const nextRecommendedAge = v.recommended_ages_months.find(age => age > ageMonths);
      return nextRecommendedAge !== undefined && !appliedVaccineIds.includes(v.id);
    }).map(v => ({
      ...v,
      nextDueAgeMonths: v.recommended_ages_months.find(age => age > ageMonths)
    }));

    res.json({
      patient: {
        firstName: patient.first_name,
        lastName: patient.last_name,
        dateOfBirth: patient.date_of_birth,
        ageMonths
      },
      applied: appliedResult.rows.map(v => ({
        id: v.id,
        vaccineId: v.vaccine_id,
        vaccineName: v.vaccine_name,
        abbreviation: v.abbreviation,
        diseasePrevented: v.disease_prevented,
        doseNumber: v.dose_number,
        administrationDate: v.administration_date,
        lotNumber: v.lot_number,
        manufacturer: v.manufacturer,
        site: v.site,
        administeredBy: v.admin_first_name ? `${v.admin_first_name} ${v.admin_last_name}` : null,
        reactionNotes: v.reaction_notes,
        nextDoseDue: v.next_dose_due
      })),
      pending: pendingVaccines.map(v => ({
        id: v.id,
        name: v.name,
        abbreviation: v.abbreviation,
        diseasePrevented: v.disease_prevented,
        dueAgeMonths: Math.max(...v.recommended_ages_months.filter(a => a <= ageMonths)),
        status: 'overdue'
      })),
      expired: expiredVaccines.map(v => ({
        id: v.id,
        name: v.name,
        abbreviation: v.abbreviation,
        diseasePrevented: v.disease_prevented,
        dueAgeMonths: Math.max(...v.recommended_ages_months.filter(a => a <= ageMonths)),
        maxAgeMonths: v.max_application_age_months,
        status: 'expired'
      })),
      upcoming: upcomingVaccines.map(v => ({
        id: v.id,
        name: v.name,
        abbreviation: v.abbreviation,
        diseasePrevented: v.disease_prevented,
        nextDueAgeMonths: v.nextDueAgeMonths,
        status: 'upcoming'
      }))
    });
  } catch (error) {
    logger.error('Get patient vaccinations error:', error);
    res.status(500).json({ error: 'Failed to get vaccination record' });
  }
});

// Record vaccination
router.post('/', authenticateToken, requireMedicalStaff, [
  body('patientId').isUUID(),
  body('vaccineId').isUUID(),
  body('administrationDate').isDate()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    patientId, vaccineId, doseNumber, administrationDate,
    lotNumber, manufacturer, expirationDate, site, reactionNotes
  } = req.body;

  try {
    // Get vaccine info for next dose calculation
    const vaccineResult = await query('SELECT * FROM vaccines WHERE id = $1', [vaccineId]);
    const vaccine = vaccineResult.rows[0];

    // Calculate next dose due date
    let nextDoseDue = null;
    if (vaccine && vaccine.recommended_ages_months.length > 1) {
      const patientResult = await query('SELECT date_of_birth FROM patients WHERE id = $1', [patientId]);
      const dob = new Date(patientResult.rows[0].date_of_birth);
      const adminDate = new Date(administrationDate);
      const ageAtAdmin = (adminDate.getFullYear() - dob.getFullYear()) * 12 + (adminDate.getMonth() - dob.getMonth());

      const nextAge = vaccine.recommended_ages_months.find(age => age > ageAtAdmin);
      if (nextAge) {
        nextDoseDue = new Date(dob);
        nextDoseDue.setMonth(nextDoseDue.getMonth() + nextAge);
      }
    }

    const result = await query(
      `INSERT INTO patient_vaccinations (
        patient_id, vaccine_id, dose_number, administration_date,
        lot_number, manufacturer, expiration_date, site, administered_by, reaction_notes, next_dose_due
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [patientId, vaccineId, doseNumber || 1, administrationDate,
        lotNumber, manufacturer, expirationDate, site, req.user.id, reactionNotes, nextDoseDue]
    );

    await logAudit(req.user.id, 'RECORD_VACCINATION', 'patient_vaccinations', result.rows[0].id, null, { patientId, vaccineId }, req);

    res.status(201).json({
      id: result.rows[0].id,
      administrationDate: result.rows[0].administration_date,
      nextDoseDue: result.rows[0].next_dose_due
    });
  } catch (error) {
    logger.error('Record vaccination error:', error);
    res.status(500).json({ error: 'Failed to record vaccination' });
  }
});

// Get vaccination schedule by age
router.get('/schedule/:ageMonths', authenticateToken, async (req, res) => {
  try {
    const ageMonths = parseInt(req.params.ageMonths);

    const result = await query(
      `SELECT * FROM vaccines 
       WHERE is_active = true AND $1 = ANY(recommended_ages_months)
       ORDER BY name`,
      [ageMonths]
    );

    res.json(result.rows.map(v => ({
      id: v.id,
      name: v.name,
      abbreviation: v.abbreviation,
      diseasePrevented: v.disease_prevented,
      route: v.route,
      notes: v.notes
    })));
  } catch (error) {
    logger.error('Get vaccination schedule error:', error);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// Get patients with overdue vaccinations
router.get('/overdue', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    let doctorFilter = '';
    const params = [];
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length > 0) {
        doctorFilter = 'AND p.doctor_id = $1';
        params.push(docRes.rows[0].id);
      } else {
        return res.json([]);
      }
    }

    const result = await query(`
      SELECT p.id, p.first_name, p.last_name, p.date_of_birth,
             EXTRACT(YEAR FROM AGE(p.date_of_birth)) * 12 + EXTRACT(MONTH FROM AGE(p.date_of_birth)) as age_months,
             array_agg(v.name) as pending_vaccines
      FROM patients p
      CROSS JOIN vaccines v
      LEFT JOIN patient_vaccinations pv ON p.id = pv.patient_id AND v.id = pv.vaccine_id
      WHERE p.is_active = true
        AND v.is_active = true
        AND pv.id IS NULL
        AND (EXTRACT(YEAR FROM AGE(p.date_of_birth)) * 12 + EXTRACT(MONTH FROM AGE(p.date_of_birth))) >= ANY(v.recommended_ages_months)
        ${doctorFilter}
      GROUP BY p.id
      ORDER BY p.last_name, p.first_name
    `, params);

    res.json(result.rows.map(p => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      dateOfBirth: p.date_of_birth,
      ageMonths: parseInt(p.age_months),
      pendingVaccines: p.pending_vaccines
    })));
  } catch (error) {
    logger.error('Get overdue vaccinations error:', error);
    res.status(500).json({ error: 'Failed to get overdue list' });
  }
});

module.exports = router;
