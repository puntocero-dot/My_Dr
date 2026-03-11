-- Migration: Add doctor_id to patients

ALTER TABLE patients 
ADD COLUMN doctor_id UUID REFERENCES doctors(id);

-- Optional: Create index for faster filtering
CREATE INDEX idx_patients_doctor ON patients(doctor_id);
