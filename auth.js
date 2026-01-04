const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');

// Middleware to protect routes
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * IMPORTANT:
 * Expo cannot use localhost or 10.0.2.2 for Google OAuth.
 * Google blocks private IPs and requires device_id/device_name.
 *
 * So we use Expo's redirect URI instead:
 *
 *     chessapp:/oauthredirect
 *
 * This must be added to Google Cloud Console under:
 * OAuth 2.0 Client → Authorized redirect URIs
 */
const callbackURL = "chessapp:/oauthredirect";

// Configure Google OAuth
function configureAuth({ clientID, clientSecret }) {
    passport.use(
        new GoogleStrategy(
            {
                clientID,
                clientSecret,
                callbackURL,
            },
            (accessToken, refreshToken, profile, done) => {
                const user = {
                    id: profile.id,
                    email: profile.emails?.[0]?.value || null,
                    name: profile.displayName,
                    avatar: profile.photos?.[0]?.value || null,
                    provider: 'google',
                };
                return done(null, user);
            }
        )
    );
}

module.exports = { requireAuth, configureAuth };
