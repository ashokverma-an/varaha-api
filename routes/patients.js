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

// Generate CRO number
function generateCRO() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = Date.now().toString().slice(-6);
  return `CRO${year}${month}${day}${time}`;
}

/**
 * @swagger
 * /patients:
 *   get:
 *     tags: [Patients]
 *     summary: Get all patients
 *     description: Get list of all patients with pagination
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of patients
 */
router.get('/', async (req, res) => {
  let connection;
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [patients] = await connection.execute(`
      SELECT 
        p.*,
        d.doctor_name,
        h.hospital_name,
        s.scan_name
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
      ORDER BY p.patient_id DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: patients,
      total: patients.length
    });
    
  } catch (error) {
    console.error('Patients fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/cro/{cro}:
 *   get:
 *     tags: [Patients]
 *     summary: Get patient by CRO
 *     description: Get patient details by CRO number
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
router.get('/cro/:cro', async (req, res) => {
  let connection;
  try {
    const { cro } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [patients] = await connection.execute(`
      SELECT 
        p.*,
        d.doctor_name,
        h.hospital_name,
        s.scan_name
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
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
    console.error('Patient fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/doctors:
 *   get:
 *     tags: [Patients]
 *     summary: Get all doctors
 *     description: Get list of all available doctors
 *     responses:
 *       200:
 *         description: List of doctors
 */
router.get('/doctors', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [doctors] = await connection.execute('SELECT * FROM doctor ORDER BY doctor_name');
    
    res.json({
      success: true,
      data: doctors
    });
    
  } catch (error) {
    console.error('Doctors fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/hospitals:
 *   get:
 *     tags: [Patients]
 *     summary: Get all hospitals
 *     description: Get list of all available hospitals
 *     responses:
 *       200:
 *         description: List of hospitals
 */
router.get('/hospitals', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [hospitals] = await connection.execute('SELECT * FROM hospital ORDER BY hospital_name');
    
    res.json({
      success: true,
      data: hospitals
    });
    
  } catch (error) {
    console.error('Hospitals fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/scans:
 *   get:
 *     tags: [Patients]
 *     summary: Get all scan types
 *     description: Get list of all available scan types
 *     responses:
 *       200:
 *         description: List of scan types
 */
router.get('/scans', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [scans] = await connection.execute('SELECT * FROM scan ORDER BY scan_name');
    
    res.json({
      success: true,
      data: scans
    });
    
  } catch (error) {
    console.error('Scans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/register:
 *   post:
 *     tags: [Patients]
 *     summary: Register new patient
 *     description: Register a new patient with complete details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patient_name, age, gender, mobile, doctor_name, hospital_id, scan_type, amount]
 *             properties:
 *               patient_name:
 *                 type: string
 *                 example: "John Doe"
 *               age:
 *                 type: integer
 *                 example: 35
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 example: "Male"
 *               mobile:
 *                 type: string
 *                 example: "9876543210"
 *               doctor_name:
 *                 type: integer
 *                 example: 1
 *               hospital_id:
 *                 type: integer
 *                 example: 1
 *               scan_type:
 *                 type: integer
 *                 example: 1
 *               amount:
 *                 type: number
 *                 example: 1500.00
 *               appointment_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-15"
 *               appointment_time:
 *                 type: string
 *                 example: "10:30"
 *               notes:
 *                 type: string
 *                 example: "Patient notes"
 *     responses:
 *       201:
 *         description: Patient registered successfully
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
 *                   example: "Patient registered successfully"
 *                 cro:
 *                   type: string
 *                   example: "CRO24011512345"
 *                 patient_id:
 *                   type: integer
 *                   example: 123
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/register', async (req, res) => {
  let connection;
  try {
    const {
      patient_name,
      age,
      gender,
      mobile,
      doctor_name,
      hospital_id,
      scan_type,
      amount,
      appointment_date,
      appointment_time,
      notes
    } = req.body;

    // Validation
    if (!patient_name || !age || !gender || !mobile || !doctor_name || !hospital_id || !scan_type || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    connection = await mysql.createConnection(dbConfig);
    
    const cro = generateCRO();
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0];
    
    const [result] = await connection.execute(`
      INSERT INTO patient_new (
        cro, patient_name, age, gender, mobile, doctor_name, hospital_id, 
        scan_type, amount, date, time, appointment_date, appointment_time, 
        notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered', NOW())
    `, [
      cro, patient_name, age, gender, mobile, doctor_name, hospital_id,
      scan_type, amount, currentDate, currentTime, appointment_date || currentDate,
      appointment_time || '09:00', notes || '', 
    ]);

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      cro: cro,
      patient_id: result.insertId
    });
    
  } catch (error) {
    console.error('Patient registration error:', error);
    res.status(500).json({ error: 'Failed to register patient' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/slots/available:
 *   get:
 *     tags: [Patients]
 *     summary: Get available appointment slots
 *     description: Get available appointment slots for a specific date
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-15"
 *       - in: query
 *         name: doctor_id
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Available slots retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 available_slots:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["09:00", "09:30", "10:00", "10:30"]
 */
router.get('/slots/available', async (req, res) => {
  let connection;
  try {
    const { date, doctor_id } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    connection = await mysql.createConnection(dbConfig);
    
    // Get booked slots for the date
    let query = 'SELECT appointment_time FROM patient_new WHERE appointment_date = ?';
    let params = [date];
    
    if (doctor_id) {
      query += ' AND doctor_name = ?';
      params.push(doctor_id);
    }
    
    const [bookedSlots] = await connection.execute(query, params);
    const bookedTimes = bookedSlots.map(slot => slot.appointment_time);
    
    // Generate available slots (9 AM to 6 PM, 30-minute intervals)
    const allSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      allSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      allSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));
    
    res.json({
      success: true,
      available_slots: availableSlots
    });
    
  } catch (error) {
    console.error('Slots fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/{id}/update-status:
 *   put:
 *     tags: [Patients]
 *     summary: Update patient status
 *     description: Update patient status (registered, in-progress, completed, cancelled)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [registered, in-progress, completed, cancelled]
 *                 example: "completed"
 *               notes:
 *                 type: string
 *                 example: "Scan completed successfully"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */
router.put('/:id/update-status', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      UPDATE patient_new 
      SET status = ?, notes = COALESCE(?, notes), updated_at = NOW()
      WHERE patient_id = ?
    `, [status, notes, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json({
      success: true,
      message: 'Patient status updated successfully'
    });
    
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update patient status' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /patients/search:
 *   get:
 *     tags: [Patients]
 *     summary: Search patients
 *     description: Search patients by name, CRO, mobile, or other criteria
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         example: "John"
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-01"
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-31"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         example: "completed"
 *       - in: query
 *         name: doctor_id
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Search results
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
 */
router.get('/search', async (req, res) => {
  let connection;
  try {
    const { q, date_from, date_to, status, doctor_id, limit = 50 } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT 
        p.*,
        d.doctor_name,
        h.hospital_name,
        s.scan_name
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
      WHERE 1=1
    `;
    
    const params = [];
    
    if (q) {
      query += ' AND (p.patient_name LIKE ? OR p.cro LIKE ? OR p.mobile LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    
    if (date_from) {
      query += ' AND p.date >= ?';
      params.push(date_from);
    }
    
    if (date_to) {
      query += ' AND p.date <= ?';
      params.push(date_to);
    }
    
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    
    if (doctor_id) {
      query += ' AND p.doctor_name = ?';
      params.push(doctor_id);
    }
    
    query += ' ORDER BY p.patient_id DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const [patients] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: patients,
      total: patients.length
    });
    
  } catch (error) {
    console.error('Patient search error:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;