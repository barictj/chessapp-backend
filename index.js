const express = require('express');
const cors = require('cors');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { configureAuth, requireAuth } = require('./auth');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  JWT_SECRET,
  BASE_URL,
} = process.env;

const app = express();

// Middleware
app.use(cors({ origin: ['http://localhost:19006'], credentials: true }));
app.use(express.json());
app.use(passport.initialize());

// Configure Google OAuth strategy
configureAuth({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: `${BASE_URL}/auth/google/callback`, // BASE_URL must be http://localhost:3000
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Google OAuth routes
app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/fail',
    session: false,
  }),
  (req, res) => {
    const token = jwt.sign(
      {
        sub: req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
      JWT_SECRET || 'dev-jwt',
      { expiresIn: '7d' }
    );

    // Redirect into Expo app via deep link
    res.redirect(`chessapp://auth?token=${token}`);
  }
);

app.get('/auth/fail', (req, res) =>
  res.status(401).json({ error: 'Authentication failed' })
);

// Example protected route
app.get('/api/secure', requireAuth, (req, res) => {
  res.json({
    message: `Hello ${req.user.name}, you are authenticated!`,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Backend running on port ${PORT}`)
);
