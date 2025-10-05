const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { swaggerUi, specs } = require('./swagger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Varaha SDC API Documentation'
}));

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'varaosrc_prc',
  password: process.env.DB_PASSWORD || 'PRC!@#456&*(',
  database: process.env.DB_NAME || 'varaosrc_hospital_management',
  port: parseInt(process.env.DB_PORT || '3306'),
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Health Check
 *     description: Returns API status and version
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Varaha SDC API is running
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 documentation:
 *                   type: string
 *                   example: /api-docs
 */
// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Varaha SDC API is running', 
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Handle /api/ route for cPanel deployment
app.get('/api/', (req, res) => {
  res.json({ 
    message: 'Varaha SDC API is running', 
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Handle /api/health route
app.get('/api/health', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('SELECT 1');
    await connection.end();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed',
      config: {
        host: dbConfig.host,
        user: dbConfig.user,
        database: dbConfig.database,
        port: dbConfig.port
      },
      error: error.message
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('SELECT 1');
    await connection.end();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const patientRoutes = require('./routes/patients');
const reportsRoutes = require('./routes/reports');
const superadminRoutes = require('./routes/superadmin');
const adminModule = require('./routes/admin');
const adminRoutes = adminModule.router;
const doctorRoutes = require('./routes/doctor');
const consoleRoutes = require('./routes/console');
const accountsRoutes = require('./routes/accounts');
const receptionRoutes = require('./routes/reception');
const inventoryRoutes = require('./routes/inventory');

// Use routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/patients', patientRoutes);
app.use('/reports', reportsRoutes);
app.use('/superadmin', superadminRoutes);
app.use('/admin', adminRoutes);
app.use('/doctor', doctorRoutes);
app.use('/console', consoleRoutes);
app.use('/accounts', accountsRoutes);
app.use('/reception', receptionRoutes);
app.use('/inventory', inventoryRoutes);

// Add /api prefix routes for cPanel
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/console', consoleRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/reception', receptionRoutes);
app.use('/api/inventory', inventoryRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler with debug info
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// For cPanel deployment
module.exports = app;

// For local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Varaha API server running on port ${PORT}`);
  });
}