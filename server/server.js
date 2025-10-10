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
  
  // Create master_shops table (from gazette/districts-data.json)
  // This is the single source of truth containing all shop data
  const createMasterShopsTableQuery = `
    CREATE TABLE IF NOT EXISTS master_shops (
      id SERIAL PRIMARY KEY,
      gazette_code VARCHAR(50) NOT NULL UNIQUE,
      locality TEXT NOT NULL,
      annual_excise_tax VARCHAR(50),
      category VARCHAR(100),
      excise_station VARCHAR(255) NOT NULL,
      district VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_master_shops_district ON master_shops(district);
    CREATE INDEX IF NOT EXISTS idx_master_shops_station ON master_shops(excise_station);
    CREATE INDEX IF NOT EXISTS idx_master_shops_category ON master_shops(category);
    CREATE INDEX IF NOT EXISTS idx_master_shops_gazette ON master_shops(gazette_code);
  `;
  
  // Create shops table if it doesn't exist
  const createShopsTableQuery = `
    CREATE TABLE IF NOT EXISTS shops (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      expected_tokens INTEGER DEFAULT 0,
      avg_sale VARCHAR(50) DEFAULT '',
      tokens INTEGER DEFAULT 0,
      district VARCHAR(255),
      station VARCHAR(255),
      gazette_code VARCHAR(50),
      category VARCHAR(50),
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
        ALTER TABLE shops ADD COLUMN avg_sale VARCHAR(50) DEFAULT '';
      ELSE
        -- Change avg_sale from DECIMAL to VARCHAR if it exists
        ALTER TABLE shops ALTER COLUMN avg_sale TYPE VARCHAR(50);
        ALTER TABLE shops ALTER COLUMN avg_sale SET DEFAULT '';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='district') THEN
        ALTER TABLE shops ADD COLUMN district VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='station') THEN
        ALTER TABLE shops ADD COLUMN station VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='gazette_code') THEN
        ALTER TABLE shops ADD COLUMN gazette_code VARCHAR(50);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='category') THEN
        ALTER TABLE shops ADD COLUMN category VARCHAR(50);
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
  
  // Create master shops table first
  client.query(createMasterShopsTableQuery, (err, result) => {
    if (err) {
      console.error('❌ Error creating master_shops table:', err.stack);
      release();
      return;
    }
    console.log('✅ Master shops table ready');
    
    // Create shops table
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
});

// ============================================
// API ROUTES
// ============================================

// ============================================
// MASTER SHOPS ROUTES
// ============================================

// GET all master shops with optional filtering
app.get('/api/master-shops', async (req, res) => {
  try {
    const { district, station, category, search } = req.query;
    let query = `SELECT * FROM master_shops WHERE 1=1`;
    const params = [];
    let paramCount = 1;
    
    if (district && district !== 'all') {
      query += ` AND district = $${paramCount++}`;
      params.push(district);
    }
    
    if (station && station !== 'all') {
      query += ` AND excise_station = $${paramCount++}`;
      params.push(station);
    }
    
    if (category && category !== 'all') {
      query += ` AND category = $${paramCount++}`;
      params.push(category);
    }
    
    if (search) {
      query += ` AND (gazette_code ILIKE $${paramCount} OR locality ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ' ORDER BY gazette_code ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch master shops', message: error.message });
  }
});

// GET single master shop by gazette code
app.get('/api/master-shops/:gazette_code', async (req, res) => {
  try {
    const { gazette_code } = req.params;
    const result = await pool.query(
      'SELECT * FROM master_shops WHERE gazette_code = $1',
      [gazette_code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Master shop not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch master shop', message: error.message });
  }
});

// GET all unique categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT category FROM master_shops WHERE category IS NOT NULL ORDER BY category ASC'
    );
    res.json(result.rows.map(row => row.category));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories', message: error.message });
  }
});

