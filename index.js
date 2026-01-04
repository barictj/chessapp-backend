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
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(passport.initialize());

// Configure Google OAuth strategy
configureAuth({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: `${BASE_URL}/auth/google/callback`,
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Google OAuth start — IMPORTANT: redirect_uri must be passed through manually
app.get('/auth/google', (req, res, next) => {
  const redirectUri = req.query.redirect_uri;

  if (!redirectUri) {
    return res.status(400).send("Missing redirect_uri");
  }

  // Store redirect URI in state param (encoded)
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
    // Decode redirectUri from state
    const state = JSON.parse(
      Buffer.from(req.query.state, 'base64').toString('utf8')
    );

    const redirectUri = state.redirectUri;

    const token = jwt.sign(
      {
        sub: req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
      JWT_SECRET || 'dev-jwt',
      { expiresIn: '7d' }
    );

    // Redirect back into Expo app
    res.redirect(`${redirectUri}?token=${token}`);
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
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});
