import { pool } from './index.js';

// Add a chat message to a game
export async function addChatMessage({ game_id, sender_id, message }) {
    const [result] = await pool.query(
        `INSERT INTO chat (game_id, sender_id, message)
     VALUES (?, ?, ?)`,
        [game_id, sender_id, message]
    );
    return result.insertId;
}

// Get all chat messages for a game (ordered)
export async function getChatForGame(gameId) {
    const [rows] = await pool.query(
        `SELECT c.id, c.game_id, c.sender_id, c.message, c.created_at,
            u.username AS sender_username
     FROM chat c
     JOIN users u ON u.id = c.sender_id
     WHERE c.game_id = ?
     ORDER BY c.created_at ASC`,
        [gameId]
    );
    return rows;
}

// Get the latest chat message for a game
export async function getLatestChatMessage(gameId) {
    const [rows] = await pool.query(
        `SELECT *
     FROM chat
     WHERE game_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
        [gameId]
    );
    return rows[0] || null;
}

// Delete all chat for a game (admin/moderation)
export async function deleteChatForGame(gameId) {
    await pool.query(
        `DELETE FROM chat
     WHERE game_id = ?`,
        [gameId]
    );
}
