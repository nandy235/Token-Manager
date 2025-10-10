import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/token_manager',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection and create table
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error connecting to PostgreSQL:', err.stack);
  }
  console.log('✅ Connected to PostgreSQL');
  
  // Create shops table if it doesn't exist
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS shops (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      tokens INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  client.query(createTableQuery, (err, result) => {
    release();
    if (err) {
      console.error('❌ Error creating table:', err.stack);
    } else {
      console.log('✅ Shops table ready');
    }
  });
});

// ============================================
// API ROUTES
// ============================================

// GET all shops
app.get('/api/shops', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shops ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shops', message: error.message });
  }
});

// POST create new shop
app.post('/api/shops', async (req, res) => {
  try {
    const { id, name, tokens } = req.body;
    const result = await pool.query(
      'INSERT INTO shops (id, name, tokens) VALUES ($1, $2, $3) RETURNING *',
      [id, name, tokens || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shop', message: error.message });
  }
});

// PUT update shop tokens
app.put('/api/shops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tokens } = req.body;
    const result = await pool.query(
      'UPDATE shops SET tokens = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [tokens, parseInt(id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shop', message: error.message });
  }
});

// DELETE shop
app.delete('/api/shops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM shops WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    res.json({ message: 'Shop deleted successfully', shop: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete shop', message: error.message });
  }
});

// POST bulk update (for import/export)
app.post('/api/shops/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    const { shops } = req.body;
    
    await client.query('BEGIN');
    
    // Clear existing shops
    await client.query('DELETE FROM shops');
    
    // Insert new shops
    const insertPromises = shops.map(shop => 
      client.query(
        'INSERT INTO shops (id, name, tokens) VALUES ($1, $2, $3)',
        [shop.id, shop.name, shop.tokens || 0]
      )
    );
    
    await Promise.all(insertPromises);
    await client.query('COMMIT');
    
    // Fetch all shops
    const result = await client.query('SELECT * FROM shops ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to bulk update shops', message: error.message });
  } finally {
    client.release();
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});

