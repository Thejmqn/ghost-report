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

// Add these endpoints to your server.js file, before app.listen()

// GET sightings for a specific ghost
app.get('/api/ghosts/:ghostId/sightings', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const ghostId = req.params.ghostId;
    
    const sql = `SELECT S.id, S.visibility, S.time, S.userReportID, S.latitude, S.longitude, S.description, U.username
                 FROM Sighting S
                 INNER JOIN Sighting_Reports_Ghost SRG ON S.id = SRG.sightingID
                 LEFT JOIN User U ON S.userReportID = U.id
                 WHERE SRG.ghostID = ?
                 ORDER BY S.time DESC`;
    
    const rows = await dbClient.query(sql, [ghostId]);
    
    const mapped = (rows || []).map((r) => ({
      id: String(r.id),
      visibility: Number(r.visibility || 0),
      time: r.time ? new Date(r.time) : new Date(),
      userReportID: String(r.userReportID || ''),
      latitude: (r.latitude !== undefined && r.latitude !== null) ? Number(r.latitude) : null,
      longitude: (r.longitude !== undefined && r.longitude !== null) ? Number(r.longitude) : null,
      description: r.description || '',
      username: r.username || 'Unknown'
    }));
    
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching ghost sightings:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET comments for a specific ghost
app.get('/api/ghosts/:ghostId/comments', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const ghostId = req.params.ghostId;
    
    const sql = `SELECT GC.userID, GC.ghostID, GC.reportTime, GC.description, U.username
                 FROM Ghost_Comment GC
                 LEFT JOIN User U ON GC.userID = U.id
                 WHERE GC.ghostID = ?
                 ORDER BY GC.reportTime ASC`;
    
    const rows = await dbClient.query(sql, [ghostId]);
    
    const comments = (rows || []).map((r) => ({
      userID: String(r.userID),
      ghostID: String(r.ghostID),
      reportTime: r.reportTime,
      description: r.description || '',
      username: r.username || `User ${r.userID}`
    }));
    
    res.json(comments);
  } catch (err) {
    console.error('Error fetching ghost comments:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST a comment on a ghost
app.post('/api/ghosts/:ghostId/comments', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const ghostId = req.params.ghostId;
    const { userID, description } = req.body || {};
    
    if (!userID || !description) {
      return res.status(400).json({ error: 'userID and description are required' });
    }
    
    // Check if this user has already commented on this ghost
    // According to schema, PRIMARY KEY (userID, ghostID) means one comment per user per ghost
    const existing = await dbClient.query(
      'SELECT * FROM Ghost_Comment WHERE userID = ? AND ghostID = ?',
      [userID, ghostId]
    );
    
    if (existing && existing.length > 0) {
      // User already commented, update the existing comment
      if (dbClient.type === 'mysql') {
        await dbClient.run(
          'UPDATE Ghost_Comment SET description = ?, reportTime = NOW() WHERE userID = ? AND ghostID = ?',
          [description, userID, ghostId]
        );
      } else {
        await dbClient.run(
          'UPDATE Ghost_Comment SET description = ?, reportTime = datetime(\'now\') WHERE userID = ? AND ghostID = ?',
          [description, userID, ghostId]
        );
      }
      
      return res.status(200).json({ 
        userID, 
        ghostID: ghostId, 
        description,
        message: 'Comment updated'
      });
    } else {
      // Insert new comment
      if (dbClient.type === 'mysql') {
        await dbClient.run(
          'INSERT INTO Ghost_Comment (userID, ghostID, reportTime, description) VALUES (?, ?, NOW(), ?)',
          [userID, ghostId, description]
        );
      } else {
        await dbClient.run(
          'INSERT INTO Ghost_Comment (userID, ghostID, reportTime, description) VALUES (?, ?, datetime(\'now\'), ?)',
          [userID, ghostId, description]
        );
      }
      
      return res.status(201).json({ 
        userID, 
        ghostID: ghostId, 
        description 
      });
    }
  } catch (err) {
    console.error('Error posting ghost comment:', err);
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

// GET ghost buster status for a user
app.get('/api/users/:id/ghost-buster', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const userId = req.params.id;
    const rows = await dbClient.query('SELECT userID, ghosts_busted, alias FROM Ghost_Buster WHERE userID = ?', [userId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_a_ghost_buster' });
    const r = rows[0];
    return res.json({ isGhostBuster: true, ghosts_busted: Number(r.ghosts_busted || 0), alias: r.alias || null });
  } catch (err) {
    console.error('Error fetching ghost buster status:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// PUT toggle ghost buster status for a user
app.put('/api/users/:id/ghost-buster', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const userId = req.params.id;
    const { isGhostBuster } = req.body || {};

    if (typeof isGhostBuster !== 'boolean') return res.status(400).json({ error: 'isGhostBuster boolean required' });

    if (isGhostBuster) {
      // create if not exists
      const existing = await dbClient.query('SELECT userID, ghosts_busted, alias FROM Ghost_Buster WHERE userID = ?', [userId]);
      if (existing && existing.length > 0) {
        const e = existing[0];
        return res.json({ isGhostBuster: true, ghosts_busted: Number(e.ghosts_busted || 0), alias: e.alias || null });
      }

      // Insert with defaults: ghosts_busted = 0, alias = NULL
      if (dbClient.type === 'mysql') {
        await dbClient.run('INSERT INTO `Ghost_Buster` (userID, ghosts_busted, alias) VALUES (?, ?, ?)', [userId, 0, null]);
      } else {
        await dbClient.run('INSERT INTO Ghost_Buster (userID, ghosts_busted, alias) VALUES (?, ?, ?)', [userId, 0, null]);
      }

      return res.status(201).json({ isGhostBuster: true, ghosts_busted: 0, alias: null });
    } else {
      // remove entry if exists
      await dbClient.run('DELETE FROM Ghost_Buster WHERE userID = ?', [userId]);
      return res.json({ isGhostBuster: false });
    }
  } catch (err) {
    console.error('Error toggling ghost buster status:', err);
    return res.status(500).json({ error: 'internal' });
  }
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

// Add these endpoints to your server.js file, before app.listen()

// GET all tours with ghost count, signup count, and user signup status
app.get('/api/tours', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const userId = req.query.userId;

    const sql = `
      SELECT 
        T.id, 
        T.startTime, 
        T.endTime, 
        T.guide, 
        T.path,
        (SELECT COUNT(*) FROM Tour_Includes TI WHERE TI.tourID = T.id) AS ghostCount,
        (SELECT COUNT(*) FROM Tour_Sign_Up TSU WHERE TSU.tourID = T.id) AS signupCount,
        ${userId ? `(SELECT COUNT(*) FROM Tour_Sign_Up TSU2 WHERE TSU2.tourID = T.id AND TSU2.userID = ?) AS isSignedUp` : '0 AS isSignedUp'}
      FROM Tour T
      ORDER BY T.startTime DESC
    `;

    const params = userId ? [userId] : [];
    const rows = await dbClient.query(sql, params);

    const mapped = (rows || []).map((r) => ({
      id: String(r.id),
      startTime: r.startTime,
      endTime: r.endTime,
      guide: r.guide || 'Unknown Guide',
      path: r.path || '',
      ghostCount: Number(r.ghostCount || 0),
      signupCount: Number(r.signupCount || 0),
      isSignedUp: Number(r.isSignedUp || 0) > 0
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching tours:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST create a new tour
app.post('/api/tours', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const { guide, path, startTime, endTime, ghostIDs } = req.body || {};

    if (!guide || !path || !startTime || !endTime) {
      return res.status(400).json({ error: 'guide, path, startTime, and endTime are required' });
    }

    if (!ghostIDs || !Array.isArray(ghostIDs) || ghostIDs.length === 0) {
      return res.status(400).json({ error: 'at least one ghost must be selected' });
    }

    // Insert tour
    let tourId;
    if (dbClient.type === 'mysql') {
      const result = await dbClient.run(
        'INSERT INTO Tour (startTime, endTime, guide, path) VALUES (?, ?, ?, ?)',
        [startTime, endTime, guide, path]
      );
      tourId = result.insertId;
    } else {
      const result = await dbClient.run(
        'INSERT INTO Tour (startTime, endTime, guide, path) VALUES (?, ?, ?, ?)',
        [startTime, endTime, guide, path]
      );
      tourId = result.lastID;
    }

    // Insert ghost associations
    for (const ghostID of ghostIDs) {
      await dbClient.run(
        'INSERT INTO Tour_Includes (tourID, ghostID) VALUES (?, ?)',
        [tourId, ghostID]
      );
    }

    res.status(201).json({ id: tourId, guide, path, startTime, endTime });
  } catch (err) {
    console.error('Error creating tour:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET ghosts for a specific tour
app.get('/api/tours/:tourId/ghosts', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const tourId = req.params.tourId;

    const sql = `
      SELECT G.id, G.type, G.name, G.description, G.visibility
      FROM Ghost G
      INNER JOIN Tour_Includes TI ON G.id = TI.ghostID
      WHERE TI.tourID = ?
    `;

    const rows = await dbClient.query(sql, [tourId]);
    res.json(rows || []);
  } catch (err) {
    console.error('Error fetching tour ghosts:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET participants for a specific tour
app.get('/api/tours/:tourId/participants', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const tourId = req.params.tourId;

    const sql = `
      SELECT U.id, U.username
      FROM User U
      INNER JOIN Tour_Sign_Up TSU ON U.id = TSU.userID
      WHERE TSU.tourID = ?
    `;

    const rows = await dbClient.query(sql, [tourId]);
    
    const mapped = (rows || []).map((r) => ({
      id: String(r.id),
      username: r.username || 'Unknown'
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching tour participants:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST join a tour
app.post('/api/tours/:tourId/join', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const tourId = req.params.tourId;
    const { userID } = req.body || {};

    if (!userID) {
      return res.status(400).json({ error: 'userID is required' });
    }

    // Check if already signed up
    const existing = await dbClient.query(
      'SELECT * FROM Tour_Sign_Up WHERE userID = ? AND tourID = ?',
      [userID, tourId]
    );

    if (existing && existing.length > 0) {
      return res.status(200).json({ message: 'already_signed_up' });
    }

    // Sign up for tour
    await dbClient.run(
      'INSERT INTO Tour_Sign_Up (userID, tourID) VALUES (?, ?)',
      [userID, tourId]
    );

    res.status(201).json({ userID, tourID: tourId });
  } catch (err) {
    console.error('Error joining tour:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// DELETE leave a tour
app.delete('/api/tours/:tourId/leave', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const tourId = req.params.tourId;
    const { userID } = req.body || {};

    if (!userID) {
      return res.status(400).json({ error: 'userID is required' });
    }

    await dbClient.run(
      'DELETE FROM Tour_Sign_Up WHERE userID = ? AND tourID = ?',
      [userID, tourId]
    );

    res.json({ message: 'left_tour' });
  } catch (err) {
    console.error('Error leaving tour:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET list of ghosts the user is fighting
app.get('/api/users/:id/fights', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const userId = req.params.id;
    const rows = await dbClient.query('SELECT ghostID FROM Ghost_Buster_Fights_Ghost WHERE userID = ?', [userId]);
    const ghostIds = (rows || []).map(r => r.ghostID || r.ghostId || r.id).filter(Boolean);
    return res.json({ fighting: ghostIds });
  } catch (err) {
    console.error('Error fetching fights:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// PUT toggle fighting a ghost for a user
app.put('/api/users/:id/fights/:ghostId', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const userId = req.params.id;
    const ghostId = req.params.ghostId;
    const { fighting } = req.body || {};

    if (typeof fighting !== 'boolean') return res.status(400).json({ error: 'fighting boolean required' });

    if (fighting) {
      // insert if not exists
      const existing = await dbClient.query('SELECT * FROM Ghost_Buster_Fights_Ghost WHERE userID = ? AND ghostID = ?', [userId, ghostId]);
      if (existing && existing.length > 0) {
        return res.json({ fighting: true, ghostId, userId });
      }
      await dbClient.run('INSERT INTO Ghost_Buster_Fights_Ghost (userID, ghostID) VALUES (?, ?)', [userId, ghostId]);
      return res.status(201).json({ fighting: true, ghostId, userId });
    } else {
      // remove
      await dbClient.run('DELETE FROM Ghost_Buster_Fights_Ghost WHERE userID = ? AND ghostID = ?', [userId, ghostId]);
      return res.json({ fighting: false, ghostId, userId });
    }
  } catch (err) {
    console.error('Error toggling fight:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// PUT update alias for a ghost buster (creates row if missing)
app.put('/api/users/:id/ghost-buster/alias', async (req, res) => {
  try {
    while (!dbClient) await new Promise(r => setTimeout(r, 50));
    const userId = req.params.id;
    const { alias } = req.body || {};

    if (alias !== null && alias !== undefined && typeof alias !== 'string') {
      return res.status(400).json({ error: 'alias must be a string or null' });
    }

    const existing = await dbClient.query('SELECT userID FROM Ghost_Buster WHERE userID = ?', [userId]);
    if (existing && existing.length > 0) {
      // update
      await dbClient.run('UPDATE Ghost_Buster SET alias = ? WHERE userID = ?', [alias, userId]);
      return res.json({ alias: alias ?? null });
    } else {
      // create a new ghost buster row with default ghosts_busted=0
      await dbClient.run('INSERT INTO Ghost_Buster (userID, ghosts_busted, alias) VALUES (?, ?, ?)', [userId, 0, alias || null]);
      return res.status(201).json({ alias: alias || null });
    }
  } catch (err) {
    console.error('Error updating ghost buster alias:', err);
    return res.status(500).json({ error: 'internal' });
  }
});