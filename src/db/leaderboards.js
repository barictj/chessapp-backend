import { pool } from './index.js';

// Insert a leaderboard snapshot entry
export async function addLeaderboardEntry({ user_id, rating, rank_global, rank_friends }) {
    const [result] = await pool.query(
        `INSERT INTO leaderboards (user_id, rating, rank_global, rank_friends)
     VALUES (?, ?, ?, ?)`,
        [user_id, rating, rank_global, rank_friends]
    );

    return result.insertId;
}

// Get the latest leaderboard snapshot for all users
export async function getLatestLeaderboardSnapshot() {
    const [rows] = await pool.query(
        `SELECT l.*, u.username
     FROM leaderboards l
     JOIN users u ON u.id = l.user_id
     WHERE l.snapshot_at = (
       SELECT MAX(snapshot_at) FROM leaderboards
     )
     ORDER BY l.rank_global ASC`
    );

    return rows;
}

// Get leaderboard history for a specific user
export async function getLeaderboardHistoryForUser(user_id) {
    const [rows] = await pool.query(
        `SELECT *
     FROM leaderboards
     WHERE user_id = ?
     ORDER BY snapshot_at DESC`,
        [user_id]
    );

    return rows;
}

// Get the latest leaderboard entry for a specific user
export async function getLeaderboardForUser(user_id) {
    const [rows] = await pool.query(
        `SELECT *
     FROM leaderboards
     WHERE user_id = ?
     ORDER BY snapshot_at DESC
     LIMIT 1`,
        [user_id]
    );

    return rows[0] || null;
}
