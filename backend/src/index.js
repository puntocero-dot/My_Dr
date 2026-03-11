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

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - must be before other middleware
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Strict block of wildcards in production
    if (process.env.NODE_ENV === 'production' && allowedOrigins.includes('*')) {
      return callback(new Error('Wildcard origins are not allowed in production'), false);
    }

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy: Origin not allowed'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Security middleware (disabled CSP for development)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting (increased for development)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 requests per minute
  skip: () => process.env.NODE_ENV === 'development'
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
