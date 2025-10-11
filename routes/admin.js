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

// Daily revenue report - matches PHP daily_revenue_report.php exactly
router.get('/daily-revenue-report', async (req, res) => {
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

    if (type === 'S') {
      // Summary Report - matches dail_revenue_summary_xls.php
      const summaryData = await generateSummaryReport(connection, scanDate, selectedDate);
      res.json({
        success: true,
        type: 'summary',
        data: summaryData,
        date: selectedDate
      });
    } else {
      // Detail Report - matches dail_revenue_xls.php  
      const detailData = await generateDetailReport(connection, scanDate, selectedDate);
      res.json({
        success: true,
        type: 'detail', 
        data: detailData,
        date: selectedDate
      });
    }

  } catch (error) {
    console.error('Admin daily revenue report error:', error);
    res.status(500).json({
      error: 'Failed to fetch daily revenue report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Generate Detail Report - matches PHP dail_revenue_xls.php exactly
async function generateDetailReport(connection, scanDate, selectedDate) {
  const reportData = [];
  let cIs = '';
  
  // 1. Sn. CITIZEN Category
  const [seniorCitizenGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, 
           IF(hospital_id > 11, 
              IF(hospital_id = 14, CONCAT(category, hospital_id), category), 
              CONCAT(category, hospital_id)
           ) as ch  
    FROM patient_new 
    WHERE scan_date = ? AND category IN ('Sn. CITIZEN') AND scan_status = 1  
    GROUP BY hospital_id, category, scan_type  
    ORDER BY FIELD(category, 'Sn. CITIZEN') ASC, 
             FIELD(hospital_id, 10,9,11,12,14,15,16,17,18,19,20) ASC, 
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of seniorCitizenGroups) {
    if (cIs !== group.ch) {
      cIs = group.ch;
      const tableData = await generateTableForGroup(connection, group, scanDate, selectedDate);
      reportData.push(tableData);
    }
  }
  
  // 2. MDM/MGH Category Wise
  const [mdmGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, CONCAT(category, hospital_id) as ch, 
           LENGTH(scan_type) - LENGTH(REPLACE(scan_type, ',', '')) as len  
    FROM patient_new 
    WHERE scan_date = ? AND category IN ('RTA','OPD FREE','IPD FREE','Chiranjeevi', 'RGHS','Destitute', 'PRISONER') 
          AND scan_status = 1 AND hospital_id IN (10,9) 
    GROUP BY ch, scan_type  
    ORDER BY FIELD(hospital_id, 10,9) ASC, 
             FIELD(category,'RTA','OPD FREE','IPD FREE','Chiranjeevi', 'RGHS','Destitute', 'PRISONER'), 
             len DESC
  `, [scanDate]);
  
  cIs = '';
  for (const group of mdmGroups) {
    if (cIs !== group.ch) {
      cIs = group.ch;
      const tableData = await generateTableForGroup(connection, group, scanDate, selectedDate);
      reportData.push(tableData);
    }
  }
  
  // 3. Aayushmaan Category
  const [aayushmaanGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, 
           IF(hospital_id > 11, 
              IF(hospital_id = 14, CONCAT(category, hospital_id), category), 
              CONCAT(category, hospital_id)
           ) as ch  
    FROM patient_new 
    WHERE scan_date = ? AND category IN ('Aayushmaan') AND scan_status = 1  
    GROUP BY hospital_id, category, scan_type  
    ORDER BY FIELD(category, 'Aayushmaan') ASC, 
             FIELD(hospital_id, 10,9,11,12,14,15,16,17,18,19,20) ASC, 
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  cIs = '';
  for (const group of aayushmaanGroups) {
    if (cIs !== group.ch) {
      cIs = group.ch;
      const tableData = await generateTableForGroup(connection, group, scanDate, selectedDate);
      reportData.push(tableData);
    }
  }
  
  // 4. UMAID HOSPITAL ALL
  const [umaidGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, CONCAT(category, hospital_id) as ch    
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND hospital_id IN (11) AND category != 'Sn. CITIZEN' 
    GROUP BY hospital_id, category, scan_type  
    ORDER BY hospital_id ASC, 
             FIELD(category,'RTA','OPD FREE','IPD FREE','Chiranjeevi', 'RGHS','Destitute', 'PRISONER') ASC,  
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  cIs = '';
  for (const group of umaidGroups) {
    if (cIs !== group.ch) {
      cIs = group.ch;
      const tableData = await generateTableForGroup(connection, group, scanDate, selectedDate);
      reportData.push(tableData);
    }
  }
  
  // 5. Other Govt. Hospital All
  const [otherGovtGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, CONCAT(category, hospital_id) as ch    
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND hospital_id IN (11, 12,15,16,17,18,19,20) 
          AND category IN ('RTA','IPD FREE','Chiranjeevi', 'RGHS', 'PRISONER') 
    GROUP BY category, scan_type  
    ORDER BY FIELD(category,'RTA','OPD FREE','IPD FREE','Chiranjeevi', 'RGHS', 'PRISONER') ASC,  
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  cIs = '';
  for (const group of otherGovtGroups) {
    if (cIs !== group.category) {
      cIs = group.category;
      const tableData = await generateTableForGroup(connection, group, scanDate, selectedDate, 'Other GOVT. HOSPITAL');
      reportData.push(tableData);
    }
  }
  
  // 6. Other Private Hospital All
  const [otherPrivateGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id    
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND hospital_id IN (14,16) AND category != 'GEN / Paid' 
    GROUP BY category, scan_type  
    ORDER BY FIELD(category,'RTA','OPD FREE','IPD FREE','Chiranjeevi', 'RGHS','Destitute', 'PRISONER') ASC,  
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  // PHP creates separate table for each category+scan_type combination (no duplicate prevention)
  for (const group of otherPrivateGroups) {
    const tableData = await generateTableForGroup(connection, group, scanDate, selectedDate, 'OTHER HOSPITAL');
    reportData.push(tableData);
  }
  
  // 7. GEN / Paid Govt. Hospital All
  const [genPaidGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id    
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category = 'GEN / Paid'  
    ORDER BY LENGTH(scan_type) DESC 
    LIMIT 1
  `, [scanDate]);
  
  for (const group of genPaidGroups) {
    const tableData = await generateTableForGroup(connection, group, scanDate, selectedDate, 'MDM/Other Govt. Hospital');
    reportData.push(tableData);
  }
  
  return reportData;
}

// Generate table for each group - matches PHP structure exactly
async function generateTableForGroup(connection, group, scanDate, selectedDate, customHospitalName = null) {
  const scanTypeArray = group.scan_type.split(',');
  
  // Get hospital information
  let hospitalInfo = { h_short: customHospitalName || 'Unknown' };
  if (!customHospitalName && group.hospital_id) {
    const [hospitalResult] = await connection.execute(
      'SELECT * FROM hospital WHERE h_id = ?',
      [group.hospital_id]
    );
    if (hospitalResult.length > 0) {
      hospitalInfo = hospitalResult[0];
    }
  }
  
  // Get patient data for this group
  let patientQuery = `
    SELECT patient_id, scan_date, examination_id, cro, patient_name, age, gender, 
           category, scan_type, total_scan, amount, amount_reci, contact_number, dname as doctor  
    FROM patient_new 
    left join hospital on patient_new.hospital_id = hospital.h_id
    left join doctor on patient_new.doctor_name = doctor.d_id
    WHERE scan_date = ? AND category = ? AND scan_status = 1
  `;
  
  const queryParams = [scanDate, group.category];
  
  if (group.hospital_id && !customHospitalName) {
    patientQuery += ' AND hospital_id = ?';
    queryParams.push(group.hospital_id);
  } else if (customHospitalName === 'OTHER HOSPITAL') {
    // For OTHER HOSPITAL, filter by the specific hospital IDs
    patientQuery += ' AND hospital_id IN (14,16)';
  }
  
  patientQuery += ' ORDER BY category, patient_id';
  
  const [patients] = await connection.execute(patientQuery, queryParams);
  
  const processedPatients = [];
  let totalScans = 0;
  let totalAmount = 0;
  
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    
    // Get scan details - handle comma-separated scan IDs safely
    let scanResults = [];
    if (patient.scan_type) {
      const scanIds = patient.scan_type.split(',').map(id => id.trim()).filter(id => id);
      if (scanIds.length > 0) {
        const placeholders = scanIds.map(() => '?').join(',');
        const [results] = await connection.execute(
          `SELECT * FROM scan WHERE s_id IN (${placeholders})`,
          scanIds
        );
        scanResults = results;
      }
    }
    
    const scanNames = [];
    let patientTotalScans = 0; // This is $tot_p_scan in PHP
    let patientAmount = 0;
    
    for (const scan of scanResults) {
      scanNames.push(scan.s_name);
      patientTotalScans += scan.total_scan || 0; // Sum from scan table
      patientAmount += scan.charges || 0;
    }
    
    // For GEN/Paid category, use amount from patient record
    if (group.category === 'GEN / Paid') {
      patientAmount = patient.amount || 0;
    }
    
    processedPatients.push({
      sno: i + 1,
      date: selectedDate,
      cro: patient.cro,
      patientId: patient.examination_id,
      patientName: patient.patient_name,
      age: (patient.age || '').toString().replace('ear', ''),
      gender: (patient.gender || '').substring(0, 1),
      scanNames: scanNames,
      totalScans: patientTotalScans,
      amount: parseFloat(patientAmount.toFixed(2)),
      category: patient.category,
      mobile: patient.mobile || '',
      doctor: patient.doctor || ''
    });
    
    totalScans += patientTotalScans;
    totalAmount += patientAmount;
  }
  
  return {
    hospitalName: hospitalInfo.h_short,
    category: group.category,
    date: selectedDate,
    scanColumns: scanTypeArray.length,
    patients: processedPatients,
    totals: {
      totalScans,
      totalAmount: parseFloat(totalAmount.toFixed(2))
    }
  };
}

// Generate Summary Report - matches PHP dail_revenue_summary_xls.php
async function generateSummaryReport(connection, scanDate, selectedDate) {
  const summaryData = [];
  let cIs = '';
  
  // 1. Sn. CITIZEN and RTA categories
  const [seniorCitizenRTAGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, CONCAT(category, hospital_id) as ch  
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('Sn. CITIZEN', 'RTA') 
    GROUP BY hospital_id, category, scan_type 
    ORDER BY FIELD(hospital_id, 10,9,11,12,14,15,16,17,18,19,20) ASC, 
             FIELD(category,'Sn. CITIZEN','RTA') ASC,  
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of seniorCitizenRTAGroups) {
    if (cIs !== group.ch) {
      cIs = group.ch;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  // 2. OPD, IPD, etc for hospital_id = 10
  cIs = '';
  const [mdmGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id  
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') 
          AND hospital_id = 10 
    GROUP BY category, scan_type 
    ORDER BY FIELD(category,'OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') ASC, 
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of mdmGroups) {
    if (cIs !== group.category) {
      cIs = group.category;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  // 3. Aayushmaan for hospital_id = 10
  cIs = '';
  const [aayushmaanGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id  
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('Aayushmaan') AND hospital_id = 10 
    GROUP BY category, scan_type 
    ORDER BY FIELD(category,'Aayushmaan') ASC, LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of aayushmaanGroups) {
    if (cIs !== group.category) {
      cIs = group.category;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  // 4. Aayushmaan for hospital_id = 9
  cIs = '';
  const [aayushmaan9Groups] = await connection.execute(`
    SELECT category, scan_type, hospital_id  
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('Aayushmaan') AND hospital_id = 9 
    GROUP BY category, scan_type 
    ORDER BY FIELD(category,'Aayushmaan') ASC, LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of aayushmaan9Groups) {
    if (cIs !== group.category) {
      cIs = group.category;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  // 5. MDM ALL for hospital_id = 9
  cIs = '';
  const [mdm9Groups] = await connection.execute(`
    SELECT category, scan_type, hospital_id  
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') 
          AND hospital_id IN (9) 
    GROUP BY category, scan_type 
    ORDER BY FIELD(category,'OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') ASC, 
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of mdm9Groups) {
    if (cIs !== group.category) {
      cIs = group.category;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  // 6. UMAID HOSPITAL ALL
  cIs = '';
  const [umaidGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, CONCAT(category, hospital_id) as ch   
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') 
          AND hospital_id IN (11) 
    GROUP BY category, scan_type 
    ORDER BY FIELD(category,'OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') ASC, 
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of umaidGroups) {
    if (cIs !== group.ch) {
      cIs = group.ch;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  // 7. Other Govt. HOSPITAL ALL
  cIs = '';
  const [otherGovtGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id, CONCAT(category, hospital_id) as ch  
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('RTA', 'OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') 
          AND hospital_id IN (12, 15, 16, 18, 19, 20) 
    GROUP BY hospital_id, category, scan_type 
    ORDER BY FIELD(hospital_id, 12, 15, 16, 18, 19, 20) ASC, 
             FIELD(category, 'RTA', 'OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') ASC, 
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of otherGovtGroups) {
    if (cIs !== group.ch) {
      cIs = group.ch;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  // 8. Other Pvt. HOSPITAL ALL
  cIs = '';
  const [otherPvtGroups] = await connection.execute(`
    SELECT category, scan_type, hospital_id  
    FROM patient_new 
    WHERE scan_date = ? AND scan_status = 1 AND category IN ('Sn. CITIZEN', 'RTA', 'OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') 
          AND hospital_id IN (14) 
    GROUP BY category, scan_type 
    ORDER BY FIELD(category,'Sn. CITIZEN', 'RTA', 'OPD FREE', 'IPD FREE', 'Chiranjeevi', 'RGHS','Destitute', 'PRISONER') ASC, 
             LENGTH(scan_type) DESC
  `, [scanDate]);
  
  for (const group of otherPvtGroups) {
    if (cIs !== group.hospital_id) {
      cIs = group.hospital_id;
      const summaryGroup = await generateSummaryForGroup(connection, group, scanDate, selectedDate);
      if (summaryGroup) summaryData.push(summaryGroup);
    }
  }
  
  return summaryData;
}

// Generate summary data for a specific group - matches PHP aggregation logic
async function generateSummaryForGroup(connection, group, scanDate, selectedDate) {
  // Get hospital information
  let hospitalInfo = { h_short: 'Unknown' };
  if (group.hospital_id) {
    const [hospitalResult] = await connection.execute(
      'SELECT h_short FROM hospital WHERE h_id = ?',
      [group.hospital_id]
    );
    if (hospitalResult.length > 0) {
      hospitalInfo = hospitalResult[0];
    }
  }
  
  // Get aggregated summary data by scan_type
  const [summaryResults] = await connection.execute(`
    SELECT COUNT(*) as cnt, scan_type, SUM(total_scan) as s_scan, SUM(amount) as s_amt, SUM(amount_reci) as s_amt_rec 
    FROM patient_new 
    WHERE scan_date = ? AND hospital_id = ? AND category = ? AND scan_status = 1 
    GROUP BY scan_type
  `, [scanDate, group.hospital_id, group.category]);
  
  if (summaryResults.length === 0) return null;
  
  const summaryRows = [];
  let totalPatients = 0;
  let totalScans = 0;
  let totalAmount = 0;
  
  for (const sumRow of summaryResults) {
    // Get scan details
    const scanIds = sumRow.scan_type.split(',').map(id => id.trim()).filter(id => id);
    let scanResults = [];
    
    if (scanIds.length > 0) {
      const placeholders = scanIds.map(() => '?').join(',');
      const [results] = await connection.execute(
        `SELECT s_name, charges, total_scan FROM scan WHERE s_id IN (${placeholders})`,
        scanIds
      );
      scanResults = results;
    }
    
    const scanNames = [];
    let rate = 0;
    let totalPatientScans = 0;
    
    for (const scan of scanResults) {
      scanNames.push(scan.s_name);
      rate += scan.charges || 0;
      totalPatientScans += scan.total_scan || 0;
    }
    
    // Fill remaining scan name slots with '..'
    while (scanNames.length < 8) {
      scanNames.push('..');
    }
    
    const numberOfScans = totalPatientScans * sumRow.cnt;
    const rowAmount = rate * sumRow.cnt;
    
    summaryRows.push({
      scanNames: scanNames,
      scanCode: sumRow.scan_type.replace(/,/g, ' + '),
      numberOfScans: numberOfScans,
      patientCount: sumRow.cnt,
      rate: parseFloat(rate.toFixed(2)),
      amount: parseFloat(rowAmount.toFixed(2))
    });
    
    totalPatients += sumRow.cnt;
    totalScans += numberOfScans;
    totalAmount += rowAmount;
  }
  
  return {
    hospitalName: hospitalInfo.h_short,
    category: group.category,
    date: selectedDate,
    summaryRows: summaryRows,
    totals: {
      totalPatients,
      totalScans,
      totalAmount: parseFloat(totalAmount.toFixed(2))
    }
  };
}

// Appointment Report - matches PHP appoexcel.php exactly
router.get('/appointment-report', async (req, res) => {
  let connection;
  try {
    const { s_date } = req.query;
    
    if (!s_date) {
      return res.status(400).json({
        error: 'Date parameter (s_date) is required'
      });
    }

    connection = await mysql.createConnection(dbConfig);

    // Main query - matches PHP exactly: SELECT * FROM patient_new WHERE allot_date = '$selected_date'
    const [appointments] = await connection.execute(
      'SELECT * FROM patient_new WHERE allot_date = ?',
      [s_date]
    );

    const processedAppointments = [];
    
    for (let i = 0; i < appointments.length; i++) {
      const appointment = appointments[i];
      
      // Get scan names - matches PHP scan_type processing
      let scanNames = '';
      if (appointment.scan_type) {
        const scanIds = appointment.scan_type.split(',').filter(id => id.trim());
        for (const scanId of scanIds) {
          const [scanResult] = await connection.execute(
            'SELECT s_name FROM scan WHERE s_id = ?',
            [scanId.trim()]
          );
          if (scanResult.length > 0) {
            scanNames += scanResult[0].s_name + ',';
          }
        }
      }
      
      // Get time in - matches PHP allot_time processing
      let timeIn = '';
      if (appointment.allot_time) {
        const timeIds = appointment.allot_time.split(',').filter(id => id.trim());
        for (const timeId of timeIds) {
          const [timeResult] = await connection.execute(
            'SELECT time_slot FROM time_slot2 WHERE time_id = ?',
            [timeId.trim()]
          );
          if (timeResult.length > 0) {
            timeIn += timeResult[0].time_slot;
          }
        }
      }
      
      // Get time out - matches PHP allot_time_out processing
      let timeOut = '';
      if (appointment.allot_time_out) {
        const timeOutIds = appointment.allot_time_out.split(',').filter(id => id.trim());
        for (const timeId of timeOutIds) {
          const [timeResult] = await connection.execute(
            'SELECT time_slot FROM time_slot2 WHERE time_id = ?',
            [timeId.trim()]
          );
          if (timeResult.length > 0) {
            timeOut += timeResult[0].time_slot;
          }
        }
      }
      
      // Get status and console date - matches PHP scan_status logic
      let status = 'Pending';
      let consoleDate = '';
      
      if (appointment.scan_status === 3) {
        status = 'Shared to Console';
      } else if (appointment.scan_status === 1) {
        status = 'Completed';
        // Get console added_on date
        const [consoleResult] = await connection.execute(
          'SELECT added_on FROM console WHERE c_p_cro = ?',
          [appointment.cro]
        );
        if (consoleResult.length > 0) {
          consoleDate = consoleResult[0].added_on;
        }
      }
      
      processedAppointments.push({
        sno: i + 1,
        cro: appointment.cro || '',
        patient_name: appointment.patient_name || '',
        age: appointment.age || '',
        gender: appointment.gender || '',
        category: appointment.category || '',
        scan_type: scanNames.replace(/,$/, ''), // Remove trailing comma
        total_scan: appointment.total_scan || 0,
        time_in: timeIn,
        time_out: timeOut,
        status: status,
        console_date: consoleDate
      });
    }

    res.json({
      success: true,
      data: processedAppointments,
      date: s_date,
      total: processedAppointments.length
    });

  } catch (error) {
    console.error('Appointment report error:', error);
    res.status(500).json({
      error: 'Failed to fetch appointment report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Console Report - matches PHP con_revenue_report.php exactly
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
    console.error('Console report error:', error);
    res.status(500).json({
      error: 'Failed to fetch console report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Categories endpoint
router.get('/categories', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [categories] = await connection.execute('SELECT * FROM category ORDER BY cat_name ASC');
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
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
    const [hospitals] = await connection.execute('SELECT * FROM hospital ORDER BY h_name ASC');
    
    res.json({
      success: true,
      data: hospitals
    });
  } catch (error) {
    console.error('Hospitals error:', error);
    res.status(500).json({
      error: 'Failed to fetch hospitals',
      details: error.message
    });
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

// Patient List - Get all patients for editing
router.get('/patient-list', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    const { from_date, to_date } = req.query;
    
    let whereClause = '';
    let queryParams = [];
    
    if (from_date && to_date) {
      // Dates are already in dd-mm-yyyy format from frontend
      whereClause = 'WHERE STR_TO_DATE(patient_new.date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
      queryParams = [from_date, to_date];
    } else {
      // Default to today's date
      const now = new Date();
      const calcuttaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Calcutta" }));
      const dd = String(calcuttaTime.getDate()).padStart(2, "0");
      const mm = String(calcuttaTime.getMonth() + 1).padStart(2, "0");
      const yyyy = calcuttaTime.getFullYear();
      const todayDate = `${dd}-${mm}-${yyyy}`;
      
      whereClause = 'WHERE patient_new.date = ?';
      queryParams = [todayDate];
    }

    const query = `
      SELECT 
        patient_new.patient_id,
        patient_new.cro,
        patient_new.patient_name,
        patient_new.age,
        patient_new.gender,
        patient_new.contact_number,
        patient_new.category,
        patient_new.amount,
        patient_new.date,
        patient_new.remark,
        doctor.dname,
        hospital.h_name
      FROM patient_new 
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      ${whereClause}
      ORDER BY patient_new.patient_id DESC
    `;
    
    const [patients] = await connection.execute(query, queryParams);
    
    res.json({
      success: true,
      data: patients
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

// Patient Edit - Get patient by CRO
router.get('/patient-edit', async (req, res) => {
  let connection;
  try {
    const { cro, pid } = req.query;
    
    if (!cro && !pid) {
      return res.status(400).json({
        error: 'CRO or Patient ID is required'
      });
    }

    connection = await mysql.createConnection(dbConfig);

    let query = 'SELECT * FROM patient_new WHERE ';
    let params = [];
    
    if (cro) {
      query += 'cro = ?';
      params.push(cro);
    } else {
      query += 'patient_id = ?';
      params.push(pid);
    }
    
    const [patients] = await connection.execute(query, params);
    
    if (patients.length === 0) {
      return res.status(404).json({
        error: 'Patient not found'
      });
    }
    
    const patient = patients[0];
    
    // Get scan names if scan_type exists
    let scanNames = '';
    if (patient.scan_type) {
      const scanIds = patient.scan_type.split(',').filter(id => id.trim());
      for (const scanId of scanIds) {
        const [scanResult] = await connection.execute(
          'SELECT s_name FROM scan WHERE s_id = ?',
          [scanId.trim()]
        );
        if (scanResult.length > 0) {
          scanNames += scanResult[0].s_name + ', ';
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        ...patient,
        scan_names: scanNames.replace(/, $/, '')
      }
    });

  } catch (error) {
    console.error('Patient edit error:', error);
    res.status(500).json({
      error: 'Failed to fetch patient data',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Scan Heads - Get all scan heads
router.get('/scan-heads', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [scanHeads] = await connection.execute(
      'SELECT id, head_name, amount, per_scan FROM scan_heads WHERE status = 1 ORDER BY head_name ASC'
    );
    
    res.json({
      success: true,
      data: scanHeads
    });
  } catch (error) {
    console.error('Scan heads fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch scan heads',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Scan Heads - Create new scan head
router.post('/scan-heads', async (req, res) => {
  let connection;
  try {
    const { head_name, amount, per_scan } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'INSERT INTO scan_heads (head_name, amount, per_scan) VALUES (?, ?, ?)',
      [head_name, amount, per_scan]
    );
    
    res.json({
      success: true,
      message: 'Scan head created successfully'
    });
  } catch (error) {
    console.error('Scan head create error:', error);
    res.status(500).json({
      error: 'Failed to create scan head',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Scan Heads - Update scan head
router.put('/scan-heads/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { head_name, amount, per_scan } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE scan_heads SET head_name = ?, amount = ?, per_scan = ? WHERE id = ?',
      [head_name, amount, per_scan, id]
    );
    
    res.json({
      success: true,
      message: 'Scan head updated successfully'
    });
  } catch (error) {
    console.error('Scan head update error:', error);
    res.status(500).json({
      error: 'Failed to update scan head',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Scan Heads - Delete scan head (soft delete)
router.delete('/scan-heads/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE scan_heads SET status = 0 WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Scan head deleted successfully'
    });
  } catch (error) {
    console.error('Scan head delete error:', error);
    res.status(500).json({
      error: 'Failed to delete scan head',
      details: error.message
    });
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
    let whereClause = 'WHERE np.n_patient_ct = "yes" AND np.n_patient_x_ray = "yes"';
    const queryParams = [];
    
    if (doctor_id) {
      whereClause += ' AND np.ct_scan_doctor_id = ?';
      queryParams.push(doctor_id);
    }
    
    if (from_date && to_date) {
      whereClause += ' AND DATE(np.ct_scan_report_date) BETWEEN ? AND ?';
      queryParams.push(from_date, to_date);
    } else if (from_date) {
      whereClause += ' AND DATE(np.ct_scan_report_date) >= ?';
      queryParams.push(from_date);
    } else if (to_date) {
      whereClause += ' AND DATE(np.ct_scan_report_date) <= ?';
      queryParams.push(to_date);
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
        np.ct_scan_report_date as report_date,
        GROUP_CONCAT(DISTINCT s.s_name SEPARATOR ', ') as scan_names,
        GROUP_CONCAT(DISTINCT sh.head_name SEPARATOR ', ') as scan_head_names,
        SUM(DISTINCT sh.amount) as total_amount
      FROM nursing_patient np
      JOIN patient_new p ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      LEFT JOIN scan s ON FIND_IN_SET(s.s_id, p.scan_type)
      LEFT JOIN scan_heads sh ON s.scan_head_id = sh.id
      ${whereClause}
      GROUP BY np.n_patient_cro, np.ct_scan_doctor_id
      ORDER BY np.ct_scan_report_date DESC
    `;
    
    const [reports] = await connection.execute(detailQuery, queryParams);
    
    // Summary by doctor
    const doctorSummaryQuery = `
      SELECT 
        csd.doctor_name,
        COUNT(*) as report_count,
        SUM(sh.amount) as total_amount
      FROM nursing_patient np
      JOIN patient_new p ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      LEFT JOIN scan s ON FIND_IN_SET(s.s_id, p.scan_type)
      LEFT JOIN scan_heads sh ON s.scan_head_id = sh.id
      ${whereClause}
      GROUP BY np.ct_scan_doctor_id, csd.doctor_name
      ORDER BY total_amount DESC
    `;
    
    const [doctorSummary] = await connection.execute(doctorSummaryQuery, queryParams);
    
    // Summary by scan head
    const headSummaryQuery = `
      SELECT 
        sh.head_name,
        COUNT(DISTINCT np.ct_scan_doctor_id) as doctor_count,
        COUNT(*) as report_count,
        SUM(sh.amount) as total_amount
      FROM nursing_patient np
      JOIN patient_new p ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      LEFT JOIN scan s ON FIND_IN_SET(s.s_id, p.scan_type)
      LEFT JOIN scan_heads sh ON s.scan_head_id = sh.id
      ${whereClause}
      AND sh.id IS NOT NULL
      GROUP BY sh.id, sh.head_name
      ORDER BY total_amount DESC
    `;
    
    const [headSummary] = await connection.execute(headSummaryQuery, queryParams);
    
    // Overall summary
    const totalDoctors = new Set(reports.map(r => r.doctor_id)).size;
    const totalReports = reports.length;
    const totalAmount = reports.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    
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

// Doctor Scan Report Download
router.get('/doctor-scan-report/download', async (req, res) => {
  let connection;
  try {
    const { format = 'excel', doctor_id, scan_head_id, from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    // Get doctors for filter display
    const [doctors] = await connection.execute('SELECT id, doctor_name FROM ct_scan_doctor');
    
    // Same query logic as above
    let whereClause = 'WHERE np.n_patient_ct = "yes" AND np.n_patient_x_ray = "yes"';
    const queryParams = [];
    
    if (doctor_id) {
      whereClause += ' AND np.ct_scan_doctor_id = ?';
      queryParams.push(doctor_id);
    }
    
    if (from_date && to_date) {
      whereClause += ' AND DATE(np.ct_scan_report_date) BETWEEN ? AND ?';
      queryParams.push(from_date, to_date);
    }
    
    const detailQuery = `
      SELECT 
        csd.doctor_name,
        p.patient_name,
        p.cro,
        GROUP_CONCAT(DISTINCT s.s_name SEPARATOR ', ') as scan_names,
        GROUP_CONCAT(DISTINCT sh.head_name SEPARATOR ', ') as scan_head_names,
        SUM(DISTINCT sh.amount) as total_amount,
        np.ct_scan_report_date,
        p.category
      FROM nursing_patient np
      JOIN patient_new p ON p.cro = np.n_patient_cro
      LEFT JOIN ct_scan_doctor csd ON np.ct_scan_doctor_id = csd.id
      LEFT JOIN scan s ON FIND_IN_SET(s.s_id, p.scan_type)
      LEFT JOIN scan_heads sh ON s.scan_head_id = sh.id
      ${whereClause}
      GROUP BY np.n_patient_cro, np.ct_scan_doctor_id
      ORDER BY np.ct_scan_report_date DESC
    `;
    
    const [reports] = await connection.execute(detailQuery, queryParams);
    
    if (format === 'excel') {
      // Create Excel format with header rows
      const dateRange = from_date && to_date ? `${from_date} to ${to_date}` : 'All Dates';
      const doctorFilter = doctor_id ? doctors.find(d => d.id == doctor_id)?.doctor_name || 'Unknown' : 'All Doctors';
      const categoryFilter = category && category !== 'All' ? category : 'All Categories';
      
      const csvContent = [
        '"VARAHA SDC : 256 SLICE CT SCAN"',
        '"DOCTOR SCAN REPORT"',
        `"Date Range: ${dateRange}"`,
        `"Doctor Filter: ${doctorFilter}"`,
        '',
        '"S.No","Doctor Name","Patient Name","CRO","Scan Types","Scan Heads","Amount","Report Date"',
        ...reports.map((row, index) => [
          `"${index + 1}"`,
          `"${row.doctor_name || ''}"`,
          `"${row.patient_name || ''}"`,
          `"${row.cro || ''}"`,
          `"${row.scan_names || ''}"`,
          `"${row.scan_head_names || ''}"`,
          `"${row.total_amount || 0}"`,
          `"${row.ct_scan_report_date || ''}"`
        ].join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="doctor-scan-report.csv"');
      res.send(csvContent);
    } else {
      // Return JSON for PDF processing
      res.json({ data: reports });
    }
    
  } catch (error) {
    console.error('Doctor scan report download error:', error);
    res.status(500).json({
      error: 'Failed to download doctor scan report',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient Reprint - Get patient receipt data
router.get('/patient-reprint', async (req, res) => {
  let connection;
  try {
    const { cro } = req.query;
    
    if (!cro) {
      return res.status(400).json({
        error: 'CRO is required'
      });
    }

    connection = await mysql.createConnection(dbConfig);

    // Main query - matches PHP d_payment.php
    const query = `
      SELECT patient_new.*, doctor.dname, hospital.h_short 
      FROM patient_new 
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      WHERE patient_new.cro = ?
    `;
    
    const [patients] = await connection.execute(query, [cro]);
    
    if (patients.length === 0) {
      return res.status(404).json({
        error: 'Patient not found'
      });
    }
    
    const patient = patients[0];
    
    // Get scan details and calculate total
    let scanDetails = [];
    let totalAmount = 0;
    
    if (patient.scan_type) {
      const scanIds = patient.scan_type.split(',').filter(id => id.trim());
      for (const scanId of scanIds) {
        const [scanResult] = await connection.execute(
          'SELECT s_name, charges FROM scan WHERE s_id = ?',
          [scanId.trim()]
        );
        if (scanResult.length > 0) {
          scanDetails.push({
            name: scanResult[0].s_name,
            charges: scanResult[0].charges || 0
          });
          totalAmount += scanResult[0].charges || 0;
        }
      }
    }
    
    // Get time slot if exists
    let timeSlot = '';
    if (patient.allot_time) {
      const [timeResult] = await connection.execute(
        'SELECT time_slot FROM time_slot WHERE time_id = ?',
        [patient.allot_time]
      );
      if (timeResult.length > 0) {
        timeSlot = timeResult[0].time_slot;
      }
    }
    
    res.json({
      success: true,
      data: {
        ...patient,
        doctor_name: patient.dname || '',
        hospital_short: patient.h_short || '',
        scan_details: scanDetails,
        total_amount: totalAmount,
        time_slot: timeSlot
      }
    });

  } catch (error) {
    console.error('Patient reprint error:', error);
    res.status(500).json({
      error: 'Failed to fetch patient receipt data',
      details: error.message
    });
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

// Scans - Create new scan
router.post('/scans', async (req, res) => {
  let connection;
  try {
    const { s_name, n_o_films, contrass, total_scan, estimate_time, charges, scan_head_id } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'INSERT INTO scan (s_name, n_o_films, contrass, total_scan, estimate_time, charges, scan_head_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [s_name, n_o_films || 0, contrass || 0, total_scan || 1, estimate_time || '', charges || 0, scan_head_id || null]
    );
    
    res.json({
      success: true,
      message: 'Scan created successfully'
    });
  } catch (error) {
    console.error('Scan create error:', error);
    res.status(500).json({
      error: 'Failed to create scan',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Scans - Update scan
router.put('/scans/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { s_name, n_o_films, contrass, total_scan, estimate_time, charges, scan_head_id } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE scan SET s_name = ?, n_o_films = ?, contrass = ?, total_scan = ?, estimate_time = ?, charges = ?, scan_head_id = ? WHERE s_id = ?',
      [s_name, n_o_films || 0, contrass || 0, total_scan || 1, estimate_time || '', charges || 0, scan_head_id || null, id]
    );
    
    res.json({
      success: true,
      message: 'Scan updated successfully'
    });
  } catch (error) {
    console.error('Scan update error:', error);
    res.status(500).json({
      error: 'Failed to update scan',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Scans - Delete scan
router.delete('/scans/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'DELETE FROM scan WHERE s_id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Scan deleted successfully'
    });
  } catch (error) {
    console.error('Scan delete error:', error);
    res.status(500).json({
      error: 'Failed to delete scan',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient registration endpoint
router.post('/patients', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const {
      hospital_name, DoctorName, pre, firstname, age, age_type, gender,
      petient_type, p_uni_submit, p_uni_id_name, address, city, contact_number,
      type_of_scan, appoint_date, time, time_in, amount, total_amount,
      dis_amount, rec_amount, due_amount, admin_id, action
    } = req.body;

    // Generate CRO number
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = `${day}${month}${year}`;
    
    const [lastCroResult] = await connection.execute(
      'SELECT cro FROM patient_new WHERE cro LIKE ? ORDER BY patient_id DESC LIMIT 1',
      [`${dateStr}%`]
    );
    
    let sequence = 1;
    if (lastCroResult.length > 0) {
      const lastCro = lastCroResult[0].cro;
      const lastSequence = parseInt(lastCro.slice(-3));
      sequence = lastSequence + 1;
    }
    
    const cro = `${dateStr}${sequence.toString().padStart(3, '0')}`;
    
    // Insert patient record
    const insertQuery = `
      INSERT INTO patient_new (
        cro, hospital_id, doctor_name, pre, patient_name, age, age_type, gender,
        category, p_uni_submit, p_uni_id_name, address, city, contact_number,
        scan_type, allot_date, allot_time, time_in, amount, total_scan,
        dis_amount, rec_amount, due_amount, date, admin_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const currentDate = now.toLocaleDateString('en-GB');
    const scanTypeStr = Array.isArray(type_of_scan) ? type_of_scan.join(',') : type_of_scan;
    
    await connection.execute(insertQuery, [
      cro, hospital_name, DoctorName, pre, firstname, age, age_type, gender,
      petient_type, p_uni_submit || 'N', p_uni_id_name || '', address || '', city || '', contact_number || '',
      scanTypeStr, appoint_date, time, time_in, amount || 0, type_of_scan?.length || 0,
      dis_amount || 0, rec_amount || 0, due_amount || 0, currentDate, admin_id || 1
    ]);
    
    res.json({
      success: true,
      message: 'Patient registered successfully',
      data: { cro, patient_name: `${pre} ${firstname}` }
    });
    
  } catch (error) {
    console.error('Patient registration error:', error);
    res.status(500).json({ error: 'Failed to register patient', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Last enrolled patient endpoint
router.get('/patients/last-enrolled', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const query = `SELECT cro, patient_name FROM patient_new ORDER BY patient_id DESC LIMIT 1`;
    const [result] = await connection.execute(query);
    
    res.json({
      success: true,
      data: result.length > 0 ? result[0] : null
    });
    
  } catch (error) {
    console.error('Last enrolled patient error:', error);
    res.status(500).json({ error: 'Failed to fetch last enrolled patient', details: error.message });
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
      return res.status(400).json({ error: 'Search query required' });
    }

    connection = await mysql.createConnection(dbConfig);
    
    // Calculate 3 months ago date
    const today = new Date();
    const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const threeMonthsAgoStr = `${String(threeMonthsAgo.getDate()).padStart(2, '0')}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-${threeMonthsAgo.getFullYear()}`;
    
    const query = `
      SELECT patient_new.*, doctor.dname, hospital.h_short 
      FROM patient_new 
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      WHERE patient_new.cro = ? AND STR_TO_DATE(patient_new.date, '%d-%m-%Y') >= STR_TO_DATE(?, '%d-%m-%Y')
    `;
    
    const [patients] = await connection.execute(query, [q, threeMonthsAgoStr]);
    
    if (patients.length === 0) {
      return res.json({ success: false, message: 'Patient not found in last 3 months' });
    }
    
    const patient = patients[0];
    
    res.json({
      success: true,
      patient: {
        ...patient,
        doctor_name: patient.dname || '',
        hospital_short: patient.h_short || ''
      }
    });
    
  } catch (error) {
    console.error('Patient search error:', error);
    res.status(500).json({ error: 'Failed to search patient', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Patient search POST endpoint
router.post('/patients/search', async (req, res) => {
  let connection;
  try {
    const { q } = req.body;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    connection = await mysql.createConnection(dbConfig);
    
    // Calculate 3 months ago date
    const today = new Date();
    const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const threeMonthsAgoStr = `${String(threeMonthsAgo.getDate()).padStart(2, '0')}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-${threeMonthsAgo.getFullYear()}`;
    
    const query = `
      SELECT patient_new.*, doctor.dname, hospital.h_short 
      FROM patient_new 
      LEFT JOIN doctor ON doctor.d_id = patient_new.doctor_name
      LEFT JOIN hospital ON hospital.h_id = patient_new.hospital_id
      WHERE patient_new.cro = ? AND STR_TO_DATE(patient_new.date, '%d-%m-%Y') >= STR_TO_DATE(?, '%d-%m-%Y')
    `;
    
    const [patients] = await connection.execute(query, [q, threeMonthsAgoStr]);
    
    if (patients.length === 0) {
      return res.json({ success: false, message: 'Patient not found in last 3 months' });
    }
    
    const patient = patients[0];
    
    // Get scan details
    let scanNames = '';
    let totalAmount = 0;
    if (patient.scan_type) {
      const scanIds = patient.scan_type.split(',').filter(id => id.trim());
      for (const scanId of scanIds) {
        const [scanResult] = await connection.execute(
          'SELECT s_name, charges FROM scan WHERE s_id = ?',
          [scanId.trim()]
        );
        if (scanResult.length > 0) {
          scanNames += scanResult[0].s_name + ',';
          totalAmount += scanResult[0].charges || 0;
        }
      }
    }
    
    // Get time slot
    let timeSlot = '';
    if (patient.allot_time) {
      const [timeResult] = await connection.execute(
        'SELECT time_slot FROM time_slot WHERE time_id = ?',
        [patient.allot_time]
      );
      if (timeResult.length > 0) {
        timeSlot = timeResult[0].time_slot;
      }
    }
    
    res.json({
      success: true,
      patient: {
        ...patient,
        doctor_name: patient.dname || '',
        hospital_short: patient.h_short || '',
        scan_names: scanNames.replace(/,$/, ''),
        total_scan_amount: totalAmount,
        time_slot: timeSlot
      }
    });
    
  } catch (error) {
    console.error('Patient search POST error:', error);
    res.status(500).json({ error: 'Failed to search patient', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Paid patients details - matches PHP dail_revenue_summary_xls.php logic
router.get('/paid-patients', async (req, res) => {
  let connection;
  try {
    const { s_date } = req.query;
    
    if (!s_date) {
      return res.status(400).json({ error: 'Date parameter (s_date) is required' });
    }

    const parts = s_date.split('-');
    const sd = `${parts[2]}-${parts[1]}-${parts[0]}`;

    connection = await mysql.createConnection(dbConfig);

    const [paidData] = await connection.execute(`
      SELECT COUNT(*) as tot_patient, SUM(total_scan) as tot_scan, SUM(amount) as tot_amt 
      FROM patient_new 
      WHERE scan_date = ? AND scan_status = 1 AND category IN ('GEN / Paid')
    `, [sd]);
    
    const result = paidData[0] || { tot_patient: 0, tot_scan: 0, tot_amt: 0 };
    
    res.json({
      success: true,
      tot_patient: parseInt(result.tot_patient) || 0,
      tot_scan: parseInt(result.tot_scan) || 0,
      tot_amt: parseFloat(parseFloat(result.tot_amt || 0).toFixed(2)),
      date: s_date
    });

  } catch (error) {
    console.error('Paid patients error:', error);
    res.status(500).json({ error: 'Failed to fetch paid patients data', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});


module.exports = {
  router,
  generateDetailReport,
  generateSummaryReport,
  generateTableForGroup,
  generateSummaryForGroup
};