const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Get prescriptions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { patientId, doctorId, limit = 50 } = req.query;

    let sql = `
      SELECT pr.*,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.first_name as doctor_first_name, u.last_name as doctor_last_name,
             d.medical_license
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      JOIN doctors d ON pr.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (patientId) {
      sql += ` AND pr.patient_id = $${paramIndex++}`;
      params.push(patientId);
    }

    if (doctorId) {
      sql += ` AND pr.doctor_id = $${paramIndex++}`;
      params.push(doctorId);
    }

    sql += ` ORDER BY pr.prescription_date DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);

    // Get items for each prescription
    const prescriptions = await Promise.all(result.rows.map(async (pr) => {
      const itemsResult = await query(
        'SELECT * FROM prescription_items WHERE prescription_id = $1',
        [pr.id]
      );

      return {
        id: pr.id,
        consultationId: pr.consultation_id,
        patientId: pr.patient_id,
        doctorId: pr.doctor_id,
        prescriptionDate: pr.prescription_date,
        validUntil: pr.valid_until,
        notes: pr.notes,
        documentUrl: pr.document_url,
        patient: {
          firstName: pr.patient_first_name,
          lastName: pr.patient_last_name
        },
        doctor: {
          firstName: pr.doctor_first_name,
          lastName: pr.doctor_last_name,
          medicalLicense: pr.medical_license
        },
        items: itemsResult.rows.map(i => ({
          id: i.id,
          medicationName: i.medication_name,
          genericName: i.generic_name,
          dose: i.dose,
          doseUnit: i.dose_unit,
          route: i.route,
          frequency: i.frequency,
          duration: i.duration,
          quantity: i.quantity,
          instructions: i.instructions
        }))
      };
    }));

    res.json(prescriptions);
  } catch (error) {
    logger.error('Get prescriptions error:', error);
    res.status(500).json({ error: 'Failed to get prescriptions' });
  }
});

// Get prescription by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT pr.*,
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.date_of_birth, p.allergies, p.weight_kg,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name,
              d.medical_license, d.specialty, d.signature_url, d.stamp_url,
              c.name as clinic_name, c.address as clinic_address, c.phone as clinic_phone
       FROM prescriptions pr
       JOIN patients p ON pr.patient_id = p.id
       JOIN doctors d ON pr.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN clinics c ON d.clinic_id = c.id
       WHERE pr.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const pr = result.rows[0];

    const itemsResult = await query(
      'SELECT * FROM prescription_items WHERE prescription_id = $1',
      [req.params.id]
    );

    res.json({
      id: pr.id,
      consultationId: pr.consultation_id,
      prescriptionDate: pr.prescription_date,
      validUntil: pr.valid_until,
      notes: pr.notes,
      documentUrl: pr.document_url,
      patient: {
        id: pr.patient_id,
        firstName: pr.patient_first_name,
        lastName: pr.patient_last_name,
        dateOfBirth: pr.date_of_birth,
        allergies: pr.allergies
      },
      doctor: {
        id: pr.doctor_id,
        firstName: pr.doctor_first_name,
        lastName: pr.doctor_last_name,
        medicalLicense: pr.medical_license,
        specialty: pr.specialty,
        signatureUrl: pr.signature_url,
        stampUrl: pr.stamp_url
      },
      clinic: {
        name: pr.clinic_name,
        address: pr.clinic_address,
        phone: pr.clinic_phone
      },
      items: itemsResult.rows.map(i => ({
        id: i.id,
        medicationName: i.medication_name,
        genericName: i.generic_name,
        dose: i.dose,
        doseUnit: i.dose_unit,
        calculatedDoseMg: i.calculated_dose_mg,
        route: i.route,
        frequency: i.frequency,
        duration: i.duration,
        quantity: i.quantity,
        instructions: i.instructions,
        interactionWarnings: i.interaction_warnings,
        allergyWarnings: i.allergy_warnings
      }))
    });
  } catch (error) {
    logger.error('Get prescription error:', error);
    res.status(500).json({ error: 'Failed to get prescription' });
  }
});

