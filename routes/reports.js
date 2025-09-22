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
 * /reports/patient-report:
 *   get:
 *     tags: [Reports]
 *     summary: Get patient report
 *     description: Returns patient report with date filtering (same as sdc_admin patient_list.php)
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (DD-MM-YYYY)
 *         example: 01-01-2024
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (DD-MM-YYYY)
 *         example: 31-01-2024
 *     responses:
 *       200:
 *         description: Patient report data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Patient'
 *                 total:
 *                   type: integer
 *                   example: 150
 */
router.get('/patient-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT 
        p.patient_id,
        p.cro,
        p.patient_name,
        p.age,
        p.gender,
        p.mobile,
        p.date,
        p.amount,
        d.doctor_name,
        h.hospital_name,
        s.scan_name
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
    `;
    
    const params = [];
    
    if (from_date && to_date) {
      query += ` WHERE STR_TO_DATE(p.date, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%d-%m-%Y') AND STR_TO_DATE(?, '%d-%m-%Y')`;
      params.push(from_date, to_date);
    }
    
    query += ` ORDER BY p.patient_id DESC LIMIT 1000`;
    
    const [patients] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: patients,
      total: Array.isArray(patients) ? patients.length : 0
    });
    
  } catch (error) {
    console.error('Patient report error:', error);
    res.status(500).json({ error: 'Failed to fetch patient report' });
  } finally {
    if (connection) await connection.end();
  }
});

// Daily revenue report
router.get('/daily-revenue', async (req, res) => {
  let connection;
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    connection = await mysql.createConnection(dbConfig);
    
    const [revenue] = await connection.execute(`
      SELECT 
        p.cro,
        p.patient_name,
        p.amount,
        d.doctor_name,
        h.hospital_name,
        t.r_amount,
        t.d_amount,
        t.withdraw
      FROM patient_new p
      JOIN today_transeciton t ON t.cro = p.cro
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      WHERE p.date = ?
      ORDER BY p.patient_id DESC
    `, [reportDate]);
    
    res.json({
      success: true,
      data: revenue,
      date: reportDate,
      total: Array.isArray(revenue) ? revenue.length : 0
    });
    
  } catch (error) {
    console.error('Daily revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch daily revenue' });
  } finally {
    if (connection) await connection.end();
  }
});

// Console report
router.get('/console-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT 
        lb.cro_number,
        lb.c_status,
        lb.added_on,
        p.patient_name,
        p.amount,
        d.doctor_name,
        h.hospital_name
      FROM lab_banch lb
      JOIN patient_new p ON p.cro = lb.cro_number
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
    `;
    
    const params = [];
    
    if (from_date && to_date) {
      query += ` WHERE DATE(STR_TO_DATE(p.date, '%d-%m-%Y')) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }
    
    query += ` ORDER BY lb.p_id DESC LIMIT 1000`;
    
    const [consoleData] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: consoleData,
      total: Array.isArray(consoleData) ? consoleData.length : 0
    });
    
  } catch (error) {
    console.error('Console report error:', error);
    res.status(500).json({ error: 'Failed to fetch console report' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /reports/financial-summary:
 *   get:
 *     tags: [Reports]
 *     summary: Get financial summary report
 *     description: Get comprehensive financial summary with revenue, expenses, and profit analysis
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-01"
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Financial summary data
 */
router.get('/financial-summary', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Get total revenue
    let revenueQuery = 'SELECT SUM(amount) as total_revenue, COUNT(*) as total_patients FROM patient_new';
    const params = [];
    
    if (from_date && to_date) {
      revenueQuery += ' WHERE STR_TO_DATE(date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
      params.push(from_date, to_date);
    }
    
    const [revenueResult] = await connection.execute(revenueQuery, params);
    
    // Get doctor-wise revenue
    let doctorQuery = `
      SELECT 
        d.doctor_name,
        SUM(p.amount) as doctor_revenue,
        COUNT(p.patient_id) as patient_count
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
    `;
    
    if (from_date && to_date) {
      doctorQuery += ' WHERE STR_TO_DATE(p.date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
    }
    
    doctorQuery += ' GROUP BY p.doctor_name, d.doctor_name ORDER BY doctor_revenue DESC';
    
    const [doctorRevenue] = await connection.execute(doctorQuery, params);
    
    // Get scan-wise revenue
    let scanQuery = `
      SELECT 
        s.scan_name,
        SUM(p.amount) as scan_revenue,
        COUNT(p.patient_id) as scan_count
      FROM patient_new p
      LEFT JOIN scan s ON s.scan_id = p.scan_type
    `;
    
    if (from_date && to_date) {
      scanQuery += ' WHERE STR_TO_DATE(p.date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
    }
    
    scanQuery += ' GROUP BY p.scan_type, s.scan_name ORDER BY scan_revenue DESC';
    
    const [scanRevenue] = await connection.execute(scanQuery, params);
    
    res.json({
      success: true,
      summary: {
        total_revenue: revenueResult[0]?.total_revenue || 0,
        total_patients: revenueResult[0]?.total_patients || 0,
        average_per_patient: revenueResult[0]?.total_revenue ? (revenueResult[0].total_revenue / revenueResult[0].total_patients).toFixed(2) : 0
      },
      doctor_wise: doctorRevenue,
      scan_wise: scanRevenue,
      period: { from_date, to_date }
    });
    
  } catch (error) {
    console.error('Financial summary error:', error);
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /reports/monthly-analytics:
 *   get:
 *     tags: [Reports]
 *     summary: Get monthly analytics
 *     description: Get monthly patient and revenue analytics
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         example: 2024
 *     responses:
 *       200:
 *         description: Monthly analytics data
 */
router.get('/monthly-analytics', async (req, res) => {
  let connection;
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [monthlyData] = await connection.execute(`
      SELECT 
        MONTH(STR_TO_DATE(date, '%d-%m-%Y')) as month,
        MONTHNAME(STR_TO_DATE(date, '%d-%m-%Y')) as month_name,
        COUNT(*) as patient_count,
        SUM(amount) as revenue
      FROM patient_new 
      WHERE YEAR(STR_TO_DATE(date, '%d-%m-%Y')) = ?
      GROUP BY MONTH(STR_TO_DATE(date, '%d-%m-%Y')), MONTHNAME(STR_TO_DATE(date, '%d-%m-%Y'))
      ORDER BY month
    `, [year]);
    
    res.json({
      success: true,
      year: year,
      monthly_data: monthlyData
    });
    
  } catch (error) {
    console.error('Monthly analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly analytics' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /reports/patient-status-report:
 *   get:
 *     tags: [Reports]
 *     summary: Get patient status report
 *     description: Get report of patients by status (registered, in-progress, completed, cancelled)
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "01-01-2024"
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "31-01-2024"
 *     responses:
 *       200:
 *         description: Patient status report
 */
router.get('/patient-status-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM patient_new
    `;
    
    const params = [];
    
    if (from_date && to_date) {
      query += ' WHERE STR_TO_DATE(date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
      params.push(from_date, to_date);
    }
    
    query += ' GROUP BY status ORDER BY count DESC';
    
    const [statusData] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: statusData,
      period: { from_date, to_date }
    });
    
  } catch (error) {
    console.error('Patient status report error:', error);
    res.status(500).json({ error: 'Failed to fetch patient status report' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;