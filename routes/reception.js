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

// Reception stats
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
    
    // Additional stats for reception
    const [pendingPatients] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM lab_banch 
      WHERE c_status = 1
    `);

    const [completedScans] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM console 
      WHERE status = 'Complete'
    `);

    const [totalHospitals] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM hospital
    `);

    const [totalDoctors] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM doctor
    `);

    // Current month revenue - using PHP logic with today_transeciton table
    const currentYear = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;
    const [currentMonthRevenue] = await connection.execute(`
      SELECT COALESCE(SUM(patient_new.amount), 0) as total 
      FROM patient_new 
      JOIN doctor ON doctor.d_id = patient_new.doctor_name 
      JOIN hospital ON hospital.h_id = patient_new.hospital_id 
      JOIN today_transeciton ON today_transeciton.cro = patient_new.cro  
      WHERE 
        MONTH(STR_TO_DATE(today_transeciton.added_on, '%d-%m-%Y')) = ? 
        AND YEAR(STR_TO_DATE(today_transeciton.added_on, '%d-%m-%Y')) = ?
        AND today_transeciton.withdraw = 0
    `, [currentMonthNum, currentYear]);

    // Last month revenue - using PHP logic with today_transeciton table
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthNum = lastMonthDate.getMonth() + 1;
    const lastMonthYear = lastMonthDate.getFullYear();
    const [lastMonthRevenue] = await connection.execute(`
      SELECT COALESCE(SUM(patient_new.amount), 0) as total 
      FROM patient_new 
      JOIN doctor ON doctor.d_id = patient_new.doctor_name 
      JOIN hospital ON hospital.h_id = patient_new.hospital_id 
      JOIN today_transeciton ON today_transeciton.cro = patient_new.cro  
      WHERE 
        MONTH(STR_TO_DATE(today_transeciton.added_on, '%d-%m-%Y')) = ? 
        AND YEAR(STR_TO_DATE(today_transeciton.added_on, '%d-%m-%Y')) = ?
        AND today_transeciton.withdraw = 0
    `, [lastMonthNum, lastMonthYear]);

    res.json({
      todayDate: d,                    // show date for debugging
      totalPatients: totalScans,       // Patient Registered (total scans)
      todayPatients: patientCount,     // Total MRI (patient count)
      totalRevenue: c,                 // Received Amount
      todayRevenue: d_amt,             // Due Amount
      todayWithdraw: w,                // Withdraw
      cashInHand: h <= 0 ? 0 : h,      // Cash In Hand
      // Additional reception stats
      pendingPatients: pendingPatients[0].count,
      completedScans: completedScans[0].count,
      totalScans: totalScans,
      totalHospitals: totalHospitals[0].count,
      totalDoctors: totalDoctors[0].count,
      lastMonthRevenue: lastMonthRevenue[0].total,
      currentMonthRevenue: currentMonthRevenue[0].total
    });

  } catch (error) {
    console.error('Reception stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch reception stats',
      details: error.message,
      stack: error.stack,
      dbConfig: {
        host: dbConfig.host,
        user: dbConfig.user,
        database: dbConfig.database,
        port: dbConfig.port
      },
      sqlError: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Last enrolled patient endpoint
router.get('/patients/last-enrolled', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `
      SELECT cro, patient_name 
      FROM patient_new 
      ORDER BY patient_id DESC 
      LIMIT 1
    `;
    
    const [result] = await connection.execute(query);
    
    res.json({
      success: true,
      data: result[0] || null
    });
    
  } catch (error) {
    console.error('Last enrolled patient error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch last enrolled patient',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Hospitals endpoint
router.get('/hospitals', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT h_id, h_name FROM hospital ORDER BY h_name`;
    const [hospitals] = await connection.execute(query);
    
    res.json(hospitals);
    
  } catch (error) {
    console.error('Hospitals error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Doctors endpoint
router.get('/doctors', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT d_id, dname FROM doctor ORDER BY dname`;
    const [doctors] = await connection.execute(query);
    
    res.json(doctors);
    
  } catch (error) {
    console.error('Doctors error:', error);
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
    
    const query = `SELECT s_id, s_name, charges, estimate_time FROM scan ORDER BY s_name`;
    const [scans] = await connection.execute(query);
    
    res.json(scans);
    
  } catch (error) {
    console.error('Scans error:', error);
    res.status(500).json({ error: 'Failed to fetch scans', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient creation endpoint
router.post('/patients', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const {
      hospital_name, DoctorName, pre, firstname, age, age_type, gender,
      petient_type, p_uni_submit, p_uni_id_name, address, city, contact_number,
      type_of_scan, appoint_date, time, time_in, amount, total_amount,
      dis_amount, rec_amount, due_amount, admin_id = 1
    } = req.body;

    // Generate CRO number
    const now = new Date();
    const calcuttaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Calcutta" }));
    const dd = String(calcuttaTime.getDate()).padStart(2, "0");
    const mm = String(calcuttaTime.getMonth() + 1).padStart(2, "0");
    const yyyy = calcuttaTime.getFullYear();
    const date = `${dd}-${mm}-${yyyy}`;

    // Get count for CRO generation
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [date]
    );
    const cr_count = countResult[0].count + 1;
    const cro = `VDC/${date}/${cr_count}`;

    // Handle free categories
    let finalAmount = amount;
    let finalTotal = total_amount;
    let finalDiscount = dis_amount;
    let finalReceived = rec_amount;
    let finalDue = due_amount;

    const freeCategories = ['PRISONER', 'Destitute', 'Chiranjeevi', 'RGHS', 'RTA', 'OPD FREE', 'IPD FREE', 'BPL/POOR', 'Sn. CITIZEN', 'Aayushmaan'];
    if (freeCategories.includes(petient_type)) {
      finalTotal = 0;
      finalDiscount = 0;
      finalReceived = 0;
      finalDue = 0;
    }

    // Insert scan selections
    if (Array.isArray(type_of_scan)) {
      for (const scanId of type_of_scan) {
        await connection.execute(
          'INSERT INTO scan_select (scan_id, patient_id, status) VALUES (?, ?, ?)',
          [scanId, cro, 'pending']
        );
      }
    }

    // Prepare scan string and count
    const scanString = Array.isArray(type_of_scan) ? type_of_scan.join(',') : '';
    const scanCount = Array.isArray(type_of_scan) ? type_of_scan.length : 0;
    const ageWithType = `${age}${age_type}`;

    // Insert patient record
    const patientQuery = `
      INSERT INTO patient_new (
        pre, patient_name, hospital_id, doctor_name, cro, age, gender, category,
        p_uni_id_submit, p_uni_id_name, \`enroll_no.\`, date, contact_number, address, city,
        scan_type, total_scan, amount, discount, amount_reci, amount_due,
        allot_date, allot_time, scan_date, allot_time_out, admin_id, scan_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3)
    `;

    const [patientResult] = await connection.execute(patientQuery, [
      pre, firstname.toUpperCase(), hospital_name, DoctorName, cro, ageWithType, gender, petient_type,
      p_uni_submit || 'N', p_uni_id_name || '', cro, date, contact_number, address, city,
      scanString, scanCount, finalAmount, finalDiscount, finalReceived, finalDue,
      appoint_date, time, '', time_in, admin_id
    ]);

    const patientId = patientResult.insertId;

    // Insert reservation slot
    await connection.execute(
      'INSERT INTO reseve_slot (reserv_date, reserv_start_time, reserv_end_time) VALUES (?, ?, ?)',
      [appoint_date, time, time_in]
    );

    // Insert lab bench record
    await connection.execute(
      'INSERT INTO lab_banch (cro_number, c_status, added) VALUES (?, 1, ?)',
      [cro, Math.floor(Date.now() / 1000)]
    );

    // Insert corridor record
    await connection.execute(
      'INSERT INTO coridor (cro_number, n_status, added) VALUES (?, 2, ?)',
      [cro, Math.floor(Date.now() / 1000)]
    );

    // Insert transaction record
    await connection.execute(
      'INSERT INTO today_transeciton (r_amount, d_amount, cro, added_on) VALUES (?, ?, ?, ?)',
      [finalReceived, finalDue, cro, date]
    );

    res.json({
      success: true,
      message: 'Patient registered successfully',
      data: {
        patient_id: patientId,
        cro: cro,
        date: date
      }
    });

  } catch (error) {
    console.error('Patient creation error:', error);
    res.status(500).json({
      error: 'Failed to create patient',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient list endpoint (same logic as patient_list_edit.php)
router.get('/patients/list', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const { from, to } = req.query;
    
    let query, params;
    
    if (from && to) {
      // Convert dd-mm-yyyy to dd-mm-yyyy format for database (dates are already in correct format)
      const fromDate = from;
      const toDate = to;
      
      query = `
        SELECT p.*, h.h_name, d.dname 
        FROM patient_new p
        LEFT JOIN hospital h ON h.h_id = p.hospital_id
        LEFT JOIN doctor d ON d.d_id = p.doctor_name
        WHERE p.scan_status != 1 AND STR_TO_DATE(p.date, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%d-%m-%Y') AND STR_TO_DATE(?, '%d-%m-%Y')
        ORDER BY p.patient_id DESC
      `;
      params = [fromDate, toDate];
    } else {
      // Default to today's date
      const now = new Date();
      const calcuttaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Calcutta" }));
      const dd = String(calcuttaTime.getDate()).padStart(2, "0");
      const mm = String(calcuttaTime.getMonth() + 1).padStart(2, "0");
      const yyyy = calcuttaTime.getFullYear();
      const date = `${dd}-${mm}-${yyyy}`;
      
      query = `
        SELECT p.*, h.h_name, d.dname 
        FROM patient_new p
        LEFT JOIN hospital h ON h.h_id = p.hospital_id
        LEFT JOIN doctor d ON d.d_id = p.doctor_name
        WHERE p.scan_status != 1 AND p.date = ?
        ORDER BY p.patient_id DESC
      `;
      params = [date];
    }
    
    const [patients] = await connection.execute(query, params);
    
    // Format the response to match frontend expectations
    const formattedPatients = patients.map(patient => ({
      patient_id: patient.patient_id,
      cro: patient.cro,
      patient_name: `${patient.pre || ''}${patient.patient_name || ''}`,
      amount_due: patient.amount_due || 0,
      doctor_name: patient.dname || '',
      hospital_name: patient.h_name || '',
      scan_status: patient.scan_status || 0,
      pre: patient.pre || '',
      firstname: patient.patient_name || '',
      age: patient.age || '',
      gender: patient.gender || '',
      contact_number: patient.contact_number || '',
      address: patient.address || '',
      city: patient.city || '',
      category: patient.category || '',
      amount: patient.amount || 0,
      date: patient.date || '',
      dname: patient.dname || '',
      h_name: patient.h_name || ''
    }));
    
    res.json({
      success: true,
      data: formattedPatients,
      total: formattedPatients.length,
      dateRange: from && to ? { from, to } : 'today'
    });
    
  } catch (error) {
    console.error('Patient list error:', error);
    res.status(500).json({
      error: 'Failed to fetch patient list',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get single patient endpoint for editing
router.get('/patients/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    
    const query = `
      SELECT p.*, h.h_name, d.dname 
      FROM patient_new p
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      WHERE p.patient_id = ?
    `;
    
    const [patients] = await connection.execute(query, [id]);
    
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const patient = patients[0];
    
    // Format the response
    const formattedPatient = {
      patient_id: patient.patient_id,
      cro: patient.cro,
      pre: patient.pre,
      patient_name: patient.patient_name,
      age: patient.age,
      gender: patient.gender,
      hospital_id: patient.hospital_id,
      doctor_name: patient.doctor_name,
      address: patient.address,
      city: patient.city,
      contact_number: patient.contact_number,
      category: patient.category,
      amount: patient.amount,
      total_amount: patient.amount,
      dis_amount: patient.discount || 0,
      rec_amount: patient.amount_reci || 0,
      due_amount: patient.amount_due || 0,
      date: patient.date,
      appoint_date: patient.allot_date,
      time: patient.allot_time,
      time_in: patient.allot_time_out,
      scan_type: patient.scan_type,
      petient_type: patient.category,
      p_uni_submit: patient.p_uni_id_submit || 'N',
      p_uni_id_name: patient.p_uni_id_name || '',
      h_name: patient.h_name,
      dname: patient.dname
    };
    
    res.json({
      success: true,
      data: formattedPatient
    });
    
  } catch (error) {
    console.error('Patient fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch patient',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Receipt data endpoint (matches PHP d_payment.php)
router.get('/receipt/:cro', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { cro } = req.params;
    const decodedCro = decodeURIComponent(cro);
    
    // Get patient data with doctor and hospital info
    const patientQuery = `
      SELECT p.*, d.dname, h.h_short, h.h_name
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      WHERE p.cro = ?
    `;
    
    const [patients] = await connection.execute(patientQuery, [decodedCro]);
    
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const patient = patients[0];
    
    // Get scan details
    let scanNames = [];
    let totalScanAmount = 0;
    
    if (patient.scan_type) {
      const scanIds = patient.scan_type.split(',');
      for (const scanId of scanIds) {
        if (scanId.trim()) {
          const [scanData] = await connection.execute(
            'SELECT s_name, charges FROM scan WHERE s_id = ?', [scanId.trim()]
          );
          if (scanData.length > 0) {
            scanNames.push(scanData[0].s_name);
            totalScanAmount += parseFloat(scanData[0].charges) || 0;
          }
        }
      }
    }
    
    // Get time slot details
    let timeSlot = '';
    if (patient.allot_time) {
      const [timeData] = await connection.execute(
        'SELECT time_slot FROM time_slot2 WHERE time_id = ?', [patient.allot_time]
      );
      if (timeData.length > 0) {
        timeSlot = timeData[0].time_slot;
      }
    }
    
    // Format receipt data
    const receiptData = {
      cro: patient.cro,
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      age: patient.age,
      gender: patient.gender,
      address: patient.address,
      city: patient.city,
      contact_number: patient.contact_number,
      category: patient.category,
      doctor_name: patient.dname || '',
      hospital_short: patient.h_short || '',
      hospital_name: patient.h_name || '',
      appointment_date: patient.allot_date,
      appointment_time: timeSlot,
      investigations: scanNames.join(', '),
      scan_amount: totalScanAmount,
      received_amount: patient.amount_reci || 0,
      total_amount: patient.amount || 0,
      date: patient.date
    };
    
    res.json({
      success: true,
      data: receiptData
    });
    
  } catch (error) {
    console.error('Receipt data error:', error);
    res.status(500).json({
      error: 'Failed to fetch receipt data',
      details: error.message
    });
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
    
    const {
      hospital_name, DoctorName, pre, firstname, age, age_type, gender,
      petient_type, p_uni_submit, p_uni_id_name, address, city, contact_number,
      type_of_scan, appoint_date, time, time_in, amount, total_amount,
      dis_amount, rec_amount, due_amount
    } = req.body;

    // Handle free categories
    let finalAmount = amount;
    let finalTotal = total_amount;
    let finalDiscount = dis_amount;
    let finalReceived = rec_amount;
    let finalDue = due_amount;

    const freeCategories = ['PRISONER', 'Destitute', 'Chiranjeevi', 'RGHS', 'RTA', 'OPD FREE', 'IPD FREE', 'BPL/POOR', 'Sn. CITIZEN', 'Aayushmaan'];
    if (freeCategories.includes(petient_type)) {
      finalTotal = 0;
      finalDiscount = 0;
      finalReceived = 0;
      finalDue = 0;
    }

    // Get existing patient data
    const [existingPatient] = await connection.execute(
      'SELECT cro FROM patient_new WHERE patient_id = ?', [id]
    );
    
    if (existingPatient.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const cro = existingPatient[0].cro;
    const ageWithType = `${age}${age_type}`;
    const scanString = Array.isArray(type_of_scan) ? type_of_scan.join(',') : '';
    const scanCount = Array.isArray(type_of_scan) ? type_of_scan.length : 0;

    // Update patient record
    const updateQuery = `
      UPDATE patient_new SET
        pre = ?, patient_name = ?, hospital_id = ?, doctor_name = ?, age = ?, gender = ?, category = ?,
        p_uni_id_submit = ?, p_uni_id_name = ?, contact_number = ?, address = ?, city = ?,
        scan_type = ?, total_scan = ?, amount = ?, discount = ?, amount_reci = ?, amount_due = ?,
        allot_date = ?, allot_time = ?, allot_time_out = ?
      WHERE patient_id = ?
    `;

    await connection.execute(updateQuery, [
      pre, firstname.toUpperCase(), hospital_name, DoctorName, ageWithType, gender, petient_type,
      p_uni_submit || 'N', p_uni_id_name || '', contact_number, address, city,
      scanString, scanCount, finalAmount, finalDiscount, finalReceived, finalDue,
      appoint_date, time, time_in, id
    ]);

    // Update scan selections
    await connection.execute('DELETE FROM scan_select WHERE patient_id = ?', [cro]);
    if (Array.isArray(type_of_scan)) {
      for (const scanId of type_of_scan) {
        await connection.execute(
          'INSERT INTO scan_select (scan_id, patient_id, status) VALUES (?, ?, ?)',
          [scanId, cro, 'pending']
        );
      }
    }

    // Update transaction record
    await connection.execute(
      'UPDATE today_transeciton SET r_amount = ?, d_amount = ? WHERE cro = ?',
      [finalReceived, finalDue, cro]
    );

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: {
        patient_id: id,
        cro: cro
      }
    });

  } catch (error) {
    console.error('Patient update error:', error);
    res.status(500).json({
      error: 'Failed to update patient',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient payment status endpoint
router.get('/patients/:id/payment', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    
    // Get patient data with scans
    const patientQuery = `
      SELECT p.*, h.h_name, d.dname 
      FROM patient_new p
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      WHERE p.patient_id = ?
    `;
    
    const [patients] = await connection.execute(patientQuery, [id]);
    
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const patient = patients[0];
    
    // Get scan details
    const scanIds = patient.scan_type ? patient.scan_type.split(',') : [];
    const scans = [];
    
    for (const scanId of scanIds) {
      if (scanId.trim()) {
        const [scanData] = await connection.execute(
          'SELECT s_id, s_name, charges FROM scan WHERE s_id = ?', [scanId.trim()]
        );
        if (scanData.length > 0) {
          scans.push(scanData[0]);
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        patient: {
          patient_id: patient.patient_id,
          cro: patient.cro,
          patient_name: patient.patient_name,
          age: patient.age,
          gender: patient.gender,
          address: patient.address,
          contact_number: patient.contact_number,
          amount: patient.amount,
          amount_reci: patient.amount_reci || 0,
          amount_due: patient.amount_due || 0,
          discount: patient.discount || 0,
          h_name: patient.h_name,
          dname: patient.dname
        },
        scans: scans
      }
    });
    
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment status',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Update payment endpoint
router.put('/patients/:id/payment', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    const { r_amount, d_amount } = req.body;
    
    // Get current patient data
    const [currentData] = await connection.execute(
      'SELECT cro, amount_reci, amount_due FROM patient_new WHERE patient_id = ?', [id]
    );
    
    if (currentData.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const patient = currentData[0];
    const newReceived = parseFloat(patient.amount_reci || 0) + parseFloat(r_amount || 0);
    const newDue = parseFloat(d_amount || 0);
    
    // Update patient payment
    await connection.execute(
      'UPDATE patient_new SET amount_reci = ?, amount_due = ? WHERE patient_id = ?',
      [newReceived, newDue, id]
    );
    
    // Update transaction record
    await connection.execute(
      'UPDATE today_transeciton SET r_amount = r_amount + ?, d_amount = ? WHERE cro = ?',
      [parseFloat(r_amount || 0), newDue, patient.cro]
    );
    
    res.json({
      success: true,
      message: 'Payment updated successfully'
    });
    
  } catch (error) {
    console.error('Payment update error:', error);
    res.status(500).json({
      error: 'Failed to update payment',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Back-entry patient creation endpoint
router.post('/patients/back-entry', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const {
      date, scan_date, hospital_name, DoctorName, pre, firstname, age, age_type, gender,
      petient_type, p_uni_submit, p_uni_id_name, address, city, contact_number,
      type_of_scan, amount, est_time, total_amount, rec_amount, dis_amount, due_amount, admin_id = 1
    } = req.body;

    // Generate CRO number based on selected date
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [date]
    );
    const cr_count = countResult[0].count + 1;
    const cro = `VDC/${date}/${cr_count}`;

    // Handle free categories
    let finalAmount = amount;
    let finalTotal = total_amount;
    let finalDiscount = dis_amount;
    let finalReceived = rec_amount;
    let finalDue = due_amount;

    const freeCategories = ['BPL/POOR', 'Sn. CITIZEN'];
    if (freeCategories.includes(petient_type)) {
      finalTotal = 0;
      finalDiscount = 0;
      finalReceived = 0;
      finalDue = 0;
    }

    // Insert scan selections
    if (Array.isArray(type_of_scan)) {
      for (const scanId of type_of_scan) {
        await connection.execute(
          'INSERT INTO scan_select (scan_id, patient_id, status) VALUES (?, ?, ?)',
          [scanId, cro, 'pending']
        );
      }
    }

    // Prepare scan string and count
    const scanString = Array.isArray(type_of_scan) ? type_of_scan.join(',') : '';
    const scanCount = Array.isArray(type_of_scan) ? type_of_scan.length : 0;
    const ageWithType = `${age}${age_type}`;

    // Insert patient record with back-entry specific fields
    const patientQuery = `
      INSERT INTO patient_new (
        pre, patient_name, hospital_id, doctor_name, cro, age, gender, category,
        p_uni_id_submit, p_uni_id_name, \`enroll_no.\`, date, scan_date, contact_number, address, city,
        scan_type, total_scan, amount, discount, amount_reci, amount_due,
        admin_id, scan_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const [patientResult] = await connection.execute(patientQuery, [
      pre, firstname.toUpperCase(), hospital_name, DoctorName, cro, ageWithType, gender, petient_type,
      p_uni_submit || 'N', p_uni_id_name || '', cro, date, scan_date, contact_number, address, city,
      scanString, scanCount, finalAmount, finalDiscount, finalReceived, finalDue,
      admin_id
    ]);

    const patientId = patientResult.insertId;

    // Insert transaction record
    await connection.execute(
      'INSERT INTO today_transeciton (r_amount, d_amount, cro, added_on) VALUES (?, ?, ?, ?)',
      [finalReceived, finalDue, cro, date]
    );

    res.json({
      success: true,
      message: 'Back-entry patient registered successfully',
      data: {
        patient_id: patientId,
        cro: cro,
        date: date
      }
    });

  } catch (error) {
    console.error('Back-entry patient creation error:', error);
    res.status(500).json({
      error: 'Failed to create back-entry patient',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get CRO for back-entry based on date
router.post('/patients/generate-cro', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { date } = req.body;
    
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [date]
    );
    const cr_count = countResult[0].count + 1;
    const cro = `VDC/${date}/${cr_count}`;
    
    res.json({ cro });
    
  } catch (error) {
    console.error('CRO generation error:', error);
    res.status(500).json({ error: 'Failed to generate CRO' });
  } finally {
    if (connection) await connection.end();
  }
});

// Today's patient registrations
router.get('/patients/today', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get today's date in dd-mm-yyyy format
    const now = new Date();
    const calcuttaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Calcutta" }));
    const dd = String(calcuttaTime.getDate()).padStart(2, "0");
    const mm = String(calcuttaTime.getMonth() + 1).padStart(2, "0");
    const yyyy = calcuttaTime.getFullYear();
    const date = `${dd}-${mm}-${yyyy}`;
    
    // Query for today's registrations
    const query = `
      SELECT p.*, h.h_name, d.dname 
      FROM patient_new p
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      WHERE p.date = ?
      ORDER BY p.patient_id DESC
    `;
    
    const [patients] = await connection.execute(query, [date]);
    
    // Format the response to match frontend expectations
    const formattedPatients = patients.map(patient => ({
      patient_id: patient.patient_id,
      cro: patient.cro,
      patient_name: `${patient.pre || ''}${patient.patient_name || ''}`,
      amount_due: patient.amount_due || 0,
      amount_reci: patient.amount_reci || 0,
      doctor_name: patient.dname || '',
      hospital_name: patient.h_name || '',
      scan_status: patient.scan_status || 0,
      pre: patient.pre || '',
      firstname: patient.patient_name || '',
      age: patient.age || '',
      gender: patient.gender || '',
      contact_number: patient.contact_number || '',
      address: patient.address || '',
      city: patient.city || '',
      category: patient.category || '',
      amount: patient.amount || 0,
      date: patient.date || '',
      dname: patient.dname || '',
      h_name: patient.h_name || ''
    }));
    
    res.json({
      success: true,
      data: formattedPatients,
      total: formattedPatients.length
    });
    
  } catch (error) {
    console.error('Today patients list error:', error);
    res.status(500).json({
      error: 'Failed to fetch today patients list',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Doctor report Excel export endpoint (matches PHP exactly)
router.get('/reports/doctor/excel', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    // Convert dd-mm-yyyy to yyyy-mm-dd format for SQL
    const convertDate = (dateStr) => {
      const parts = dateStr.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    
    const sqlStartDate = convertDate(startDate);
    const sqlEndDate = convertDate(endDate);
    const filename = `DOCTOR REPORT-${startDate} -To-${endDate}.xls`;
    
    // Set Excel headers exactly like PHP
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment;Filename='${filename}'`);
    
    // Get all doctors
    const [doctors] = await connection.execute('SELECT * FROM doctor ORDER BY dname');
    
    // Start HTML output exactly like PHP
    let htmlOutput = '<html>';
    htmlOutput += '<meta http-equiv="Content-Type" content="text/html; charset=Windows-1252"><body>';
    htmlOutput += '<table border="1"><tr><th colspan="6">VARAHA SDC</th></tr>';
    htmlOutput += '<tr><th style="text-align:center;" colspan="6">DOCTOR REPORT</th></tr>';
    htmlOutput += `<tr><th style="text-align:center;" colspan="6">From ${startDate} To ${endDate}</th></tr>`;
    htmlOutput += '<tr><th>S.No</th><th>DOCTOR NAME</th><th>Total Scan</th><th>Paid Patient</th><th>Free Patient</th><th>Total Revenue</th></tr>';
    
    let serialNo = 1;
    
    for (const doctor of doctors) {
      // Same SQL queries as PHP
      const [totalScans] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM patient_new 
        JOIN console ON console.c_p_cro = patient_new.cro 
        WHERE doctor_name = ? AND console.added_on BETWEEN ? AND ?
      `, [doctor.d_id, sqlStartDate, sqlEndDate]);
      
      const [paidPatients] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM patient_new 
        JOIN console ON console.c_p_cro = patient_new.cro 
        WHERE doctor_name = ? AND category = 'GEN' AND console.added_on BETWEEN ? AND ?
      `, [doctor.d_id, sqlStartDate, sqlEndDate]);
      
      const [freePatients] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM patient_new 
        JOIN console ON console.c_p_cro = patient_new.cro 
        WHERE doctor_name = ? AND category <> 'GEN' AND console.added_on BETWEEN ? AND ?
      `, [doctor.d_id, sqlStartDate, sqlEndDate]);
      
      const [revenue] = await connection.execute(`
        SELECT SUM(patient_new.amount) as total 
        FROM patient_new 
        JOIN console ON console.c_p_cro = patient_new.cro 
        WHERE doctor_name = ? AND console.added_on BETWEEN ? AND ?
      `, [doctor.d_id, sqlStartDate, sqlEndDate]);
      
      const totalScanCount = totalScans[0].count;
      
      // Only include doctors with scans (same as PHP logic)
      if (totalScanCount > 0) {
        htmlOutput += `<tr><td>${serialNo++}</td><td>${doctor.dname}</td><td>${totalScanCount}</td><td>${paidPatients[0].count}</td><td>${freePatients[0].count}</td><td>${revenue[0].total || 0}</td></tr>`;
      }
    }
    
    // Add empty row like PHP
    htmlOutput += '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    htmlOutput += '</table></body></html>';
    
    res.send(htmlOutput);
    
  } catch (error) {
    console.error('Doctor report Excel error:', error);
    res.status(500).json({
      error: 'Failed to generate Excel report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Daily report endpoint (matches PHP execl.php logic)
router.get('/reports/daily', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    // Convert dd-mm-yyyy to yyyy-mm-dd format for SQL
    const convertDate = (dateStr) => {
      const parts = dateStr.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    
    const sqlDate = convertDate(date);
    
    // Main query - same as PHP
    const query = `
      SELECT p.*, d.dname, h.h_name, h.h_short, t.r_amount, t.d_amount 
      FROM patient_new p
      JOIN doctor d ON d.d_id = p.doctor_name 
      JOIN hospital h ON h.h_id = p.hospital_id 
      JOIN today_transeciton t ON t.cro = p.cro  
      WHERE p.date = ? AND t.added_on = ? AND t.withdraw = 0 
      ORDER BY p.patient_id
    `;
    
    const [patients] = await connection.execute(query, [date, date]);
    
    // Calculate totals
    let totalScans = 0;
    let totalAmount = 0;
    let totalReceived = 0;
    let totalDue = 0;
    
    // Process each patient and get scan details
    const reportData = [];
    
    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      
      // Get scan details
      let scanNames = '';
      let scanCount = 0;
      
      if (patient.scan_type) {
        const scanIds = patient.scan_type.split(',');
        for (const scanId of scanIds) {
          if (scanId.trim()) {
            const [scanData] = await connection.execute(
              'SELECT s_name, total_scan FROM scan WHERE s_id = ?', [scanId.trim()]
            );
            if (scanData.length > 0) {
              scanNames += scanData[0].s_name + ', ';
              scanCount += parseInt(scanData[0].total_scan || 0);
            }
          }
        }
        scanNames = scanNames.replace(/, $/, ''); // Remove trailing comma
      }
      
      totalScans += scanCount;
      totalAmount += parseFloat(patient.amount || 0);
      totalReceived += parseFloat(patient.r_amount || 0);
      totalDue += parseFloat(patient.d_amount || 0);
      
      reportData.push({
        sno: i + 1,
        cro: patient.cro,
        patientName: patient.patient_name,
        age: patient.age,
        gender: patient.gender,
        category: patient.category,
        doctorName: patient.dname,
        hospitalName: patient.h_short || patient.h_name,
        scanType: scanNames,
        totalScan: scanCount,
        totalAmount: parseFloat(patient.amount || 0),
        receivedAmount: parseFloat(patient.r_amount || 0),
        dueAmount: parseFloat(patient.d_amount || 0),
        contactNumber: patient.contact_number
      });
    }
    
    // Get additional financial data (credit, refund, etc.)
    const [creditData] = await connection.execute(`
      SELECT SUM(t.r_amount) as credit_amount, GROUP_CONCAT(CONCAT(t.cro, '(', t.r_amount, ')')) as credit_cros
      FROM patient_new p 
      JOIN today_transeciton t ON t.cro = p.cro 
      WHERE t.added_on = ? AND p.date <> ?
    `, [date, date]);
    
    const [expenseData] = await connection.execute(`
      SELECT 
        SUM(CASE WHEN trans_type = 'Refund' THEN withdraw ELSE 0 END) as refund,
        SUM(CASE WHEN trans_type = 'discount' THEN withdraw ELSE 0 END) as discount,
        SUM(CASE WHEN trans_type = 'complimentry' THEN withdraw ELSE 0 END) as complimentry,
        SUM(CASE WHEN trans_type = 'Expanse' THEN withdraw ELSE 0 END) as expanse
      FROM today_transeciton 
      WHERE added_on = ?
    `, [date]);
    
    const creditAmount = parseFloat(creditData[0]?.credit_amount || 0);
    const refund = parseFloat(expenseData[0]?.refund || 0);
    const discount = parseFloat(expenseData[0]?.discount || 0);
    const complimentry = parseFloat(expenseData[0]?.complimentry || 0);
    const expanse = parseFloat(expenseData[0]?.expanse || 0);
    
    const netAmount = totalReceived + creditAmount - complimentry - discount - refund - expanse;
    
    res.json({
      success: true,
      data: reportData,
      summary: {
        totalScans,
        totalAmount,
        totalReceived,
        totalDue,
        creditAmount,
        refund,
        discount,
        complimentry,
        expanse,
        netAmount,
        creditCros: creditData[0]?.credit_cros || ''
      },
      date,
      total: reportData.length
    });
    
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      error: 'Failed to generate daily report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Revenue report endpoint (matches PHP revenue_report.php logic)
router.get('/reports/revenue', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    // Convert dd-mm-yyyy to yyyy-mm-dd format for SQL
    const convertDate = (dateStr) => {
      const parts = dateStr.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    
    const sqlDate = convertDate(date);
    
    // Main query - same as PHP
    const query = `
      SELECT p.*, c.number_films, c.number_contrast, c.issue_cd, c.status
      FROM patient_new p
      JOIN console c ON c.c_p_cro = p.cro 
      WHERE c.added_on = ? AND c.status = 'Complete'
      ORDER BY c.con_id ASC
    `;
    
    const [patients] = await connection.execute(query, [sqlDate]);
    
    // Calculate totals
    let totalFilms = 0;
    let totalContrast = 0;
    let totalScans = 0;
    let totalAmount = 0;
    let totalCd = 0;
    let totalPaid = 0;
    let totalFree = 0;
    
    // Process each patient and get scan details
    const reportData = [];
    
    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      
      // Get scan details
      let scanNames = '';
      let scanCount = 0;
      
      if (patient.scan_type) {
        const scanIds = patient.scan_type.split(',');
        for (const scanId of scanIds) {
          if (scanId.trim()) {
            const [scanData] = await connection.execute(
              'SELECT s_name, total_scan FROM scan WHERE s_id = ?', [scanId.trim()]
            );
            if (scanData.length > 0) {
              scanNames += scanData[0].s_name + ', ';
              scanCount += parseInt(scanData[0].total_scan || 0);
            }
          }
        }
        scanNames = scanNames.replace(/, $/, ''); // Remove trailing comma
      }
      
      // Check if free categories (same as PHP logic)
      const freeCategories = ['BPL/POOR', 'Sn. CITIZEN', 'BHAMASHAH', 'RTA', 'JSSY', 'PRISONER'];
      const isFree = freeCategories.includes(patient.category);
      
      totalFilms += parseInt(patient.number_films || 0);
      totalContrast += parseInt(patient.number_contrast || 0);
      totalScans += scanCount;
      totalAmount += parseFloat(patient.amount || 0);
      
      if (patient.issue_cd === 'Yes') {
        totalCd++;
      }
      
      if (isFree) {
        totalFree += scanCount;
      } else {
        totalPaid += scanCount;
      }
      
      reportData.push({
        sno: i + 1,
        cro: patient.cro,
        patientName: patient.patient_name,
        age: patient.age,
        category: patient.category,
        scanType: scanNames,
        films: parseInt(patient.number_films || 0),
        numberOfScan: scanCount,
        issueCd: patient.issue_cd === 'Yes' ? 1 : 0,
        contrast: parseInt(patient.number_contrast || 0),
        paid: isFree ? 0 : scanCount,
        free: isFree ? scanCount : 0,
        amount: parseFloat(patient.amount || 0)
      });
    }
    
    res.json({
      success: true,
      data: reportData,
      summary: {
        totalFilms,
        totalContrast,
        totalScans,
        totalAmount,
        totalCd,
        totalPaid,
        totalFree
      },
      date,
      total: reportData.length
    });
    
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({
      error: 'Failed to generate revenue report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Appointment report endpoint (matches PHP appoexcel.php logic)
router.get('/reports/appointment', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { date } = req.query;
    
    if (!date) {
      // Default to today's date in dd-mm-yyyy format
      const now = new Date();
      const calcuttaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Calcutta" }));
      const dd = String(calcuttaTime.getDate()).padStart(2, "0");
      const mm = String(calcuttaTime.getMonth() + 1).padStart(2, "0");
      const yyyy = calcuttaTime.getFullYear();
      const todayDate = `${dd}-${mm}-${yyyy}`;
      
      const query = `SELECT * FROM patient_new WHERE allot_date = ?`;
      const [patients] = await connection.execute(query, [todayDate]);
      
      const reportData = await processAppointmentData(connection, patients);
      
      return res.json({
        success: true,
        data: reportData,
        date: todayDate,
        total: reportData.length
      });
    }
    
    // Main query - same as PHP
    const query = `SELECT * FROM patient_new WHERE allot_date = ?`;
    const [patients] = await connection.execute(query, [date]);
    
    const reportData = await processAppointmentData(connection, patients);
    
    res.json({
      success: true,
      data: reportData,
      date,
      total: reportData.length
    });
    
  } catch (error) {
    console.error('Appointment report error:', error);
    res.status(500).json({
      error: 'Failed to generate appointment report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Helper function to process appointment data
async function processAppointmentData(connection, patients) {
  const reportData = [];
  
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    
    // Get scan details
    let scanNames = '';
    if (patient.scan_type) {
      const scanIds = patient.scan_type.split(',');
      for (const scanId of scanIds) {
        if (scanId.trim()) {
          const [scanData] = await connection.execute(
            'SELECT s_name FROM scan WHERE s_id = ?', [scanId.trim()]
          );
          if (scanData.length > 0) {
            scanNames += scanData[0].s_name + ', ';
          }
        }
      }
      scanNames = scanNames.replace(/, $/, '');
    }
    
    // Get time in details
    let timeIn = '';
    if (patient.allot_time) {
      const timeIds = patient.allot_time.split(',');
      for (const timeId of timeIds) {
        if (timeId.trim()) {
          const [timeData] = await connection.execute(
            'SELECT time_slot FROM time_slot2 WHERE time_id = ?', [timeId.trim()]
          );
          if (timeData.length > 0) {
            timeIn += timeData[0].time_slot;
          }
        }
      }
    }
    
    // Get time out details
    let timeOut = '';
    if (patient.allot_time_out) {
      const timeIds = patient.allot_time_out.split(',');
      for (const timeId of timeIds) {
        if (timeId.trim()) {
          const [timeData] = await connection.execute(
            'SELECT time_slot FROM time_slot2 WHERE time_id = ?', [timeId.trim()]
          );
          if (timeData.length > 0) {
            timeOut += timeData[0].time_slot;
          }
        }
      }
    }
    
    // Determine status
    let status = 'Pending';
    let completedDate = '';
    
    if (patient.scan_status === 3) {
      status = 'Shared to Console';
    } else if (patient.scan_status === 1) {
      status = 'Completed';
      // Get completion date from console table
      const [consoleData] = await connection.execute(
        'SELECT added_on FROM console WHERE c_p_cro = ?', [patient.cro]
      );
      if (consoleData.length > 0) {
        completedDate = consoleData[0].added_on;
      }
    }
    
    reportData.push({
      sno: i + 1,
      cro: patient.cro,
      patient_name: patient.patient_name,
      age: patient.age,
      gender: patient.gender,
      category: patient.category,
      scan_type: scanNames,
      total_scan: patient.total_scan,
      time_in: timeIn,
      time_out: timeOut,
      status: status,
      completed_date: completedDate,
      appointment_date: patient.allot_date,
      appointment_time: timeIn
    });
  }
  
  return reportData;
}

// Revenue report Excel export endpoint
router.get('/reports/revenue/excel', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    const filename = `REVENUE-${date}.xls`;
    
    // Set Excel headers exactly like PHP
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment;Filename='${filename}'`);
    
    // Get report data (reuse logic from above)
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/reception/reports/revenue?date=${date}`);
    const reportResult = await response.json();
    
    if (!reportResult.success) {
      return res.status(500).send('Error generating report');
    }
    
    const { data: reportData, summary } = reportResult;
    
    // Start HTML output exactly like PHP
    let htmlOutput = '<html>';
    htmlOutput += '<meta http-equiv="Content-Type" content="text/html; charset=Windows-1252"><body>';
    htmlOutput += '<table border="1"><tr><th colspan="13">VARAHA SDC</th></tr>';
    htmlOutput += `<tr><th style="text-align:center;" colspan="13">CONSOLE REVENUE - ${date}</th></tr>`;
    htmlOutput += '<tr><th>S.No</th><th>CRO</th><th>NAME</th><th>AGE</th><th>CATEGORY</th><th>SCAN TYPE</th><th>FILMS</th><th>NUMBER OF SCAN</th><th>ISSUE CD / DVD</th><th>CONTRAST</th><th>PAID</th><th>FREE</th><th>AMOUNT</th></tr>';
    
    // Add data rows
    reportData.forEach(row => {
      htmlOutput += `<tr><td>${row.sno}</td><td>${row.cro}</td><td>${row.patientName}</td><td>${row.age}</td><td>${row.category}</td><td>${row.scanType}</td><td>${row.films}</td><td>${row.numberOfScan}</td><td>${row.issueCd}</td><td>${row.contrast}</td><td>${row.paid || '&nbsp;'}</td><td>${row.free || '&nbsp;'}</td><td>${row.amount}</td></tr>`;
    });
    
    // Add summary row exactly like PHP
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL</th><th>${summary.totalFilms}</th><th>${summary.totalScans}</th><th>${summary.totalCd}</th><th>${summary.totalContrast}</th><th>${summary.totalPaid}</th><th>${summary.totalFree}</th><th>${summary.totalAmount}</th></tr>`;
    
    htmlOutput += '</table></body></html>';
    
    res.send(htmlOutput);
    
  } catch (error) {
    console.error('Revenue report Excel error:', error);
    res.status(500).json({
      error: 'Failed to generate Excel report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Daily report Excel export endpoint
router.get('/reports/daily/excel', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    const filename = `DAILY REPORT-${date}.xls`;
    
    // Set Excel headers exactly like PHP
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment;Filename='${filename}'`);
    
    // Get report data (reuse logic from above)
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/reception/reports/daily?date=${date}`);
    const reportResult = await response.json();
    
    if (!reportResult.success) {
      return res.status(500).send('Error generating report');
    }
    
    const { data: reportData, summary } = reportResult;
    
    // Start HTML output exactly like PHP
    let htmlOutput = '<html>';
    htmlOutput += '<meta http-equiv="Content-Type" content="text/html; charset=Windows-1252"><body>';
    htmlOutput += '<table border="1"><tr><th colspan="14">VARAHA SDC</th></tr>';
    htmlOutput += `<tr><th style="text-align:center;" colspan="14">DAILY REPORT-${date}</th></tr>`;
    htmlOutput += '<tr><th>S.No</th><th>CRO</th><th>NAME</th><th>AGE</th><th>GENDER</th><th>CATEGORY</th><th>DOCTOR</th><th>HOSPITAL</th><th>SCAN TYPE</th><th>TOTAL SCAN</th><th>TOTAL AMOUNT</th><th>RECIVE AMOUNT</th><th>DUE AMOUNT</th><th>CONTACT NUMBER</th></tr>';
    
    // Add data rows
    reportData.forEach(row => {
      htmlOutput += `<tr><td>${row.sno}</td><td>${row.cro}</td><td>${row.patientName}</td><td>${row.age}</td><td>${row.gender}</td><td>${row.category}</td><td>${row.doctorName}</td><td>${row.hospitalName}</td><td>${row.scanType}</td><td>${row.totalScan}</td><td>${row.totalAmount}</td><td>${row.receivedAmount}</td><td>${row.dueAmount}</td><td>${row.contactNumber}</td></tr>`;
    });
    
    // Add summary rows exactly like PHP
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL</th><th>${summary.totalScans}</th><th>${summary.totalAmount}</th><th>${summary.totalReceived}</th><th>${summary.totalDue}</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL RECIVE AMOUNT</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.totalReceived}</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL DUE AMOUNT</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.totalDue}</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL CREDIT RECIVE</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.creditAmount}</th><th>${summary.creditCros}</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL DISCOUNT</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.discount}</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL COMPLIMENTRY</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.complimentry}</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL REFUND</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.refund}</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>TOTAL EXPANSE</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.expanse}</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    htmlOutput += `<tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>NET AMOUNT</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>${summary.netAmount}</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr>`;
    
    htmlOutput += '</table></body></html>';
    
    res.send(htmlOutput);
    
  } catch (error) {
    console.error('Daily report Excel error:', error);
    res.status(500).json({
      error: 'Failed to generate Excel report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Doctor report endpoint
router.get('/reports/doctor', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    // Convert dd-mm-yyyy to yyyy-mm-dd format for SQL
    const convertDate = (dateStr) => {
      const parts = dateStr.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    
    const sqlStartDate = convertDate(startDate);
    const sqlEndDate = convertDate(endDate);
    
    // Single optimized query instead of loop
    const [reportData] = await connection.execute(`
      SELECT 
        d.dname as doctorName,
        COUNT(*) as totalScans,
        SUM(CASE WHEN p.category = 'GEN' THEN 1 ELSE 0 END) as paidPatients,
        SUM(CASE WHEN p.category <> 'GEN' THEN 1 ELSE 0 END) as freePatients,
        SUM(p.amount) as totalRevenue
      FROM patient_new p
      JOIN console c ON c.c_p_cro = p.cro 
      JOIN doctor d ON d.d_id = p.doctor_name
      WHERE c.added_on BETWEEN ? AND ?
      GROUP BY p.doctor_name, d.dname
      HAVING totalScans > 0
      ORDER BY d.dname
    `, [sqlStartDate, sqlEndDate]);
    
    // Add serial numbers and ensure numeric values
    const formattedData = reportData.map((row, index) => ({
      sno: index + 1,
      doctorName: row.doctorName,
      totalScans: parseInt(row.totalScans) || 0,
      paidPatients: parseInt(row.paidPatients) || 0,
      freePatients: parseInt(row.freePatients) || 0,
      totalRevenue: parseFloat(row.totalRevenue) || 0
    }));
    
    res.json({
      success: true,
      data: formattedData,
      dateRange: {
        startDate,
        endDate
      },
      total: formattedData.length
    });
    
  } catch (error) {
    console.error('Doctor report error:', error);
    res.status(500).json({
      error: 'Failed to generate doctor report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Time slots endpoint
router.get('/time-slots', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT time_id, time_slot FROM time_slot2 ORDER BY time_id`;
    const [timeSlots] = await connection.execute(query);
    
    res.json(timeSlots);
    
  } catch (error) {
    console.error('Time slots error:', error);
    res.status(500).json({ error: 'Failed to fetch time slots', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient deletion endpoint
router.delete('/patients/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const { id } = req.params;
    
    // Get patient CRO for related table cleanup
    const [patientData] = await connection.execute(
      'SELECT cro FROM patient_new WHERE patient_id = ?', [id]
    );
    
    if (patientData.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const cro = patientData[0].cro;
    
    // Delete from all related tables (same as PHP logic)
    await connection.execute('DELETE FROM scan_select WHERE patient_id = ?', [cro]);
    await connection.execute('DELETE FROM lab_banch WHERE cro_number = ?', [cro]);
    await connection.execute('DELETE FROM coridor WHERE cro_number = ?', [cro]);
    await connection.execute('DELETE FROM today_transeciton WHERE cro = ?', [cro]);
    await connection.execute('DELETE FROM console WHERE c_p_cro = ?', [cro]);
    
    // Delete main patient record
    await connection.execute('DELETE FROM patient_new WHERE patient_id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Patient deleted successfully',
      cro: cro
    });
    
  } catch (error) {
    console.error('Patient deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete patient',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;