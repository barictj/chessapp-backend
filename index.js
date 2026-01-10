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

// Create MySQL pool (shared across app)
export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});

// Environment variables
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  JWT_SECRET,
  BASE_URL,
} = process.env;
async function waitForDB() {
  const maxRetries = 50;
  const delay = ms => new Promise(res => setTimeout(res, ms));

  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("Database is ready.");
      return;
    } catch (err) {
      console.log(`DB not ready yet (${i + 1}/${maxRetries})...`);
      await delay(1000);
    }
  }

  throw new Error("Database did not become ready in time.");
}

// Create express app
const app = express();

// -------------------------
// ASYNC STARTUP WRAPPER
// -------------------------
(async () => {
  // Initialize DB before anything else
  await waitForDB();
  await initSchema();
  // Middleware
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use(passport.initialize());



  // Configure Google OAuth strategy
  configureAuth({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/auth/google/callback`,
  });
  console.log("STRATEGIES:", passport._strategies);
  // Health check
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Google OAuth start
  app.get('/auth/google', (req, res, next) => {
    const redirectUri = req.query.redirect_uri;

    if (!redirectUri) {
      return res.status(400).send("Missing redirect_uri");
    }

    const state = Buffer.from(JSON.stringify({ redirectUri })).toString('base64');

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state,
    })(req, res, next);
  });

  // Google OAuth callback
  app.get(
    '/auth/google/callback',
    passport.authenticate('google', {
      failureRedirect: '/auth/fail',
      session: false,
    }),
    (req, res) => {
      console.log("CALLBACK ROUTE HIT, REQ.QUERY:", req.query);
      const state = JSON.parse(
        Buffer.from(req.query.state, 'base64').toString('utf8')
      );

      const redirectUri = state.redirectUri;

      const token = jwt.sign(
        {
          sub: req.user.id,
          email: req.user.email,
          name: req.user.display_name || req.user.username,
        },
        JWT_SECRET || 'dev-jwt',
        { expiresIn: '7d' }
      );

      res.redirect(`${redirectUri}?token=${token}`);
    }
  );


  app.get('/auth/fail', (req, res) =>
    res.status(401).json({ error: 'Authentication failed' })
  );

  // Protected example route
  app.get('/api/secure', requireAuth, (req, res) => {
    res.json({
      message: `Hello ${req.user.name}, you are authenticated!`,
    });
  });

  // -------------------------
  // API ROUTES
  // -------------------------
  app.use('/api/games', gamesRoutes);
  app.use('/api/moves', movesRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/friends', friendsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/auth', authRoutes);

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
  });
})();
