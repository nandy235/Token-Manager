-- Token Manager Database Setup
-- Run this file to initialize your PostgreSQL database

-- Create database (run this separately as postgres user)
-- CREATE DATABASE token_manager;

-- Connect to the database
\c token_manager

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data (optional)
INSERT INTO shops (id, name, tokens) VALUES 
  (1, 'Shop 1', 0),
  (2, 'Shop 2', 0)
ON CONFLICT (id) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shops_id ON shops(id);

-- Display all shops
SELECT * FROM shops ORDER BY id;

-- Success message
SELECT 'Database initialized successfully!' AS message;

