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
    
    // Weekly patients (last 7 days)
    const [weeklyPatients] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM patient_new 
      WHERE DATE(STR_TO_DATE(date, '%d-%m-%Y')) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    
    // Monthly patients (last 30 days)
    const [monthlyPatients] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM patient_new 
      WHERE DATE(STR_TO_DATE(date, '%d-%m-%Y')) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);
    
    // Pending reports
    const [pendingReports] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM patient_new p
      LEFT JOIN lab_banch lb ON lb.cro_number = p.cro
      WHERE lb.c_status = 0 OR lb.c_status IS NULL
    `);
    
    // Completed reports today
    const [completedToday] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM lab_banch lb
      WHERE lb.c_status = 1 AND DATE(lb.added_on) = CURDATE()
    `);
    
    // Total completed reports (last 7 days)
    const [completedWeek] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM lab_banch lb
      WHERE lb.c_status = 1 AND DATE(lb.added_on) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    
    // Total reports
    const [totalReports] = await connection.execute(`
      SELECT COUNT(*) as count FROM lab_banch
    `);
    
    // Calculate completion rate
    const total = pendingReports[0].count + completedWeek[0].count;
    const completionRate = total > 0 ? Math.round((completedWeek[0].count / total) * 100) : 0;
    
    // Average reports per day (based on last 7 days)
    const avgReportsPerDay = Math.round(completedWeek[0].count / 7);
    
    res.json({
      todayPatients: todayPatients[0].count,
      weeklyPatients: weeklyPatients[0].count,
      monthlyPatients: monthlyPatients[0].count,
      pendingReports: pendingReports[0].count,
      completedReports: completedToday[0].count,
      totalReports: totalReports[0].count,
      completionRate,
      avgReportsPerDay
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
    const { search = '', date = '' } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Match PHP query exactly
    let whereClause = 'WHERE (np.n_patient_x_ray = "no" OR np.n_patient_ct = "no")';
    const queryParams = [];
    
    if (search && search.trim()) {
      const searchTerm = decodeURIComponent(search.trim());
      whereClause += ' AND (p.cro LIKE ? OR p.patient_name LIKE ?)';
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    if (date && date.trim()) {
      whereClause += ' AND p.date = ?';
      queryParams.push(date.trim());
    }
    
    // Exact PHP query structure
    const dataQuery = `
      SELECT 
        np.*,
        p.*,
        csd.doctor_name
      FROM nursing_patient np
      JOIN patient_new p ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      ${whereClause}
      ORDER BY p.patient_id DESC
    `;
    
    const [patients] = await connection.execute(dataQuery, queryParams);
    
    res.json({
      success: true,
      data: patients,
      total: patients.length
    });
    
  } catch (error) {
    console.error('Doctor pending patients error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pending patients',
      details: error.message,
      stack: error.stack
    });
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
      LEFT JOIN scan s ON s.s_id = p.scan_type
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

/**
 * @swagger
 * /doctor/corridor-list:
 *   get:
 *     tags: [Doctor]
 *     summary: Get corridor list
 *     description: Get list of corridor data for doctor
 *     responses:
 *       200:
 *         description: Corridor list data
 */
router.get('/corridor-list', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [corridorData] = await connection.execute(`
      SELECT 
        c_id,
        cro_number,
        n_status,
        added
      FROM coridor
      ORDER BY added DESC
      LIMIT 100
    `);
    
    res.json({
      success: true,
      data: corridorData
    });
    
  } catch (error) {
    console.error('Corridor list error:', error);
    res.status(500).json({ error: 'Failed to fetch corridor list' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/ct-scan-doctors:
 *   get:
 *     tags: [Doctor]
 *     summary: Get CT scan doctors list
 *     description: Get list of CT scan doctors
 *     responses:
 *       200:
 *         description: CT scan doctors list
 */
router.get('/ct-scan-doctors', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [doctors] = await connection.execute(`
      SELECT 
        id as d_id,
        doctor_name
      FROM ct_scan_doctor
      ORDER BY id DESC
    `);
    
    res.json({
      success: true,
      data: doctors
    });
    
  } catch (error) {
    console.error('CT scan doctors list error:', error);
    res.status(500).json({ error: 'Failed to fetch CT scan doctors' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/ct-scan-doctors:
 *   post:
 *     tags: [Doctor]
 *     summary: Add CT scan doctor
 *     description: Add new CT scan doctor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctor_name]
 *             properties:
 *               doctor_name:
 *                 type: string
 *               specialization:
 *                 type: string
 *               mobile:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Doctor added successfully
 */
router.post('/ct-scan-doctors', async (req, res) => {
  let connection;
  try {
    const { doctor_name } = req.body;
    
    if (!doctor_name) {
      return res.status(400).json({ error: 'Doctor name is required' });
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      INSERT INTO ct_scan_doctor (doctor_name)
      VALUES (?)
    `, [doctor_name]);
    
    res.status(201).json({
      success: true,
      message: 'Doctor added successfully',
      doctor_id: result.insertId
    });
    
  } catch (error) {
    console.error('Add CT scan doctor error:', error);
    res.status(500).json({ error: 'Failed to add doctor' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/ct-scan-doctors/{id}:
 *   put:
 *     tags: [Doctor]
 *     summary: Update CT scan doctor
 *     description: Update CT scan doctor details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               doctor_name:
 *                 type: string
 *               specialization:
 *                 type: string
 *               mobile:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Doctor updated successfully
 */
router.put('/ct-scan-doctors/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { doctor_name } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      UPDATE ct_scan_doctor 
      SET doctor_name = ?
      WHERE id = ?
    `, [doctor_name, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.json({
      success: true,
      message: 'Doctor updated successfully'
    });
    
  } catch (error) {
    console.error('Update CT scan doctor error:', error);
    res.status(500).json({ error: 'Failed to update doctor' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/ct-scan-doctors/{id}:
 *   delete:
 *     tags: [Doctor]
 *     summary: Delete CT scan doctor
 *     description: Delete CT scan doctor
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor deleted successfully
 */
router.delete('/ct-scan-doctors/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute('DELETE FROM ct_scan_doctor WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete CT scan doctor error:', error);
    res.status(500).json({ error: 'Failed to delete doctor' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/patient-in-queue:
 *   get:
 *     tags: [Doctor]
 *     summary: Get patient in queue
 *     description: Get paginated list of patients in queue with examination_id != 0
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Patient in queue data
 */
/**
 * @swagger
 * /doctor/nursing/{cro}:
 *   get:
 *     tags: [Doctor]
 *     summary: Get nursing patient details
 *     description: Get detailed nursing information for a patient by CRO
 *     parameters:
 *       - in: path
 *         name: cro
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nursing patient details
 */
router.get('/nursing/:cro', async (req, res) => {
  let connection;
  try {
    const { cro } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Get patient details with nursing data
    const [patients] = await connection.execute(`
      SELECT 
        patient_new.*,
        nursing_patient.*,
        ct_scan_doctor.doctor_name as ct_doctor_name
      FROM patient_new 
      LEFT JOIN nursing_patient ON patient_new.cro = nursing_patient.n_patient_cro 
      LEFT JOIN ct_scan_doctor ON nursing_patient.ct_scan_doctor_id = ct_scan_doctor.id 
      WHERE patient_new.cro = ?
    `, [cro]);
    
    if (patients.length === 0) {
      return res.status(404).json({ 
        error: 'Patient not found',
        cro: req.params.cro,
        query: `SELECT patient_new.*, nursing_patient.*, ct_scan_doctor.doctor_name as ct_doctor_name FROM patient_new LEFT JOIN nursing_patient ON patient_new.cro = nursing_patient.n_patient_cro LEFT JOIN ct_scan_doctor ON nursing_patient.ct_scan_doctor_id = ct_scan_doctor.id WHERE patient_new.cro = '${cro}'`
      });
    }
    
    const patient = patients[0];
    
    // Get scan details with scan head information
    const scanIds = patient.scan_type ? patient.scan_type.split(',') : [];
    const scans = [];
    
    for (const scanId of scanIds) {
      if (scanId.trim()) {
        const [scanResult] = await connection.execute(`
          SELECT s.*, sh.head_name 
          FROM scan s 
          LEFT JOIN scan_heads sh ON s.scan_head_id = sh.id 
          WHERE s.s_id = ?
        `, [scanId.trim()]);
        if (scanResult.length > 0) {
          scans.push(scanResult[0]);
        }
      }
    }
    
    // Get all CT scan doctors
    const [doctors] = await connection.execute('SELECT * FROM ct_scan_doctor');
    
    res.json({
      success: true,
      data: {
        patient,
        scans,
        doctors
      }
    });
    
  } catch (error) {
    console.error('Nursing patient detail error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch nursing patient details',
      details: error.message,
      stack: error.stack,
      cro: req.params.cro,
      query: req.query
    });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/save-nursing:
 *   post:
 *     tags: [Doctor]
 *     summary: Save nursing data
 *     description: Save or update nursing patient data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cro]
 *             properties:
 *               cro:
 *                 type: string
 *               ct_scan_doctor_id:
 *                 type: integer
 *               n_patient_ct:
 *                 type: string
 *               n_patient_ct_report_date:
 *                 type: string
 *               n_patient_ct_remark:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nursing data saved successfully
 */
router.post('/save-nursing', async (req, res) => {
  let connection;
  try {
    const { 
      cro, 
      ct_scan_doctor_id,
      ct_scan_report_date, 
      n_patient_ct, 
      n_patient_ct_report_date, 
      n_patient_ct_remark,
      n_patient_x_ray,
      n_patient_x_ray_report_date,
      n_patient_x_ray_remark
    } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Check if nursing record exists
    const [existing] = await connection.execute(
      'SELECT * FROM nursing_patient WHERE n_patient_cro = ?', [cro]
    );
    
    if (existing.length > 0) {
      // Update existing record
      await connection.execute(`
        UPDATE nursing_patient 
        SET ct_scan_doctor_id = ?, ct_scan_report_date = ?, n_patient_ct = ?, n_patient_ct_report_date = ?, n_patient_ct_remark = ?,
            n_patient_x_ray = ?, n_patient_x_ray_report_date = ?, n_patient_x_ray_remark = ?
        WHERE n_patient_cro = ?
      `, [
        ct_scan_doctor_id || null,
        ct_scan_report_date || null, 
        n_patient_ct, 
        n_patient_ct_report_date || null, 
        n_patient_ct_remark,
        n_patient_x_ray,
        n_patient_x_ray_report_date || null,
        n_patient_x_ray_remark,
        cro
      ]);
    } else {
      // Insert new record
      await connection.execute(`
        INSERT INTO nursing_patient (
          n_patient_cro, ct_scan_doctor_id, ct_scan_report_date, n_patient_ct, n_patient_ct_report_date, n_patient_ct_remark,
          n_patient_x_ray, n_patient_x_ray_report_date, n_patient_x_ray_remark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cro, 
        ct_scan_doctor_id || null,
        ct_scan_report_date || null, 
        n_patient_ct, 
        n_patient_ct_report_date || null, 
        n_patient_ct_remark,
        n_patient_x_ray,
        n_patient_x_ray_report_date || null,
        n_patient_x_ray_remark
      ]);
    }
    
    res.json({
      success: true,
      message: 'Nursing data saved successfully'
    });
    
  } catch (error) {
    console.error('Save nursing data error:', error);
    res.status(500).json({ 
      error: 'Failed to save nursing data',
      details: error.message,
      stack: error.stack,
      body: req.body
    });
  } finally {
    if (connection) await connection.end();
  }
});

router.get('/patient-in-queue', async (req, res) => {
  let connection;
  try {
    const { page = 1, search = '', limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    connection = await mysql.createConnection(dbConfig);
    
    // Get total records
    let totalQuery = `
      SELECT COUNT(*) AS total FROM coridor 
      JOIN patient_new ON patient_new.cro = coridor.cro_number 
      WHERE patient_new.examination_id != 0
    `;
    
    const queryParams = [];
    if (search) {
      totalQuery += ` AND coridor.cro_number LIKE ?`;
      queryParams.push(`%${search}%`);
    }
    
    const [totalResult] = await connection.execute(totalQuery, queryParams);
    const totalRecords = totalResult[0].total;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));
    
    // Get paginated data
    let dataQuery = `
      SELECT 
        coridor.c_id,
        coridor.cro_number,
        patient_new.patient_name,
        COALESCE(patient_new.pre, '') as pre,
        patient_new.allot_date,
        patient_new.examination_id,
        coridor.added
      FROM coridor 
      JOIN patient_new ON patient_new.cro = coridor.cro_number 
      WHERE patient_new.examination_id != 0
    `;
    
    const dataParams = [];
    if (search) {
      dataQuery += ` AND coridor.cro_number LIKE ?`;
      dataParams.push(`%${search}%`);
    }
    
    dataQuery += ` ORDER BY coridor.added DESC LIMIT ? OFFSET ?`;
    dataParams.push(parseInt(limit), offset);
    
    const [patients] = await connection.execute(dataQuery, dataParams);
    
    res.json({
      success: true,
      data: patients,
      totalPages,
      currentPage: parseInt(page),
      total: totalRecords
    });
    
  } catch (error) {
    console.error('Patient in queue error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch patient in queue data', 
      details: error.message,
      stack: error.stack,
      query: {
        page: req.query.page,
        search: req.query.search,
        limit: req.query.limit
      }
    });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/ct-scan-doctor-list:
 *   get:
 *     tags: [Doctor]
 *     summary: Get CT scan doctor list with date filtering
 *     description: Get list of patients with CT scan doctor assignments with date filtering
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of CT scan doctor assignments
 */
router.get('/ct-scan-doctor-list', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date, page = 1, limit = 10, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    connection = await mysql.createConnection(dbConfig);
    
    // Get today's date in DD-MM-YYYY format if no dates provided
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    // Build WHERE clause with date filtering
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    
    if (search && search.trim()) {
      const searchTerm = decodeURIComponent(search.trim());
      whereClause += ' AND (p.cro LIKE ? OR p.patient_name LIKE ?)';
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    // Date filtering logic - show all data if no dates provided
    if (from_date && from_date.trim() && to_date && to_date.trim()) {
      whereClause += ` AND STR_TO_DATE(p.date, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%d-%m-%Y') AND STR_TO_DATE(?, '%d-%m-%Y')`;
      queryParams.push(from_date.trim(), to_date.trim());
    } else if (from_date && from_date.trim()) {
      whereClause += ` AND STR_TO_DATE(p.date, '%d-%m-%Y') >= STR_TO_DATE(?, '%d-%m-%Y')`;
      queryParams.push(from_date.trim());
    } else if (to_date && to_date.trim()) {
      whereClause += ` AND STR_TO_DATE(p.date, '%d-%m-%Y') <= STR_TO_DATE(?, '%d-%m-%Y')`;
      queryParams.push(to_date.trim());
    }
    // Remove default date filter to show all data when no dates are specified
    
    // Get total count with filters applied - matching original PHP query structure
    const countQuery = `
      SELECT COUNT(*) as total
      FROM patient_new p
      ${whereClause}
    `;
    
    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;
    
    // Get all data for client-side pagination - matching original PHP query structure
    const dataQuery = `
      SELECT 
        p.*,
        COALESCE(np.n_patient_ct, 'no') as n_patient_ct,
        np.n_patient_ct_report_date,
        np.n_patient_ct_remark,
        COALESCE(np.n_patient_x_ray, 'no') as n_patient_x_ray,
        np.n_patient_x_ray_report_date,
        np.n_patient_x_ray_remark,
        np.ct_scan_doctor_id,
        csd.doctor_name as ct_doctor_name
      FROM patient_new p
      LEFT JOIN nursing_patient np ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      ${whereClause}
      ORDER BY p.patient_id DESC
    `;
    
    const [patients] = await connection.execute(dataQuery, queryParams);
    
    res.json({
      success: true,
      data: patients,
      total: total,
      defaultDate: today
    });
    
  } catch (error) {
    console.error('CT scan doctor list error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch CT scan doctor list',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /doctor/completed-reports:
 *   get:
 *     tags: [Doctor]
 *     summary: Get completed reports
 *     description: Get list of completed reports for doctor review
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of completed reports
 */
router.get('/completed-reports', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date, page = 1, limit = 10, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    connection = await mysql.createConnection(dbConfig);
    
    // Build WHERE clause - Match PHP view_report logic exactly
    let whereClause = 'WHERE np.n_patient_x_ray = "yes" AND np.n_patient_ct = "yes"';
    const queryParams = [];
    
    if (search && search.trim()) {
      const searchTerm = decodeURIComponent(search.trim());
      whereClause += ' AND (p.cro LIKE ? OR p.patient_name LIKE ?)';
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    if (from_date && from_date.trim() && to_date && to_date.trim()) {
      whereClause += ` AND DATE(np.n_patient_ct_report_date) BETWEEN ? AND ?`;
      queryParams.push(from_date.trim(), to_date.trim());
    } else if (from_date && from_date.trim()) {
      whereClause += ` AND DATE(np.n_patient_ct_report_date) >= ?`;
      queryParams.push(from_date.trim());
    } else if (to_date && to_date.trim()) {
      whereClause += ` AND DATE(np.n_patient_ct_report_date) <= ?`;
      queryParams.push(to_date.trim());
    }
    
    // Get total count with filters applied
    const countQuery = `
      SELECT COUNT(*) as total
      FROM nursing_patient np
      JOIN patient_new p ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      ${whereClause}
    `;
    
    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;
    
    // Get paginated data - Match PHP view_report columns exactly
    const dataQuery = `
      SELECT 
        p.*,
        np.n_patient_ct,
        np.n_patient_ct_report_date,
        np.n_patient_ct_remark,
        np.n_patient_x_ray,
        np.n_patient_x_ray_report_date,
        np.n_patient_x_ray_remark,
        csd.doctor_name
      FROM nursing_patient np
      JOIN patient_new p ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      ${whereClause}
      ORDER BY p.patient_id DESC
      LIMIT ? OFFSET ?
    `;
    
    const [reports] = await connection.execute(dataQuery, [...queryParams, parseInt(limit), offset]);
    
    res.json({
      success: true,
      data: reports,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
    
  } catch (error) {
    console.error('Doctor completed reports error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch completed reports',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;