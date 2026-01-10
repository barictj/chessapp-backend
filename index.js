import express from 'express';
import cors from 'cors';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

import { requireAuth, configureAuth } from './auth.js';
import { initSchema } from './db/index.js';

// Route imports
import gamesRoutes from './src/routes/games.js';
import movesRoutes from './src/routes/moves.js';
import chatRoutes from './src/routes/chat.js';
import friendsRoutes from './src/routes/friends.js';
import notificationsRoutes from './src/routes/notifications.js';
import statsRoutes from './src/routes/stats.js';
import authRoutes from './src/routes/auth.js';

/* -------------------------
   GLOBAL READINESS FLAG
------------------------- */
global.dbReady = false;

/* -------------------------
   MYSQL POOL
------------------------- */
export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password:
    process.env.MYSQL_PASSWORD ||
    process.env.DB_PASSWORD ||
    '',
  database:
    process.env.MYSQL_DATABASE ||
    process.env.DB_NAME ||
    'chess_test',
  waitForConnections: true,
  connectionLimit: 10,
});

/* -------------------------
   DB WAIT LOOP
------------------------- */
async function waitForDB() {
  const maxRetries = 150;
  const delay = ms => new Promise(res => setTimeout(res, ms));

  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database is ready.');
      return;
    } catch {
      console.log(`DB not ready yet (${i + 1}/${maxRetries})...`);
      await delay(1000);
    }
  }

  throw new Error('Database did not become ready in time.');
}

/* -------------------------
   EXPRESS APP
------------------------- */
const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(passport.initialize());

/* -------------------------
   HEALTH ENDPOINT (CRITICAL)
------------------------- */
app.get('/health', (req, res) => {
  if (!global.dbReady) {
    return res.status(503).json({ status: 'starting' });
  }
  res.json({ status: 'ok' });
});

/* -------------------------
   AUTH CONFIG
------------------------- */
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  JWT_SECRET,
  BASE_URL,
} = process.env;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  configureAuth({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL || 'http://localhost:3000'}/auth/google/callback`,
  });
} else {
  console.warn(
    'Google OAuth not configured; skipping Google strategy.'
  );
}

/* -------------------------
   AUTH ROUTES
------------------------- */
app.get('/auth/google', (req, res, next) => {
  const redirectUri = req.query.redirect_uri;
  if (!redirectUri) {
    return res.status(400).send('Missing redirect_uri');
  }

  const state = Buffer.from(
    JSON.stringify({ redirectUri })
  ).toString('base64');

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/fail',
    session: false,
  }),
  (req, res) => {
    const state = JSON.parse(
      Buffer.from(req.query.state, 'base64').toString('utf8')
    );

    const token = jwt.sign(
      {
        sub: req.user.id,
        email: req.user.email,
        name: req.user.display_name || req.user.username,
      },
      JWT_SECRET || 'dev-jwt',
      { expiresIn: '7d' }
    );

    res.redirect(`${state.redirectUri}?token=${token}`);
  }
);

app.get('/auth/fail', (_req, res) =>
  res.status(401).json({ error: 'Authentication failed' })
);

/* -------------------------
   API ROUTES
------------------------- */
app.use('/api/games', gamesRoutes);
app.use('/api/moves', movesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/secure', requireAuth, (req, res) => {
  res.json({
    message: `Hello ${req.user.name}, you are authenticated!`,
  });
});

/* -------------------------
   START SERVER IMMEDIATELY
------------------------- */
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});

/* -------------------------
   DB INIT (ASYNC, NON-BLOCKING)
------------------------- */
(async () => {
  try {
    await waitForDB();
    await initSchema();
    global.dbReady = true;
    console.log('DB initialized and ready.');
  } catch (err) {
    console.error('Fatal DB init error:', err);
    process.exit(1);
  }
})();

/* -------------------------
   SAFETY NETS
------------------------- */
server.on('error', err => {
  console.error('Server failed to start', err);
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('Unhandled promise rejection', err);
});

process.on('uncaughtException', err => {
  console.error('Uncaught exception', err);
  process.exit(1);
});
