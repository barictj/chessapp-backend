import { Chess } from 'chess.js';
import { getMovesForGame } from '../db/moves.js';

// Load full game state by replaying all moves
export async function loadGameState(game_id) {
    const moves = await getMovesForGame(game_id);
    const chess = new Chess();

    for (const move of moves) {
        try {
            chess.move(move.san, { sloppy: true });
        } catch (err) {
            console.error(`Invalid historical move in DB: ${move.san}`, err);
        }
    }

    return chess;
}

// Validate a move without modifying DB
export async function validateMove(game_id, san) {
    const chess = await loadGameState(game_id);

    const result = chess.move(san, { sloppy: true });

    // If illegal, chess.move() returns null
    return result !== null;
}

// Apply a move and return updated FEN + status
export async function applyMove(game_id, san) {
    const chess = await loadGameState(game_id);

    const result = chess.move(san, { sloppy: true });
    if (!result) {
        throw new Error('Illegal move');
    }

    return {
        fen: chess.fen(),
        status: getGameStatus(chess)
    };
}

// Determine game status after a move
export function getGameStatus(chess) {
    if (chess.isCheckmate()) {
        return { state: 'checkmate', winner: chess.turn() === 'w' ? 'black' : 'white' };
    }

    if (chess.isStalemate()) {
        return { state: 'stalemate' };
    }

    if (chess.isThreefoldRepetition()) {
        return { state: 'threefold' };
    }

    if (chess.isInsufficientMaterial()) {
        return { state: 'insufficient_material' };
    }

    if (chess.isDraw()) {
        return { state: 'draw' };
    }

    if (chess.inCheck()) {
        return { state: 'check' };
    }

    return { state: 'active' };
}

// Detect if a move requires promotion
export async function requiresPromotion(game_id, san) {
    const chess = await loadGameState(game_id);

    const move = chess.move(san, { sloppy: true });

    if (!move) return false;

    // Pawn reaches last rank
    return (
        move.piece === 'p' &&
        (move.to.endsWith('8') || move.to.endsWith('1'))
    );
}
