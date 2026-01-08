import express from 'express';
import { requireAuth } from '../../auth.js';

const router = express.Router();

// Return current user info
router.get('/me', requireAuth, async (req, res) => {
    res.json(req.user);
});

export default router;
