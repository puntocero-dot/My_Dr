const { Client } = require('pg');

const connectionString = 'postgresql://postgres:AbBeNdwlMirTABiZZhnJBHemQXUdQMhe@switchback.proxy.rlwy.net:31758/railway';

async function migrate() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Add doctor_id column to patients if it doesn't exist
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id);');
    console.log('Column doctor_id added to patients table');
    
    // Create revoked_tokens table if it doesn't exist (requested in previous conversation but let's be sure)
    await client.query(`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        token TEXT PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table revoked_tokens ensured');

    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
