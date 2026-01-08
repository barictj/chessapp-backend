import { pool } from './index.js';

// Send a friend request
export async function sendFriendRequest(user_id, friend_id) {
    const [result] = await pool.query(
        `INSERT INTO friends (user_id, friend_id, status)
     VALUES (?, ?, 'pending')
     ON DUPLICATE KEY UPDATE status = 'pending'`,
        [user_id, friend_id]
    );
    return result.insertId;
}

// Accept a friend request
export async function acceptFriendRequest(user_id, friend_id) {
    await pool.query(
        `UPDATE friends
     SET status = 'accepted'
     WHERE user_id = ? AND friend_id = ?`,
        [user_id, friend_id]
    );
}

// Block a user
export async function blockUser(user_id, friend_id) {
    await pool.query(
        `UPDATE friends
     SET status = 'blocked'
     WHERE user_id = ? AND friend_id = ?`,
        [user_id, friend_id]
    );
}

// Get friendship status between two users
export async function getFriendStatus(user_id, friend_id) {
    const [rows] = await pool.query(
        `SELECT status
     FROM friends
     WHERE user_id = ? AND friend_id = ?`,
        [user_id, friend_id]
    );
    return rows[0]?.status || null;
}

// List accepted friends for a user
export async function listFriends(user_id) {
    const [rows] = await pool.query(
        `SELECT friend_id AS id
     FROM friends
     WHERE user_id = ? AND status = 'accepted'`,
        [user_id]
    );
    return rows;
}

// List pending friend requests (incoming)
export async function listIncomingRequests(user_id) {
    const [rows] = await pool.query(
        `SELECT user_id AS id
     FROM friends
     WHERE friend_id = ? AND status = 'pending'`,
        [user_id]
    );
    return rows;
}

// List pending friend requests (outgoing)
export async function listOutgoingRequests(user_id) {
    const [rows] = await pool.query(
        `SELECT friend_id AS id
     FROM friends
     WHERE user_id = ? AND status = 'pending'`,
        [user_id]
    );
    return rows;
}
