const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireMedicalStaff, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// Get all patients
router.get('/', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const { search, clinicId, doctorId, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT p.*, 
             array_agg(DISTINCT jsonb_build_object(
               'id', par.id,
               'firstName', u.first_name,
               'lastName', u.last_name,
               'phone', u.phone,
               'email', u.email,
               'relationship', pp.relationship
             )) FILTER (WHERE par.id IS NOT NULL) as parents
      FROM patients p
      LEFT JOIN patient_parents pp ON p.id = pp.patient_id
      LEFT JOIN parents par ON pp.parent_id = par.id
      LEFT JOIN users u ON par.user_id = u.id
      WHERE p.is_active = true
    `;
    const params = [];
    let paramIndex = 1;

    // Filter by doctor_id if the user is a doctor (own patients + active referrals)
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0) return res.json([]);
      const doctorId = docRes.rows[0].id;
      sql += ` AND (p.doctor_id = $${paramIndex} OR EXISTS (
        SELECT 1 FROM referrals r
        WHERE r.patient_id = p.id AND r.to_doctor_id = $${paramIndex} AND r.status = 'active'
      ))`;
      params.push(doctorId);
      paramIndex++;
    } else if (req.user.role === 'secretary') {
      sql += ` AND p.clinic_id IN (
        SELECT clinic_id FROM secretary_clinics 
        WHERE secretary_id = (SELECT id FROM secretaries WHERE user_id = $${paramIndex})
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    if (clinicId) {
      sql += ` AND p.clinic_id = $${paramIndex++}`;
      params.push(clinicId);
    }

    if (doctorId) {
      sql += ` AND p.doctor_id = $${paramIndex++}`;
      params.push(doctorId);
    }

    if (search) {
      sql += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.medical_record_number ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` GROUP BY p.id ORDER BY p.last_name, p.first_name LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    res.json(result.rows.map(p => ({
      id: p.id,
      medicalRecordNumber: p.medical_record_number,
      firstName: p.first_name,
      lastName: p.last_name,
      dateOfBirth: p.date_of_birth,
      gender: p.gender,
      bloodType: p.blood_type,
      allergies: p.allergies,
      chronicConditions: p.chronic_conditions,
      insuranceProvider: p.insurance_provider,
      insurancePolicyNumber: p.insurance_policy_number,
      profileImageUrl: p.profile_image_url,
      parents: p.parents,
      createdAt: p.created_at
    })));
  } catch (error) {
    logger.error('Get patients error:', error);
    res.status(500).json({ error: 'Failed to get patients' });
  }
});

// Get patient by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ error: 'Valid patient ID is required' });
    }
    const result = await query(
      `SELECT p.*,
              array_agg(DISTINCT jsonb_build_object(
                'id', par.id,
                'userId', u.id,
                'firstName', u.first_name,
                'lastName', u.last_name,
                'phone', u.phone,
                'email', u.email,
                'dui', u.dui,
                'relationship', pp.relationship,
                'isPrimaryContact', pp.is_primary_contact
              )) FILTER (WHERE par.id IS NOT NULL) as parents,
              array_agg(DISTINCT jsonb_build_object(
                'id', ec.id,
                'name', ec.name,
                'phone', ec.phone,
                'relationship', ec.relationship,
                'isPrimary', ec.is_primary
              )) FILTER (WHERE ec.id IS NOT NULL) as emergency_contacts
       FROM patients p
       LEFT JOIN patient_parents pp ON p.id = pp.patient_id
       LEFT JOIN parents par ON pp.parent_id = par.id
       LEFT JOIN users u ON par.user_id = u.id
       LEFT JOIN emergency_contacts ec ON p.id = ec.patient_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const p = result.rows[0];

    // Check access for parent role
    if (req.user.role === 'parent') {
      const parentAccess = await query(
        `SELECT 1 FROM patient_parents pp
         JOIN parents par ON pp.parent_id = par.id
         WHERE pp.patient_id = $1 AND par.user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (parentAccess.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Doctors can only access their own patients or patients referred to them
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
      const doctorId = docRes.rows[0].id;
      const accessCheck = await query(
        `SELECT 1 FROM patients p
         WHERE p.id = $1 AND (
           p.doctor_id = $2 OR EXISTS (
             SELECT 1 FROM referrals r
             WHERE r.patient_id = p.id AND r.to_doctor_id = $2 AND r.status = 'active'
           )
         )`,
        [req.params.id, doctorId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({
      id: p.id,
      clinicId: p.clinic_id,
      medicalRecordNumber: p.medical_record_number,
      firstName: p.first_name,
      lastName: p.last_name,
      dateOfBirth: p.date_of_birth,
      gender: p.gender,
      bloodType: p.blood_type,
      birthWeightGrams: p.birth_weight_grams,
      birthHeightCm: p.birth_height_cm,
      apgar1min: p.apgar_1min,
      apgar5min: p.apgar_5min,
      gestationalWeeks: p.gestational_weeks,
      birthNotes: p.birth_notes,
      allergies: p.allergies,
      chronicConditions: p.chronic_conditions,
      insuranceProvider: p.insurance_provider,
      insurancePolicyNumber: p.insurance_policy_number,
      profileImageUrl: p.profile_image_url,
      notes: p.notes,
      parents: p.parents,
      emergencyContacts: p.emergency_contacts,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    });
  } catch (error) {
    logger.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to get patient' });
  }
});

// Create patient
router.post('/', authenticateToken, requireMedicalStaff, [
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('dateOfBirth').isDate(),
  body('gender').isIn(['male', 'female', 'other'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    clinicId, doctorId, firstName, lastName, dateOfBirth, gender, bloodType,
    birthWeightGrams, birthHeightCm, apgar1min, apgar5min, gestationalWeeks, birthNotes,
    allergies, chronicConditions, insuranceProvider, insurancePolicyNumber, notes,
    parentId
  } = req.body;

  try {
    // Generate medical record number
    const countResult = await query('SELECT COUNT(*) FROM patients');
    const mrn = `MR${String(parseInt(countResult.rows[0].count) + 1).padStart(6, '0')}`;

    // Determine doctor assignment
    let assignedDoctorId = doctorId || null;
    let finalClinicId = clinicId || null;

    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id, clinic_id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length > 0) {
        assignedDoctorId = docRes.rows[0].id;
        finalClinicId = docRes.rows[0].clinic_id;
      }
    } else {
      // If secretary/admin created it and assigned a doctor, use the doctor's clinic!
      if (assignedDoctorId) {
        const docRes = await query('SELECT clinic_id FROM doctors WHERE id = $1', [assignedDoctorId]);
        if (docRes.rows.length > 0) {
          finalClinicId = finalClinicId || docRes.rows[0].clinic_id;
        }
      }
      
      // If still no clinic (e.g., secretary didn't assign a doctor), use secretary's first clinic
      if (!finalClinicId && req.user.role === 'secretary') {
        const secRes = await query(
          'SELECT clinic_id FROM secretary_clinics WHERE secretary_id = (SELECT id FROM secretaries WHERE user_id = $1) LIMIT 1', 
          [req.user.id]
        );
        if (secRes.rows.length > 0) {
          finalClinicId = secRes.rows[0].clinic_id;
        }
      }
    }

    const result = await query(
      `INSERT INTO patients (
        clinic_id, doctor_id, medical_record_number, first_name, last_name, date_of_birth, gender, blood_type,
        birth_weight_grams, birth_height_cm, apgar_1min, apgar_5min, gestational_weeks, birth_notes,
        allergies, chronic_conditions, insurance_provider, insurance_policy_number, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        finalClinicId, assignedDoctorId, mrn, firstName, lastName, dateOfBirth, gender, bloodType || 'unknown',
        birthWeightGrams, birthHeightCm, apgar1min, apgar5min, gestationalWeeks, birthNotes,
        allergies || [], chronicConditions || [], insuranceProvider, insurancePolicyNumber, notes
      ]
    );

    const newPatient = result.rows[0];

    // Link to parent if provided
    if (parentId) {
      await query(
        `INSERT INTO patient_parents (patient_id, parent_id, is_primary_contact)
         VALUES ($1, $2, true)`,
        [newPatient.id, parentId]
      );
    }

    await logAudit(req.user.id, 'CREATE_PATIENT', 'patients', newPatient.id, null, { firstName, lastName }, req);

    res.status(201).json({
      id: newPatient.id,
      medicalRecordNumber: newPatient.medical_record_number,
      firstName: newPatient.first_name,
      lastName: newPatient.last_name,
      dateOfBirth: newPatient.date_of_birth,
      gender: newPatient.gender
    });
  } catch (error) {
    logger.error('Create patient error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// Update patient
router.put('/:id', authenticateToken, requireMedicalStaff, async (req, res) => {
  const {
    firstName, lastName, dateOfBirth, gender, bloodType, allergies, chronicConditions,
    insuranceProvider, insurancePolicyNumber, notes,
    birthWeightGrams, birthHeightCm, gestationalWeeks
  } = req.body;

  try {
    const oldResult = await query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Ownership check for doctors
    if (req.user.role === 'doctor') {
      const docRes = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length === 0 || oldResult.rows[0].doctor_id !== docRes.rows[0].id) {
        return res.status(403).json({ error: 'Access denied: You can only edit your own patients' });
      }
    }

    const result = await query(
      `UPDATE patients SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        date_of_birth = COALESCE($3, date_of_birth),
        gender = COALESCE($4, gender),
        blood_type = COALESCE($5, blood_type),
        allergies = COALESCE($6, allergies),
        chronic_conditions = COALESCE($7, chronic_conditions),
        insurance_provider = COALESCE($8, insurance_provider),
        insurance_policy_number = COALESCE($9, insurance_policy_number),
        notes = COALESCE($10, notes),
        birth_weight_grams = COALESCE($11, birth_weight_grams),
        birth_height_cm = COALESCE($12, birth_height_cm),
        gestational_weeks = COALESCE($13, gestational_weeks),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING *`,
      [firstName, lastName, dateOfBirth, gender, bloodType, allergies, chronicConditions,
        insuranceProvider, insurancePolicyNumber, notes,
        birthWeightGrams, birthHeightCm, gestationalWeeks, req.params.id]
    );

    await logAudit(req.user.id, 'UPDATE_PATIENT', 'patients', req.params.id, oldResult.rows[0], result.rows[0], req);

    const p = result.rows[0];
    res.json({
      id: p.id,
      medicalRecordNumber: p.medical_record_number,
      firstName: p.first_name,
      lastName: p.last_name,
      dateOfBirth: p.date_of_birth,
      gender: p.gender,
      bloodType: p.blood_type,
      allergies: p.allergies,
      chronicConditions: p.chronic_conditions,
      insuranceProvider: p.insurance_provider,
      insurancePolicyNumber: p.insurance_policy_number,
      birthWeightGrams: p.birth_weight_grams,
      birthHeightCm: p.birth_height_cm,
      gestationalWeeks: p.gestational_weeks
    });
  } catch (error) {
    logger.error('Update patient error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Add parent to patient
router.post('/:id/parents', authenticateToken, requireMedicalStaff, [
  body('parentId').isUUID(),
  body('relationship').optional()
], async (req, res) => {
  const { parentId, relationship, isPrimaryContact } = req.body;

  try {
    await query(
      `INSERT INTO patient_parents (patient_id, parent_id, relationship, is_primary_contact)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (patient_id, parent_id) DO UPDATE SET relationship = $3`,
      [req.params.id, parentId, relationship || 'parent', isPrimaryContact || false]
    );

    res.json({ message: 'Parent linked successfully' });
  } catch (error) {
    logger.error('Add parent error:', error);
    res.status(500).json({ error: 'Failed to add parent' });
  }
});

// Search patients by parent DUI
router.get('/search/by-parent-dui', authenticateToken, requireMedicalStaff, async (req, res) => {
  const { dui } = req.query;

  if (!dui) {
    return res.status(400).json({ error: 'DUI is required' });
  }

  try {
    const result = await query(
      `SELECT p.*, u.first_name as parent_first_name, u.last_name as parent_last_name
       FROM patients p
       JOIN patient_parents pp ON p.id = pp.patient_id
       JOIN parents par ON pp.parent_id = par.id
       JOIN users u ON par.user_id = u.id
       WHERE u.dui = $1 AND p.is_active = true`,
      [dui]
    );

    res.json(result.rows.map(p => ({
      id: p.id,
      medicalRecordNumber: p.medical_record_number,
      firstName: p.first_name,
      lastName: p.last_name,
      dateOfBirth: p.date_of_birth,
      parentName: `${p.parent_first_name} ${p.parent_last_name}`
    })));
  } catch (error) {
    logger.error('Search by parent DUI error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Delete patient (soft delete or hard delete based on history)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { force } = req.query; // force=true for hard delete

  try {
    // Check if patient exists
    const patientResult = await query(
      'SELECT * FROM patients WHERE id = $1',
      [id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const patient = patientResult.rows[0];

    // Check for related records
    const consultationsResult = await query(
      'SELECT COUNT(*) FROM consultations WHERE patient_id = $1',
      [id]
    );
    const hasConsultations = parseInt(consultationsResult.rows[0].count) > 0;

    if (hasConsultations && force !== 'true') {
      // Soft delete - just mark as inactive
      await query(
        'UPDATE patients SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      await logAudit(req.user.id, 'SOFT_DELETE_PATIENT', 'patients', id, patient, null, req);

      return res.json({
        message: 'Paciente desactivado (tiene historial médico)',
        softDelete: true
      });
    }

    // Hard delete - remove all related records
    // Delete in order due to foreign key constraints
    await query('DELETE FROM growth_measurements WHERE patient_id = $1', [id]);
    await query('DELETE FROM patient_vaccinations WHERE patient_id = $1', [id]);
    await query('DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE consultation_id IN (SELECT id FROM consultations WHERE patient_id = $1))', [id]);
    await query('DELETE FROM prescriptions WHERE consultation_id IN (SELECT id FROM consultations WHERE patient_id = $1)', [id]);
    await query('DELETE FROM consultations WHERE patient_id = $1', [id]);
    await query('DELETE FROM appointments WHERE patient_id = $1', [id]);
    await query('DELETE FROM patient_parents WHERE patient_id = $1', [id]);
    await query('DELETE FROM patients WHERE id = $1', [id]);

    await logAudit(req.user.id, 'DELETE_PATIENT', 'patients', id, patient, null, req);

    res.json({ message: 'Paciente eliminado permanentemente', hardDelete: true });
  } catch (error) {
    logger.error('Delete patient error:', error);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
});

// Get patient growth data
router.get('/:id/growth', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM growth_measurements 
       WHERE patient_id = $1 
       ORDER BY measurement_date ASC`,
      [req.params.id]
    );

    res.json(result.rows.map(g => ({
      id: g.id,
      measurementDate: g.measurement_date,
      ageMonths: g.age_months,
      weightKg: g.weight_kg,
      heightCm: g.height_cm,
      headCircumferenceCm: g.head_circumference_cm,
      bmi: g.bmi,
      weightPercentile: g.weight_percentile,
      heightPercentile: g.height_percentile,
      bmiPercentile: g.bmi_percentile,
      headPercentile: g.head_percentile
    })));
  } catch (error) {
    logger.error('Get growth data error:', error);
    res.status(500).json({ error: 'Failed to get growth data' });
  }
});

// Get available parents to assign
router.get('/parents/available', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT par.id as parent_id, u.id as user_id, u.first_name, u.last_name, u.phone, u.email, u.dui
      FROM parents par
      JOIN users u ON par.user_id = u.id
      WHERE u.status = 'active'
    `;
    const params = [];
    if (search) {
      sql += ` AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.dui ILIKE $1)`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY u.last_name, u.first_name LIMIT 20`;

    const result = await query(sql, params);
    res.json(result.rows.map(r => ({
      parentId: r.parent_id,
      userId: r.user_id,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      email: r.email,
      dui: r.dui
    })));
  } catch (error) {
    logger.error('Get available parents error:', error);
    res.status(500).json({ error: 'Failed to get parents' });
  }
});

// Remove parent from patient
router.delete('/:id/parents/:parentId', authenticateToken, requireMedicalStaff, async (req, res) => {
  try {
    await query(
      'DELETE FROM patient_parents WHERE patient_id = $1 AND parent_id = $2',
      [req.params.id, req.params.parentId]
    );
    res.json({ message: 'Parent removed' });
  } catch (error) {
    logger.error('Remove parent error:', error);
    res.status(500).json({ error: 'Failed to remove parent' });
  }
});

module.exports = router;
