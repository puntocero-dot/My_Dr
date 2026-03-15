const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireMedicalStaff } = require('../middleware/auth');
const {
  calculateGrowthMetrics,
  getGrowthComparison,
  getAdvancedGrowthComparison,
  calculateIdealWeightCDC,
  calculateIdealHeightCDC
} = require('../utils/growthStandards');
const logger = require('../config/logger');

const router = express.Router();

// Get growth history for a patient
router.get('/patient/:patientId/history', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Get patient info and verify ownership
    let sql = 'SELECT date_of_birth, gender FROM patients WHERE id = $1';
    const params = [patientId];

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

    // Get all consultations with vitals
    const consultations = await query(
      `SELECT c.id, c.consultation_date, c.weight_kg, c.height_cm, c.head_circumference_cm,
              c.temperature_celsius, c.heart_rate_bpm, c.respiratory_rate, c.oxygen_saturation
       FROM consultations c
       WHERE c.patient_id = $1 AND c.status IN ('completed', 'in_progress')
       ORDER BY c.consultation_date ASC`,
      [patientId]
    );

    const growthHistory = consultations.rows.map(c => {
      const consultDate = new Date(c.consultation_date);
      const ageMonths = Math.floor((consultDate - dob) / (1000 * 60 * 60 * 24 * 30.44));

      const metrics = calculateGrowthMetrics(
        patient.gender,
        ageMonths,
        c.weight_kg ? parseFloat(c.weight_kg) : null,
        c.height_cm ? parseFloat(c.height_cm) : null,
        c.head_circumference_cm ? parseFloat(c.head_circumference_cm) : null
      );

      return {
        consultationId: c.id,
        date: c.consultation_date,
        ageMonths,
        weight: c.weight_kg ? parseFloat(c.weight_kg) : null,
        height: c.height_cm ? parseFloat(c.height_cm) : null,
        headCircumference: c.head_circumference_cm ? parseFloat(c.head_circumference_cm) : null,
        temperature: c.temperature_celsius ? parseFloat(c.temperature_celsius) : null,
        metrics
      };
    });

    res.json({
      patientId,
      gender: patient.gender,
      dateOfBirth: patient.date_of_birth,
      history: growthHistory
    });
  } catch (error) {
    logger.error('Get growth history error:', error);
    res.status(500).json({ error: 'Failed to get growth history' });
  }
});

// Get growth comparison (current vs previous vs ideal)
router.get('/patient/:patientId/comparison', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Get patient info and verify ownership
    let sql = 'SELECT date_of_birth, gender, first_name, last_name FROM patients WHERE id = $1';
    const params = [patientId];

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
    const currentAgeMonths = Math.floor((now - dob) / (1000 * 60 * 60 * 24 * 30.44));

    // Get last two consultations
    const consultations = await query(
      `SELECT c.id, c.consultation_date, c.weight_kg, c.height_cm, c.head_circumference_cm
       FROM consultations c
       WHERE c.patient_id = $1 AND c.weight_kg IS NOT NULL AND c.status IN ('completed', 'in_progress')
       ORDER BY c.consultation_date DESC
       LIMIT 2`,
      [patientId]
    );

    if (consultations.rows.length === 0) {
      // Return ideal values only
      const idealMetrics = calculateGrowthMetrics(patient.gender, currentAgeMonths, null, null, null);
      return res.json({
        patient: {
          id: patientId,
          name: `${patient.first_name} ${patient.last_name}`,
          gender: patient.gender,
          ageMonths: currentAgeMonths
        },
        current: null,
        previous: null,
        ideal: {
          weight: idealMetrics.weight?.ideal || null,
          height: idealMetrics.height?.ideal || null
        },
        comparison: null
      });
    }

    const currentConsult = consultations.rows[0];
    const previousConsult = consultations.rows[1] || null;

    const currentDate = new Date(currentConsult.consultation_date);
    const currentAge = Math.floor((currentDate - dob) / (1000 * 60 * 60 * 24 * 30.44));

    const currentData = {
      weight: currentConsult.weight_kg ? parseFloat(currentConsult.weight_kg) : null,
      height: currentConsult.height_cm ? parseFloat(currentConsult.height_cm) : null,
      headCircumference: currentConsult.head_circumference_cm ? parseFloat(currentConsult.head_circumference_cm) : null
    };

    let previousData = null;
    let previousAge = null;
    if (previousConsult) {
      const prevDate = new Date(previousConsult.consultation_date);
      previousAge = Math.floor((prevDate - dob) / (1000 * 60 * 60 * 24 * 30.44));
      previousData = {
        ageMonths: previousAge,
        weight: previousConsult.weight_kg ? parseFloat(previousConsult.weight_kg) : null,
        height: previousConsult.height_cm ? parseFloat(previousConsult.height_cm) : null,
        headCircumference: previousConsult.head_circumference_cm ? parseFloat(previousConsult.head_circumference_cm) : null
      };
    }

    const comparison = getGrowthComparison(patient.gender, currentAge, currentData, previousData);

    res.json({
      patient: {
        id: patientId,
        name: `${patient.first_name} ${patient.last_name}`,
        gender: patient.gender,
        ageMonths: currentAge
      },
      currentConsultation: {
        id: currentConsult.id,
        date: currentConsult.consultation_date,
        ageMonths: currentAge
      },
      previousConsultation: previousConsult ? {
        id: previousConsult.id,
        date: previousConsult.consultation_date,
        ageMonths: previousAge
      } : null,
      ...comparison
    });
  } catch (error) {
    logger.error('Get growth comparison error:', error);
    res.status(500).json({ error: 'Failed to get growth comparison' });
  }
});

