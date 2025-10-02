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
    GROUP BY hospital_id, scan_type  
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
    let patientTotalScans = 0;
    let patientAmount = 0;
    
    for (const scan of scanResults) {
      scanNames.push(scan.s_name);
      patientTotalScans += scan.total_scan || 0;
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
      amount: patientAmount,
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
      totalAmount
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
      rate: rate,
      amount: rowAmount
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
      totalAmount
    }
  };
}

module.exports = router;