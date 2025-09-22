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
 * /accounts/stats:
 *   get:
 *     tags: [Accounts]
 *     summary: Get accounts dashboard statistics
 *     description: Get financial statistics for accounts dashboard
 *     responses:
 *       200:
 *         description: Accounts statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                 monthlyTotal:
 *                   type: number
 *                   example: 125000.00
 *                 pendingPayments:
 *                   type: integer
 *                   example: 25
 *                 pendingAmount:
 *                   type: number
 *                   example: 15000.00
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

    // Today's revenue
    const [todayRevenue] = await connection.execute(`
      SELECT 
        SUM(r_amount) as received,
        SUM(d_amount) as due,
        SUM(withdraw) as withdraw,
        COUNT(*) as transactions
      FROM today_transeciton 
      WHERE added_on = ?
    `, [today]);
    
    // Monthly revenue
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const [monthlyRevenue] = await connection.execute(`
      SELECT SUM(p.amount) as total
      FROM patient_new p
      JOIN today_transeciton t ON t.cro = p.cro
      WHERE MONTH(STR_TO_DATE(t.added_on, '%d-%m-%Y')) = ? 
        AND YEAR(STR_TO_DATE(t.added_on, '%d-%m-%Y')) = ?
        AND t.withdraw = 0
    `, [currentMonth, currentYear]);
    
    // Pending payments
    const [pendingPayments] = await connection.execute(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM patient_new 
      WHERE payment_status = 'pending'
    `);
    
    const received = parseFloat(todayRevenue[0]?.received || 0);
    const due = parseFloat(todayRevenue[0]?.due || 0);
    const withdraw = parseFloat(todayRevenue[0]?.withdraw || 0);
    
    res.json({
      todayReceived: received,
      todayDue: due,
      todayWithdraw: withdraw,
      cashInHand: Math.max(0, received - due - withdraw),
      monthlyTotal: parseFloat(monthlyRevenue[0]?.total || 0),
      pendingPayments: pendingPayments[0].count,
      pendingAmount: parseFloat(pendingPayments[0]?.total || 0),
      todayTransactions: todayRevenue[0].transactions
    });
    
  } catch (error) {
    console.error('Accounts stats error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts stats' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /accounts/transactions:
 *   get:
 *     tags: [Accounts]
 *     summary: Get payment transactions
 *     description: Get list of payment transactions with filtering
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "01-01-2024"
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "31-01-2024"
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
 *         description: List of transactions
 */
router.get('/transactions', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date, limit = 100, offset = 0 } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT 
        t.*,
        p.patient_name,
        p.amount as total_amount,
        d.doctor_name,
        h.hospital_name
      FROM today_transeciton t
      JOIN patient_new p ON p.cro = t.cro
      LEFT JOIN doctor d ON d.d_id = p.doctor_name
      LEFT JOIN hospital h ON h.h_id = p.hospital_id
    `;
    
    const params = [];
    
    if (from_date && to_date) {
      query += ` WHERE STR_TO_DATE(t.added_on, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%d-%m-%Y') AND STR_TO_DATE(?, '%d-%m-%Y')`;
      params.push(from_date, to_date);
    }
    
    query += ` ORDER BY t.t_id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    const [transactions] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: transactions,
      total: transactions.length
    });
    
  } catch (error) {
    console.error('Accounts transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /accounts/update-payment:
 *   post:
 *     tags: [Accounts]
 *     summary: Update payment status
 *     description: Update payment information for a patient
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cro, received_amount, due_amount]
 *             properties:
 *               cro:
 *                 type: string
 *                 example: "CRO24011512345"
 *               received_amount:
 *                 type: number
 *                 example: 1500.00
 *               due_amount:
 *                 type: number
 *                 example: 0.00
 *               payment_method:
 *                 type: string
 *                 example: "cash"
 *               remark:
 *                 type: string
 *                 example: "Payment completed"
 *     responses:
 *       200:
 *         description: Payment updated successfully
 */
router.post('/update-payment', async (req, res) => {
  let connection;
  try {
    const { cro, received_amount, due_amount, payment_method, remark } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    // Insert/Update transaction
    await connection.execute(`
      INSERT INTO today_transeciton (cro, r_amount, d_amount, added_on, payment_method, remark)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      r_amount = VALUES(r_amount),
      d_amount = VALUES(d_amount),
      payment_method = VALUES(payment_method),
      remark = VALUES(remark)
    `, [cro, received_amount, due_amount, today, payment_method, remark]);
    
    // Update patient payment status
    const payment_status = due_amount > 0 ? 'pending' : 'completed';
    await connection.execute(`
      UPDATE patient_new 
      SET payment_status = ?
      WHERE cro = ?
    `, [payment_status, cro]);
    
    res.json({
      success: true,
      message: 'Payment updated successfully'
    });
    
  } catch (error) {
    console.error('Accounts update payment error:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /accounts/revenue-report:
 *   get:
 *     tags: [Accounts]
 *     summary: Get revenue report
 *     description: Get detailed revenue report with grouping options
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "01-01-2024"
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         example: "31-01-2024"
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [daily, monthly]
 *           default: daily
 *     responses:
 *       200:
 *         description: Revenue report data
 */
router.get('/revenue-report', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date, group_by = 'daily' } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let query, groupBy;
    
    if (group_by === 'monthly') {
      groupBy = `DATE_FORMAT(STR_TO_DATE(t.added_on, '%d-%m-%Y'), '%Y-%m')`;
    } else {
      groupBy = `t.added_on`;
    }
    
    query = `
      SELECT 
        ${groupBy} as period,
        SUM(t.r_amount) as total_received,
        SUM(t.d_amount) as total_due,
        SUM(t.withdraw) as total_withdraw,
        COUNT(*) as transaction_count,
        SUM(p.amount) as gross_revenue
      FROM today_transeciton t
      JOIN patient_new p ON p.cro = t.cro
    `;
    
    const params = [];
    
    if (from_date && to_date) {
      query += ` WHERE STR_TO_DATE(t.added_on, '%d-%m-%Y') BETWEEN STR_TO_DATE(?, '%d-%m-%Y') AND STR_TO_DATE(?, '%d-%m-%Y')`;
      params.push(from_date, to_date);
    }
    
    query += ` GROUP BY ${groupBy} ORDER BY period DESC`;
    
    const [revenue] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: revenue,
      total: revenue.length
    });
    
  } catch (error) {
    console.error('Accounts revenue report error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue report' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @swagger
 * /accounts/vouchers:
 *   get:
 *     tags: [Accounts]
 *     summary: Get vouchers
 *     description: Get list of vouchers
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of vouchers
 */
router.get('/vouchers', async (req, res) => {
  let connection;
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [vouchers] = await connection.execute(`
      SELECT * FROM voucher 
      ORDER BY v_id DESC 
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: vouchers,
      total: vouchers.length
    });
    
  } catch (error) {
    console.error('Accounts vouchers error:', error);
    res.status(500).json({ error: 'Failed to fetch vouchers' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;