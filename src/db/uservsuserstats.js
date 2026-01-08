import { pool } from './index.js';

// Initialize or ensure a head‑to‑head record exists
export async function initUserVsUser(user_id, opponent_id) {
    await pool.query(
        `INSERT INTO uservsuserstats (user_id, opponent_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
        [user_id, opponent_id]
    );
}

// Get head‑to‑head stats between two users
export async function getUserVsUserStats(user_id, opponent_id) {
    const [rows] = await pool.query(
        `SELECT *
     FROM uservsuserstats
     WHERE user_id = ? AND opponent_id = ?`,
        [user_id, opponent_id]
    );
    return rows[0] || null;
}

// Add a win to the head‑to‑head record
export async function addHeadToHeadWin(user_id, opponent_id) {
    await pool.query(
        `UPDATE uservsuserstats
     SET wins = wins + 1,
         games_played = games_played + 1
     WHERE user_id = ? AND opponent_id = ?`,
        [user_id, opponent_id]
    );
}

// Add a loss to the head‑to‑head record
export async function addHeadToHeadLoss(user_id, opponent_id) {
    await pool.query(
        `UPDATE uservsuserstats
     SET losses = losses + 1,
         games_played = games_played + 1
     WHERE user_id = ? AND opponent_id = ?`,
        [user_id, opponent_id]
    );
}

// Add a draw to the head‑to‑head record
export async function addHeadToHeadDraw(user_id, opponent_id) {
    await pool.query(
        `UPDATE uservsuserstats
     SET draws = draws + 1,
         games_played = games_played + 1
     WHERE user_id = ? AND opponent_id = ?`,
        [user_id, opponent_id]
    );
}
