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

// Revenue report endpoint
router.get('/revenue-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    const fromDate = from_date || '2024-01-01';
    const toDate = to_date || '2024-12-31';
    
    connection = await mysql.createConnection(dbConfig);
    
    // Dynamic query using column mappings
    const query = `
      SELECT 
        patient_new.${DB_COLUMNS.patient_new.cro} as cro,
        patient_new.${DB_COLUMNS.patient_new.name} as patient_name,
        patient_new.${DB_COLUMNS.patient_new.age} as age,
        patient_new.${DB_COLUMNS.patient_new.category} as category,
        patient_new.${DB_COLUMNS.patient_new.scan_type} as scan_type,
        patient_new.${DB_COLUMNS.patient_new.amount} as amount,
        patient_new.${DB_COLUMNS.patient_new.date} as date,
        console.${DB_COLUMNS.console.number_films} as number_films,
        console.${DB_COLUMNS.console.number_contrast} as number_contrast,
        console.${DB_COLUMNS.console.number_scan} as number_scan,
        console.${DB_COLUMNS.console.issue_cd} as issue_cd,
        console.${DB_COLUMNS.console.added_on} as added_on
      FROM patient_new 
      JOIN console ON console.${DB_COLUMNS.console.cro} = patient_new.${DB_COLUMNS.patient_new.cro}
      WHERE STR_TO_DATE(console.${DB_COLUMNS.console.added_on}, '%Y-%m-%d') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
        AND console.${DB_COLUMNS.console.status} = 'Complete'
      ORDER BY console.${DB_COLUMNS.console.id} ASC
      LIMIT 1000
    `;
    
    const [revenue] = await connection.execute(query, [fromDate, toDate]);
    
    res.json({
      success: true,
      data: revenue,
      total: Array.isArray(revenue) ? revenue.length : 0
    });
    
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue report', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Console report endpoint
router.get('/console-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    const fromDate = from_date || '2024-01-01';
    const toDate = to_date || '2024-12-31';
    
    connection = await mysql.createConnection(dbConfig);
    
    // Same query as con_revenue_report.php
    const query = `
      SELECT 
        patient_new.${DB_COLUMNS.patient_new.cro} as cro,
        patient_new.${DB_COLUMNS.patient_new.name} as patient_name,
        patient_new.${DB_COLUMNS.patient_new.age} as age,
        patient_new.${DB_COLUMNS.patient_new.category} as category,
        patient_new.${DB_COLUMNS.patient_new.scan_type} as scan_type,
        patient_new.${DB_COLUMNS.patient_new.amount} as amount,
        patient_new.${DB_COLUMNS.patient_new.date} as date,
        doctor.${DB_COLUMNS.doctor.name} as doctor_name,
        console.${DB_COLUMNS.console.number_films} as number_films,
        console.${DB_COLUMNS.console.number_contrast} as number_contrast,
        console.${DB_COLUMNS.console.number_scan} as number_scan,
        console.${DB_COLUMNS.console.issue_cd} as issue_cd,
        console.${DB_COLUMNS.console.start_time} as start_time,
        console.${DB_COLUMNS.console.stop_time} as stop_time,
        console.${DB_COLUMNS.console.status} as status,
        console.${DB_COLUMNS.console.added_on} as added_on
      FROM patient_new 
      JOIN doctor ON doctor.${DB_COLUMNS.doctor.id} = patient_new.${DB_COLUMNS.patient_new.doctor_name}
      JOIN console ON console.${DB_COLUMNS.console.cro} = patient_new.${DB_COLUMNS.patient_new.cro}
      WHERE STR_TO_DATE(console.${DB_COLUMNS.console.added_on}, '%Y-%m-%d') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
        AND console.${DB_COLUMNS.console.status} = 'Complete'
      ORDER BY console.${DB_COLUMNS.console.id} ASC
      LIMIT 1000
    `;
    
    const [consoleData] = await connection.execute(query, [fromDate, toDate]);
    
    res.json({
      success: true,
      data: consoleData,
      total: Array.isArray(consoleData) ? consoleData.length : 0
    });
    
  } catch (error) {
    console.error('Console report error:', error);
    res.status(500).json({ error: 'Failed to fetch console report', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Pending reports endpoint
router.get('/pending-reports', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Same query as report_pending_list.php
    const query = `
      SELECT 
        nursing_patient.${DB_COLUMNS.nursing_patient.cro} as cro,
        patient_new.${DB_COLUMNS.patient_new.name} as patient_name,
        patient_new.${DB_COLUMNS.patient_new.amount} as amount,
        patient_new.${DB_COLUMNS.patient_new.date} as date,
        doctor.${DB_COLUMNS.doctor.name} as doctor_name,
        nursing_patient.${DB_COLUMNS.nursing_patient.ct_scan} as ct_scan,
        nursing_patient.${DB_COLUMNS.nursing_patient.ct_report_date} as ct_report_date,
        nursing_patient.${DB_COLUMNS.nursing_patient.ct_remark} as ct_remark,
        nursing_patient.${DB_COLUMNS.nursing_patient.xray} as xray,
        nursing_patient.${DB_COLUMNS.nursing_patient.xray_report_date} as xray_report_date,
        nursing_patient.${DB_COLUMNS.nursing_patient.xray_remark} as xray_remark
      FROM nursing_patient 
      JOIN patient_new ON patient_new.${DB_COLUMNS.patient_new.cro} = nursing_patient.${DB_COLUMNS.nursing_patient.cro}
      LEFT JOIN doctor ON doctor.${DB_COLUMNS.doctor.id} = patient_new.${DB_COLUMNS.patient_new.doctor_name}
      WHERE nursing_patient.${DB_COLUMNS.nursing_patient.xray} = 'no' 
         OR nursing_patient.${DB_COLUMNS.nursing_patient.ct_scan} = 'no'
      ORDER BY nursing_patient.${DB_COLUMNS.nursing_patient.id} DESC
      LIMIT 1000
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

// View reports endpoint
router.get('/view-reports', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Same query as view_report.php
    const query = `
      SELECT 
        nursing_patient.${DB_COLUMNS.nursing_patient.cro} as cro,
        patient_new.${DB_COLUMNS.patient_new.name} as patient_name,
        patient_new.${DB_COLUMNS.patient_new.amount} as amount,
        patient_new.${DB_COLUMNS.patient_new.date} as date,
        doctor.${DB_COLUMNS.doctor.name} as doctor_name,
        nursing_patient.${DB_COLUMNS.nursing_patient.ct_scan} as ct_scan,
        nursing_patient.${DB_COLUMNS.nursing_patient.ct_report_date} as ct_report_date,
        nursing_patient.${DB_COLUMNS.nursing_patient.ct_remark} as ct_remark,
        nursing_patient.${DB_COLUMNS.nursing_patient.xray} as xray,
        nursing_patient.${DB_COLUMNS.nursing_patient.xray_report_date} as xray_report_date,
        nursing_patient.${DB_COLUMNS.nursing_patient.xray_remark} as xray_remark
      FROM nursing_patient 
      JOIN patient_new ON patient_new.${DB_COLUMNS.patient_new.cro} = nursing_patient.${DB_COLUMNS.nursing_patient.cro}
      LEFT JOIN doctor ON doctor.${DB_COLUMNS.doctor.id} = patient_new.${DB_COLUMNS.patient_new.doctor_name}
      WHERE nursing_patient.${DB_COLUMNS.nursing_patient.xray} = 'yes' 
        AND nursing_patient.${DB_COLUMNS.nursing_patient.ct_scan} = 'yes'
      ORDER BY nursing_patient.${DB_COLUMNS.nursing_patient.id} DESC
      LIMIT 1000
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
    const fromDate = from_date || '2024-01-01';
    const toDate = to_date || '2024-12-31';
    
    connection = await mysql.createConnection(dbConfig);
    
    // Fixed query with correct column names
    const query = `
      SELECT 
        patient_new.patient_id as p_id,
        patient_new.cro as cro_number,
        patient_new.patient_name,
        doctor.dname as dname,
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
    res.status(500).json({ error: 'Failed to fetch patient report', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;