// Get advanced 3D comparison data (current vs previous vs ideal with body transformations)
router.get('/patient/:patientId/comparison3d', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Get patient info and verify ownership
    let sql = 'SELECT date_of_birth, gender, first_name, last_name FROM patients WHERE id = $1';
    const params = [patientId];

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
    const currentAgeMonths = Math.floor((now - dob) / (1000 * 60 * 60 * 24 * 30.44));
    const ageYears = currentAgeMonths / 12;

    // Get last two consultations with vitals
    const consultations = await query(
      `SELECT c.id, c.consultation_date, c.weight_kg, c.height_cm, c.head_circumference_cm
       FROM consultations c
       WHERE c.patient_id = $1 AND c.weight_kg IS NOT NULL AND c.height_cm IS NOT NULL AND c.status IN ('completed', 'in_progress')
       ORDER BY c.consultation_date DESC
       LIMIT 2`,
      [patientId]
    );

    // Calculate ideal values using CDC formulas
    const idealWeight = Math.round(calculateIdealWeightCDC(ageYears) * 10) / 10;
    const idealHeight = Math.round(calculateIdealHeightCDC(ageYears) * 10) / 10;

    // If no consultations, return only ideal data for comparison
    if (consultations.rows.length === 0) {
      return res.json({
        patient: {
          id: patientId,
          name: `${patient.first_name} ${patient.last_name}`,
          gender: patient.gender,
          ageMonths: currentAgeMonths,
          ageYears: Math.round(ageYears * 10) / 10
        },
        hasData: false,
        current: null,
        previous: null,
        ideal: {
          weight: idealWeight,
          height: idealHeight,
          source: 'CDC'
        },
        healthStatus: null,
        transform3D: null
      });
    }

    const currentConsult = consultations.rows[0];
    const previousConsult = consultations.rows[1] || null;

    const currentDate = new Date(currentConsult.consultation_date);
    const currentAge = Math.floor((currentDate - dob) / (1000 * 60 * 60 * 24 * 30.44));

    const currentData = {
      weight: parseFloat(currentConsult.weight_kg),
      height: parseFloat(currentConsult.height_cm),
      headCircumference: currentConsult.head_circumference_cm ? parseFloat(currentConsult.head_circumference_cm) : null
    };

    let previousData = null;
    if (previousConsult) {
      const prevDate = new Date(previousConsult.consultation_date);
      const prevAge = Math.floor((prevDate - dob) / (1000 * 60 * 60 * 24 * 30.44));
      previousData = {
        ageMonths: prevAge,
        weight: parseFloat(previousConsult.weight_kg),
        height: parseFloat(previousConsult.height_cm),
        headCircumference: previousConsult.head_circumference_cm ? parseFloat(previousConsult.head_circumference_cm) : null
      };
    }

    // Get advanced comparison with 3D transformation data
    const comparison = getAdvancedGrowthComparison(patient.gender, currentAge, currentData, previousData);

    res.json({
      patient: {
        id: patientId,
        name: `${patient.first_name} ${patient.last_name}`,
        gender: patient.gender,
        ageMonths: currentAge,
        ageYears: comparison.ageYears
      },
      hasData: true,
      ...comparison
    });
  } catch (error) {
    logger.error('Get 3D comparison error:', error);
    res.status(500).json({ error: 'Failed to get 3D comparison data' });
  }
});

// Get percentile curves for charts
router.get('/curves/:gender/:ageMaxMonths', authenticateToken, async (req, res) => {
  try {
    const { gender, ageMaxMonths } = req.params;
    const maxAge = Math.min(parseInt(ageMaxMonths) || 228, 228);

    const curves = {
      weight: { p3: [], p15: [], p50: [], p85: [], p97: [] },
      height: { p3: [], p15: [], p50: [], p85: [], p97: [] }
    };

    for (let age = 0; age <= maxAge; age++) {
      const metrics = calculateGrowthMetrics(gender, age, 10, 70, null);

      if (metrics.weight) {
        curves.weight.p3.push({ age, value: metrics.weight.p3 });
        curves.weight.p15.push({ age, value: metrics.weight.p15 });
        curves.weight.p50.push({ age, value: metrics.weight.p50 });
        curves.weight.p85.push({ age, value: metrics.weight.p85 });
        curves.weight.p97.push({ age, value: metrics.weight.p97 });
      }

      if (metrics.height) {
        curves.height.p3.push({ age, value: metrics.height.p3 });
        curves.height.p15.push({ age, value: metrics.height.p15 });
        curves.height.p50.push({ age, value: metrics.height.p50 });
        curves.height.p85.push({ age, value: metrics.height.p85 });
        curves.height.p97.push({ age, value: metrics.height.p97 });
      }
    }

    res.json(curves);
  } catch (error) {
    logger.error('Get growth curves error:', error);
    res.status(500).json({ error: 'Failed to get growth curves' });
  }
});

module.exports = router;
