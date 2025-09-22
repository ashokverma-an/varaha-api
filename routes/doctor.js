const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

const dbConfig = {
  host: process.env.DB_HOST || '198.54.121.225',
      user: process.env.DB_USER || 'varaosrc_api_user',
      password: process.env.DB_PASSWORD || 'Akshay!@#2025',
      database: process.env.DB_NAME || 'varaosrc_hospital_api',
      port: parseInt(process.env.DB_PORT || '3306'),
      connectTimeout: 30000
};

/**
 * @swagger
 * /doctor/stats:
 *   get:
 *     tags: [Doctor]
 *     summary: Get doctor dashboard statistics
 *     description: Get statistics for doctor dashboard
 *     responses:
 *       200:
 *         description: Doctor statistics
 */
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });

    // Today's patients
    const [todayPatients] = await connection.execute(
      'SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [today]
    );
    
    // Pending reports
    const [pendingReports] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM patient_new p
      LEFT JOIN lab_banch lb ON lb.cro_number = p.cro
      WHERE lb.c_status = 0 OR lb.c_status IS NULL
    `);
    
    // Completed reports
    const [completedReports] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM lab_banch lb
      WHERE lb.c_status = 1 AND DATE(lb.added_on) = CURDATE()
    `);
    
    res.json({
      todayPatients: todayPatients[0].count,
      pendingReports: pendingReports[0].count,
      completedReports: completedReports[0].count
    });
    
  } catch (error) {
    console.error('Doctor stats error:', error);
    res.status(500).json({ error: 'Failed to fetch doctor stats' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/pending-patients:
 *   get:
 *     tags: [Doctor]
 *     summary: Get pending patients
 *     description: Get list of patients pending for doctor review
 *     responses:
 *       200:
 *         description: List of pending patients
 */
router.get('/pending-patients', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [patients] = await connection.execute(`
      SELECT 
        p.*,
        d.doctor_name,
        h.hospital_name,
        s.scan_name,
        lb.c_status,
        lb.remark
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
      LEFT JOIN lab_banch lb ON lb.cro_number = p.cro
      WHERE lb.c_status = 0 OR lb.c_status IS NULL
      ORDER BY p.patient_id DESC
      LIMIT 100
    `);
    
    res.json({
      success: true,
      data: patients,
      total: patients.length
    });
    
  } catch (error) {
    console.error('Doctor pending patients error:', error);
    res.status(500).json({ error: 'Failed to fetch pending patients' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/patient/{cro}:
 *   get:
 *     tags: [Doctor]
 *     summary: Get patient details
 *     description: Get detailed information about a specific patient
 *     parameters:
 *       - in: path
 *         name: cro
 *         required: true
 *         schema:
 *           type: string
 *         example: "CRO24011512345"
 *     responses:
 *       200:
 *         description: Patient details
 *       404:
 *         description: Patient not found
 */
router.get('/patient/:cro', async (req, res) => {
  let connection;
  try {
    const { cro } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [patients] = await connection.execute(`
      SELECT 
        p.*,
        d.doctor_name,
        h.hospital_name,
        s.scan_name,
        lb.c_status,
        lb.remark,
        lb.added_on as report_date
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
      LEFT JOIN lab_banch lb ON lb.cro_number = p.cro
      WHERE p.cro = ?
    `, [cro]);
    
    if (patients.length > 0) {
      res.json({
        success: true,
        data: patients[0]
      });
    } else {
      res.status(404).json({ error: 'Patient not found' });
    }
    
  } catch (error) {
    console.error('Doctor patient detail error:', error);
    res.status(500).json({ error: 'Failed to fetch patient detail' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/add-report:
 *   post:
 *     tags: [Doctor]
 *     summary: Add patient report
 *     description: Add or update patient report by doctor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cro, remark]
 *             properties:
 *               cro:
 *                 type: string
 *                 example: "CRO24011512345"
 *               report_detail:
 *                 type: string
 *                 example: "Scan results normal"
 *               remark:
 *                 type: string
 *                 example: "No abnormalities found"
 *     responses:
 *       200:
 *         description: Report added successfully
 */
router.post('/add-report', async (req, res) => {
  let connection;
  try {
    const { cro, report_detail, remark } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Check if report already exists
    const [existing] = await connection.execute(
      'SELECT * FROM lab_banch WHERE cro_number = ?', [cro]
    );
    
    if (existing.length > 0) {
      // Update existing report
      await connection.execute(`
        UPDATE lab_banch 
        SET remark = ?, c_status = 1, added_on = NOW()
        WHERE cro_number = ?
      `, [remark, cro]);
    } else {
      // Insert new report
      await connection.execute(`
        INSERT INTO lab_banch (cro_number, remark, c_status, added_on)
        VALUES (?, ?, 1, NOW())
      `, [cro, remark]);
    }
    
    res.json({
      success: true,
      message: 'Report added successfully'
    });
    
  } catch (error) {
    console.error('Doctor add report error:', error);
    res.status(500).json({ error: 'Failed to add report' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/daily-report:
 *   get:
 *     tags: [Doctor]
 *     summary: Get doctor daily report
 *     description: Get daily report of patients for doctor
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         example: "15-01-2024"
 *     responses:
 *       200:
 *         description: Daily report data
 */
router.get('/daily-report', async (req, res) => {
  let connection;
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    connection = await mysql.createConnection(dbConfig);
    
    const [reports] = await connection.execute(`
      SELECT 
        p.*,
        d.doctor_name,
        h.hospital_name,
        s.scan_name,
        lb.c_status,
        lb.remark,
        lb.added_on
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
      LEFT JOIN lab_banch lb ON lb.cro_number = p.cro
      WHERE p.date = ?
      ORDER BY p.patient_id DESC
    `, [reportDate]);
    
    res.json({
      success: true,
      data: reports,
      date: reportDate,
      total: reports.length
    });
    
  } catch (error) {
    console.error('Doctor daily report error:', error);
    res.status(500).json({ error: 'Failed to fetch daily report' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;