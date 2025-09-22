const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Varaha SDC Hospital Management API',
      version: '1.0.0',
      description: 'Complete API for Varaha SDC Hospital Management System - migrated from PHP sdc_admin',
      contact: {
        name: 'Varaha SDC',
        url: 'https://varahasdc.co.in'
      }
    },
    servers: [
      {
        url: 'https://varahasdc.co.in/api',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              example: 'superadmin'
            },
            password: {
              type: 'string',
              example: 'Super@321'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                username: { type: 'string', example: 'superadmin' },
                role: { type: 'string', example: 'superadmin' },
                name: { type: 'string', example: 'Super Administrator' }
              }
            }
          }
        },
        Patient: {
          type: 'object',
          properties: {
            patient_id: { type: 'integer', example: 1 },
            cro: { type: 'string', example: 'CRO001' },
            patient_name: { type: 'string', example: 'John Doe' },
            age: { type: 'integer', example: 35 },
            gender: { type: 'string', example: 'Male' },
            mobile: { type: 'string', example: '9876543210' },
            date: { type: 'string', example: '15-01-2024' },
            amount: { type: 'number', example: 1500.00 },
            doctor_name: { type: 'string', example: 'Dr. Smith' },
            hospital_name: { type: 'string', example: 'City Hospital' },
            scan_name: { type: 'string', example: 'CT Scan' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Error message'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication endpoints'
      },
      {
        name: 'Dashboard',
        description: 'Dashboard statistics'
      },
      {
        name: 'Admin',
        description: 'Admin role specific endpoints'
      },
      {
        name: 'Doctor',
        description: 'Doctor role specific endpoints'
      },
      {
        name: 'Console',
        description: 'Console operator endpoints'
      },
      {
        name: 'Accounts',
        description: 'Accounts management endpoints'
      },
      {
        name: 'Superadmin',
        description: 'Superadmin role endpoints'
      },
      {
        name: 'Reports',
        description: 'General reporting endpoints'
      },
      {
        name: 'Patients',
        description: 'Patient management endpoints'
      }
    ]
  },
  apis: [
    './routes/auth.js',
    './routes/patients.js', 
    './routes/dashboard.js',
    './routes/reports.js',
    './routes/admin.js',
    './routes/doctor.js',
    './routes/console.js',
    './routes/accounts.js',
    './routes/superadmin.js',
    './server.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };