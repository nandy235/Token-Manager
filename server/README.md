# Token Manager - Backend Server

Express.js + PostgreSQL backend for Token Manager application.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup PostgreSQL Database

**Create Database:**
```bash
psql postgres
CREATE DATABASE token_manager;
\q
```

**Or use the init script:**
```bash
psql -U postgres -f init-db.sql
```

### 3. Configure Environment

Default connection: `postgresql://localhost:5432/token_manager`

To customize, create `.env` in root directory:
```env
PORT=5000
DATABASE_URL=postgresql://localhost:5432/token_manager
```

### 4. Start Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server runs on: **http://localhost:5000**

---

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Endpoints

#### GET `/shops`
Returns all shops
```bash
curl http://localhost:5000/api/shops
```

#### POST `/shops`
Create a new shop
```bash
curl -X POST http://localhost:5000/api/shops \
  -H "Content-Type: application/json" \
  -d '{"id": 123, "name": "Test Shop", "tokens": 50}'
```

#### PUT `/shops/:id`
Update shop tokens
```bash
curl -X PUT http://localhost:5000/api/shops/123 \
  -H "Content-Type: application/json" \
  -d '{"tokens": 100}'
```

#### DELETE `/shops/:id`
Delete a shop
```bash
curl -X DELETE http://localhost:5000/api/shops/123
```

#### POST `/shops/bulk`
Bulk update all shops
```bash
curl -X POST http://localhost:5000/api/shops/bulk \
  -H "Content-Type: application/json" \
  -d '{"shops": [{"id": 1, "name": "Shop 1", "tokens": 50}]}'
```

#### GET `/health`
Health check
```bash
curl http://localhost:5000/api/health
```

---

## 🗄️ Database Schema

```sql
CREATE TABLE shops (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `DATABASE_URL` | `postgresql://localhost:5432/token_manager` | PostgreSQL connection string |
| `NODE_ENV` | `development` | Environment mode |

---

## 📦 Dependencies

- **express** - Web framework
- **pg** - PostgreSQL client
- **cors** - CORS middleware
- **dotenv** - Environment variables
- **nodemon** - Auto-reload (dev only)

---

## 🐛 Debugging

### Check Database Connection
```bash
psql token_manager -c "SELECT * FROM shops;"
```

### View Server Logs
Server logs errors and connections to console.

### Test Health Endpoint
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{"status":"OK","message":"Server is running"}
```

---

## 🚀 Deployment

### Heroku
```bash
git push heroku main
```

### Railway
1. Connect GitHub repo
2. Add PostgreSQL service
3. Set DATABASE_URL environment variable

### Render
1. Create Web Service
2. Add PostgreSQL database
3. Set build command: `npm install`
4. Set start command: `npm start`

---

## 📝 Notes

- Server auto-creates `shops` table on startup
- Uses connection pooling for better performance
- All API errors return JSON with error message
- CORS enabled for all origins (configure for production)

---

## 🎉 Ready!

Your backend server is now running and ready to handle requests!

