import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';

import { findOrCreateGoogleUser } from './src/db/users.js';

import { pool } from './index.js';



export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token provided' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt');

        // debug: remove or lower verbosity in production
        console.log('Decoded token:', { sub: decoded.sub, iss: decoded.iss, aud: decoded.aud, exp: decoded.exp });

        const sub = decoded.sub;
        if (!sub) return res.status(401).json({ error: 'Invalid token payload' });

        let userRow;
        if (/^\d+$/.test(String(sub))) {
            // numeric sub: treat as internal DB id
            const [rows] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [Number(sub)]);
            userRow = rows[0];
        } else {
            // non-numeric sub: treat as provider id (google_id)
            const [rows] = await pool.query('SELECT id FROM users WHERE google_id = ? AND provider = ? LIMIT 1', [String(sub), 'google']);
            userRow = rows[0];
        }

        if (!userRow) return res.status(401).json({ error: 'User not found' });

        // downstream code should use req.user.id
        req.user = { id: userRow.id, tokenPayload: decoded };
        next();
    } catch (err) {
        console.error('Auth error', err);
        return res.status(401).json({ error: 'Invalid token' });
    }
}



// Google OAuth configuration
export function configureAuth({ clientID, clientSecret, callbackURL }) {
    console.log("GOOGLE STRATEGY ACTIVE");
    console.log("GOOGLE STRATEGY TYPE:", GoogleStrategy);
    console.log("CHECKING findOrCreateGoogleUser:", findOrCreateGoogleUser);
    console.log("CALLBACK URL:", callbackURL);

    passport.use(
        new GoogleStrategy(
            {
                clientID,
                clientSecret,
                callbackURL,
            },
            async (accessToken, refreshToken, profile, done) => {
                console.log("VERIFY CALLBACK FIRED");
                try {
                    const googleId = profile.id;
                    const email = profile.emails?.[0]?.value || null;
                    const displayName = profile.displayName;
                    const avatarUrl = profile.photos?.[0]?.value || null;

                    const user = await findOrCreateGoogleUser({
                        googleId,
                        email,
                        displayName,
                        avatarUrl,
                    });
                    console.log("GOOGLE USER FROM DB:", user);

                    return done(null, user);
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );
}
