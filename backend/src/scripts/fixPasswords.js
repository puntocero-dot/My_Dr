const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixPasswords() {
  try {
    const hash = await bcrypt.hash('123456', 10);
    console.log('Generated hash:', hash);
    
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 RETURNING email',
      [hash]
    );
    
    console.log('Updated users:', result.rows.map(r => r.email));
    
    // Verify
    const verify = await pool.query('SELECT email, password_hash FROM users');
    for (const user of verify.rows) {
      const valid = await bcrypt.compare('123456', user.password_hash);
      console.log(`${user.email}: password valid = ${valid}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPasswords();
