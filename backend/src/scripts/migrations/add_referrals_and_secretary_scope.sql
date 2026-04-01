-- Migration: Multi-tenancy roles - referrals + secretary scope
-- Run once against the production database

-- 0. Allow doctors without medical license (admin-created doctors)
ALTER TABLE doctors ALTER COLUMN medical_license DROP NOT NULL;

-- 1. Add scope fields to secretaries
ALTER TABLE secretaries
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'clinic'
    CHECK (scope IN ('clinic', 'personal')),
  ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL;

COMMENT ON COLUMN secretaries.scope IS
  'clinic = manages all doctors in clinic, personal = manages only assigned_doctor_id';

-- 2. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    from_doctor_id UUID NOT NULL REFERENCES doctors(id),
    to_doctor_id UUID NOT NULL REFERENCES doctors(id),
    authorized_by UUID REFERENCES users(id),  -- doctor or secretary who authorized
    reason TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'completed', 'revoked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT referrals_different_doctors CHECK (from_doctor_id != to_doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_to_doctor ON referrals(to_doctor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
