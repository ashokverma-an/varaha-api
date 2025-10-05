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

// Get all inventory items
router.get('/items', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [items] = await connection.execute(`
      SELECT id, item_name, quantity, opening_stock, inward_qty, outward_qty, value_rupees, unit, stock_date, date_added, last_updated 
      FROM inventory_items 
      ORDER BY id DESC
    `);
    
    res.json({
      success: true,
      data: items
    });
    
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({
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
    const [totalValue] = await connection.execute('SELECT SUM(quantity * 100) as value FROM inventory_items');
    
    res.json({
      success: true,
      stats: {
        totalItems: totalItems[0].count,
        lowStock: lowStock[0].count,
        totalValue: totalValue[0].value || 0,
        recentOrders: 0
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

// Initialize inventory table
router.post('/init', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
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
    
    res.json({
      success: true,
      message: 'Inventory table initialized successfully'
    });
    
  } catch (error) {
    console.error('Initialize inventory error:', error);
    res.status(500).json({
      error: 'Failed to initialize inventory table',
      details: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;