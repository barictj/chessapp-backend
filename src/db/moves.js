import { pool } from './index.js';

// Add a move to a game
export async function addMove({
    game_id,
    move_number,
    player_color,
    san,
    from_square,
    to_square
}) {
    const [result] = await pool.query(
        `INSERT INTO moves (
        game_id,
        move_number,
        player_color,
        san,
        from_square,
        to_square
     )
     VALUES (?, ?, ?, ?, ?, ?)`,
        [game_id, move_number, player_color, san, from_square, to_square]
    );

    return result.insertId;
}

// Get all moves for a game (ordered)
export async function getMovesForGame(gameId) {
    const [rows] = await pool.query(
        `SELECT *
     FROM moves
     WHERE game_id = ?
     ORDER BY move_number ASC`,
        [gameId]
    );
    return rows;
}

// Get the latest move for a game
export async function getLatestMove(gameId) {
    const [rows] = await pool.query(
        `SELECT *
     FROM moves
     WHERE game_id = ?
     ORDER BY move_number DESC
     LIMIT 1`,
        [gameId]
    );
    return rows[0] || null;
}

// Count moves for a game
export async function countMoves(gameId) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS count
     FROM moves
     WHERE game_id = ?`,
        [gameId]
    );
    return rows[0].count;
}
