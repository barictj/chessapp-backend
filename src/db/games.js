// src/db/games.js

import { pool } from './index.js';

export async function createGame({ white_user_id, black_user_id = null, bot_id = null }) {
    console.log("createGame params:", { white_user_id, black_user_id, bot_id });

    const sql = "INSERT INTO games (white_user_id, black_user_id, bot_id, status) VALUES (?, ?, ?, 'pending')";
    console.log("SQL:", sql);

    const [result] = await pool.query(sql, [white_user_id, black_user_id, bot_id]);
    return result.insertId;
}


// Complete a game (set result + timestamps)
export async function completeGame(id, result) {
    await pool.query(
        `UPDATE games
     SET status = 'completed',
         result = ?,
         completed_at = NOW()
     WHERE id = ?`,
        [result, id]
    );
}

// Abandon a game
export async function abandonGame(id) {
    await pool.query(
        `UPDATE games
     SET status = 'abandoned',
         result = 'abandoned',
         completed_at = NOW()
     WHERE id = ?`,
        [id]
    );
}

export async function listGamesForUser(userId) {
    const uid = Number(userId);
    const [rows] = await pool.query(
        `SELECT *
     FROM games
     WHERE white_user_id = ?
        OR black_user_id = ?
     ORDER BY created_at DESC`,
        [uid, uid]
    );
    return rows;
}

export async function updateGameFen(id, fen) {
    await pool.query(
        `UPDATE games
         SET fen = ?
         WHERE id = ?`,
        [fen, id]
    );
}
export async function updateGameStatus(id, status) {
    await pool.query(
        `UPDATE games
         SET status = ?
         WHERE id = ?`,
        [status, id]
    );
}
export async function activateGame(gameId, userId) {
    const startingFEN =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    // Only allow the creator/participant to start the game
    const [gameRows] = await pool.query(
        `SELECT * FROM games WHERE id = ?`,
        [gameId]
    );

    if (gameRows.length === 0) throw new Error("Game not found");
    const game = gameRows[0];

    if (game.white_user_id !== userId && game.black_user_id !== userId) {
        throw new Error("You are not a participant in this game");
    }

    await pool.query(
        `UPDATE games
         SET status = 'active',
             fen = ?,
             current_turn = white_user_id,
             started_at = NOW()
         WHERE id = ?`,
        [startingFEN, gameId]
    );

    const [updated] = await pool.query(
        `SELECT * FROM games WHERE id = ?`,
        [gameId]
    );

    return updated[0];
}

export async function fetchGameById(gameId, userId) {
    const [rows] = await pool.query(
        `SELECT * FROM games WHERE id = ? AND (white_user_id = ? OR black_user_id = ?)`,
        [Number(gameId), Number(userId), Number(userId)]
    );

    if (rows.length === 0) {
        throw new Error("Game not found or access denied");
    }
    return rows[0];
}
