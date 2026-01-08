import {
    createNotification as dbCreateNotification,
    getNotificationsForUser,
    getUnreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification
} from '../db/notifications.js';

import { isBlocked } from './friends.js';

// Create a notification with block enforcement
export async function sendNotification({ user_id, from_user_id = null, type, payload }) {
    // If the notification is from another user, enforce blocking
    if (from_user_id && await isBlocked(user_id, from_user_id)) {
        return; // silently ignore
    }

    return dbCreateNotification({
        user_id,
        type,
        payload
    });
}

// Convenience wrappers for common notification types
export async function notifyGameInvite({ to, from, gameId }) {
    return sendNotification({
        user_id: to,
        from_user_id: from,
        type: 'game_invite',
        payload: { gameId, from }
    });
}

export async function notifyMoveMade({ to, gameId, move_number }) {
    return sendNotification({
        user_id: to,
        type: 'move_made',
        payload: { gameId, move_number }
    });
}

export async function notifyGameCompleted({ to, gameId, result }) {
    return sendNotification({
        user_id: to,
        type: 'game_completed',
        payload: { gameId, result }
    });
}

export async function notifyFriendRequest({ to, from }) {
    return sendNotification({
        user_id: to,
        from_user_id: from,
        type: 'friend_request',
        payload: { from }
    });
}

export async function notifyFriendAccepted({ to, from }) {
    return sendNotification({
        user_id: to,
        from_user_id: from,
        type: 'friend_accepted',
        payload: { from }
    });
}

// Fetch notifications
export async function getAllNotifications(user_id) {
    return getNotificationsForUser(user_id);
}

export async function getUnread(user_id) {
    return getUnreadNotifications(user_id);
}

// Mark notifications as read
export async function markRead(id) {
    return markNotificationRead(id);
}

export async function markAllRead(user_id) {
    return markAllNotificationsRead(user_id);
}

// Delete a notification
export async function removeNotification(id) {
    return deleteNotification(id);
}
