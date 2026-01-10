// ./tests/move-tests.js
import axios from 'axios';
import { Chess } from 'chess.js';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/games';
const GAME_ID = process.env.GAME_ID || '35';
const WHITE_TOKEN = process.env.WHITE_TOKEN; // "Bearer ..."
const BLACK_TOKEN = process.env.BLACK_TOKEN; // "Bearer ..."

if (!WHITE_TOKEN || !BLACK_TOKEN) {
    console.error('Set WHITE_TOKEN and BLACK_TOKEN env vars before running.');
    process.exit(1);
}

const gameUrl = `${BASE}/${GAME_ID}`;
const moveUrl = `${BASE}/${GAME_ID}/move`;

async function getGame() {
    const r = await axios.get(gameUrl, { headers: { Authorization: WHITE_TOKEN } }).catch(e => {
        if (e.response) return e.response;
        throw e;
    });
    return r.data;
}

function chooseMoveFromFen(fen) {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (!moves || moves.length === 0) return null;
    // Prefer a capture or promotion if available, otherwise first legal move
    const capture = moves.find(m => m.captured);
    if (capture) return capture;
    const promotion = moves.find(m => m.promotion);
    if (promotion) return promotion;
    return moves[0];
}

async function postMove(token, moveObj, requestId) {
    const body = {
        from: moveObj.from,
        to: moveObj.to,
        promotion: moveObj.promotion || undefined,
        request_id: requestId
    };
    try {
        const r = await axios.post(moveUrl, body, { headers: { Authorization: token } });
        return { ok: true, status: r.status, data: r.data };
    } catch (err) {
        if (err.response) return { ok: false, status: err.response.status, data: err.response.data };
        return { ok: false, status: 0, data: err.message };
    }
}

(async () => {
    console.log('Fetching game...');
    const game = await getGame();
    console.log('Game turn:', game.turn, 'FEN:', game.fen);

    const moveToPlay = chooseMoveFromFen(game.fen);
    if (!moveToPlay) {
        console.log('No legal moves available for this position.');
        return;
    }

    const token = game.turn === 'w' ? WHITE_TOKEN : BLACK_TOKEN;
    const reqId = `test-${Date.now()}`;

    console.log('Selected move:', `${moveToPlay.from}->${moveToPlay.to}`, 'san candidate:', moveToPlay.san || '(none)');
    console.log('Posting initial move with request_id', reqId);
    const first = await postMove(token, moveToPlay, reqId);
    console.log('First response:', first);

    console.log('Retrying same request_id (idempotency)');
    const retry = await postMove(token, moveToPlay, reqId);
    console.log('Retry response:', retry);

    console.log('Concurrent race test (two different request_ids)');
    // For concurrency, attempt two different request_ids for the same move
    const r1 = postMove(token, moveToPlay, `race-A-${Date.now()}`);
    const r2 = postMove(token, moveToPlay, `race-B-${Date.now() + 1}`);
    const results = await Promise.allSettled([r1, r2]);
    console.log('Concurrent results:', results);

    console.log('Done.');
})();
