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

  // Run PRAGMA and execute transformed SQL in a safe, idempotent way
  const transformed = transformSqlForSqlite(initSQLraw);
  await run('PRAGMA foreign_keys = ON;');

  // Split into individual statements (handles semicolon + optional whitespace/newline)
  const statements = transformed.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);

  // First, execute all CREATE TABLE statements (these are idempotent due to IF NOT EXISTS)
  for (const stmt of statements) {
    if (/^CREATE\s+TABLE/i.test(stmt)) {
      try {
        await run(stmt + ';');
      } catch (e) {
        // ignore errors from existing schema
      }
    }
  }

  // Determine whether to run seed INSERTS: only run when the User table is empty
  let userCount = 0;
  try {
    const row = await get('SELECT COUNT(*) as cnt FROM User');
    userCount = row?.cnt || 0;
  } catch (e) {
    userCount = 0;
  }

  if (userCount === 0) {
    // Run non-CREATE statements (inserts/populates)
    for (const stmt of statements) {
      if (!/^CREATE\s+TABLE/i.test(stmt)) {
        try {
          await run(stmt + ';');
        } catch (e) {
          console.warn('Failed to execute statement during seed:', e.message || e);
        }
      }
    }
    console.log('SQLite database initialized with seed data.');
  } else {
    console.log('SQLite schema ensured; existing data preserved (seed skipped).');
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
    // Split the SQL and run CREATE TABLE statements first
    const statements = initSQLraw.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
    await promiseConn.query(`USE \`${DB_NAME}\`;`);
    for (const stmt of statements) {
      if (/^CREATE\s+TABLE/i.test(stmt)) {
        try { await promiseConn.query(stmt + ';'); } catch (e) { /* ignore */ }
      }
    }

    // Only seed if User table is empty
    const [rowsCount] = await promiseConn.query('SELECT COUNT(*) AS cnt FROM `User`');
    const cnt = rowsCount && rowsCount[0] ? rowsCount[0].cnt || rowsCount[0].CNT || 0 : 0;
    if (cnt === 0) {
      for (const stmt of statements) {
        if (!/^CREATE\s+TABLE/i.test(stmt)) {
          try { await promiseConn.query(stmt + ';'); } catch (e) { console.warn('Seed statement failed:', e.message || e); }
        }
      }
      console.log('MySQL database initialized with seed data.');
    } else {
      console.log('MySQL schema ensured; existing data preserved (seed skipped).');
    }
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

    // Use GROUP_CONCAT / group_concat for MySQL/SQLite compatibility and include the earliest report description
    const sql = `SELECT S.id, S.visibility, S.time as time, S.userReportID, S.latitude, S.longitude, U.username,
                         GROUP_CONCAT(G.name) AS ghost_names,
                         (SELECT SC.description FROM Sighting_Comment SC WHERE SC.sightingID = S.id ORDER BY SC.reportTime ASC LIMIT 1) AS description,
                         (SELECT MIN(SC.reportTime) FROM Sighting_Comment SC WHERE SC.sightingID = S.id) AS reportTime
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
      description: r.description || '',
      ghostType: r.ghost_names ? String(r.ghost_names).split(',')[0] : '',
      timeOfSighting: r.time ? String(r.time) : '',
      visibilityLevel: (r.visibility >= 8) ? 'Very Clear' : (r.visibility >=5 ? 'Clear' : 'Faint'),
      timestamp: r.reportTime ? new Date(r.reportTime) : (r.time ? new Date(r.time) : new Date())
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

// Create a new sighting
app.post('/api/sightings', async (req, res) => {
  const { userId, location, description, ghostType, timeOfSighting, visibilityLevel } = req.body || {};
  if (!userId || !location || !description || !ghostType) return res.status(400).json({ error: 'missing_fields' });

  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));

    // map visibility level to numeric
    const visMap = { 'Faint': 3, 'Clear': 6, 'Very Clear': 9 };
    const visibility = visMap[visibilityLevel] || 5;

    // Insert sighting
    if (dbClient.type === 'mysql') {
      const result = await dbClient.run('INSERT INTO Sighting (visibility, time, userReportID, latitude, longitude) VALUES (?, NOW(), ?, NULL, NULL)', [visibility, userId]);
      const sightingId = result.insertId;

      // Insert comment as the initial report; include reported time string inside description
      const repDesc = `Reported time: ${timeOfSighting || ''}\n${description}`;
      await dbClient.run('INSERT INTO Sighting_Comment (userID, sightingID, reportTime, description) VALUES (?, ?, NOW(), ?)', [userId, sightingId, repDesc]);

      // find or create ghost
      let ghosts = await dbClient.query('SELECT id FROM Ghost WHERE name = ? OR type = ? LIMIT 1', [ghostType, ghostType]);
      let ghostId = ghosts && ghosts.length ? ghosts[0].id : null;
      if (!ghostId) {
        const gres = await dbClient.run('INSERT INTO Ghost (type, name, description, visibility) VALUES (?, ?, ?, ?)', [ghostType, ghostType, '', visibility]);
        ghostId = gres.insertId;
      }

      await dbClient.run('INSERT INTO Sighting_Reports_Ghost (sightingID, ghostID) VALUES (?, ?)', [sightingId, ghostId]);

      // return created sighting
      const rows = await dbClient.query(`SELECT S.id, S.visibility, S.time as time, S.userReportID, U.username,
                                         (SELECT SC.description FROM Sighting_Comment SC WHERE SC.sightingID = S.id ORDER BY SC.reportTime ASC LIMIT 1) AS description,
                                         (SELECT MIN(SC.reportTime) FROM Sighting_Comment SC WHERE SC.sightingID = S.id) AS reportTime
                                         FROM Sighting S
                                         LEFT JOIN User U ON S.userReportID = U.id
                                         WHERE S.id = ?`, [sightingId]);
      const r = rows[0];
      return res.status(201).json({ id: r.id, userId: String(r.userReportID), username: r.username, location: location, description: r.description, ghostType, timeOfSighting: timeOfSighting || r.time, visibilityLevel: visibilityLevel || (r.visibility>=8?'Very Clear':(r.visibility>=5?'Clear':'Faint')), timestamp: r.reportTime || r.time });
    } else {
      const result = await dbClient.run('INSERT INTO Sighting (visibility, time, userReportID, latitude, longitude) VALUES (?, datetime(\'now\'), ?, NULL, NULL)', [visibility, userId]);
      const sightingId = result.lastID;

      const repDesc = `Reported time: ${timeOfSighting || ''}\n${description}`;
      await dbClient.run('INSERT INTO Sighting_Comment (userID, sightingID, reportTime, description) VALUES (?, ?, datetime(\'now\'), ?)', [userId, sightingId, repDesc]);

      let ghosts = await dbClient.query('SELECT id FROM Ghost WHERE name = ? OR type = ? LIMIT 1', [ghostType, ghostType]);
      let ghostId = ghosts && ghosts.length ? ghosts[0].id : null;
      if (!ghostId) {
        const gres = await dbClient.run('INSERT INTO Ghost (type, name, description, visibility) VALUES (?, ?, ?, ?)', [ghostType, ghostType, '', visibility]);
        ghostId = gres.lastID;
      }

      await dbClient.run('INSERT INTO Sighting_Reports_Ghost (sightingID, ghostID) VALUES (?, ?)', [sightingId, ghostId]);

      const rows = await dbClient.query(`SELECT S.id, S.visibility, S.time as time, S.userReportID, U.username,
                                         (SELECT SC.description FROM Sighting_Comment SC WHERE SC.sightingID = S.id ORDER BY SC.reportTime ASC LIMIT 1) AS description,
                                         (SELECT MIN(SC.reportTime) FROM Sighting_Comment SC WHERE SC.sightingID = S.id) AS reportTime
                                         FROM Sighting S
                                         LEFT JOIN User U ON S.userReportID = U.id
                                         WHERE S.id = ?`, [sightingId]);
      const r = rows[0];
      return res.status(201).json({ id: r.id, userId: String(r.userReportID), username: r.username, location: location, description: r.description, ghostType, timeOfSighting: timeOfSighting || r.time, visibilityLevel: visibilityLevel || (r.visibility>=8?'Very Clear':(r.visibility>=5?'Clear':'Faint')), timestamp: r.reportTime || r.time });
    }
  } catch (err) {
    console.error('Create sighting error:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

