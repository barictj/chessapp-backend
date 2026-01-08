import express from 'express';
import { requireAuth } from '../../auth.js';
import {
    sendChatMessage,
    getChatHistory
} from '../services/chat.js';

const router = express.Router();

// Send chat message
router.post('/:game_id', requireAuth, async (req, res) => {
    try {
        const { message } = req.body;

        const id = await sendChatMessage({
            game_id: req.params.game_id,
            sender_id: req.user.id,
            message
        });

        res.json({ chat_id: id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get chat history
router.get('/:game_id', requireAuth, async (req, res) => {
    try {
        const chat = await getChatHistory(req.params.game_id, req.user.id);
        res.json(chat);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
