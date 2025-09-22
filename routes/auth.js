const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Try different database configurations
const dbConfigs = [
  {
    name: 'New API Database',
    config: {
       host: process.env.DB_HOST || '198.54.121.225',
      user: process.env.DB_USER || 'varaosrc_api_user',
      password: process.env.DB_PASSWORD || 'Akshay!@#2025',
      database: process.env.DB_NAME || 'varaosrc_hospital_api',
      port: parseInt(process.env.DB_PORT || '3306'),
      connectTimeout: 30000
    }
  },
  {
    name: 'Original SDC Database',
    config: {
      host: 'localhost',
      user: 'varaosrc_sdc',
      password: 'SDC@123',
      database: 'varaosrc_sdc_admin',
      port: 3306,
      connectTimeout: 30000
    }
  },
  {
    name: 'Alternative Database',
    config: {
      host: 'localhost',
      user: 'varaosrc_prc',
      password: 'PRC!@#456&*(',
      database: 'varaosrc_hospital_management',
      port: 3306,
      connectTimeout: 30000
    }
  }
];

// Use the working database configuration
const dbConfig = dbConfigs[2].config; // Alternative Database that works

// Debug database configuration (remove in production)
console.log('Auth DB Config:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with username and password (same as sdc_admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             superadmin:
 *               summary: Superadmin login
 *               value:
 *                 username: superadmin
 *                 password: Super@321
 *             admin:
 *               summary: Admin login
 *               value:
 *                 username: admin
 *                 password: Admin@Varaha
 *             reception:
 *               summary: Reception login
 *               value:
 *                 username: reception
 *                 password: Admin@321
 *             doctor:
 *               summary: Doctor login
 *               value:
 *                 username: doctor
 *                 password: Admin@321
 *             console:
 *               summary: Console login
 *               value:
 *                 username: console
 *                 password: Admin@321
 *             accounts:
 *               summary: Accounts login
 *               value:
 *                 username: accounts
 *                 password: Admin@321
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: "superadmin"
 *                     role:
 *                       type: string
 *                       example: "superadmin"
 *                     name:
 *                       type: string
 *                       example: "Super Administrator"
 *                     loginTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Bad request - Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Username and password are required"
 *                 code:
 *                   type: string
 *                   example: "MISSING_CREDENTIALS"
 *       401:
 *         description: Unauthorized - Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid username or password"
 *                 code:
 *                   type: string
 *                   example: "INVALID_CREDENTIALS"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "An unexpected error occurred. Please try again later."
 *                 code:
 *                   type: string
 *                   example: "INTERNAL_SERVER_ERROR"
 *       503:
 *         description: Service unavailable - Database connection failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Database connection failed. Please try again later."
 *                 code:
 *                   type: string
 *                   example: "DB_CONNECTION_ERROR"
 */
router.post('/login', async (req, res) => {
  let connection;
  try {
    // Input validation
    const { username, password } = req.body;
    
    // Check if required fields are provided
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Validate input format
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Username and password must be strings',
        code: 'INVALID_FORMAT'
      });
    }
    
    // Check minimum length
    if (username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters long',
        code: 'USERNAME_TOO_SHORT'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    // Sanitize inputs
    const sanitizedUsername = username.trim().toLowerCase();
    
    // Database connection with timeout handling
    try {
      console.log('Attempting database connection...');
      connection = await mysql.createConnection(dbConfig);
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection error details:', {
        message: dbError.message,
        code: dbError.code,
        errno: dbError.errno,
        sqlState: dbError.sqlState,
        config: {
          host: dbConfig.host,
          user: dbConfig.user,
          database: dbConfig.database,
          port: dbConfig.port
        }
      });
      return res.status(503).json({
        success: false,
        error: 'Database connection failed. Please try again later.',
        code: 'DB_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
    
    // Query database with proper error handling
    let users;
    try {
      [users] = await connection.execute(
        'SELECT admin_id, username, admin_type, email FROM admin WHERE LOWER(username) = ? AND password = ?',
        [sanitizedUsername, password]
      );
    } catch (queryError) {
      console.error('Database query error:', queryError);
      return res.status(500).json({
        success: false,
        error: 'Database query failed. Please try again later.',
        code: 'DB_QUERY_ERROR'
      });
    }
    
    // Check if user exists and credentials are valid
    if (!Array.isArray(users) || users.length === 0) {
      // Log failed login attempt (without exposing sensitive info)
      console.warn(`Failed login attempt for username: ${sanitizedUsername} at ${new Date().toISOString()}`);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Successful login
    const user = users[0];
    
    // Log successful login
    console.log(`Successful login for user: ${user.username} (${user.admin_type}) at ${new Date().toISOString()}`);
    
    // Return user data (excluding sensitive information)
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.admin_id,
        username: user.username,
        role: user.admin_type,
        email: user.email,
        loginTime: new Date().toISOString()
      }
    });
    
  } catch (error) {
    // Log the full error for debugging
    console.error('Unexpected login error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Return generic error to client
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL_SERVER_ERROR'
    });
  } finally {
    // Ensure database connection is always closed
    if (connection) {
      try {
        await connection.end();
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
});

// Test admin table structure
router.get('/test-admin', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Check table structure
    const [columns] = await connection.execute('DESCRIBE admin');
    
    // Get sample data
    const [sampleData] = await connection.execute('SELECT * FROM admin LIMIT 3');
    
    res.json({
      success: true,
      columns: columns,
      sampleData: sampleData
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Test all database configurations
router.get('/test-db', async (req, res) => {
  const results = [];
  
  for (const dbTest of dbConfigs) {
    let connection;
    try {
      console.log(`Testing ${dbTest.name}:`, {
        host: dbTest.config.host,
        user: dbTest.config.user,
        database: dbTest.config.database,
        port: dbTest.config.port
      });
      
      connection = await mysql.createConnection(dbTest.config);
      
      // Test basic query
      const [result] = await connection.execute('SELECT 1 as test');
      
      // Test admin table exists
      const [tables] = await connection.execute('SHOW TABLES LIKE "admin"');
      
      results.push({
        name: dbTest.name,
        success: true,
        testQuery: result[0],
        adminTableExists: tables.length > 0,
        config: {
          host: dbTest.config.host,
          user: dbTest.config.user,
          database: dbTest.config.database,
          port: dbTest.config.port
        }
      });
      
    } catch (error) {
      console.error(`${dbTest.name} failed:`, error.message);
      results.push({
        name: dbTest.name,
        success: false,
        error: error.message,
        code: error.code,
        errno: error.errno
      });
    } finally {
      if (connection) await connection.end();
    }
  }
  
  res.json({
    message: 'Database connection tests completed',
    results: results,
    workingConfigs: results.filter(r => r.success)
  });
});

// Download Postman Collection
router.get('/postman-collection', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="Varaha-SDC-API-Collection.json"');
  
  const postmanCollection = {
    "info": {
      "name": "Varaha SDC Hospital Management API",
      "description": "Complete API collection for Varaha SDC Hospital Management System",
      "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "variable": [
      {
        "key": "baseUrl",
        "value": "https://varahasdc.co.in/api",
        "type": "string"
      }
    ],
    "item": [
      {
        "name": "Authentication",
        "item": [
          {
            "name": "Login - Superadmin",
            "request": {
              "method": "POST",
              "header": [{"key": "Content-Type", "value": "application/json"}],
              "body": {"mode": "raw", "raw": "{\n  \"username\": \"superadmin\",\n  \"password\": \"Super@321\"\n}"},
              "url": {"raw": "{{baseUrl}}/auth/login", "host": ["{{baseUrl}}"], "path": ["auth", "login"]}
            }
          },
          {
            "name": "Login - Admin",
            "request": {
              "method": "POST",
              "header": [{"key": "Content-Type", "value": "application/json"}],
              "body": {"mode": "raw", "raw": "{\n  \"username\": \"admin\",\n  \"password\": \"Admin@Varaha\"\n}"},
              "url": {"raw": "{{baseUrl}}/auth/login", "host": ["{{baseUrl}}"], "path": ["auth", "login"]}
            }
          },
          {
            "name": "Login - Doctor",
            "request": {
              "method": "POST",
              "header": [{"key": "Content-Type", "value": "application/json"}],
              "body": {"mode": "raw", "raw": "{\n  \"username\": \"doctor\",\n  \"password\": \"Admin@321\"\n}"},
              "url": {"raw": "{{baseUrl}}/auth/login", "host": ["{{baseUrl}}"], "path": ["auth", "login"]}
            }
          },
          {
            "name": "Login - Reception",
            "request": {
              "method": "POST",
              "header": [{"key": "Content-Type", "value": "application/json"}],
              "body": {"mode": "raw", "raw": "{\n  \"username\": \"reception\",\n  \"password\": \"Admin@321\"\n}"},
              "url": {"raw": "{{baseUrl}}/auth/login", "host": ["{{baseUrl}}"], "path": ["auth", "login"]}
            }
          },
          {
            "name": "Login - Console",
            "request": {
              "method": "POST",
              "header": [{"key": "Content-Type", "value": "application/json"}],
              "body": {"mode": "raw", "raw": "{\n  \"username\": \"console\",\n  \"password\": \"Admin@321\"\n}"},
              "url": {"raw": "{{baseUrl}}/auth/login", "host": ["{{baseUrl}}"], "path": ["auth", "login"]}
            }
          },
          {
            "name": "Login - Accounts",
            "request": {
              "method": "POST",
              "header": [{"key": "Content-Type", "value": "application/json"}],
              "body": {"mode": "raw", "raw": "{\n  \"username\": \"accounts\",\n  \"password\": \"Admin@321\"\n}"},
              "url": {"raw": "{{baseUrl}}/auth/login", "host": ["{{baseUrl}}"], "path": ["auth", "login"]}
            }
          }
        ]
      }
    ]
  };
  
  res.json(postmanCollection);
});

// Next.js Integration Guide
router.get('/integration-guide', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const guidePath = path.join(__dirname, '..', 'nextjs-integration.md');
    const guideContent = fs.readFileSync(guidePath, 'utf8');
    
    res.setHeader('Content-Type', 'text/markdown');
    res.send(guideContent);
  } catch (error) {
    res.status(404).json({ error: 'Integration guide not found' });
  }
});

module.exports = router;