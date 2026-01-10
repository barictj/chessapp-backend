// src/services/games.js
import {
    createGame as dbCreateGame,
    listGamesForUser,
    activateGame,
    fetchGameById,
    completeGame as dbCompleteGame,
    abandonGame as dbAbandonGame
} from '../db/games.js';

import { pool } from '../db/index.js'; // adjust path if your pool lives elsewhere
import { Chess } from 'chess.js';
console.log('TRANSACTIONAL makeMove module loaded');

/**
 * Create a new game (wrapper around DB helper)
 * Keeps the same signature your routes expect: createGame(creatorId, opponentId, botId)
 */
export async function createGame(creatorId, opponentId = null, botId = null) {
    const white_user_id = Number(creatorId);
    const black_user_id = opponentId === null ? null : Number(opponentId);
    return await dbCreateGame({
        white_user_id,
        black_user_id,
        bot_id: botId
    });
}

/**
 * makeMove(gameId, userId, from, to, promotion)
 * - transactional: locks game row, computes move number, applies move, inserts move, updates games
 * - prefers from/to; accepts promotion; returns inserted move row + updated game state
 */
export async function makeMove(gameId, userId, from, to, promotion = null, requestId) {
    console.log("MAKE MOVE ARGS:", { gameId, userId, from, to, promotion, requestId });

    if (!requestId) {
        throw Object.assign(new Error('Missing requestId'), { code: 'MISSING_REQUEST_ID' });
    }

    let conn;
    let fenAfter; // visible to setImmediate verification
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Lock game row FIRST
        const [gameRows] = await conn.query(
            `SELECT * FROM games WHERE id = ? FOR UPDATE`,
            [gameId]
        );
        if (gameRows.length === 0) {
            throw Object.assign(new Error('Game not found'), { code: 'GAME_NOT_FOUND' });
        }
        const game = gameRows[0];

        // Idempotency check AFTER lock
        const [existing] = await conn.query(
            `SELECT * FROM moves WHERE game_id = ? AND request_id = ? LIMIT 1`,
            [gameId, requestId]
        );

        if (existing.length > 0) {
            await conn.commit();
            return {
                gameId,
                move: existing[0],
                fen: existing[0].fen_after,
                pgn: game.pgn,
                turn: game.turn,
                status: game.status,
                result: game.result,
                idempotent: true
            };
        }

        // Game must be active
        if (game.status === 'completed' || game.status === 'abandoned') {
            throw Object.assign(new Error('Game is not active'), { code: 'GAME_NOT_ACTIVE' });
        }

        // Determine player color
        let playerColor;
        if (Number(game.white_user_id) === Number(userId)) playerColor = 'w';
        else if (Number(game.black_user_id) === Number(userId)) playerColor = 'b';
        else throw Object.assign(new Error('User is not a player in this game'), { code: 'NOT_A_PLAYER' });

        // Use authoritative game.turn to check turn
        if (game.turn !== playerColor) {
            throw Object.assign(new Error('Not your turn'), { code: 'NOT_YOUR_TURN' });
        }

        // Normalize inputs
        if (typeof from === 'string') from = from.trim().toLowerCase();
        if (typeof to === 'string') to = to.trim().toLowerCase();
        if (promotion) promotion = String(promotion).trim().toLowerCase();

        //
        // --- RECONSTRUCT BOARD STATE using authoritative game.fen ---
        //
        const chess = new Chess(game.fen && game.fen !== 'startpos' ? game.fen : undefined);

        const [moves] = await conn.query(
            `SELECT from_square, to_square, san, request_id, fen_after
             FROM moves
             WHERE game_id = ?
             ORDER BY id ASC`,
            [gameId]
        );

        // If game.fen is present and matches last move's fen_after, no replay needed.
        // Otherwise, replay moves to reach current state (defensive).
        if (!game.fen || game.fen === 'startpos') {
            // already initialized from startpos
        } else {
            // If moves exist and last move's fen_after differs from game.fen, prefer game.fen as authoritative.
            // We still keep chess initialized from game.fen above.
        }

        console.log("DEBUG FEN BEFORE APPLY:", chess.fen(), { gameId, requestId });
        console.log("DEBUG MOVES REPLAYED:", moves, { gameId, requestId });

        const moveObj = { from, to };
        if (promotion) moveObj.promotion = promotion;
        console.log("DEBUG MOVE OBJ:", moveObj, { gameId, requestId });

        const applied = chess.move(moveObj);
        if (!applied) throw Object.assign(new Error(`Illegal move from ${from} to ${to}`), { code: 'INVALID_MOVE' });

        fenAfter = chess.fen();
        const pgn = chess.pgn();
        const nextTurn = chess.turn();
        const color = applied.color;

        //
        // --- INSERT MOVE with duplicate-insert handling ---
        //
        let newMoveId;
        try {
            // compute move_number defensively from existing moves count
            const [countRows] = await conn.query(
                `SELECT COUNT(*) AS cnt FROM moves WHERE game_id = ?`,
                [gameId]
            );
            const moveCount = Number(countRows[0].cnt);
            const moveNumber = Math.floor(moveCount / 2) + 1;

            const [insertResult] = await conn.query(
                `INSERT INTO moves
                 (game_id, move_number, player_color, san, from_square, to_square, fen_after, request_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [gameId, moveNumber, color, applied.san, from, to, fenAfter, requestId]
            );
            newMoveId = insertResult.insertId;
        } catch (err) {
            // Handle unique constraint race on (game_id, request_id)
            if (err && err.code === 'ER_DUP_ENTRY') {
                const [rows] = await conn.query(
                    `SELECT * FROM moves WHERE game_id = ? AND request_id = ? LIMIT 1`,
                    [gameId, requestId]
                );
                if (rows.length > 0) {
                    await conn.commit();
                    return {
                        gameId,
                        move: rows[0],
                        fen: rows[0].fen_after,
                        pgn: game.pgn,
                        turn: game.turn,
                        status: game.status,
                        result: game.result,
                        idempotent: true
                    };
                }
            }
            throw err;
        }

        //
        // --- UPDATE GAME ROW including last_move_id ---
        //
        const isCheckmate = chess.isCheckmate?.() || chess.in_checkmate?.();
        const isStalemate = chess.isStalemate?.() || chess.in_stalemate?.();
        const isInsufficient = chess.isInsufficientMaterial?.() || chess.insufficient_material?.();
        const isThreefold = chess.isThreefoldRepetition?.() || chess.in_threefold_repetition?.();
        const isDraw = chess.isDraw?.() || chess.in_draw?.();

        let newStatus = game.status;
        let newResult = null;

        if (isCheckmate) {
            newStatus = 'completed';
            newResult = color === 'w' ? 'white' : 'black';
        } else if (isStalemate || isInsufficient || isThreefold || isDraw) {
            newStatus = 'completed';
            newResult = 'draw';
        } else {
            newStatus = 'active';
        }

        if (newStatus === 'completed') {
            await conn.query(
                `UPDATE games
                 SET fen = ?, pgn = ?, turn = ?, status = ?, result = ?, last_move_id = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [fenAfter, pgn, nextTurn, newStatus, newResult, newMoveId, gameId]
            );
        } else {
            await conn.query(
                `UPDATE games
                 SET fen = ?, pgn = ?, turn = ?, status = ?, result = NULL, last_move_id = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [fenAfter, pgn, nextTurn, newStatus, newMoveId, gameId]
            );
        }

        //
        // --- COMMIT ---
        //
        await conn.commit();

        //
        // --- RETURN RESULT including authoritative game row ---
        //
        const [moveRows] = await conn.query(
            `SELECT * FROM moves WHERE id = ? LIMIT 1`,
            [newMoveId]
        );
        const [gameAfterRows] = await conn.query(
            `SELECT * FROM games WHERE id = ? LIMIT 1`,
            [gameId]
        );

        return {
            gameId,
            move: moveRows[0],
            game: gameAfterRows[0],
            fen: fenAfter,
            pgn,
            turn: nextTurn,
            status: newStatus,
            result: newResult
        };

    } catch (err) {
        if (conn) await conn.rollback();
        // rethrow structured errors as-is
        throw err;
    } finally {
        if (conn) conn.release();
    }

    // AFTER committing the move and releasing the connection
    setImmediate(async () => {
        try {
            if (!fenAfter) return;

            const verify = new Chess();

            const [allMoves] = await pool.query(
                `SELECT from_square, to_square, promotion FROM moves WHERE game_id = ? ORDER BY id ASC`,
                [gameId]
            );

            for (const m of allMoves) {
                const mv = { from: m.from_square, to: m.to_square };
                if (m.promotion) mv.promotion = m.promotion;
                verify.move(mv);
            }

            if (verify.fen() !== fenAfter) {
                console.error("FEN mismatch detected for game", gameId, { expected: fenAfter, actual: verify.fen() });
            }
        } catch (err) {
            console.error("FEN verify error for game", gameId, err);
        }
    });
}
// Get a single game (with access control)
export async function getGameById(gameId, userId) {
    return await fetchGameById(gameId, userId);
}

// List all games for a user
export async function getUserGames(userId) {
    return await listGamesForUser(Number(userId));
}

// Start a game (sets FEN, status, turn)
export async function startGame(gameId, userId) {
    // delegate to DB helper; ensure DB helper sets fen and turn correctly
    return await activateGame(gameId, userId);
}

// Complete a game
export async function completeGame(id, result) {
    await dbCompleteGame(id, result);
}

// Abandon a game
export async function abandonGame(id) {
    await dbAbandonGame(id);
}
