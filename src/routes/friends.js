import express from 'express';
import { requireAuth } from '../../auth.js';
import {
    sendFriendRequest,
    acceptFriendRequest,
    blockUser,
    unblockUser,
    getFriendsList
} from '../services/friends.js';

const router = express.Router();

// Send friend request
router.post('/request', requireAuth, async (req, res) => {
    try {
        const { to } = req.body;
        const result = await sendFriendRequest(req.user.id, to);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Accept friend request
router.post('/accept', requireAuth, async (req, res) => {
    try {
        const { from } = req.body;
        const result = await acceptFriendRequest(req.user.id, from);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Block user
router.post('/block', requireAuth, async (req, res) => {
    try {
        const { user_id } = req.body;
        const result = await blockUser(req.user.id, user_id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Unblock user
router.post('/unblock', requireAuth, async (req, res) => {
    try {
        const { user_id } = req.body;
        const result = await unblockUser(req.user.id, user_id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get friends list
router.get('/', requireAuth, async (req, res) => {
    try {
        const friends = await getFriendsList(req.user.id);
        res.json(friends);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
