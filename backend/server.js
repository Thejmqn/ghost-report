import express from 'express';
import cors from 'cors';
import fs from 'fs';
import mysql from 'mysql2';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 8100;

app.use(cors());
app.use(express.json());

// Decide whether to use SQLite (development) or MySQL (production).
const useSqlite = (process.env.USE_SQLITE === 'true') || Boolean(process.env.SQLITE_FILE) || (process.env.NODE_ENV !== 'production');
const initSQLraw = fs.readFileSync('./db_init.sql', 'utf8');

// Simple DB client abstraction with async methods: query(sql, params) and run(sql, params)
let dbClient = null;

function transformSqlForSqlite(sql) {
  // Basic transformations from MySQL-ish SQL to SQLite-friendly SQL.
  let out = sql;
  // Enable foreign keys will be executed separately
  // Convert AUTO_INCREMENT primary keys
  out = out.replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  out = out.replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT');
  // Replace plain INT with INTEGER (careful: name INTs)
  out = out.replace(/\bINT\b/gi, 'INTEGER');
  // Decimal to real
  out = out.replace(/DECIMAL\([^\)]+\)/gi, 'REAL');
  // Make VARCHAR a no-op (SQLite treats as TEXT) but normalize to TEXT
  out = out.replace(/VARCHAR\(\d+\)/gi, 'TEXT');
  // Ensure CREATE TABLE IF NOT EXISTS
  out = out.replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ');
  // Remove unsupported MySQL-specific statements if any (e.g., ENGINE=..., DEFAULT CHARSET=...)
  out = out.replace(/ENGINE=\w+\s*/gi, '');
  out = out.replace(/DEFAULT CHARSET=[^;]+/gi, '');
  return out;
}

async function initSqlite() {
  const sqliteFile = process.env.SQLITE_FILE || './dev.sqlite';
  sqlite3.verbose();
  const sqliteDb = new sqlite3.Database(sqliteFile);

  // Promisified helpers
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
  const get = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
  const all = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

  // Run PRAGMA and execute transformed SQL
  const transformed = transformSqlForSqlite(initSQLraw);
  try {
    await run('PRAGMA foreign_keys = ON;');
    await all(transformed);
    console.log('SQLite database initialized (or already present).');
  } catch (err) {
    // If exec-style multiple statements failed, try splitting by semicolon and run individually
    try {
      const statements = transformed.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
      for (const s of statements) {
        await run(s + ';');
      }
      console.log('SQLite database initialized via statements.');
    } catch (err2) {
      console.error('Error initializing SQLite DB:', err2.message || err2);
    }
  }

  dbClient = {
    type: 'sqlite',
    query: async (sql, params = []) => {
      const t = sql.trim().toUpperCase();
      if (t.startsWith('SELECT')) return all(sql, params);
      // For other statements, run and return an object similar to MySQL's result
      const res = await run(sql, params);
      return res;
    },
    run
  };
}

async function initMysql() {
  const DB_NAME = process.env.MYSQL_DATABASE || 'ghost_report';
  const connection = mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    multipleStatements: true
  });

  const promiseConn = connection.promise();
  try {
    await promiseConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    await promiseConn.query(`USE \`${DB_NAME}\`;` + initSQLraw);
    console.log('MySQL database initialized (or already present).');
  } catch (err) {
    console.warn('Warning executing MySQL init (may already be initialized or connection failed):', err.message || err);
  }

  dbClient = {
    type: 'mysql',
    query: async (sql, params = []) => {
      const [rows] = await promiseConn.query(sql, params);
      return rows;
    },
    run: async (sql, params = []) => {
      const [result] = await promiseConn.query(sql, params);
      return result;
    }
  };
}

// Initialize appropriate DB client
(async () => {
  if (useSqlite) {
    console.log('Using SQLite for development (use SQLITE_FILE or set USE_SQLITE=false for MySQL).');
    await initSqlite();
  } else {
    console.log('Using MySQL as configured.');
    await initMysql();
  }
})();

// Define a basic route
app.get('/', (req, res) => {
  res.json({ test: 123123, test2: 'testfield' });
});

// GET sightings - returns sightings joined with user and associated ghost names
app.get('/api/sightings', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));

    // Use GROUP_CONCAT / group_concat for MySQL/SQLite compatibility
    const sql = `SELECT S.id, S.visibility, S.time as time, S.userReportID, S.latitude, S.longitude, U.username, GROUP_CONCAT(G.name) AS ghost_names
                 FROM Sighting S
                 LEFT JOIN User U ON S.userReportID = U.id
                 LEFT JOIN Sighting_Reports_Ghost SRG ON S.id = SRG.sightingID
                 LEFT JOIN Ghost G ON SRG.ghostID = G.id
                 GROUP BY S.id
                 ORDER BY S.time DESC`;

    const rows = await dbClient.query(sql);

    const mapped = (rows || []).map((r) => ({
      id: String(r.id),
      userId: String(r.userReportID || ''),
      username: r.username || 'Unknown',
      location: (r.latitude && r.longitude) ? `${r.latitude}, ${r.longitude}` : 'Unknown location',
      description: '',
      ghostType: r.ghost_names ? String(r.ghost_names).split(',')[0] : '',
      timeOfSighting: r.time ? String(r.time) : '',
      visibilityLevel: (r.visibility >= 8) ? 'Very Clear' : (r.visibility >=5 ? 'Clear' : 'Faint'),
      timestamp: r.time ? new Date(r.time) : new Date()
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching sightings:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET ghosts
app.get('/api/ghosts', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const rows = await dbClient.query('SELECT id, type, name, description, visibility FROM Ghost');
    res.json(rows || []);
  } catch (err) {
    console.error('Error fetching ghosts:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET user by id
app.get('/api/users/:id', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const id = req.params.id;
    const rows = await dbClient.query('SELECT id, username, email FROM User WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Register a new user
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email and password are required' });

  try {
    // wait for DB client to be ready
    while (!dbClient) await new Promise(r => setTimeout(r, 50));

    const existing = await dbClient.query('SELECT id FROM User WHERE username = ? OR email = ?', [username, email]);
    if (existing && existing.length > 0) return res.status(409).json({ error: 'username_or_email_taken' });

    const hashed = await new Promise((resolve, reject) => bcrypt.hash(password, 10, (err, hash) => err ? reject(err) : resolve(hash)));

    if (dbClient.type === 'mysql') {
      const result = await dbClient.run('INSERT INTO `User` (username, password, email) VALUES (?, ?, ?)', [username, hashed, email]);
      return res.status(201).json({ id: result.insertId, username, email });
    } else {
      const result = await dbClient.run('INSERT INTO User (username, password, email) VALUES (?, ?, ?)', [username, hashed, email]);
      return res.status(201).json({ id: result.lastID, username, email });
    }
  } catch (err) {
    console.error('Register error:', err.message || err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const rows = await dbClient.query('SELECT id, username, password, email FROM User WHERE username = ?', [username]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'invalid_credentials' });

    const user = rows[0];
    const match = await new Promise((resolve, reject) => bcrypt.compare(password, user.password, (err, ok) => err ? reject(err) : resolve(ok)));
    if (!match) return res.status(401).json({ error: 'invalid_credentials' });
    return res.json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    console.error('Login error:', err.message || err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

