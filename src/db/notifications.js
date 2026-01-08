import { pool } from './index.js';

// Create a notification
export async function createNotification({ user_id, type, payload }) {
    const [result] = await pool.query(
        `INSERT INTO notification (user_id, type, payload)
     VALUES (?, ?, ?)`,
        [user_id, type, JSON.stringify(payload)]
    );

    return result.insertId;
}

// Get all notifications for a user
export async function getNotificationsForUser(user_id) {
    const [rows] = await pool.query(
        `SELECT *
     FROM notification
     WHERE user_id = ?
     ORDER BY created_at DESC`,
        [user_id]
    );

    return rows;
}

// Get unread notifications for a user
export async function getUnreadNotifications(user_id) {
    const [rows] = await pool.query(
        `SELECT *
     FROM notification
     WHERE user_id = ? AND is_read = 0
     ORDER BY created_at DESC`,
        [user_id]
    );

    return rows;
}

// Mark a notification as read
export async function markNotificationRead(id) {
    await pool.query(
        `UPDATE notification
     SET is_read = 1
     WHERE id = ?`,
        [id]
    );
}

// Mark all notifications as read for a user
export async function markAllNotificationsRead(user_id) {
    await pool.query(
        `UPDATE notification
     SET is_read = 1
     WHERE user_id = ?`,
        [user_id]
    );
}

// Delete a notification
export async function deleteNotification(id) {
    await pool.query(
        `DELETE FROM notification
     WHERE id = ?`,
        [id]
    );
}