// GET master shops statistics
app.get('/api/master-shops/stats', async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM master_shops');
    const districtResult = await pool.query('SELECT COUNT(DISTINCT district) as total FROM master_shops');
    const stationResult = await pool.query('SELECT COUNT(DISTINCT excise_station) as total FROM master_shops');
    const categoryResult = await pool.query('SELECT COUNT(DISTINCT category) as total FROM master_shops WHERE category IS NOT NULL');
    
    res.json({
      total_shops: parseInt(totalResult.rows[0].total),
      total_districts: parseInt(districtResult.rows[0].total),
      total_stations: parseInt(stationResult.rows[0].total),
      total_categories: parseInt(categoryResult.rows[0].total)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics', message: error.message });
  }
});

// ============================================
// DISTRICTS & STATIONS ROUTES
// ============================================

// GET all districts (from master_shops)
app.get('/api/districts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT district as name FROM master_shops ORDER BY district ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch districts', message: error.message });
  }
});

// GET excise stations (optionally filtered by district from master_shops)
app.get('/api/excise-stations', async (req, res) => {
  try {
    const { district } = req.query;
    let query = 'SELECT DISTINCT excise_station as name, district FROM master_shops';
    const params = [];
    
    if (district && district !== 'all') {
      query += ' WHERE district = $1';
      params.push(district);
    }
    
    query += ' ORDER BY excise_station ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch excise stations', message: error.message });
  }
});

// GET all shops with optional filtering
app.get('/api/shops', async (req, res) => {
  try {
    const { district_id, station_id } = req.query;
    let query = `
      SELECT s.*, d.name as district_name, e.name as station_name 
      FROM shops s
      LEFT JOIN districts d ON s.district_id = d.id
      LEFT JOIN excise_stations e ON s.station_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;
    
    if (district_id && district_id !== 'all') {
      query += ` AND s.district_id = $${paramCount++}`;
      params.push(district_id);
    }
    
    if (station_id && station_id !== 'all') {
      query += ` AND s.station_id = $${paramCount++}`;
      params.push(station_id);
    }
    
    query += ' ORDER BY s.id ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shops', message: error.message });
  }
});

// POST create new shop
app.post('/api/shops', async (req, res) => {
  try {
    const { id, name, expected_tokens, avg_sale, tokens, district, station, gazette_code, category } = req.body;
    const result = await pool.query(
      'INSERT INTO shops (id, name, expected_tokens, avg_sale, tokens, district, station, gazette_code, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [id, name, expected_tokens || 0, avg_sale || '', tokens || 0, district || null, station || null, gazette_code || null, category || null]
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
    const { expected_tokens, avg_sale, tokens, district_id, station_id } = req.body;
    
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
    if (district_id !== undefined) {
      updates.push(`district_id = $${paramCount++}`);
      values.push(district_id || null);
    }
    if (station_id !== undefined) {
      updates.push(`station_id = $${paramCount++}`);
      values.push(station_id || null);
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
        [shop.id, shop.name, shop.expected_tokens || 0, shop.avg_sale || '', shop.tokens || 0]
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

// Migration endpoint to populate gazette_code, category, district, station for existing shops
app.post('/api/migrate-shops', async (req, res) => {
  try {
    // Get all shops
    const shopsResult = await pool.query('SELECT * FROM shops');
    const shops = shopsResult.rows;
    
    // Get all master shops
    const masterShopsResult = await pool.query('SELECT * FROM master_shops');
    const masterShops = masterShopsResult.rows;
    
    let updated = 0;
    let errors = [];
    
    for (const shop of shops) {
      // Try to find matching master shop by name
      const masterShop = masterShops.find(ms => 
        ms.locality === shop.name || 
        ms.locality.toLowerCase() === shop.name.toLowerCase()
      );
      
      if (masterShop) {
        // Update shop with master shop data
        await pool.query(
          `UPDATE shops 
           SET gazette_code = $1, category = $2, district = $3, station = $4
           WHERE id = $5`,
          [masterShop.gazette_code, masterShop.category, masterShop.district, masterShop.excise_station, shop.id]
        );
        updated++;
      } else {
        errors.push({ id: shop.id, name: shop.name, reason: 'No matching master shop found' });
      }
    }
    
    res.json({ 
      success: true, 
      updated, 
      total: shops.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ error: 'Migration failed', message: error.message });
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

