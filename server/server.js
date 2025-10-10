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
const isDevelopment = process.env.NODE_ENV !== 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/token_manager',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Test connection and create table
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error connecting to PostgreSQL:', err.stack);
  }
  console.log('✅ Connected to PostgreSQL');
  
  // Create shops table if it doesn't exist
  const createShopsTableQuery = `
    CREATE TABLE IF NOT EXISTS shops (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      expected_tokens INTEGER DEFAULT 0,
      avg_sale DECIMAL(10, 2) DEFAULT 0,
      tokens INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  // Add new columns if they don't exist (for existing databases)
  const addColumnsQuery = `
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='expected_tokens') THEN
        ALTER TABLE shops ADD COLUMN expected_tokens INTEGER DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='avg_sale') THEN
        ALTER TABLE shops ADD COLUMN avg_sale DECIMAL(10, 2) DEFAULT 0;
      END IF;
    END $$;
  `;
  
  // Create settings table for token cap
  const createSettingsTableQuery = `
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value INTEGER NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  // Insert default token cap if not exists
  const insertDefaultCapQuery = `
    INSERT INTO settings (key, value)
    VALUES ('token_cap', 200)
    ON CONFLICT (key) DO NOTHING;
  `;
  
  client.query(createShopsTableQuery, (err, result) => {
    if (err) {
      console.error('❌ Error creating shops table:', err.stack);
      release();
      return;
    }
    console.log('✅ Shops table ready');
    
    // Add new columns for existing tables
    client.query(addColumnsQuery, (err, result) => {
      if (err) {
        console.error('❌ Error adding new columns:', err.stack);
      } else {
        console.log('✅ New columns added');
      }
      
      client.query(createSettingsTableQuery, (err, result) => {
        if (err) {
          console.error('❌ Error creating settings table:', err.stack);
          release();
          return;
        }
        console.log('✅ Settings table ready');
        
        client.query(insertDefaultCapQuery, (err, result) => {
          release();
          if (err) {
            console.error('❌ Error inserting default cap:', err.stack);
          } else {
            console.log('✅ Default token cap set');
          }
        });
      });
    });
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
    const { id, name, expected_tokens, avg_sale, tokens } = req.body;
    const result = await pool.query(
      'INSERT INTO shops (id, name, expected_tokens, avg_sale, tokens) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, name, expected_tokens || 0, avg_sale || 0, tokens || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shop', message: error.message });
  }
});

// PUT update shop
app.put('/api/shops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { expected_tokens, avg_sale, tokens } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (expected_tokens !== undefined) {
      updates.push(`expected_tokens = $${paramCount++}`);
      values.push(expected_tokens);
    }
    if (avg_sale !== undefined) {
      updates.push(`avg_sale = $${paramCount++}`);
      values.push(avg_sale);
    }
    if (tokens !== undefined) {
      updates.push(`tokens = $${paramCount++}`);
      values.push(tokens);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(parseInt(id));
    
    const result = await pool.query(
      `UPDATE shops SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
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
        'INSERT INTO shops (id, name, expected_tokens, avg_sale, tokens) VALUES ($1, $2, $3, $4, $5)',
        [shop.id, shop.name, shop.expected_tokens || 0, shop.avg_sale || 0, shop.tokens || 0]
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

// GET token cap setting
app.get('/api/settings/token-cap', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = 'token_cap'"
    );
    if (result.rows.length === 0) {
      return res.json({ tokenCap: 200 });
    }
    res.json({ tokenCap: result.rows[0].value });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch token cap', message: error.message });
  }
});

// PUT update token cap setting
app.put('/api/settings/token-cap', async (req, res) => {
  try {
    const { tokenCap } = req.body;
    const result = await pool.query(
      "UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = 'token_cap' RETURNING value",
      [tokenCap]
    );
    res.json({ tokenCap: result.rows[0].value });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update token cap', message: error.message });
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

