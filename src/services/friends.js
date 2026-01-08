import {
    sendFriendRequest as dbSendFriendRequest,
    acceptFriendRequest as dbAcceptFriendRequest,
    blockUser as dbBlockUser,
    getFriendStatus,
    listFriends,
    listIncomingRequests,
    listOutgoingRequests
} from '../db/friends.js';

// Check if either user has blocked the other
export async function isBlocked(userA, userB) {
    const statusAB = await getFriendStatus(userA, userB);
    const statusBA = await getFriendStatus(userB, userA);

    return statusAB === 'blocked' || statusBA === 'blocked';
}

// Send a friend request (with block enforcement)
export async function sendFriendRequest(user_id, friend_id) {
    if (await isBlocked(user_id, friend_id)) {
        throw new Error('Cannot send friend request — user is blocked');
    }

    return dbSendFriendRequest(user_id, friend_id);
}

// Accept a friend request (with block enforcement)
export async function acceptFriendRequest(user_id, friend_id) {
    if (await isBlocked(user_id, friend_id)) {
        throw new Error('Cannot accept friend request — user is blocked');
    }

    return dbAcceptFriendRequest(user_id, friend_id);
}

// Block a user
export async function blockUser(user_id, friend_id) {
    return dbBlockUser(user_id, friend_id);
}

// Unblock a user (set status back to pending or remove row)
export async function unblockUser(user_id, friend_id) {
    // simplest approach: delete the row entirely
    await pool.query(
        `DELETE FROM friends
     WHERE user_id = ? AND friend_id = ?`,
        [user_id, friend_id]
    );
}

// Get all accepted friends
export async function getFriendsList(user_id) {
    return listFriends(user_id);
}

// Get incoming friend requests
export async function getIncomingRequests(user_id) {
    return listIncomingRequests(user_id);
}

// Get outgoing friend requests
export async function getOutgoingRequests(user_id) {
    return listOutgoingRequests(user_id);
}
