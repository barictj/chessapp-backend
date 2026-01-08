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
export async function makeMove(gameId, userId, from, to, promotion = null) {
    console.log('TRANSACTIONAL makeMove invoked', { gameId, userId, from, to });

    let conn;
    try {
        console.log('makeMove: acquiring DB connection');
        conn = await pool.getConnection();
        console.log('makeMove: acquired DB connection');

        await conn.beginTransaction();

        // Lock game row
        const [games] = await conn.query(`SELECT * FROM games WHERE id = ? FOR UPDATE`, [gameId]);
        console.log(
            'makeMove: games rows length:',
            games.length,
            'firstRow:',
            games[0]
                ? {
                    id: games[0].id,
                    fen: games[0].fen,
                    turn: games[0].turn,
                    status: games[0].status,
                    white_user_id: games[0].white_user_id,
                    black_user_id: games[0].black_user_id
                }
                : null
        );
        if (games.length === 0) throw new Error('Game not found');
        const game = games[0];

        if (game.status === 'completed' || game.status === 'abandoned') throw new Error('Game is not active');

        // Determine player color
        let playerColor;
        if (Number(game.white_user_id) === Number(userId)) playerColor = 'w';
        else if (Number(game.black_user_id) === Number(userId)) playerColor = 'b';
        else throw new Error('User is not a player in this game');

        // Compute move count and move number inside transaction
        const [countRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM moves WHERE game_id = ?`, [gameId]);
        const moveCount = Number(countRows[0].cnt); // number of moves already stored
        const moveNumber = Math.floor(moveCount / 2) + 1; // 1-based move number
        const expectedColor = (moveCount % 2 === 0) ? 'w' : 'b'; // if 0 moves -> white to move

        // DEBUG: show moveCount/turn expectations so we can trace why execution stops
        console.log('makeMove: moveCount:', moveCount, 'moveNumber:', moveNumber, 'expectedColor:', expectedColor, 'playerColor (so far):', playerColor);

        if (expectedColor !== playerColor) throw new Error('Not your turn');

        // Normalize inputs
        if (typeof from === 'string') from = from.trim().toLowerCase();
        if (typeof to === 'string') to = to.trim().toLowerCase();
        if (promotion) promotion = String(promotion).trim().toLowerCase();

        // Build chess position from game.fen or fallback to last fen_after, then replay moves if needed
        let chess;
        let loaded = false;

        // 1) Try to initialize chess from game.fen using constructor (works across versions)
        try {
            if (game.fen && game.fen !== 'startpos') {
                chess = new Chess(game.fen);
                // If constructor didn't throw, consider it loaded
                loaded = true;
                console.log('makeMove: initialized chess from game.fen via constructor');
            } else {
                chess = new Chess();
            }
        } catch (e) {
            // constructor failed for this fen; fall back to empty board and try last fen_after
            chess = new Chess();
            loaded = false;
            console.warn('makeMove: constructor init from game.fen failed:', e && e.message);
        }

        // 2) If not loaded, try last fen_after from moves
        if (!loaded) {
            try {
                const [lastFenRows] = await conn.query(
                    `SELECT fen_after FROM moves WHERE game_id = ? AND fen_after IS NOT NULL ORDER BY id DESC LIMIT 1`,
                    [gameId]
                );
                if (lastFenRows && lastFenRows.length > 0 && lastFenRows[0].fen_after) {
                    try {
                        // try constructor with last fen_after
                        chess = new Chess(lastFenRows[0].fen_after);
                        loaded = true;
                        console.log('makeMove: initialized chess from last moves.fen_after via constructor');
                    } catch (e) {
                        loaded = false;
                        console.warn('makeMove: constructor init from last fen_after failed:', e && e.message);
                    }
                }
            } catch (e) {
                loaded = false;
            }
        }

        console.log('makeMove: loadedFromGameFen:', loaded, 'game.fen length:', game.fen ? game.fen.length : 0);

        // 3) If still not loaded, replay moves (deterministic: try from/to first, then SAN)
        if (!loaded) {
            console.log('makeMove: replaying moves to reconstruct position');

            // fetch moves to replay
            const [rows] = await conn.query(
                `SELECT id, san, from_square, to_square, fen_after FROM moves WHERE game_id = ? ORDER BY id ASC`,
                [gameId]
            );

            // log after rows is available
            console.log('makeMove: replay rows count:', rows.length);

            for (const m of rows) {
                // if a fen_after exists and can be loaded, prefer it (fast path)
                if (m.fen_after) {
                    try {
                        const testChess = new Chess(m.fen_after);
                        // if constructor succeeded, replace chess and continue
                        chess = testChess;
                        continue;
                    } catch (e) {
                        // ignore and try to apply move
                    }
                }

                // debug: show board before attempting this replay move
                console.log('makeMove: before replay move, chess.fen():', chess.fen(), 'attempting move row:', m);

                // Try applying by from/to first (deterministic)
                let applied = null;
                if (m.from_square && m.to_square) {
                    try {
                        applied = chess.move({ from: m.from_square, to: m.to_square, promotion: 'q' });
                    } catch (e) {
                        applied = null;
                    }
                }

                // If from/to didn't apply, try SAN with sloppy parsing
                if (!applied && m.san) {
                    try {
                        applied = chess.move(m.san, { sloppy: true });
                    } catch (e) {
                        applied = null;
                    }
                }

                // debug: show whether applied and board after attempt
                console.log('makeMove: after replay attempt, applied:', !!applied, 'chess.fen():', chess.fen());

                if (!applied) {
                    console.error('makeMove: failed to replay move row:', m);
                    throw new Error(`Failed to replay moves to recover game state (failing move id=${m.id})`);
                }
            }
        }

        // DEBUG: inspect request + board state (remove/comment out after debugging)
        console.log('MOVE REQ seen by service:', { gameId, userId, from, to, promotion });
        console.log('Loaded FEN:', chess.fen());
        console.log('chess.turn():', chess.turn());
        console.log('Piece at from:', chess.get(from));
        console.log('Legal moves from', from, ':', chess.moves({ square: from }));

        // Apply incoming move (prefer from/to)
        let applied = null;
        if (from && to) {
            const moveObj = { from, to };
            if (promotion) moveObj.promotion = promotion;
            applied = chess.move(moveObj);
        } else {
            throw new Error('Invalid move payload: from and to required');
        }

        if (!applied) {
            // server-side log for debugging (commented out in production)
            // console.error('Illegal move', { gameId, userId, from, to, fen: chess.fen(), turn: chess.turn(), legal: chess.moves({ square: from }) });
            throw new Error(`Illegal move from ${from} to ${to}`);
        }

        // Prepare metadata
        const fenAfter = chess.fen();
        const pgn = chess.pgn();
        const nextTurn = chess.turn(); // 'w' or 'b'
        const color = applied.color; // 'w' or 'b'

        // Insert move
        const [insertResult] = await conn.query(
            `INSERT INTO moves (game_id, move_number, player_color, san, from_square, to_square, fen_after)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [gameId, moveNumber, color, applied.san, from, to, fenAfter]
        );
        const newMoveId = insertResult.insertId;

        // Determine game status/result
        const isCheckmate = typeof chess.isCheckmate === 'function' ? chess.isCheckmate() : (typeof chess.in_checkmate === 'function' ? chess.in_checkmate() : false);
        const isStalemate = typeof chess.isStalemate === 'function' ? chess.isStalemate() : (typeof chess.in_stalemate === 'function' ? chess.in_stalemate() : false);
        const isInsufficient = typeof chess.isInsufficientMaterial === 'function' ? chess.isInsufficientMaterial() : (typeof chess.insufficient_material === 'function' ? chess.insufficient_material() : false);
        const isThreefold = typeof chess.isThreefoldRepetition === 'function' ? chess.isThreefoldRepetition() : (typeof chess.in_threefold_repetition === 'function' ? chess.in_threefold_repetition() : false);
        const isDraw = typeof chess.isDraw === 'function' ? chess.isDraw() : (typeof chess.in_draw === 'function' ? chess.in_draw() : false);

        let newStatus = game.status;
        let newResult = null;
        if (isCheckmate) {
            newStatus = 'completed';
            newResult = (color === 'w') ? 'white' : 'black';
        } else if (isStalemate || isInsufficient || isThreefold || isDraw) {
            newStatus = 'completed';
            newResult = 'draw';
        } else {
            newStatus = 'active';
        }

        // Update games row (no optional columns required)
        if (newStatus === 'completed') {
            await conn.query(
                `UPDATE games SET fen = ?, pgn = ?, turn = ?, status = ?, result = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [fenAfter, pgn, nextTurn, newStatus, newResult, gameId]
            );
        } else {
            await conn.query(
                `UPDATE games SET fen = ?, pgn = ?, turn = ?, status = ?, result = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [fenAfter, pgn, nextTurn, newStatus, gameId]
            );
        }

        // Fetch inserted move row
        const [moveRows] = await conn.query(`SELECT * FROM moves WHERE id = ? LIMIT 1`, [newMoveId]);
        const insertedMove = moveRows[0];

        await conn.commit();

        return {
            gameId,
            move: insertedMove,
            fen: fenAfter,
            pgn,
            turn: nextTurn,
            status: newStatus,
            result: newResult
        };
    } catch (err) {
        if (conn) await conn.rollback();
        throw err;
    } finally {
        if (conn) conn.release();
    }
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
