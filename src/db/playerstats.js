import { pool } from './index.js';

// Initialize stats for a new user
export async function initPlayerStats(user_id) {
    await pool.query(
        `INSERT INTO playerstats (user_id)
     VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
        [user_id]
    );
}

// Get stats for a user
export async function getPlayerStats(user_id) {
    const [rows] = await pool.query(
        `SELECT *
     FROM playerstats
     WHERE user_id = ?`,
        [user_id]
    );
    return rows[0] || null;
}

// Increment wins
export async function addWin(user_id) {
    await pool.query(
        `UPDATE playerstats
     SET wins = wins + 1,
         games_played = games_played + 1,
         last_played_at = NOW()
     WHERE user_id = ?`,
        [user_id]
    );
}

// Increment losses
export async function addLoss(user_id) {
    await pool.query(
        `UPDATE playerstats
     SET losses = losses + 1,
         games_played = games_played + 1,
         last_played_at = NOW()
     WHERE user_id = ?`,
        [user_id]
    );
}

// Increment draws
export async function addDraw(user_id) {
    await pool.query(
        `UPDATE playerstats
     SET draws = draws + 1,
         games_played = games_played + 1,
         last_played_at = NOW()
     WHERE user_id = ?`,
        [user_id]
    );
}

// Update rating
export async function updateRating(user_id, newRating) {
    await pool.query(
        `UPDATE playerstats
     SET rating = ?,
         last_played_at = NOW()
     WHERE user_id = ?`,
        [newRating, user_id]
    );
}
