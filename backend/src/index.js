require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const logger = require('./config/logger');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const consultationRoutes = require('./routes/consultations');
const prescriptionRoutes = require('./routes/prescriptions');
const vaccinationRoutes = require('./routes/vaccinations');
const documentRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const clinicRoutes = require('./routes/clinics');
const dashboardRoutes = require('./routes/dashboard');
const growthRoutes = require('./routes/growth');
const preferencesRoutes = require('./routes/preferences');
const scheduleRoutes = require('./routes/schedule');
const labExamsRoutes = require('./routes/labExams');
const referralsRoutes = require('./routes/referrals');
const specialtiesRoutes = require('./routes/specialties');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - must be before other middleware
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list manually or via regex/includes
    const isAllowed = allowedOrigins.includes(origin) || 
                      allowedOrigins.some(ao => ao === '*' || (ao.includes('*') && origin.match(new RegExp(ao.replace(/\*/g, '.*')))));

    if (isAllowed) {
      callback(null, true);
    } else {
      // Log exactly which origin was rejected to help debugging
      logger.error(`CORS Policy: Origin ${origin} not allowed. Current allowed origins configuration: ${process.env.CORS_ORIGINS || 'defaults'}`);
      callback(new Error(`CORS Policy: Origin ${origin} not allowed`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Security middleware (disabled CSP for development)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 requests per minute
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/vaccinations', vaccinationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/lab-exams', labExamsRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/specialties', specialtiesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Auto-run DB migrations on startup
const fs = require('fs');
const path = require('path');
async function runMigrations() {
  try {
    const migrationPath = path.join(__dirname, 'scripts', 'migrations', 'add_preferences_and_schedule.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
      logger.info('Preferences and Schedule migration executed successfully');
    }
    
    const specSql = `CREATE TABLE IF NOT EXISTS specialties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;
    await pool.query(specSql);
    logger.info('Specialties table created successfully');
    
    // Add default pediatric specialties if none exist
    const checkSpec = await pool.query('SELECT count(*) FROM specialties');
    if (parseInt(checkSpec.rows[0].count) === 0) {
      await pool.query(`INSERT INTO specialties (name, description) VALUES 
        ('Pediatría General', 'Atención médica integral de niños y adolescentes'),
        ('Cardiología Pediátrica', 'Diagnóstico y tratamiento de enfermedades del corazón en niños'),
        ('Neurología Pediátrica', 'Atención de trastornos del sistema nervioso en niños'),
        ('Nutrición Pediátrica', 'Evaluación y tratamiento nutricional infantil'),
        ('Gastroenterología Pediátrica', 'Enfermedades del sistema digestivo en niños')
      `);
      logger.info('Default specialties registered');
    }
    
    // Add max_application_age_months to vaccines
    await pool.query(`ALTER TABLE vaccines ADD COLUMN IF NOT EXISTS max_application_age_months INTEGER;`);
    logger.info('Checked vaccines column max_application_age_months');
    
    // Seed real expiration limits for core vaccines where applicable
    await pool.query(`
      UPDATE vaccines SET max_application_age_months = CASE
        WHEN abbreviation = 'BCG' THEN 12
        WHEN name ILIKE '%Rotavirus%' THEN 8
        WHEN abbreviation IN ('HepB', 'Hepatitis B') THEN 12
        WHEN abbreviation IN ('DPT-HepB-Hib', 'Pentavalente', 'Polio', 'OPV', 'Neumococo', 'PCV13') THEN 60
        WHEN abbreviation IN ('SRP', 'DPT') THEN 120
      ELSE 216 END
      WHERE max_application_age_months IS NULL;
    `);
    
  } catch (error) {
    logger.error('Error running migrations:', error);
  }
}
runMigrations();

// Start server
app.listen(PORT, () => {
  logger.info(`My_Dr Backend running on port ${PORT}`);
  console.log(`🏥 My_Dr Backend running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});
