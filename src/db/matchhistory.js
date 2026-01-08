import { pool } from './index.js';

// Add a match history entry
export async function addMatchHistory({
    user_id,
    game_id,
    result,
    opponent_id
}) {
    const [resultObj] = await pool.query(
        `INSERT INTO matchhistory (user_id, game_id, result, opponent_id)
     VALUES (?, ?, ?, ?)`,
        [user_id, game_id, result, opponent_id]
    );

    return resultObj.insertId;
}

// Get match history for a user
export async function getMatchHistoryForUser(user_id) {
    const [rows] = await pool.query(
        `SELECT mh.*, u.username AS opponent_username
     FROM matchhistory mh
     LEFT JOIN users u ON u.id = mh.opponent_id
     WHERE mh.user_id = ?
     ORDER BY mh.created_at DESC`,
        [user_id]
    );

    return rows;
}

// Get match history for a specific game (both players)
export async function getMatchHistoryForGame(game_id) {
    const [rows] = await pool.query(
        `SELECT *
     FROM matchhistory
     WHERE game_id = ?
     ORDER BY created_at ASC`,
        [game_id]
    );

    return rows;
}

// Delete match history for a game (admin/moderation)
export async function deleteMatchHistoryForGame(game_id) {
    await pool.query(
        `DELETE FROM matchhistory
     WHERE game_id = ?`,
        [game_id]
    );
}
