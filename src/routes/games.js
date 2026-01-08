// src/routes/games.js
import express from 'express';
import { requireAuth } from '../../auth.js';
// replace existing import line for clarity and safety
import {
    createGame,
    getGameById,
    getUserGames,
    startGame,
    makeMove as makeMoveTransactional
} from '../services/games.js';


const router = express.Router();

// POST /games/:id/move
router.post('/:id/move', requireAuth, async (req, res) => {
    console.log('ROUTE /:id/move body:', req.body);

    try {
        const gameId = Number(req.params.id);
        const userId = Number(req.user?.id ?? req.user?.sub);

        // normalize body fields (drop-in)
        const fromSquare = req.body.from || req.body.from_square || req.body.fromSquare || req.body.fromSquareRaw;
        const toSquare = req.body.to || req.body.to_square || req.body.toSquare || req.body.toSquareRaw;
        const promotion = req.body.promotion || req.body.promote || null;

        if (!fromSquare || !toSquare) return res.status(400).json({ error: 'Missing from or to' });

        const result = await makeMoveTransactional(
            gameId,
            userId,
            String(fromSquare).trim().toLowerCase(),
            String(toSquare).trim().toLowerCase(),
            promotion
        );

        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});



// routes/games.js
router.post('/', requireAuth, async (req, res) => {
    try {
        const creatorId = req.user && req.user.id;
        if (!creatorId) return res.status(401).json({ error: 'Unauthorized' });

        const { opponent_id = null, bot_id = null } = req.body;

        // optional: validate opponent_id is a number or null
        if (opponent_id !== null && isNaN(Number(opponent_id))) {
            return res.status(400).json({ error: 'Invalid opponent_id' });
        }

        const gameId = await createGame(creatorId, opponent_id, bot_id);
        return res.status(201).json({ id: gameId });
    } catch (err) {
        console.error('Create game error', err);
        return res.status(400).json({ error: err.message });
    }
});


// POST /games/:id/start
router.post('/:id/start', requireAuth, async (req, res) => {
    try {
        const game = await startGame(req.params.id, req.user.sub);
        res.json(game);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// routes/games.js
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const gameId = Number(req.params.id);
        const userId = req.user && (req.user.id ?? Number(req.user.sub));
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const game = await getGameById(gameId, userId);
        res.json(game);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// GET /games
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = Number(req.user?.id ?? req.user?.sub);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const games = await getUserGames(userId);
        res.json(games);
    } catch (err) {
        console.error('GET /games error', err);
        res.status(400).json({ error: err.message });
    }
});


export default router;