// Create prescription
router.post('/', authenticateToken, requireRole('doctor', 'admin'), [
  body('patientId').isUUID(),
  body('doctorId').isUUID(),
  body('items').isArray({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { consultationId, patientId, doctorId, validUntil, notes, items } = req.body;

  try {
    // Check patient allergies
    const patientResult = await query('SELECT allergies FROM patients WHERE id = $1', [patientId]);
    const allergies = patientResult.rows[0]?.allergies || [];

    // Create prescription
    const prescriptionResult = await query(
      `INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, valid_until, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [consultationId, patientId, doctorId, validUntil, notes]
    );

    const prescriptionId = prescriptionResult.rows[0].id;

    // Add items
    for (const item of items) {
      // Check for allergy warnings
      const allergyWarnings = allergies.filter(a =>
        item.medicationName.toLowerCase().includes(a.toLowerCase()) ||
        (item.genericName && item.genericName.toLowerCase().includes(a.toLowerCase()))
      );

      await query(
        `INSERT INTO prescription_items (
          prescription_id, medication_name, generic_name, dose, dose_unit, calculated_dose_mg,
          route, frequency, duration, quantity, instructions, allergy_warnings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          prescriptionId, item.medicationName, item.genericName, item.dose, item.doseUnit,
          item.calculatedDoseMg, item.route, item.frequency, item.duration, item.quantity,
          item.instructions, allergyWarnings.length > 0 ? allergyWarnings : null
        ]
      );
    }

    await logAudit(req.user.id, 'CREATE_PRESCRIPTION', 'prescriptions', prescriptionId, null, { patientId, itemCount: items.length }, req);

    res.status(201).json({
      id: prescriptionId,
      prescriptionDate: prescriptionResult.rows[0].prescription_date,
      itemCount: items.length
    });
  } catch (error) {
    logger.error('Create prescription error:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// Calculate pediatric dose
router.post('/calculate-dose', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  const { medicationName, weightKg, ageMonths, dosePerKg, maxDose, frequency } = req.body;

  try {
    // Basic dose calculation
    let calculatedDose = weightKg * dosePerKg;

    // Apply max dose limit if provided
    if (maxDose && calculatedDose > maxDose) {
      calculatedDose = maxDose;
    }

    // Round to appropriate precision
    calculatedDose = Math.round(calculatedDose * 100) / 100;

    res.json({
      medicationName,
      weightKg,
      dosePerKg,
      calculatedDose,
      unit: 'mg',
      frequency,
      warning: calculatedDose === maxDose ? 'Dose limited to maximum recommended dose' : null
    });
  } catch (error) {
    logger.error('Calculate dose error:', error);
    res.status(500).json({ error: 'Failed to calculate dose' });
  }
});

// Get patient's prescription history
router.get('/patient/:patientId/history', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT pr.id, pr.prescription_date, pr.notes,
              u.first_name as doctor_first_name, u.last_name as doctor_last_name,
              json_agg(json_build_object(
                'id', pi.id,
                'name', pi.medication_name,
                'dose', pi.dose,
                'doseUnit', pi.dose_unit,
                'frequency', pi.frequency,
                'duration', pi.duration,
                'lastDoseAt', pi.last_dose_at,
                'nextDoseAt', pi.next_dose_at,
                'instructions', pi.instructions
              )) as items
       FROM prescriptions pr
       JOIN doctors d ON pr.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN prescription_items pi ON pr.id = pi.prescription_id
       WHERE pr.patient_id = $1
       GROUP BY pr.id, u.first_name, u.last_name
       ORDER BY pr.prescription_date DESC`,
      [req.params.patientId]
    );

    res.json(result.rows.map(pr => ({
      id: pr.id,
      prescriptionDate: pr.prescription_date,
      notes: pr.notes,
      doctor: `Dr. ${pr.doctor_first_name} ${pr.doctor_last_name}`,
      items: pr.items.filter(item => item.id !== null) // Filter out null items from LEFT JOIN
    })));
  } catch (error) {
    logger.error('Get prescription history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Log medication administration (Mark as taken)
router.post('/log-dose', authenticateToken, [
  body('prescriptionItemId').isUUID(),
  body('status').isIn(['taken', 'missed', 'delayed'])
], async (req, res) => {
  const { prescriptionItemId, status, notes, administeredAt = new Date() } = req.body;

  try {
    // Get item details to calculate next dose
    const itemResult = await query(
      'SELECT pi.*, pi.frequency, p.patient_id FROM prescription_items pi JOIN prescriptions p ON pi.prescription_id = p.id WHERE pi.id = $1',
      [prescriptionItemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Medication item not found' });
    }

    const item = itemResult.rows[0];

    // Log the event
    const logResult = await query(
      `INSERT INTO medication_logs (prescription_item_id, patient_id, administered_at, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [prescriptionItemId, item.patient_id || req.body.patientId, administeredAt, status, notes]
    );

    // Calculate next dose time if frequency is provided (e.g., "cada 8 horas")
    let nextDoseAt = null;
    if (item.frequency) {
      const hoursMatch = item.frequency.match(/cada (\d+) horas/i);
      if (hoursMatch) {
        const hours = parseInt(hoursMatch[1]);
        nextDoseAt = new Date(new Date(administeredAt).getTime() + (hours * 60 * 60 * 1000));
      }
    }

    // Update the item tracking
    await query(
      `UPDATE prescription_items 
       SET last_dose_at = $1, next_dose_at = $2
       WHERE id = $3`,
      [administeredAt, nextDoseAt, prescriptionItemId]
    );

    res.status(201).json({
      log: logResult.rows[0],
      nextDoseAt
    });
  } catch (error) {
    logger.error('Log dose error:', error);
    res.status(500).json({ error: 'Failed to log medication dose' });
  }
});

module.exports = router;
