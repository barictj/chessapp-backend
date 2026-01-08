import express from 'express';
import { requireAuth } from '../../auth.js';
import { makeMovesLegacy } from '../services/moves.js';

const router = express.Router();

// Submit a move
router.post('/:game_id', requireAuth, async (req, res) => {
    try {
        const { san, from_square, to_square } = req.body;

        const moveId = await makeMove({
            game_id: req.params.game_id,
            user_id: req.user.id,
            san,
            from_square,
            to_square
        });

        res.json({ move_id: moveId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
