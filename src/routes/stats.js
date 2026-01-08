import express from 'express';
import { requireAuth } from '../../auth.js';
import { getFullStats } from '../services/stats.js';

const router = express.Router();

// Get full stats for logged-in user
router.get('/', requireAuth, async (req, res) => {
    try {
        const stats = await getFullStats(req.user.id);
        res.json(stats);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
