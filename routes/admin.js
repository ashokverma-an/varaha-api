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
    name: 'h_name',
    short: 'h_short',
    type: 'h_type',
    address: 'h_address',
    contact: 'h_contact'
  },
  category: {
    id: 'cat_id',
    name: 'cat_name',
    type: 'cat_type'
  }
};

// Patient list endpoint
router.get('/patient-list', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    const fromDate = from_date || '2024-01-01';
    const toDate = to_date || '2024-12-31';
    
    connection = await mysql.createConnection(dbConfig);
    
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
    console.error('Admin patient list error:', error);
    res.status(500).json({ error: 'Failed to fetch patient list', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Categories endpoint
router.get('/categories', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT * FROM category ORDER BY cat_id DESC`;
    const [categories] = await connection.execute(query);
    
    res.json({
      success: true,
      data: categories,
      total: Array.isArray(categories) ? categories.length : 0
    });
    
  } catch (error) {
    console.error('Admin categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Hospitals endpoint
router.get('/hospitals', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT * FROM hospital ORDER BY h_id DESC`;
    const [hospitals] = await connection.execute(query);
    
    res.json({
      success: true,
      data: hospitals,
      total: Array.isArray(hospitals) ? hospitals.length : 0
    });
    
  } catch (error) {
    console.error('Admin hospitals error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Daily revenue report endpoint
router.get('/daily-revenue-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    const fromDate = from_date || '2024-01-01';
    const toDate = to_date || '2024-12-31';
    
    connection = await mysql.createConnection(dbConfig);
    
    const query = `
      SELECT 
        patient_new.date,
        patient_new.cro,
        patient_new.patient_name,
        patient_new.amount,
        patient_new.category,
        hospital.h_name as hospital_name,
        doctor.dname as doctor_name
      FROM patient_new
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      WHERE STR_TO_DATE(patient_new.date, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
      ORDER BY patient_new.patient_id DESC
      LIMIT 1000
    `;
    
    const [revenue] = await connection.execute(query, [fromDate, toDate]);
    
    res.json({
      success: true,
      data: revenue,
      total: Array.isArray(revenue) ? revenue.length : 0
    });
    
  } catch (error) {
    console.error('Admin daily revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch daily revenue', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient search endpoint
router.get('/patients/search', async (req, res) => {
  let connection;
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    const query = `
      SELECT 
        patient_new.patient_id as p_id,
        patient_new.cro as cro_number,
        patient_new.patient_name,
        doctor.dname as dname,
        hospital.h_name as h_name,
        COALESCE(patient_new.amount, 0) as amount,
        patient_new.date,
        COALESCE(patient_new.age, 0) as age,
        COALESCE(patient_new.gender, '') as gender,
        COALESCE(patient_new.contact_number, '') as mobile,
        COALESCE(patient_new.address, '') as address,
        COALESCE(patient_new.category, '') as category,
        COALESCE(patient_new.scan_type, '') as scan_type,
        COALESCE(patient_new.remark, '') as remark
      FROM patient_new
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      WHERE patient_new.cro LIKE ? OR patient_new.patient_name LIKE ?
      ORDER BY patient_new.patient_id DESC
      LIMIT 10
    `;
    
    const searchTerm = `%${q}%`;
    const [patients] = await connection.execute(query, [searchTerm, searchTerm]);
    
    res.json({
      success: true,
      data: patients,
      total: Array.isArray(patients) ? patients.length : 0
    });
    
  } catch (error) {
    console.error('Patient search error:', error);
    res.status(500).json({ error: 'Failed to search patients', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Admin stats endpoint (same logic as admin/blank.php)
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // ✅ Use today's date in dd-mm-yyyy format (dash, same as DB)
    const now = new Date();
    const calcuttaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Calcutta" }));
    const dd = String(calcuttaTime.getDate()).padStart(2, "0");
    const mm = String(calcuttaTime.getMonth() + 1).padStart(2, "0"); // Month is 0-based
    const yyyy = calcuttaTime.getFullYear();
    const d = `${dd}-${mm}-${yyyy}`;
    
    // 1. Today's transactions
    const [transactionResults] = await connection.execute(
      'SELECT withdraw, r_amount, d_amount FROM today_transeciton WHERE added_on = ?', [d]
    );
    
    // 2. Today's patient count and total scans
    const [patientResults] = await connection.execute(
      'SELECT COUNT(*) as count, SUM(total_scan) as total_scans FROM patient_new WHERE date = ?', [d]
    );
    const patientCount = patientResults[0]?.count || 0;
    const totalScans = patientResults[0]?.total_scans || 0;
    
    // Same PHP logic
    let c = 0; // received
    let d_amt = 0; // due  
    let w = 0; // withdraw
    
    transactionResults.forEach(r => {
      w += parseFloat(r.withdraw || 0);
      c += parseFloat(r.r_amount || 0);
      d_amt += parseFloat(r.d_amount || 0);
    });
    
    const h = c - d_amt - w; // cash in hand
    
    res.json({
      todayDate: d,              // show date for debugging
      totalPatients: totalScans, // Patient Registered (total scans)
      todayPatients: patientCount, // Total MRI (patient count)
      totalRevenue: c,           // Received Amount
      todayRevenue: d_amt,       // Due Amount
      todayWithdraw: w,          // Withdraw
      cashInHand: h <= 0 ? 0 : h // Cash In Hand
    });
    
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch admin stats',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});
// Patient create endpoint
router.post('/patients', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const {
      patient_name, age, gender, contact_number, address,
      hospital_name, doctor_name, category, amount, date,
      allot_date, allot_time, scan_type, remark
    } = req.body;
    
    // Generate CRO number
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Get next sequence number for today
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [dateStr]
    );
    const sequence = (countResult[0]?.count || 0) + 1;
    const cro = `VDC/${dateStr}/${sequence.toString().padStart(3, '0')}`;
    
    const query = `
      INSERT INTO patient_new (
        cro, patient_name, age, gender, contact_number, address,
        hospital_id, doctor_name, category, amount, date,
        allot_date, allot_time, scan_type, remark, total_scan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;
    
    const [result] = await connection.execute(query, [
      cro, patient_name, age, gender, contact_number, address,
      hospital_name, doctor_name, category, amount, date,
      allot_date, allot_time, scan_type, remark
    ]);
    
    res.json({
      success: true,
      message: 'Patient registered successfully',
      data: { patient_id: result.insertId, cro }
    });
    
  } catch (error) {
    console.error('Patient create error:', error);
    res.status(500).json({ error: 'Failed to create patient', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Hospital CRUD endpoints
router.post('/hospitals', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { h_name, h_short, h_address, h_contact, h_type } = req.body;
    
    const query = 'INSERT INTO hospital (h_name, h_short, h_address, h_contact, h_type) VALUES (?, ?, ?, ?, ?)';
    const [result] = await connection.execute(query, [h_name, h_short, h_address, h_contact, h_type || 'General']);
    
    res.json({ success: true, message: 'Hospital created successfully', data: { h_id: result.insertId } });
  } catch (error) {
    console.error('Hospital create error:', error);
    res.status(500).json({ error: 'Failed to create hospital', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

router.put('/hospitals/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    const { h_name, h_short, h_address, h_contact, h_type } = req.body;
    
    const query = 'UPDATE hospital SET h_name = ?, h_short = ?, h_address = ?, h_contact = ?, h_type = ? WHERE h_id = ?';
    await connection.execute(query, [h_name, h_short, h_address, h_contact, h_type || 'General', id]);
    
    res.json({ success: true, message: 'Hospital updated successfully' });
  } catch (error) {
    console.error('Hospital update error:', error);
    res.status(500).json({ error: 'Failed to update hospital', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

router.delete('/hospitals/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    
    const query = 'DELETE FROM hospital WHERE h_id = ?';
    await connection.execute(query, [id]);
    
    res.json({ success: true, message: 'Hospital deleted successfully' });
  } catch (error) {
    console.error('Hospital delete error:', error);
    res.status(500).json({ error: 'Failed to delete hospital', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Category CRUD endpoints
router.post('/categories', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { cat_name, cat_type } = req.body;
    
    const query = 'INSERT INTO category (cat_name, cat_type) VALUES (?, ?)';
    const [result] = await connection.execute(query, [cat_name, cat_type]);
    
    res.json({ success: true, message: 'Category created successfully', data: { cat_id: result.insertId } });
  } catch (error) {
    console.error('Category create error:', error);
    res.status(500).json({ error: 'Failed to create category', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

router.put('/categories/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    const { cat_name, cat_type } = req.body;
    
    const query = 'UPDATE category SET cat_name = ?, cat_type = ? WHERE cat_id = ?';
    await connection.execute(query, [cat_name, cat_type, id]);
    
    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Category update error:', error);
    res.status(500).json({ error: 'Failed to update category', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

router.delete('/categories/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    
    const query = 'DELETE FROM category WHERE cat_id = ?';
    await connection.execute(query, [id]);
    
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Category delete error:', error);
    res.status(500).json({ error: 'Failed to delete category', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient update endpoint
router.put('/patients/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    const { patient_name, age, gender, mobile, address, amount, remark } = req.body;
    
    const query = `
      UPDATE patient_new 
      SET patient_name = ?, age = ?, gender = ?, contact_number = ?, address = ?, amount = ?, remark = ?
      WHERE patient_id = ?
    `;
    
    await connection.execute(query, [patient_name, age, gender, mobile, address, amount, remark, id]);
    
    res.json({ success: true, message: 'Patient updated successfully' });
  } catch (error) {
    console.error('Patient update error:', error);
    res.status(500).json({ error: 'Failed to update patient', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Doctors endpoint
router.get('/doctors', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT * FROM doctor ORDER BY d_id DESC`;
    const [doctors] = await connection.execute(query);
    
    res.json(doctors);
    
  } catch (error) {
    console.error('Admin doctors error:', error);
    res.status(500).json({ error: 'Failed to fetch doctors', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Scans endpoint
router.get('/scans', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT * FROM scan ORDER BY s_id DESC`;
    const [scans] = await connection.execute(query);
    
    res.json({
      success: true,
      data: scans,
      total: Array.isArray(scans) ? scans.length : 0
    });
    
  } catch (error) {
    console.error('Admin scans error:', error);
    res.status(500).json({ error: 'Failed to fetch scans', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;