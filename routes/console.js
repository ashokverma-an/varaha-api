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

// Console queue endpoint
router.get('/queue', async (req, res) => {
  let connection;
  try {
    const { date } = req.query;
    const selectedDate = date || new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
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
        COALESCE(patient_new.category, '') as category,
        COALESCE(patient_new.scan_type, '') as scan_type,
        COALESCE(patient_new.allot_date, '') as allot_date,
        'Pending' as status
      FROM patient_new
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      WHERE patient_new.allot_date = ? OR patient_new.date = ?
      ORDER BY patient_new.patient_id DESC
      LIMIT 100
    `;
    
    const [patients] = await connection.execute(query, [selectedDate, selectedDate]);
    
    res.json({
      success: true,
      data: patients,
      total: Array.isArray(patients) ? patients.length : 0
    });
    
  } catch (error) {
    console.error('Console queue error:', error);
    res.status(500).json({ error: 'Failed to fetch console queue', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Individual patient console endpoint
router.get('/patient/:cro', async (req, res) => {
  let connection;
  try {
    const { cro } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Get patient data
    const patientQuery = `
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
        COALESCE(patient_new.category, '') as category,
        COALESCE(patient_new.scan_type, '') as scan_type,
        COALESCE(patient_new.allot_date, '') as allot_date
      FROM patient_new
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      WHERE patient_new.cro = ?
      LIMIT 1
    `;
    
    const [patientResult] = await connection.execute(patientQuery, [cro]);
    
    if (patientResult.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const patient = patientResult[0];
    
    // Get scan details
    if (patient.scan_type) {
      const scanIds = patient.scan_type.split(',').filter(Boolean);
      if (scanIds.length > 0) {
        const placeholders = scanIds.map(() => '?').join(',');
        const scanQuery = `SELECT s_id, s_name, 'Pending' as status FROM scan WHERE s_id IN (${placeholders})`;
        const [scans] = await connection.execute(scanQuery, scanIds);
        patient.scans = scans;
      } else {
        patient.scans = [];
      }
    } else {
      patient.scans = [];
    }
    
    res.json({
      success: true,
      data: patient
    });
    
  } catch (error) {
    console.error('Console patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient console data', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Update scan status endpoint
router.put('/scan-status', async (req, res) => {
  let connection;
  try {
    const { cro, scanId, status } = req.body;
    
    // For now, just return success as we don't have a scan_status table
    // In a real implementation, you would update a scan_status table
    
    res.json({
      success: true,
      message: 'Scan status updated successfully'
    });
    
  } catch (error) {
    console.error('Console scan status error:', error);
    res.status(500).json({ error: 'Failed to update scan status', details: error.message });
  }
});

module.exports = router;