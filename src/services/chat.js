import { addChatMessage, getChatForGame } from '../db/chat.js';
import { fetchGameById } from '../db/games.js';
import { isBlocked } from './friends.js';
import { createNotification } from '../db/notifications.js';

// Send a chat message inside a game
export async function sendChatMessage({ game_id, sender_id, message }) {
    const game = await fetchGameById(game_id);
    if (!game) throw new Error('Game not found');

    const { white_user_id, black_user_id, status } = game;

    // Game must be active or pending (some apps allow chat before start)
    if (status === 'completed' || status === 'abandoned') {
        throw new Error('Cannot chat in a completed or abandoned game');
    }

    // Sender must be a participant
    if (sender_id !== white_user_id && sender_id !== black_user_id) {
        throw new Error('You are not a participant in this game');
    }

    // Determine opponent
    const opponent_id =
        sender_id === white_user_id ? black_user_id : white_user_id;

    // Block enforcement
    if (await isBlocked(sender_id, opponent_id)) {
        throw new Error('Cannot send messages — user is blocked');
    }

    // Store the message
    const chatId = await addChatMessage({
        game_id,
        sender_id,
        message
    });

    // Notify opponent
    await createNotification({
        user_id: opponent_id,
        type: 'chat_message',
        payload: { game_id }
    });

    return chatId;
}

// Get chat history for a game
export async function getChatHistory(game_id, user_id) {
    const game = await getGameById(game_id);
    if (!game) throw new Error('Game not found');

    const { white_user_id, black_user_id } = game;

    // Only participants can view chat
    if (user_id !== white_user_id && user_id !== black_user_id) {
        throw new Error('You are not a participant in this game');
    }

    return getChatForGame(game_id);
}
