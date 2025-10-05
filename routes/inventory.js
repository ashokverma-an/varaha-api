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

// Helper function to get current date in DD-MM-YYYY format
const getCurrentDate = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Get all inventory items
router.get('/items', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [items] = await connection.execute(`
      SELECT id, item_name, quantity, opening_stock, inward_qty, outward_qty, value_rupees, unit, stock_date, date_added, last_updated 
      FROM inventory_items 
      ORDER BY item_name ASC
    `);
    
    res.json({
      success: true,
      data: items,
      total: items.length
    });
    
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory items',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Add new inventory item
router.post('/items', async (req, res) => {
  let connection;
  try {
    const { item_name, opening_stock, value_rupees, stock_date, unit } = req.body;
    
    if (!item_name || opening_stock === undefined || value_rupees === undefined) {
      return res.status(400).json({
        error: 'Item name, opening stock, and value are required'
      });
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      INSERT INTO inventory_items (item_name, quantity, opening_stock, value_rupees, unit, stock_date, date_added)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [item_name, opening_stock, opening_stock, value_rupees, unit || 'quantity', stock_date || new Date().toISOString().split('T')[0]]);
    
    res.json({
      success: true,
      message: 'Item added successfully',
      id: result.insertId
    });
    
  } catch (error) {
    console.error('Add inventory item error:', error);
    res.status(500).json({
      error: 'Failed to add inventory item',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Update inventory item
router.put('/items/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { item_name, quantity, opening_stock, inward_qty, outward_qty } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      UPDATE inventory_items 
      SET item_name = ?, quantity = ?, opening_stock = ?, inward_qty = ?, outward_qty = ?
      WHERE id = ?
    `, [item_name, quantity, opening_stock, inward_qty || 0, outward_qty || 0, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({
      success: true,
      message: 'Item updated successfully'
    });
    
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({
      error: 'Failed to update inventory item',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Delete inventory item
router.delete('/items/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(`
      DELETE FROM inventory_items WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      error: 'Failed to delete inventory item',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get inventory stats
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [totalItems] = await connection.execute('SELECT COUNT(*) as count FROM inventory_items');
    const [lowStock] = await connection.execute('SELECT COUNT(*) as count FROM inventory_items WHERE quantity < 10');
    const [totalValue] = await connection.execute('SELECT SUM(quantity * value_rupees) as value FROM inventory_items');
    const [recentTransactions] = await connection.execute(`
      SELECT COUNT(*) as count FROM inventory_transactions 
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    
    res.json({
      success: true,
      stats: {
        totalItems: totalItems[0].count,
        lowStock: lowStock[0].count,
        totalValue: totalValue[0].value || 0,
        recentOrders: recentTransactions[0].count
      }
    });
    
  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch inventory stats',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Inward Stock Entry
router.post('/inward', async (req, res) => {
  let connection;
  try {
    const { item_id, quantity, rate, supplier, invoice_no, remarks } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    // Insert inward transaction
    const [inwardResult] = await connection.execute(`
      INSERT INTO inventory_transactions (item_id, transaction_type, quantity, rate, total_amount, supplier, invoice_no, remarks, transaction_date)
      VALUES (?, 'INWARD', ?, ?, ?, ?, ?, ?, ?)
    `, [item_id, quantity, rate, quantity * rate, supplier, invoice_no, remarks, getCurrentDate()]);
    
    // Update item stock
    await connection.execute(`
      UPDATE inventory_items 
      SET quantity = quantity + ?, inward_qty = inward_qty + ?, last_updated = NOW()
      WHERE id = ?
    `, [quantity, quantity, item_id]);
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Inward stock added successfully',
      transaction_id: inwardResult.insertId
    });
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Inward stock error:', error);
    res.status(500).json({
      error: 'Failed to add inward stock',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Outward Stock Entry
router.post('/outward', async (req, res) => {
  let connection;
  try {
    const { item_id, quantity, department, issued_to, purpose, remarks } = req.body;
    
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    // Check available stock
    const [stockCheck] = await connection.execute('SELECT quantity FROM inventory_items WHERE id = ?', [item_id]);
    if (stockCheck.length === 0 || stockCheck[0].quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock available' });
    }
    
    // Insert outward transaction
    const [outwardResult] = await connection.execute(`
      INSERT INTO inventory_transactions (item_id, transaction_type, quantity, department, issued_to, purpose, remarks, transaction_date)
      VALUES (?, 'OUTWARD', ?, ?, ?, ?, ?, ?)
    `, [item_id, quantity, department, issued_to, purpose, remarks, getCurrentDate()]);
    
    // Update item stock
    await connection.execute(`
      UPDATE inventory_items 
      SET quantity = quantity - ?, outward_qty = outward_qty + ?, last_updated = NOW()
      WHERE id = ?
    `, [quantity, quantity, item_id]);
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Outward stock recorded successfully',
      transaction_id: outwardResult.insertId
    });
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Outward stock error:', error);
    res.status(500).json({
      error: 'Failed to record outward stock',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get Transactions with filters
router.get('/transactions', async (req, res) => {
  let connection;
  try {
    const { type, from_date, to_date, item_id } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (type && type !== 'ALL') {
      whereClause += ' AND t.transaction_type = ?';
      params.push(type);
    }
    
    if (from_date && to_date) {
      whereClause += ' AND STR_TO_DATE(t.transaction_date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
      params.push(from_date, to_date);
    }
    
    if (item_id) {
      whereClause += ' AND t.item_id = ?';
      params.push(item_id);
    }
    
    const [transactions] = await connection.execute(`
      SELECT t.*, i.item_name, i.unit
      FROM inventory_transactions t
      JOIN inventory_items i ON t.item_id = i.id
      ${whereClause}
      ORDER BY t.id DESC
    `, params);
    
    res.json({
      success: true,
      data: transactions,
      total: transactions.length
    });
    
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});



// Stock Analysis Report
router.get('/analysis', async (req, res) => {
  let connection;
  try {
    const { from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    let dateFilter = '';
    const params = [];
    
    if (from_date && to_date) {
      dateFilter = 'AND STR_TO_DATE(t.transaction_date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
      params.push(from_date, to_date);
    }
    
    // Stock summary by item
    const [stockSummary] = await connection.execute(`
      SELECT 
        i.id,
        i.item_name,
        i.unit,
        i.opening_stock,
        i.quantity as current_stock,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'INWARD' THEN t.quantity ELSE 0 END), 0) as total_inward,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'OUTWARD' THEN t.quantity ELSE 0 END), 0) as total_outward,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'INWARD' THEN t.total_amount ELSE 0 END), 0) as inward_value,
        i.value_rupees * i.quantity as current_value
      FROM inventory_items i
      LEFT JOIN inventory_transactions t ON i.id = t.item_id ${dateFilter}
      GROUP BY i.id
      ORDER BY i.item_name
    `, params);
    
    // Monthly trend
    const [monthlyTrend] = await connection.execute(`
      SELECT 
        DATE_FORMAT(STR_TO_DATE(transaction_date, '%d-%m-%Y'), '%Y-%m') as month,
        transaction_type,
        SUM(quantity) as total_quantity,
        SUM(total_amount) as total_value
      FROM inventory_transactions t
      WHERE STR_TO_DATE(transaction_date, '%d-%m-%Y') >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month, transaction_type
      ORDER BY month DESC
    `);
    
    // Low stock alerts
    const [lowStock] = await connection.execute(`
      SELECT item_name, quantity, unit
      FROM inventory_items
      WHERE quantity < 10
      ORDER BY quantity ASC
    `);
    
    res.json({
      success: true,
      data: {
        stock_summary: stockSummary,
        monthly_trend: monthlyTrend,
        low_stock_alerts: lowStock
      }
    });
    
  } catch (error) {
    console.error('Stock analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate stock analysis',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Export Inventory Data
router.get('/export', async (req, res) => {
  let connection;
  try {
    const { type = 'stock', from_date, to_date } = req.query;
    
    connection = await mysql.createConnection(dbConfig);
    
    if (type === 'transactions') {
      // Export transactions
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (from_date && to_date) {
        whereClause += ' AND STR_TO_DATE(t.transaction_date, "%d-%m-%Y") BETWEEN STR_TO_DATE(?, "%d-%m-%Y") AND STR_TO_DATE(?, "%d-%m-%Y")';
        params.push(from_date, to_date);
      }
      
      const [transactions] = await connection.execute(`
        SELECT 
          t.id,
          i.item_name,
          t.transaction_type,
          t.quantity,
          i.unit,
          t.rate,
          t.total_amount,
          t.supplier,
          t.department,
          t.issued_to,
          t.purpose,
          t.invoice_no,
          t.remarks,
          t.transaction_date
        FROM inventory_transactions t
        JOIN inventory_items i ON t.item_id = i.id
        ${whereClause}
        ORDER BY t.id DESC
      `, params);
      
      res.json({
        success: true,
        type: 'transactions',
        data: transactions,
        date_range: from_date && to_date ? `${from_date} to ${to_date}` : 'All Dates'
      });
      
    } else {
      // Export stock summary
      const [stockData] = await connection.execute(`
        SELECT 
          i.id,
          i.item_name,
          i.unit,
          i.opening_stock,
          i.quantity as current_stock,
          i.inward_qty as total_inward,
          i.outward_qty as total_outward,
          i.value_rupees as unit_rate,
          i.value_rupees * i.quantity as current_value,
          i.stock_date,
          i.last_updated
        FROM inventory_items i
        ORDER BY i.item_name
      `);
      
      res.json({
        success: true,
        type: 'stock',
        data: stockData,
        export_date: getCurrentDate()
      });
    }
    
  } catch (error) {
    console.error('Export inventory error:', error);
    res.status(500).json({
      error: 'Failed to export inventory data',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Initialize inventory tables
router.post('/init', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Create inventory_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        opening_stock INT NOT NULL DEFAULT 0,
        inward_qty INT DEFAULT 0,
        outward_qty INT DEFAULT 0,
        value_rupees DECIMAL(10,2) DEFAULT 0,
        unit VARCHAR(50) DEFAULT 'quantity',
        stock_date DATE,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create inventory_transactions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id INT NOT NULL,
        transaction_type ENUM('INWARD', 'OUTWARD') NOT NULL,
        quantity INT NOT NULL,
        rate DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        supplier VARCHAR(255) DEFAULT NULL,
        department VARCHAR(255) DEFAULT NULL,
        issued_to VARCHAR(255) DEFAULT NULL,
        purpose VARCHAR(255) DEFAULT NULL,
        invoice_no VARCHAR(100) DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        transaction_date VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_item_id (item_id),
        INDEX idx_transaction_type (transaction_type),
        INDEX idx_transaction_date (transaction_date),
        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      )
    `);
    
    // Insert sample data if tables are empty
    const [itemCount] = await connection.execute('SELECT COUNT(*) as count FROM inventory_items');
    if (itemCount[0].count === 0) {
      await connection.execute(`
        INSERT INTO inventory_items (item_name, quantity, opening_stock, value_rupees, unit, stock_date) VALUES
        ('X-Ray Films', 100, 100, 25.00, 'pieces', CURDATE()),
        ('CT Films', 50, 50, 45.00, 'pieces', CURDATE()),
        ('Contrast Media', 20, 20, 150.00, 'bottles', CURDATE()),
        ('Diesel', 500, 500, 85.00, 'liters', CURDATE()),
        ('Syringes', 200, 200, 5.00, 'pieces', CURDATE()),
        ('Gloves', 1000, 1000, 2.50, 'pieces', CURDATE())
      `);
    }
    
    res.json({
      success: true,
      message: 'Inventory tables initialized successfully'
    });
    
  } catch (error) {
    console.error('Initialize inventory error:', error);
    res.status(500).json({
      error: 'Failed to initialize inventory tables',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;