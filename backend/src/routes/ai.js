const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');
const geminiService = require('../services/geminiService');

const router = express.Router();

// AI Diagnostic Assistant
router.post('/diagnose', authenticateToken, requireRole('doctor', 'admin'), [
  body('patientId').isUUID(),
  body('symptoms').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { patientId, symptoms, vitals, additionalInfo } = req.body;

  try {
    // Get patient info and history
    const patientResult = await query(
      `SELECT p.*, 
              EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age_years,
              EXTRACT(MONTH FROM AGE(p.date_of_birth)) as age_months_total
       FROM patients p WHERE p.id = $1`,
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];

    // Get recent consultations
    const historyResult = await query(
      `SELECT diagnosis_codes, diagnosis_descriptions, symptoms, consultation_date
       FROM consultations 
       WHERE patient_id = $1 AND status = 'completed'
       ORDER BY consultation_date DESC LIMIT 10`,
      [patientId]
    );

    // Build context for AI
    const patientContext = {
      age: `${patient.age_years} años${patient.age_months_total < 12 ? ` y ${patient.age_months_total} meses` : ''}`,
      gender: patient.gender === 'male' ? 'masculino' : 'femenino',
      allergies: patient.allergies || [],
      chronicConditions: patient.chronic_conditions || [],
      recentHistory: historyResult.rows.map(h => ({
        date: h.consultation_date,
        diagnoses: h.diagnosis_descriptions,
        symptoms: h.symptoms
      }))
    };

    // Use Gemini AI service
    const aiResponse = await geminiService.getDiagnosticSuggestions(
      patientContext,
      symptoms,
      vitals,
      additionalInfo
    );

    // Log AI usage
    await logAudit(req.user.id, 'AI_DIAGNOSIS_ASSIST', 'consultations', null, null, { patientId, symptoms: symptoms.substring(0, 100) }, req);

    res.json(aiResponse);
  } catch (error) {
    logger.error('AI diagnosis error:', error);
    res.status(500).json({ error: 'AI assistant failed' });
  }
});

// Pattern detection for patient
router.get('/patterns/:patientId', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { patientId } = req.params;

    // Get consultation history
    const consultations = await query(
      `SELECT diagnosis_codes, diagnosis_descriptions, symptoms, consultation_date
       FROM consultations 
       WHERE patient_id = $1 AND status = 'completed'
       ORDER BY consultation_date DESC`,
      [patientId]
    );

    if (consultations.rows.length < 2) {
      return res.json({ patterns: [], message: 'Insufficient history for pattern detection' });
    }

    // Simple pattern detection (count recurring diagnoses)
    const diagnosisCounts = {};
    const last6Months = new Date();
    last6Months.setMonth(last6Months.getMonth() - 6);

    consultations.rows.forEach(c => {
      if (new Date(c.consultation_date) >= last6Months) {
        (c.diagnosis_descriptions || []).forEach(d => {
          diagnosisCounts[d] = (diagnosisCounts[d] || 0) + 1;
        });
      }
    });

    const patterns = Object.entries(diagnosisCounts)
      .filter(([_, count]) => count >= 2)
      .map(([diagnosis, count]) => ({
        diagnosis,
        occurrences: count,
        period: '6 meses',
        alert: count >= 3 ? 'Patrón recurrente detectado - considerar evaluación especializada' : null
      }));

    res.json({
      patterns,
      totalConsultations: consultations.rows.length,
      periodAnalyzed: '6 meses'
    });
  } catch (error) {
    logger.error('Pattern detection error:', error);
    res.status(500).json({ error: 'Pattern detection failed' });
  }
});

// Treatment suggestions based on diagnosis
router.post('/treatment-suggestions', authenticateToken, requireRole('doctor', 'admin'), [
  body('diagnosis').notEmpty(),
  body('patientAge').isNumeric()
], async (req, res) => {
  const { diagnosis, patientAge, patientWeight, allergies } = req.body;

  try {
    const suggestions = await geminiService.getTreatmentSuggestions(
      diagnosis,
      patientAge,
      patientWeight,
      allergies
    );

    res.json(suggestions);
  } catch (error) {
    logger.error('Treatment suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Educational content based on diagnosis
router.get('/education/:diagnosis', authenticateToken, async (req, res) => {
  try {
    const { diagnosis } = req.params;
    const { language = 'es' } = req.query;

    const content = await geminiService.getEducationalContent(diagnosis, language);

    res.json({
      diagnosis,
      content,
      language
    });
  } catch (error) {
    logger.error('Education content error:', error);
    res.status(500).json({ error: 'Failed to get educational content' });
  }
});

// Medication suggestions for autocomplete
router.post('/medication-suggestions', authenticateToken, requireRole('doctor', 'admin'), [
  body('query').notEmpty()
], async (req, res) => {
  const { query: queryText } = req.body;
  try {
    const suggestions = await geminiService.getMedicationAutocomplete(queryText);
    res.json(suggestions);
  } catch (error) {
    logger.error('Medication suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// AI Pediatric dosing calculation
router.post('/calculate-dose-ai', authenticateToken, requireRole('doctor', 'admin'), [
  body('medicationName').notEmpty(),
  body('patientId').isUUID()
], async (req, res) => {
  const { medicationName, patientId } = req.body;
  try {
    const patientResult = await query(
      `SELECT p.*, 
              EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age_years,
              EXTRACT(MONTH FROM AGE(p.date_of_birth)) as age_months_total
       FROM patients p WHERE p.id = $1`,
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];
    const patientContext = {
      age: `${patient.age_years} años y ${patient.age_months_total % 12} meses`,
      weight: patient.weight_kg,
      allergies: patient.allergies || []
    };

    const doseSuggestion = await geminiService.getPediatricDoseAI(medicationName, patientContext);
    res.json(doseSuggestion);
  } catch (error) {
    logger.error('AI dosing calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate dose' });
  }
});

module.exports = router;
