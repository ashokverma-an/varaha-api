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

// Console queue - matches PHP query exactly
router.get('/queue', async (req, res) => {
  let connection;
  let dataQuery = '';
  try {
    console.log('Console queue request received:', req.query);
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    connection = await mysql.createConnection(dbConfig);
    console.log('Database connection established');

    // Build WHERE clause - Match PHP logic exactly
    let whereClause = `
  WHERE lab_banch.c_status = 1 
    AND lab_banch.added >= UNIX_TIMESTAMP('2023-05-01 00:00:00')
`;

    const queryParams = [];

    if (search && search.trim()) {
      const searchTerm = decodeURIComponent(search.trim());
      whereClause += ' AND (lab_banch.cro_number LIKE ? OR patient_new.patient_name LIKE ?)';
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Get total count with filters applied
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lab_banch 
      JOIN patient_new ON patient_new.cro = lab_banch.cro_number
      ${whereClause}
    `;

    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;
    console.log('Total records found:', total);

    // Get paginated data - Match PHP columns exactly
    dataQuery = `
      SELECT 
        lab_banch.*,
        patient_new.*
      FROM lab_banch 
      JOIN patient_new ON patient_new.cro = lab_banch.cro_number
      ${whereClause}
      ORDER BY patient_new.patient_id DESC
      LIMIT ? OFFSET ?
    `;

    const [patients] = await connection.execute(dataQuery, [...queryParams, parseInt(limit), offset]);
    console.log('Query executed successfully, found', patients.length, 'patients');

    res.json({
      success: true,
      data: patients,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('Console queue error:', error);
    res.status(500).json({
      error: dataQuery || 'Query not initialized',
      details: error.message,
      stack: error.stack,
      query: req.query,
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

// Get patient details for console
router.get('/patient/:cro', async (req, res) => {
  let connection;
  try {
    const { cro } = req.params;

    connection = await mysql.createConnection(dbConfig);

    // Get patient details with time slot
    const [patients] = await connection.execute(`
      SELECT 
        patient_new.*,
        time_slot2.time_slot,
        doctor.dname as doctor_name
      FROM patient_new 
      JOIN time_slot2 ON time_slot2.time_id = patient_new.allot_time 
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      WHERE patient_new.cro = ?
    `, [cro]);

    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get scan details
    const [scans] = await connection.execute(`
      SELECT 
        scan_select.*,
        scan.s_name
      FROM scan_select 
      JOIN scan ON scan.s_id = scan_select.scan_id
      WHERE scan_select.patient_id = ?
    `, [cro]);

    // Get console timing info with Asia/Calcutta timezone
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Calcutta' });
    const [consoleData] = await connection.execute(`
      SELECT * FROM console 
      WHERE con_id = (SELECT MAX(con_id) FROM console WHERE added_on = ?)
    `, [currentDate]);

    res.json({
      success: true,
      data: {
        patient: patients[0],
        scans: scans,
        console: consoleData[0] || null
      }
    });

  } catch (error) {
    console.error('Console patient detail error:', error);
    res.status(500).json({
      error: 'Failed to fetch patient details',
      details: error.message,
      stack: error.stack,
      params: req.params,
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

// Update scan status
router.post('/update-scan-status', async (req, res) => {
  let connection;
  try {
    const { scan_id, patient_id, status } = req.body;

    connection = await mysql.createConnection(dbConfig);

    await connection.execute(`
      UPDATE scan_select 
      SET status = ? 
      WHERE scan_id = ? AND patient_id = ?
    `, [status, scan_id, patient_id]);

    // Check if all scans are complete
    const [pendingScans] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM scan_select 
      WHERE patient_id = ? AND status = 'pending'
    `, [patient_id]);

    const allComplete = pendingScans[0].count === 0;

    res.json({
      success: true,
      message: 'Scan status updated',
      allComplete: allComplete
    });

  } catch (error) {
    console.error('Update scan status error:', error);
    res.status(500).json({
      error: 'Failed to update scan status',
      details: error.message,
      stack: error.stack,
      body: req.body,
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

// Save console data
router.post('/save-console', async (req, res) => {
  let connection;
  try {
    const {
      cro,
      start_time,
      stop_time,
      status,
      examination_id,
      number_scan,
      number_film,
      number_contrast,
      technician_name,
      nursing_name,
      issue_cd,
      remark
    } = req.body;

    connection = await mysql.createConnection(dbConfig);

    // Insert console record with Asia/Calcutta timezone
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Calcutta' });
    await connection.execute(`
      INSERT INTO console (
        c_p_cro, start_time, stop_time, status, examination_id,
        number_scan, number_film, number_contrast, technician_name,
        nursing_name, issue_cd, remark, added_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cro, start_time, stop_time, status, examination_id,
      number_scan, number_film, number_contrast, technician_name,
      nursing_name, issue_cd, remark, currentDate
    ]);

    res.json({
      success: true,
      message: 'Console data saved successfully'
    });

  } catch (error) {
    console.error('Save console data error:', error);
    res.status(500).json({
      error: 'Failed to save console data',
      details: error.message,
      stack: error.stack,
      body: req.body,
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

// Console stats
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Use Asia/Calcutta timezone like PHP
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Calcutta' });

    // Today's patients in console
    const [todayPatients] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM console 
      WHERE added_on = ?
    `, [today]);

    // Completed today
    const [completedToday] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM console 
      WHERE added_on= ? AND status = 'Complete'
    `, [today]);

    // Pending queue
    const [pendingQueue] = await connection.execute(`
  SELECT COUNT(*) as count 
  FROM lab_banch 
  WHERE c_status = 1 
    AND added >= UNIX_TIMESTAMP('2023-05-01 00:00:00')
`);

    // Total processed
    const [totalProcessed] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM console
    `);

    res.json({
      todayPatients: todayPatients[0].count,
      completedToday: completedToday[0].count,
      pendingQueue: pendingQueue[0].count,
      totalProcessed: totalProcessed[0].count
    });

  } catch (error) {
    console.error('Console stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch console stats',
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

// Daily report
router.get('/daily-report', async (req, res) => {
  let connection;
  try {
    console.log('Daily report request received:', req.query);
    const { fromDate, toDate } = req.query;
    console.log('Extracted dates - fromDate:', fromDate, 'toDate:', toDate);
    
    // Convert DD-MM-YYYY to YYYY-MM-DD for SQL queries
    const convertToSqlDate = (ddmmyyyy) => {
      if (!ddmmyyyy) return null;
      const parts = ddmmyyyy.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    
    const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
    const sqlStartDate = convertToSqlDate(fromDate || today);
    const sqlEndDate = convertToSqlDate(toDate || today);
    console.log('SQL dates - sqlStartDate:', sqlStartDate, 'sqlEndDate:', sqlEndDate);

    connection = await mysql.createConnection(dbConfig);

    // Get all data without pagination
    const query = `
      SELECT 
        console.*,
        patient_new.*,
        doctor.dname as doctor_name
      FROM patient_new 
      JOIN doctor ON doctor.d_id = patient_new.doctor_name  
      JOIN console ON console.c_p_cro = patient_new.cro 
      WHERE console.added_on BETWEEN ? AND ?
      ORDER BY console.con_id ASC
    `;
    
    const [reports] = await connection.execute(query, [sqlStartDate, sqlEndDate]);

    // Process scan names for each report
    for (const report of reports) {
      if (report.scan_type) {
        const scanIds = report.scan_type.split(',');
        const scanNames = [];
        
        for (const scanId of scanIds) {
          if (scanId.trim()) {
            const [scanResult] = await connection.execute(
              'SELECT s_name FROM scan WHERE s_id = ?',
              [scanId.trim()]
            );
            if (scanResult.length > 0) {
              scanNames.push(scanResult[0].s_name);
            }
          }
        }
        
        report.scan_names = scanNames.join(', ');
        report.scan_type = scanNames.join(', ');
      }
    }

    res.json({
      success: true,
      data: reports,
      fromDate: fromDate || today,
      toDate: toDate || today,
      total: reports.length
    });

  } catch (error) {
    console.error('Console daily report error:', error);
    res.status(500).json({
      error: 'Failed to fetch daily report',
      details: error.message,
      stack: error.stack,
      query: req.query,
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

// Console queue after - matches PHP index-after.php query exactly
router.get('/queue-after', async (req, res) => {
  let connection;
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    connection = await mysql.createConnection(dbConfig);

    // Build WHERE clause - Match PHP logic exactly
    let whereClause = `WHERE lab_banch.c_status=1 AND lab_banch.added >= UNIX_TIMESTAMP('2023-06-01 00:00:00')`;
    const queryParams = [];

    if (search && search.trim()) {
      const searchTerm = decodeURIComponent(search.trim());
      whereClause += ' AND (lab_banch.cro_number LIKE ? OR patient_new.patient_name LIKE ?)';
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Get total count with filters applied
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lab_banch 
      JOIN patient_new ON patient_new.cro = lab_banch.cro_number
      ${whereClause}
    `;

    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get paginated data - Match PHP columns exactly
    const dataQuery = `
      SELECT 
        lab_banch.*,
        patient_new.*
      FROM lab_banch 
      JOIN patient_new ON patient_new.cro = lab_banch.cro_number
      ${whereClause}
      ORDER BY lab_banch.cro_number DESC
      LIMIT ? OFFSET ?
    `;

    const [patients] = await connection.execute(dataQuery, [...queryParams, parseInt(limit), offset]);

    res.json({
      success: true,
      data: patients,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('Console queue after error:', error);
    res.status(500).json({
      error: 'Failed to fetch console queue after data',
      details: error.message,
      stack: error.stack,
      query: req.query,
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

// Detail report - date range filtering
router.get('/detail-report', async (req, res) => {
  let connection;
  try {
    const { fromDate, toDate } = req.query;
    
    // Convert DD-MM-YYYY to YYYY-MM-DD for SQL queries
    const convertToSqlDate = (ddmmyyyy) => {
      if (!ddmmyyyy) return null;
      const parts = ddmmyyyy.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    
    const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
    const sqlStartDate = convertToSqlDate(fromDate || today);
    const sqlEndDate = convertToSqlDate(toDate || today);

    connection = await mysql.createConnection(dbConfig);

    // Get all data without pagination
    const query = `
      SELECT 
        console.*,
        patient_new.*,
        doctor.dname as doctor_name
      FROM patient_new 
      JOIN console ON console.c_p_cro = patient_new.cro 
      JOIN doctor ON doctor.d_id = patient_new.doctor_name
      WHERE console.added_on BETWEEN ? AND ?
      ORDER BY console.con_id ASC
    `;
    
    const [reports] = await connection.execute(query, [sqlStartDate, sqlEndDate]);

    // Process scan names for each report
    for (const report of reports) {
      if (report.scan_type) {
        const scanIds = report.scan_type.split(',');
        const scanNames = [];
        
        for (const scanId of scanIds) {
          if (scanId.trim()) {
            const [scanResult] = await connection.execute(
              'SELECT s_name FROM scan WHERE s_id = ?',
              [scanId.trim()]
            );
            if (scanResult.length > 0) {
              scanNames.push(scanResult[0].s_name);
            }
          }
        }
        
        report.scan_names = scanNames.join(', ');
        report.scan_type = scanNames.join(', ');
      }
    }

    res.json({
      success: true,
      data: reports,
      fromDate: fromDate || today,
      toDate: toDate || today,
      total: reports.length
    });

  } catch (error) {
    console.error('Console detail report error:', error);
    res.status(500).json({
      error: 'Failed to fetch detail report',
      details: error.message,
      stack: error.stack,
      query: req.query,
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

// Update console record - only updates patient_new table
router.post('/update-console', async (req, res) => {
  let connection;
  try {
    const {
      con_id,
      scan_date,
      allot_date,
      date
    } = req.body;

    connection = await mysql.createConnection(dbConfig);

    // Get CRO from console record
    const [consoleRecord] = await connection.execute(
      'SELECT c_p_cro FROM console WHERE con_id = ?',
      [con_id]
    );
    
    if (consoleRecord.length === 0) {
      return res.status(404).json({ error: 'Console record not found' });
    }

    const cro = consoleRecord[0].c_p_cro;
    const updateFields = [];
    const updateValues = [];
    
    // Handle date formats based on database requirements
    if (scan_date) {
      updateFields.push('scan_date = ?');
      updateValues.push(scan_date); // Keep YYYY-MM-DD format for scan_date
    }
    if (allot_date) {
      updateFields.push('allot_date = ?');
      // Convert YYYY-MM-DD to DD-MM-YYYY for allot_date
      const parts = allot_date.split('-');
      const formattedAllotDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      updateValues.push(formattedAllotDate);
    }
    if (date) {
      updateFields.push('date = ?');
      // Convert YYYY-MM-DD to DD-MM-YYYY for registration date
      const parts = date.split('-');
      const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      updateValues.push(formattedDate);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(cro);
      
      await connection.execute(`
        UPDATE patient_new 
        SET ${updateFields.join(', ')}
        WHERE cro = ?
      `, updateValues);
    }

    res.json({
      success: true,
      message: 'Patient dates updated successfully'
    });

  } catch (error) {
    console.error('Update console error:', error);
    res.status(500).json({
      error: 'Failed to update patient dates',
      details: error.message,
      stack: error.stack,
      body: req.body,
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

module.exports = router;