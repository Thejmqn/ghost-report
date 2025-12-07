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

    // Get sightings with description from the Sighting table and ghost name
    const sql = `SELECT S.id, S.visibility, S.time as time, S.userReportID, S.latitude, S.longitude, S.description, U.username,
                         (SELECT G.name FROM Sighting_Reports_Ghost SRG 
                          LEFT JOIN Ghost G ON SRG.ghostID = G.id 
                          WHERE SRG.sightingID = S.id LIMIT 1) AS ghost_name
                  FROM Sighting S
                  LEFT JOIN User U ON S.userReportID = U.id
                  ORDER BY S.time DESC`;

    const rows = await dbClient.query(sql);

    const mapped = (rows || []).map((r) => ({
      id: String(r.id),
      visibility: Number(r.visibility || 0),
      time: r.time ? new Date(r.time) : new Date(),
      userReportID: String(r.userReportID || ''),
      latitude: (r.latitude !== undefined && r.latitude !== null) ? Number(r.latitude) : null,
      longitude: (r.longitude !== undefined && r.longitude !== null) ? Number(r.longitude) : null,
      description: r.description || '',
      ghostName: r.ghost_name || 'Unknown'
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
  console.log('Received sighting POST request:', JSON.stringify(req.body, null, 2));
  
  const { userId, userReportID, latitude, longitude, description, ghostID, timeOfSighting, visibility } = req.body || {};
  // Accept either `userReportID` (DB field) or `userId` (frontend alias)
  const reporter = userReportID || userId;
  
  console.log('Extracted values:', { reporter, latitude, longitude, description, ghostID, timeOfSighting, visibility });
  
  // Require essential fields
  if (!reporter || !description) {
    console.log('Missing required fields - reporter:', reporter, 'description:', description);
    return res.status(400).json({ error: 'missing_fields' });
  }

  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));

    // Use provided visibility or default to 5
    const visibilityNum = (visibility !== undefined && visibility !== null && !Number.isNaN(Number(visibility)))
      ? Number(visibility)
      : 5;

    // Build description that includes reported time
    const fullDescription = timeOfSighting 
      ? `Reported time: ${timeOfSighting}\n${description}`
      : description;

    // Insert sighting with description stored in the Sighting table
    if (dbClient.type === 'mysql') {
      const result = await dbClient.run(
        'INSERT INTO Sighting (visibility, time, userReportID, latitude, longitude, description) VALUES (?, NOW(), ?, ?, ?, ?)', 
        [visibilityNum, reporter, latitude || null, longitude || null, fullDescription]
      );
      const sightingId = result.insertId;

      // Handle ghost association
      let finalGhostId = null;
      
      if (ghostID && ghostID !== '') {
        // User selected a known ghost
        finalGhostId = ghostID;
      } else {
        // No ghost selected, create/find "Unknown" ghost
        let unknownGhosts = await dbClient.query('SELECT id FROM Ghost WHERE name = ? LIMIT 1', ['Unknown']);
        if (unknownGhosts && unknownGhosts.length > 0) {
          finalGhostId = unknownGhosts[0].id;
        } else {
          const gres = await dbClient.run('INSERT INTO Ghost (type, name, description, visibility) VALUES (?, ?, ?, ?)', ['Unknown', 'Unknown', 'Unidentified paranormal entity', visibilityNum]);
          finalGhostId = gres.insertId;
        }
      }

      // Link sighting to ghost
      if (finalGhostId) {
        await dbClient.run('INSERT INTO Sighting_Reports_Ghost (sightingID, ghostID) VALUES (?, ?)', [sightingId, finalGhostId]);
      }

      // Return created sighting
      const rows = await dbClient.query(
        'SELECT id, visibility, time, userReportID, latitude, longitude, description FROM Sighting WHERE id = ?', 
        [sightingId]
      );
      const r = rows[0];
      return res.status(201).json({
        id: String(r.id),
        visibility: Number(r.visibility || visibilityNum),
        time: r.time || new Date(),
        userReportID: String(r.userReportID || reporter),
        latitude: (r.latitude !== undefined && r.latitude !== null) ? Number(r.latitude) : null,
        longitude: (r.longitude !== undefined && r.longitude !== null) ? Number(r.longitude) : null,
        description: r.description || fullDescription
      });
    } else {
      // SQLite version
      const result = await dbClient.run(
        'INSERT INTO Sighting (visibility, time, userReportID, latitude, longitude, description) VALUES (?, datetime(\'now\'), ?, ?, ?, ?)', 
        [visibilityNum, reporter, latitude || null, longitude || null, fullDescription]
      );
      const sightingId = result.lastID;

      // Handle ghost association
      let finalGhostId = null;
      
      if (ghostID && ghostID !== '') {
        finalGhostId = ghostID;
      } else {
        let unknownGhosts = await dbClient.query('SELECT id FROM Ghost WHERE name = ? LIMIT 1', ['Unknown']);
        if (unknownGhosts && unknownGhosts.length > 0) {
          finalGhostId = unknownGhosts[0].id;
        } else {
          const gres = await dbClient.run('INSERT INTO Ghost (type, name, description, visibility) VALUES (?, ?, ?, ?)', ['Unknown', 'Unknown', 'Unidentified paranormal entity', visibilityNum]);
          finalGhostId = gres.lastID;
        }
      }

      if (finalGhostId) {
        await dbClient.run('INSERT INTO Sighting_Reports_Ghost (sightingID, ghostID) VALUES (?, ?)', [sightingId, finalGhostId]);
      }

      const rows = await dbClient.query(
        'SELECT id, visibility, time, userReportID, latitude, longitude, description FROM Sighting WHERE id = ?', 
        [sightingId]
      );
      const r = rows[0];
      return res.status(201).json({
        id: String(r.id),
        visibility: Number(r.visibility || visibilityNum),
        time: r.time || new Date(),
        userReportID: String(r.userReportID || reporter),
        latitude: (r.latitude !== undefined && r.latitude !== null) ? Number(r.latitude) : null,
        longitude: (r.longitude !== undefined && r.longitude !== null) ? Number(r.longitude) : null,
        description: r.description || fullDescription
      });
    }
  } catch (err) {
    console.error('Create sighting error:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// GET comments for a specific sighting
app.get('/api/sightings/:sightingId/comments', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const sightingId = req.params.sightingId;
    
    const sql = `SELECT SC.userID, SC.sightingID, SC.reportTime, SC.description, U.username
                 FROM Sighting_Comment SC
                 LEFT JOIN User U ON SC.userID = U.id
                 WHERE SC.sightingID = ?
                 ORDER BY SC.reportTime ASC`;
    
    const rows = await dbClient.query(sql, [sightingId]);
    
    const comments = (rows || []).map((r) => ({
      userID: String(r.userID),
      sightingID: String(r.sightingID),
      reportTime: r.reportTime,
      description: r.description || '',
      username: r.username || `User ${r.userID}`
    }));
    
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST a comment on a sighting
app.post('/api/sightings/:sightingId/comments', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const sightingId = req.params.sightingId;
    const { userID, description } = req.body || {};
    
    if (!userID || !description) {
      return res.status(400).json({ error: 'userID and description are required' });
    }
    
    // Check if this user has already commented on this sighting
    // According to schema, PRIMARY KEY (userID, sightingID) means one comment per user per sighting
    const existing = await dbClient.query(
      'SELECT * FROM Sighting_Comment WHERE userID = ? AND sightingID = ?',
      [userID, sightingId]
    );
    
    if (existing && existing.length > 0) {
      // User already commented, update the existing comment
      if (dbClient.type === 'mysql') {
        await dbClient.run(
          'UPDATE Sighting_Comment SET description = ?, reportTime = NOW() WHERE userID = ? AND sightingID = ?',
          [description, userID, sightingId]
        );
      } else {
        await dbClient.run(
          'UPDATE Sighting_Comment SET description = ?, reportTime = datetime(\'now\') WHERE userID = ? AND sightingID = ?',
          [description, userID, sightingId]
        );
      }
      
      return res.status(200).json({ 
        userID, 
        sightingID: sightingId, 
        description,
        message: 'Comment updated'
      });
    } else {
      // Insert new comment
      if (dbClient.type === 'mysql') {
        await dbClient.run(
          'INSERT INTO Sighting_Comment (userID, sightingID, reportTime, description) VALUES (?, ?, NOW(), ?)',
          [userID, sightingId, description]
        );
      } else {
        await dbClient.run(
          'INSERT INTO Sighting_Comment (userID, sightingID, reportTime, description) VALUES (?, ?, datetime(\'now\'), ?)',
          [userID, sightingId, description]
        );
      }
      
      return res.status(201).json({ 
        userID, 
        sightingID: sightingId, 
        description 
      });
    }
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// PUT update ghost name for a sighting (updates the first linked ghost)
app.put('/api/sightings/:sightingId/ghost-name', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const sightingId = req.params.sightingId;
    const { newName } = req.body || {};

    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ error: 'newName is required' });
    }

    // Find a ghost linked to this sighting
    const linked = await dbClient.query('SELECT ghostID FROM Sighting_Reports_Ghost WHERE sightingID = ? LIMIT 1', [sightingId]);
    if (!linked || linked.length === 0) {
      return res.status(404).json({ error: 'no_ghost_linked' });
    }

    const ghostId = linked[0].ghostID || linked[0].ghostId || linked[0].id;
    if (!ghostId) return res.status(500).json({ error: 'invalid_ghost_id' });

    // Update the ghost name
    if (dbClient.type === 'mysql') {
      await dbClient.run('UPDATE `Ghost` SET `name` = ? WHERE id = ?', [newName, ghostId]);
    } else {
      await dbClient.run('UPDATE Ghost SET name = ? WHERE id = ?', [newName, ghostId]);
    }

    return res.json({ success: true, ghostId, newName });
  } catch (err) {
    console.error('Error updating ghost name:', err);
    return res.status(500).json({ error: 'internal' });
  }
});