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
 * /superadmin/stats:
 *   get:
 *     tags: [Superadmin]
 *     summary: Get superadmin dashboard statistics
 *     description: Get comprehensive statistics for superadmin dashboard
 *     responses:
 *       200:
 *         description: Superadmin statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 todayScans:
 *                   type: integer
 *                   example: 25
 *                 todayReceived:
 *                   type: number
 *                   example: 5000.00
 *                 todayDue:
 *                   type: number
 *                   example: 1500.00
 *                 todayWithdraw:
 *                   type: number
 *                   example: 500.00
 *                 cashInHand:
 *                   type: number
 *                   example: 3000.00
 *                 totalAmount:
 *                   type: number
 *                   example: 6500.00
 */
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Exact same date format as PHP: $d = $now->format("d-m-Y");
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });

    // MariaDB compatible queries - exact same as PHP
    const [totalAmountResult] = await connection.execute(
      'SELECT COALESCE(SUM(amount), 0) as total FROM patient_new WHERE date = ?', [today]
    );
    const totalAmount = parseFloat(totalAmountResult[0]?.total || 0);
    
    // MariaDB compatible - handle NULL values
    const [transactionResults] = await connection.execute(
      'SELECT COALESCE(withdraw, 0) as withdraw, COALESCE(r_amount, 0) as r_amount, COALESCE(d_amount, 0) as d_amount FROM today_transeciton WHERE added_on = ?', [today]
    );
    
    // Count patients for today
    const [patientCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [today]
    );
    const count = patientCount[0]?.count || 0;
    
    // Exact same PHP logic: $c=0; $d=0; $w=0; $t=0;
    let c = 0; // received
    let d = 0; // due  
    let w = 0; // withdraw
    let t = 0; // total_scan
    
    // MariaDB compatible - sum calculations
    transactionResults.forEach(r => {
      w = w + parseFloat(r.withdraw || 0);
      c = c + parseFloat(r.r_amount || 0);
      d = d + parseFloat(r.d_amount || 0);
    });
    
    // Get total scans from patient_new table
    const [scanResults] = await connection.execute(
      'SELECT COALESCE(SUM(total_scan), 0) as total_scans FROM patient_new WHERE date = ?', [today]
    );
    t = parseInt(scanResults[0]?.total_scans || 0);
    
    // Exact same PHP logic: $h = $c-$d-$w;
    const h = c - d - w;
    
    res.json({
      todayScans: count,                    // $count (CT-Scan)
      todayReceived: c,                     // $c (Received Amount)
      todayDue: d,                         // $d (Due Amount)
      todayWithdraw: w,                    // $w (Withdraw)
      cashInHand: h <= 0 ? 0 : h,         // if($h<=0){echo 0;}else{echo $h;}
      totalAmount: totalAmount             // $totalAmount (Total Amount)
    });
    
  } catch (error) {
    console.error('Superadmin stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch superadmin stats',
      details: error.message,
      stack: error.stack,
      today: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      })
    });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /superadmin/patient-report:
 *   get:
 *     tags: [Superadmin]
 *     summary: Get comprehensive patient report
 *     description: Get detailed patient report for superadmin (same as sdc_admin)
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
 *         description: Comprehensive patient report
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
 *                     type: object
 *                     properties:
 *                       p_id:
 *                         type: integer
 *                       cro_number:
 *                         type: string
 *                       patient_name:
 *                         type: string
 *                       dname:
 *                         type: string
 *                       h_name:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       remark:
 *                         type: string
 *                       date:
 *                         type: string
 *                       age:
 *                         type: integer
 *                       gender:
 *                         type: string
 *                       mobile:
 *                         type: string
 *                 total:
 *                   type: integer
 */
router.get('/patient-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    const fromDate = from_date || new Date().toISOString().split('T')[0];
    const toDate = to_date || new Date().toISOString().split('T')[0];
    
    connection = await mysql.createConnection(dbConfig);
    
    // MariaDB compatible query - same as sdc_admin superadmin/patient_report.php
    const query = `
      SELECT 
        lab_banch.p_id,
        lab_banch.cro_number,
        patient_new.patient_name,
        doctor.doctor_name as dname,
        hospital.hospital_name as h_name,
        COALESCE(patient_new.amount, 0) as amount,
        COALESCE(lab_banch.remark, '') as remark,
        patient_new.date,
        COALESCE(patient_new.age, 0) as age,
        COALESCE(patient_new.gender, '') as gender,
        COALESCE(patient_new.mobile, '') as mobile
      FROM lab_banch
      INNER JOIN patient_new ON patient_new.cro = lab_banch.cro_number
      INNER JOIN hospital ON hospital.h_id = patient_new.hospital_id 
      INNER JOIN doctor ON doctor.d_id = patient_new.doctor_name 
      WHERE STR_TO_DATE(patient_new.date, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
      ORDER BY lab_banch.p_id DESC
      LIMIT 1000
    `;
    
    const [patients] = await connection.execute(query, [fromDate, toDate]);
    
    res.json({
      success: true,
      data: patients,
      total: Array.isArray(patients) ? patients.length : 0
    });
    
  } catch (error) {
    console.error('Superadmin patient report error:', error);
    res.status(500).json({ error: 'Failed to fetch patient report' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;