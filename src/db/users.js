// src/db/users.js
import { pool } from './index.js';
import { normalizeUsername } from '../utils/username.js'; // adjust path if needed

const MAX_USERNAME_ATTEMPTS = 1000;

/**
 * Helper: try to insert a user row.
 * Accepts both local and google provider shapes.
 */
async function tryInsertUser({ username, email, passwordHash = null, googleId = null, displayName = null, avatarUrl = null, provider = 'local' }) {
    const sql = `
    INSERT INTO users (username, email, password_hash, google_id, display_name, avatar_url, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
    return pool.query(sql, [username, email, passwordHash, googleId, displayName, avatarUrl, provider]);
}

/**
 * Parse duplicate-key error to determine which unique index caused it.
 * MySQL messages look like: "Duplicate entry 'x' for key 'users.username'"
 */
function parseDuplicateKey(err) {
    const msg = err.sqlMessage || err.message || '';
    const m = msg.match(/for key '?(?:`?([^`']+)`?)'?$/i);
    if (!m) return null;
    // m[1] might be index name like users.username or ux_users_email etc.
    const key = m[1].toLowerCase();
    if (key.includes('email')) return 'email';
    if (key.includes('username')) return 'username';
    if (key.includes('google') || key.includes('google_id') || key.includes('provider')) return 'google_id';
    return key;
}

/**
 * Create a LOCAL user (email + password).
 * Ensures username uniqueness by suffixing if needed.
 * Returns the inserted user's id.
 */
export async function createUser({ username, email, passwordHash }) {
    const normalizedEmail = String(email).toLowerCase();
    const base = normalizeUsername(username) || `user${Date.now()}`;
    let attempt = 0;

    while (attempt < MAX_USERNAME_ATTEMPTS) {
        const candidate = attempt === 0 ? base : `${base}-${attempt}`;
        try {
            const [result] = await tryInsertUser({
                username: candidate,
                email: normalizedEmail,
                passwordHash,
                provider: 'local'
            });
            return result.insertId;
        } catch (err) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                const dupKey = parseDuplicateKey(err);
                // If email conflict, return existing user id
                if (dupKey === 'email') {
                    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
                    if (rows.length) return rows[0].id;
                    // If we couldn't find it, rethrow to avoid silent failure
                    throw err;
                }
                // If username conflict, try next suffix
                if (dupKey === 'username' || dupKey === null) {
                    attempt += 1;
                    continue;
                }
            }
            throw err;
        }
    }

    throw new Error('Unable to generate unique username for local user');
}

/**
 * Find or create a Google user. Uses googleId and email for identity,
 * generates unique username (from profileUsername or email local part),
 * and retries on username collisions by appending numeric suffixes.
 *
 * Returns the full user row.
 */
export async function findOrCreateGoogleUser({ googleId, email, displayName, avatarUrl, profileUsername = null }) {
    const normalizedEmail = String(email).toLowerCase();

    // 1) existing by google_id
    const [byId] = await pool.query('SELECT * FROM users WHERE google_id = ? LIMIT 1', [googleId]);
    if (byId.length) return byId[0];

    // 2) existing by email (fallback)
    const [byEmail] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (byEmail.length) return byEmail[0];

    // 3) derive base username: prefer explicit profile username, else local part of email, else displayName
    const emailLocal = normalizedEmail.split('@')[0] || `user${Date.now()}`;
    const rawBase = profileUsername || emailLocal || displayName || `user${Date.now()}`;
    const base = normalizeUsername(rawBase) || `user${Date.now()}`;

    // 4) attempt inserts with suffix loop
    let attempt = 0;
    while (attempt < MAX_USERNAME_ATTEMPTS) {
        const candidate = attempt === 0 ? base : `${base}-${attempt}`;
        try {
            const [result] = await tryInsertUser({
                username: candidate,
                email: normalizedEmail,
                googleId,
                displayName,
                avatarUrl,
                provider: 'google'
            });
            const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [result.insertId]);
            return rows[0];
        } catch (err) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                const dupKey = parseDuplicateKey(err);
                // If email conflict, return existing user by email
                if (dupKey === 'email') {
                    const [existing] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
                    if (existing.length) return existing[0];
                    throw err;
                }
                // If google_id conflict (rare), return existing by google_id
                if (dupKey === 'google_id') {
                    const [existing] = await pool.query('SELECT * FROM users WHERE google_id = ? LIMIT 1', [googleId]);
                    if (existing.length) return existing[0];
                    throw err;
                }
                // username conflict: increment suffix and retry
                attempt += 1;
                continue;
            }
            throw err;
        }
    }

    throw new Error('Unable to generate unique username for Google user after many attempts');
}

/**
 * Get user by ID
 */
export async function getUserById(id) {
    const [rows] = await pool.query(
        `SELECT id, username, email, display_name, avatar_url, is_active, created_at
     FROM users
     WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
}

/**
 * Get user by email (normalizes email)
 * Returns full user row (including password_hash) so callers can check auth.
 */
export async function getUserByEmail(email) {
    const normalizedEmail = String(email).toLowerCase();
    const [rows] = await pool.query(
        `SELECT id, username, email, password_hash, display_name, avatar_url, provider
     FROM users
     WHERE email = ?`,
        [normalizedEmail]
    );
    return rows[0] || null;
}

/**
 * Update profile fields
 */
export async function updateUserProfile(id, { display_name, avatar_url }) {
    await pool.query(
        `UPDATE users
     SET display_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
        [display_name, avatar_url, id]
    );
}

/**
 * List all users
 */
export async function listUsers() {
    const [rows] = await pool.query(
        `SELECT id, username, email, display_name, avatar_url, created_at
     FROM users
     ORDER BY created_at DESC`
    );
    return rows;
}
