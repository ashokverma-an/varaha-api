const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

const dbConfig = {
  host: 'localhost',
  user: 'varaosrc_prc',
  password: 'PRC!@#456&*(',
  database: 'varaosrc_hospital_management',
  port: 3306,
  connectTimeout: 30000
};

// Database column mappings
const DB_COLUMNS = {
  patient_new: {
    id: 'patient_id',
    name: 'patient_name',
    mobile: 'contact_number',
    age: 'age',
    gender: 'gender',
    date: 'date',
    amount: 'amount',
    cro: 'cro',
    hospital_id: 'hospital_id',
    doctor_name: 'doctor_name',
    total_scan: 'total_scan',
    category: 'category',
    scan_type: 'scan_type'
  },
  doctor: {
    id: 'd_id',
    name: 'dname'
  },
  hospital: {
    id: 'h_id',
    name: 'h_name'
  },
  console: {
    id: 'con_id',
    cro: 'c_p_cro',
    examination_id: 'examination_id',
    number_films: 'number_films',
    number_scan: 'number_scan',
    number_contrast: 'number_contrast',
    issue_cd: 'issue_cd',
    start_time: 'start_time',
    stop_time: 'stop_time',
    status: 'status',
    technician_name: 'technician_name',
    added_on: 'added_on'
  },
  today_transeciton: {
    cro: 'cro',
    received: 'r_amount',
    due: 'd_amount',
    withdraw: 'withdraw',
    date: 'added_on'
  },
  nursing_patient: {
    id: 'p_id',
    name: 'n_patient_name',
    cro: 'n_patient_cro',
    age: 'n_patient_age',
    sex: 'n_patient_sex',
    address: 'n_patient_address',
    ct_scan: 'n_patient_ct',
    ct_report_date: 'n_patient_ct_report_date',
    ct_remark: 'n_patient_ct_remark',
    xray: 'n_patient_x_ray',
    xray_report_date: 'n_patient_x_ray_report_date',
    xray_remark: 'n_patient_x_ray_remark',
    status: 'r_status',
    ct_scan_doctor_id: 'ct_scan_doctor_id',
    added_on: 'added_on'
  }
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
router.get("/stats", async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Format today's date as dd-mm-yyyy (with dash)
    const now = new Date();
    const calcuttaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Calcutta" })
    );

    const dd = String(calcuttaTime.getDate()).padStart(2, "0");
    const mm = String(calcuttaTime.getMonth() + 1).padStart(2, "0"); // Month is 0-based
    const yyyy = calcuttaTime.getFullYear();
    const d = `${dd}-${mm}-${yyyy}`; // --> "09-02-2023"

    // 1. Total Amount for today
    const [totalAmountResult] = await connection.execute(
      "SELECT SUM(amount) as total FROM patient_new WHERE date = ?",
      [d]
    );
    const totalAmount = parseFloat(totalAmountResult[0]?.total || 0);

    // 2. Today's transactions
    const [transactionResults] = await connection.execute(
      "SELECT withdraw, r_amount, d_amount FROM today_transeciton WHERE added_on = ?",
      [d]
    );

    // 3. Today's patient count
    const [patientResults] = await connection.execute(
      "SELECT COUNT(*) as count, SUM(total_scan) as total_scans FROM patient_new WHERE date = ?",
      [d]
    );
    const count = patientResults[0]?.count || 0;

    // Same PHP logic
    let c = 0; // received
    let d_amt = 0; // due
    let w = 0; // withdraw

    transactionResults.forEach((r) => {
      w += parseFloat(r.withdraw || 0);
      c += parseFloat(r.r_amount || 0);
      d_amt += parseFloat(r.d_amount || 0);
    });

    const h = c - d_amt - w;

    res.json({
      todayDate: d,
      todayScans: count,
      todayReceived: c,
      todayDue: d_amt,
      todayWithdraw: w,
      cashInHand: h <= 0 ? 0 : h,
      totalAmount: totalAmount,
    });
  } catch (error) {
    console.error("Superadmin stats error:", error);
    res.status(500).json({
      error: "Failed to fetch superadmin stats",
      details: error.message,
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
// Test with actual production date format
router.get('/test-date', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Test different date formats
    const dates = [
      new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Calcutta"})).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      '21-09-2025', // Today's date
      '31-08-2025', // Last data date from debug
    ];
    
    const results = [];
    
    for (const testDate of dates) {
      const [patients] = await connection.execute('SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [testDate]);
      const [transactions] = await connection.execute('SELECT COUNT(*) as count FROM today_transeciton WHERE added_on = ?', [testDate]);
      const [totalAmount] = await connection.execute('SELECT SUM(amount) as total FROM patient_new WHERE date = ?', [testDate]);
      
      results.push({
        date: testDate,
        patients: patients[0].count,
        transactions: transactions[0].count,
        totalAmount: totalAmount[0].total || 0
      });
    }
    
    res.json({ results });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Debug endpoint to check data
router.get('/debug', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const now = new Date();
    const calcuttaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Calcutta"}));
    const today = calcuttaTime.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    // Check what dates exist in patient_new
    const [dates] = await connection.execute(
      'SELECT DISTINCT date, COUNT(*) as count FROM patient_new GROUP BY date ORDER BY date DESC LIMIT 10'
    );
    
    // Check what dates exist in today_transeciton
    const [transDates] = await connection.execute(
      'SELECT DISTINCT added_on, COUNT(*) as count FROM today_transeciton GROUP BY added_on ORDER BY added_on DESC LIMIT 10'
    );
    
    // Check total records
    const [totalPatients] = await connection.execute('SELECT COUNT(*) as count FROM patient_new');
    const [totalTrans] = await connection.execute('SELECT COUNT(*) as count FROM today_transeciton');
    
    res.json({
      todayDate: today,
      serverDate: new Date().toISOString(),
      patientDates: dates,
      transactionDates: transDates,
      totalPatients: totalPatients[0].count,
      totalTransactions: totalTrans[0].count
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Revenue report endpoint - uses same logic as admin daily-revenue-report
router.get('/revenue-report', async (req, res) => {
  let connection;
  try {
    const { date, type = 'D' } = req.query; // D = Detail, S = Summary
    
    // Default to today's date in DD-MM-YYYY format
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayFormatted = `${dd}-${mm}-${yyyy}`;
    
    const selectedDate = date || todayFormatted;
    
    // Convert DD-MM-YYYY to YYYY-MM-DD for scan_date queries
    const parts = selectedDate.split('-');
    const scanDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    connection = await mysql.createConnection(dbConfig);

    // Use same logic as admin daily-revenue-report
    const adminModule = require('./admin');

    if (type === 'S') {
      // Summary Report - matches dail_revenue_summary_xls.php
      const summaryData = await adminModule.generateSummaryReport(connection, scanDate, selectedDate);
      res.json({
        success: true,
        type: 'summary',
        data: summaryData,
        date: selectedDate
      });
    } else {
      // Detail Report - matches dail_revenue_xls.php  
      const detailData = await adminModule.generateDetailReport(connection, scanDate, selectedDate);
      res.json({
        success: true,
        type: 'detail', 
        data: detailData,
        date: selectedDate
      });
    }

  } catch (error) {
    console.error('Superadmin revenue report error:', error);
    res.status(500).json({
      error: 'Failed to fetch revenue report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Console report endpoint - uses same logic as admin console-report
router.get('/console-report', async (req, res) => {
  let connection;
  try {
    const { s_date } = req.query;
    
    if (!s_date) {
      return res.status(400).json({
        error: 'Date parameter (s_date) is required'
      });
    }

    // Convert DD-MM-YYYY to YYYY-MM-DD for database query
    const parts = s_date.split('-');
    const dbDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    connection = await mysql.createConnection(dbConfig);

    // Main query - matches PHP exactly
    const query = `
      SELECT patient_new.*, doctor.dname, console.* 
      FROM patient_new 
      JOIN doctor ON doctor.d_id = patient_new.doctor_name  
      JOIN console ON console.c_p_cro = patient_new.cro 
      WHERE console.added_on = ? AND console.status = 'Complete' 
      ORDER BY console.con_id ASC
    `;
    
    const [consoleData] = await connection.execute(query, [dbDate]);

    const processedData = [];
    let totals = {
      films: 0,
      contrast: 0,
      scans: 0,
      amount: 0,
      cd: 0,
      paid: 0,
      free: 0
    };
    
    for (let i = 0; i < consoleData.length; i++) {
      const row = consoleData[i];
      
      // Get scan names and total scans - matches PHP scan_type processing
      let scanNames = '';
      let scanTotal = 0;
      
      if (row.scan_type) {
        const scanIds = row.scan_type.split(',').filter(id => id.trim());
        for (const scanId of scanIds) {
          const [scanResult] = await connection.execute(
            'SELECT s_name, total_scan FROM scan WHERE s_id = ?',
            [scanId.trim()]
          );
          if (scanResult.length > 0) {
            scanNames += scanResult[0].s_name + ',';
            scanTotal += scanResult[0].total_scan || 0;
          }
        }
      }
      
      // CD/DVD issue status
      const cdStatus = row.issue_cd === 'Yes' ? '1' : '0';
      if (row.issue_cd === 'Yes') {
        totals.cd++;
      }
      
      // Free/Paid logic - matches PHP category conditions
      const freeCategories = ['BPL/POOR', 'Sn. CITIZEN', 'BHAMASHAH', 'RTA', 'JSSY', 'PRISONER'];
      const isFree = freeCategories.includes(row.category);
      
      let paidScans = 0;
      let freeScans = 0;
      
      if (isFree) {
        freeScans = scanTotal;
        totals.free += scanTotal;
      } else {
        paidScans = scanTotal;
        totals.paid += scanTotal;
      }
      
      processedData.push({
        sno: i + 1,
        cro: row.cro || '',
        patient_name: row.patient_name || '',
        doctor_name: row.dname || '',
        age: row.age || '',
        category: row.category || '',
        scan_type: scanNames.replace(/,$/, ''), // Remove trailing comma
        number_films: row.number_films || 0,
        number_of_scan: scanTotal,
        issue_cd: cdStatus,
        number_contrast: row.number_contrast || 0,
        paid: isFree ? '' : paidScans,
        free: isFree ? freeScans : '',
        amount: row.amount || 0,
        start_time: row.start_time || '',
        stop_time: row.stop_time || '',
        remark: row.remark || '',
        status: row.status || ''
      });
      
      // Update totals
      totals.films += parseInt(row.number_films || 0);
      totals.contrast += parseInt(row.number_contrast || 0);
      totals.scans += scanTotal;
      totals.amount += parseInt(row.amount || 0);
    }

    res.json({
      success: true,
      data: processedData,
      totals: totals,
      date: s_date,
      total: processedData.length
    });

  } catch (error) {
    console.error('Superadmin console report error:', error);
    res.status(500).json({
      error: 'Failed to fetch console report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Pending reports endpoint - matches report_pending_list.php exactly
router.get('/pending-reports', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Exact query from report_pending_list.php - NO LIMIT with date formatting
    const query = `
      SELECT 
        nursing_patient.n_patient_cro as cro,
        patient_new.patient_name,
        patient_new.amount,
        patient_new.date,
        doctor.dname as doctor_name,
        nursing_patient.n_patient_ct as ct_scan,
        DATE_FORMAT(nursing_patient.n_patient_ct_report_date, '%d-%m-%Y') as ct_report_date,
        nursing_patient.n_patient_ct_remark as ct_remark,
        nursing_patient.n_patient_x_ray as xray,
        DATE_FORMAT(nursing_patient.n_patient_x_ray_report_date, '%d-%m-%Y') as xray_report_date,
        nursing_patient.n_patient_x_ray_remark as xray_remark,
        nursing_patient.p_id,
        patient_new.age,
        patient_new.gender,
        patient_new.contact_number as mobile,
        hospital.h_name as hospital_name
      FROM nursing_patient 
      JOIN patient_new ON patient_new.cro = nursing_patient.n_patient_cro
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      WHERE nursing_patient.n_patient_x_ray = 'no' 
         OR nursing_patient.n_patient_ct = 'no'
      ORDER BY nursing_patient.p_id DESC
    `;
    
    const [pendingReports] = await connection.execute(query);
    
    res.json({
      success: true,
      data: pendingReports,
      total: Array.isArray(pendingReports) ? pendingReports.length : 0
    });
    
  } catch (error) {
    console.error('Pending reports error:', error);
    res.status(500).json({ error: 'Failed to fetch pending reports', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// View reports endpoint - matches view_report.php exactly
router.get('/view-reports', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Exact query from view_report.php - NO LIMIT
    const query = `
      SELECT 
        nursing_patient.n_patient_cro as cro,
        patient_new.patient_name,
        patient_new.amount,
        patient_new.date,
        doctor.dname as doctor_name,
        nursing_patient.n_patient_ct as ct_scan,
        nursing_patient.n_patient_ct_report_date as ct_report_date,
        nursing_patient.n_patient_ct_remark as ct_remark,
        nursing_patient.n_patient_x_ray as xray,
        nursing_patient.n_patient_x_ray_report_date as xray_report_date,
        nursing_patient.n_patient_x_ray_remark as xray_remark,
        nursing_patient.p_id,
        patient_new.age,
        patient_new.gender,
        patient_new.contact_number as mobile,
        hospital.h_name as hospital_name
      FROM nursing_patient 
      JOIN patient_new ON patient_new.cro = nursing_patient.n_patient_cro
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      WHERE nursing_patient.n_patient_x_ray = 'yes' 
        AND nursing_patient.n_patient_ct = 'yes'
      ORDER BY nursing_patient.p_id DESC
    `;
    
    const [viewReports] = await connection.execute(query);
    
    res.json({
      success: true,
      data: viewReports,
      total: Array.isArray(viewReports) ? viewReports.length : 0
    });
    
  } catch (error) {
    console.error('View reports error:', error);
    res.status(500).json({ error: 'Failed to fetch view reports', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

router.get('/patient-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let query, params = [];
    
    if (from_date && to_date) {
      // Date range query
      query = `
        SELECT 
          patient_new.patient_id as p_id,
          patient_new.cro as cro_number,
          patient_new.patient_name,
          COALESCE(doctor.dname,'') as dname,
          hospital.h_name as h_name,
          COALESCE(patient_new.amount, 0) as amount,
          '' as remark,
          patient_new.date,
          COALESCE(patient_new.age, 0) as age,
          COALESCE(patient_new.gender, '') as gender,
          COALESCE(patient_new.contact_number, '') as mobile
        FROM patient_new
        LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
        LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
        WHERE STR_TO_DATE(patient_new.date, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
        ORDER BY patient_new.patient_id DESC
        LIMIT 50000
      `;
      params = [from_date, to_date];
    } else {
      // Fetch all records by default (50,000 limit)
      query = `
        SELECT 
          patient_new.patient_id as p_id,
          patient_new.cro as cro_number,
          patient_new.patient_name,
          COALESCE(doctor.dname, doctor.doctor_name, 'Unknown Doctor') as dname,
          hospital.h_name as h_name,
          COALESCE(patient_new.amount, 0) as amount,
          '' as remark,
          patient_new.date,
          COALESCE(patient_new.age, 0) as age,
          COALESCE(patient_new.gender, '') as gender,
          COALESCE(patient_new.contact_number, '') as mobile
        FROM patient_new
        LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
        LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
        ORDER BY patient_new.patient_id DESC
        LIMIT 50000
      `;
    }
    
    const [patients] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: patients,
      total: Array.isArray(patients) ? patients.length : 0
    });
    
  } catch (error) {
    console.error('Superadmin patient report error:', error);
    res.status(500).json({ error: 'Failed to fetch patient report', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Doctor Scan Report - Get comprehensive doctor scan reports
router.get('/doctor-scan-report', async (req, res) => {
  let connection;
  try {
    const { doctor_id, scan_head_id, from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Build WHERE clause
    let whereClause = 'WHERE np.n_patient_ct = "yes"';
    const queryParams = [];
    
    if (doctor_id) {
      whereClause += ' AND np.ct_scan_doctor_id = ?';
      queryParams.push(doctor_id);
    }
    
    if (scan_head_id) {
      whereClause += ' AND sh.id = ?';
      queryParams.push(scan_head_id);
    }
    
    if (from_date && to_date) {
      // Convert DD-MM-YYYY to YYYY-MM-DD
      const fromParts = from_date.split('-');
      const toParts = to_date.split('-');
      const fromFormatted = `${fromParts[2]}-${fromParts[1]}-${fromParts[0]}`;
      const toFormatted = `${toParts[2]}-${toParts[1]}-${toParts[0]}`;
      whereClause += ' AND DATE(np.ct_scan_report_date) BETWEEN ? AND ?';
      queryParams.push(fromFormatted, toFormatted);
    } else if (from_date) {
      const fromParts = from_date.split('-');
      const fromFormatted = `${fromParts[2]}-${fromParts[1]}-${fromParts[0]}`;
      whereClause += ' AND DATE(np.ct_scan_report_date) >= ?';
      queryParams.push(fromFormatted);
    } else if (to_date) {
      const toParts = to_date.split('-');
      const toFormatted = `${toParts[2]}-${toParts[1]}-${toParts[0]}`;
      whereClause += ' AND DATE(np.ct_scan_report_date) <= ?';
      queryParams.push(toFormatted);
    }
    
    
    // Main query to get detailed reports
    const detailQuery = `
      SELECT 
        np.ct_scan_doctor_id as doctor_id,
        csd.doctor_name,
        p.cro as patient_cro,
        p.patient_name,
        p.scan_type as scan_types,
        p.category,
        DATE_FORMAT(np.ct_scan_report_date, '%d-%m-%Y') as report_date,
        GROUP_CONCAT(DISTINCT s.s_name SEPARATOR ', ') as scan_names,
        GROUP_CONCAT(DISTINCT sh.head_name SEPARATOR ', ') as scan_head_names,
        SUM(sh.amount) as total_amount
      FROM nursing_patient np
      INNER JOIN patient_new p ON p.cro = np.n_patient_cro
      INNER JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      INNER JOIN scan s ON FIND_IN_SET(s.s_id, p.scan_type)
      INNER JOIN scan_heads sh ON s.scan_head_id = sh.id
      ${whereClause}
      AND np.ct_scan_doctor_id IS NOT NULL
      AND sh.amount IS NOT NULL
      AND ct_scan_report_date IS NOT NULL and ct_scan_report_date != '0000-00-00'
      GROUP BY np.n_patient_cro, np.ct_scan_doctor_id
      ORDER BY np.added_on DESC
    `;
    
    const [reports] = await connection.execute(detailQuery, queryParams);
    
    // Summary by doctor
    const doctorSummaryQuery = `
      SELECT 
        csd.doctor_name,
        COUNT(DISTINCT np.n_patient_cro) as report_count,
        SUM(sh.amount) as total_amount
      FROM nursing_patient np
      INNER JOIN patient_new p ON p.cro = np.n_patient_cro
      INNER JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      INNER JOIN scan s ON FIND_IN_SET(s.s_id, p.scan_type)
      INNER JOIN scan_heads sh ON s.scan_head_id = sh.id
      ${whereClause}
      AND np.ct_scan_doctor_id IS NOT NULL
      AND sh.amount IS NOT NULL
      AND ct_scan_report_date IS NOT NULL and ct_scan_report_date != '0000-00-00'
      GROUP BY np.ct_scan_doctor_id, csd.doctor_name
      ORDER BY total_amount DESC
    `;
    
    const [doctorSummary] = await connection.execute(doctorSummaryQuery, queryParams);
    
    // Summary by scan head
    const headSummaryQuery = `
      SELECT 
        sh.head_name,
        COUNT(DISTINCT np.ct_scan_doctor_id) as doctor_count,
        COUNT(DISTINCT np.n_patient_cro) as report_count,
        SUM(sh.amount) as total_amount
      FROM nursing_patient np
      INNER JOIN patient_new p ON p.cro = np.n_patient_cro
      INNER JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      INNER JOIN scan s ON FIND_IN_SET(s.s_id, p.scan_type)
      INNER JOIN scan_heads sh ON s.scan_head_id = sh.id
      ${whereClause}
      AND np.ct_scan_doctor_id IS NOT NULL
      AND ct_scan_report_date IS NOT NULL and ct_scan_report_date != '0000-00-00'
      AND sh.amount IS NOT NULL
      GROUP BY sh.id, sh.head_name
      ORDER BY total_amount DESC
      
    `;
    
    const [headSummary] = await connection.execute(headSummaryQuery, queryParams);
    
    // Overall summary
    const totalDoctors = new Set(reports.map(r => r.doctor_id)).size;
    const totalReports = reports.length;
    const totalAmount = reports.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
    
    res.json({
      success: true,
      data: reports,
      summary: {
        total_doctors: totalDoctors,
        total_reports: totalReports,
        total_amount: totalAmount,
        by_doctor: doctorSummary,
        by_head: headSummary
      }
    });
    
  } catch (error) {
    console.error('Doctor scan report error:', error);
    res.status(500).json({
      error: 'Failed to fetch doctor scan report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});



module.exports = router;