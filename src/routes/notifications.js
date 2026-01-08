import express from 'express';
import { requireAuth } from '../../auth.js';
import {
    getAllNotifications,
    getUnread,
    markRead,
    markAllRead,
    removeNotification
} from '../services/notifications.js';

const router = express.Router();

// Get all notifications
router.get('/', requireAuth, async (req, res) => {
    try {
        const list = await getAllNotifications(req.user.id);
        res.json(list);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get unread notifications
router.get('/unread', requireAuth, async (req, res) => {
    try {
        const list = await getUnread(req.user.id);
        res.json(list);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Mark one as read
router.post('/read/:id', requireAuth, async (req, res) => {
    try {
        await markRead(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Mark all as read
router.post('/read-all', requireAuth, async (req, res) => {
    try {
        await markAllRead(req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete notification
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await removeNotification(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
