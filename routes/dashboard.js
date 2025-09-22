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

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard statistics
 *     description: Returns dashboard stats (same logic as sdc_admin blank.php)
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentMonthTotal:
 *                   type: number
 *                   example: 125000.50
 *                 lastMonthTotal:
 *                   type: number
 *                   example: 98000.25
 *                 todayScans:
 *                   type: integer
 *                   example: 15
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
 */
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const lastMonth = String(new Date().getMonth()).padStart(2, '0');
    const lastMonthYear = new Date().getMonth() === 0 ? currentYear - 1 : currentYear;
    
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });

    // Current month total (same query as blank.php)
    const [currentMonthData] = await connection.execute(`
      SELECT SUM(p.amount) as total
      FROM patient_new p
      JOIN today_transeciton t ON t.cro = p.cro
      WHERE MONTH(STR_TO_DATE(t.added_on, '%d-%m-%Y')) = ? 
        AND YEAR(STR_TO_DATE(t.added_on, '%d-%m-%Y')) = ?
        AND t.withdraw = 0
    `, [currentMonth, currentYear]);

    // Last month total
    const [lastMonthData] = await connection.execute(`
      SELECT SUM(p.amount) as total
      FROM patient_new p
      JOIN today_transeciton t ON t.cro = p.cro
      WHERE MONTH(STR_TO_DATE(t.added_on, '%d-%m-%Y')) = ? 
        AND YEAR(STR_TO_DATE(t.added_on, '%d-%m-%Y')) = ?
        AND t.withdraw = 0
    `, [lastMonth, lastMonthYear]);

    // Today's stats
    const [todayScans] = await connection.execute(
      'SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [today]
    );
    
    const [transactions] = await connection.execute(
      'SELECT SUM(r_amount) as received, SUM(d_amount) as due, SUM(withdraw) as withdraw FROM today_transeciton WHERE added_on = ?', [today]
    );
    
    const received = parseFloat(transactions[0]?.received || 0);
    const due = parseFloat(transactions[0]?.due || 0);
    const withdraw = parseFloat(transactions[0]?.withdraw || 0);
    
    res.json({
      currentMonthTotal: parseFloat(currentMonthData[0]?.total || 0),
      lastMonthTotal: parseFloat(lastMonthData[0]?.total || 0),
      todayScans: todayScans[0].count,
      todayReceived: received,
      todayDue: due,
      todayWithdraw: withdraw,
      cashInHand: Math.max(0, received - due - withdraw)
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard stats',
      details: error.message,
      stack: error.stack,
      today: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      })
    });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /dashboard/recent-patients:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get recent patients
 *     description: Get list of recent patients for dashboard
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         example: 10
 *     responses:
 *       200:
 *         description: Recent patients list
 */
router.get('/recent-patients', async (req, res) => {
  let connection;
  try {
    const { limit = 10 } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [patients] = await connection.execute(`
      SELECT 
        p.patient_id,
        p.cro,
        p.patient_name,
        p.age,
        p.gender,
        p.mobile,
        p.date,
        p.time,
        p.amount,
        p.status,
        d.doctor_name,
        h.hospital_name,
        s.scan_name
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
      LEFT JOIN scan s ON s.scan_id = p.scan_type
      ORDER BY p.patient_id DESC
      LIMIT ?
    `, [parseInt(limit)]);
    
    res.json({
      success: true,
      data: patients
    });
    
  } catch (error) {
    console.error('Recent patients error:', error);
    res.status(500).json({ error: 'Failed to fetch recent patients' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /dashboard/quick-stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get quick statistics
 *     description: Get quick statistics for dashboard cards
 *     responses:
 *       200:
 *         description: Quick statistics
 */
router.get('/quick-stats', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    // Get various counts
    const [totalPatients] = await connection.execute('SELECT COUNT(*) as count FROM patient_new');
    const [todayPatients] = await connection.execute('SELECT COUNT(*) as count FROM patient_new WHERE date = ?', [today]);
    const [completedToday] = await connection.execute('SELECT COUNT(*) as count FROM patient_new WHERE date = ? AND status = "completed"', [today]);
    const [pendingToday] = await connection.execute('SELECT COUNT(*) as count FROM patient_new WHERE date = ? AND status IN ("registered", "in-progress")', [today]);
    
    // Get revenue stats
    const [todayRevenue] = await connection.execute('SELECT SUM(amount) as total FROM patient_new WHERE date = ?', [today]);
    const [totalRevenue] = await connection.execute('SELECT SUM(amount) as total FROM patient_new');
    
    // Get doctor count
    const [doctorCount] = await connection.execute('SELECT COUNT(*) as count FROM doctor');
    
    // Get hospital count
    const [hospitalCount] = await connection.execute('SELECT COUNT(*) as count FROM hospital');
    
    res.json({
      success: true,
      stats: {
        total_patients: totalPatients[0].count,
        today_patients: todayPatients[0].count,
        completed_today: completedToday[0].count,
        pending_today: pendingToday[0].count,
        today_revenue: parseFloat(todayRevenue[0]?.total || 0),
        total_revenue: parseFloat(totalRevenue[0]?.total || 0),
        total_doctors: doctorCount[0].count,
        total_hospitals: hospitalCount[0].count
      }
    });
    
  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({ error: 'Failed to fetch quick stats' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /dashboard/appointments-today:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get today's appointments
 *     description: Get list of appointments scheduled for today
 *     responses:
 *       200:
 *         description: Today's appointments
 */
router.get('/appointments-today', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const today = new Date().toISOString().split('T')[0];
    
    const [appointments] = await connection.execute(`
      SELECT 
        p.patient_id,
        p.cro,
        p.patient_name,
        p.mobile,
        p.appointment_time,
        p.status,
        d.doctor_name,
        s.scan_name
      FROM patient_new p
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN scan s ON s.scan_id = p.scan_type
      WHERE p.appointment_date = ?
      ORDER BY p.appointment_time ASC
    `, [today]);
    
    res.json({
      success: true,
      date: today,
      appointments: appointments
    });
    
  } catch (error) {
    console.error('Today appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s appointments' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;