import {
    getPlayerStats,
    initPlayerStats,
    addWin,
    addLoss,
    addDraw,
    updateRating
} from '../db/playerstats.js';

import {
    addMatchHistory,
    getMatchHistoryForUser
} from '../db/matchhistory.js';

import {
    initUserVsUser,
    addHeadToHeadWin,
    addHeadToHeadLoss,
    addHeadToHeadDraw,
    getUserVsUserStats
} from '../db/uservsuserstats.js';

import {
    addLeaderboardEntry,
    getLeaderboardForUser
} from '../db/leaderboards.js';

// Basic ELO-like rating adjustment (placeholder)
function calculateRatingChange(result, playerRating, opponentRating) {
    const K = 20;

    const expected =
        1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

    let score = 0.5;
    if (result === 'win') score = 1;
    if (result === 'loss') score = 0;

    const newRating = Math.round(playerRating + K * (score - expected));
    return newRating;
}

// Update stats after a completed game
export async function updateStatsAfterGame({
    game_id,
    white_user_id,
    black_user_id,
    result
}) {
    // Ensure stats rows exist
    await initPlayerStats(white_user_id);
    await initPlayerStats(black_user_id);

    const whiteStats = await getPlayerStats(white_user_id);
    const blackStats = await getPlayerStats(black_user_id);

    // Update wins/losses/draws
    if (result === 'white') {
        await addWin(white_user_id);
        await addLoss(black_user_id);
    } else if (result === 'black') {
        await addWin(black_user_id);
        await addLoss(white_user_id);
    } else {
        await addDraw(white_user_id);
        await addDraw(black_user_id);
    }

    // Update match history
    await addMatchHistory({
        user_id: white_user_id,
        game_id,
        result,
        opponent_id: black_user_id
    });

    await addMatchHistory({
        user_id: black_user_id,
        game_id,
        result,
        opponent_id: white_user_id
    });

    // Initialize head-to-head rows
    await initUserVsUser(white_user_id, black_user_id);

    // Update head-to-head stats
    if (result === 'white') {
        await addHeadToHeadWin(white_user_id, black_user_id);
        await addHeadToHeadLoss(black_user_id, white_user_id);
    } else if (result === 'black') {
        await addHeadToHeadWin(black_user_id, white_user_id);
        await addHeadToHeadLoss(white_user_id, black_user_id);
    } else {
        await addHeadToHeadDraw(white_user_id, black_user_id);
        await addHeadToHeadDraw(black_user_id, white_user_id);
    }

    // Rating adjustments
    const whiteNewRating = calculateRatingChange(
        result === 'white' ? 'win' : result === 'black' ? 'loss' : 'draw',
        whiteStats.rating,
        blackStats.rating
    );

    const blackNewRating = calculateRatingChange(
        result === 'black' ? 'win' : result === 'white' ? 'loss' : 'draw',
        blackStats.rating,
        whiteStats.rating
    );

    await updateRating(white_user_id, whiteNewRating);
    await updateRating(black_user_id, blackNewRating);

    // Leaderboard updates
    await addLeaderboardEntry({
        user_id: white_user_id,
        rating: whiteNewRating
    });

    await addLeaderboardEntry({
        user_id: black_user_id,
        rating: blackNewRating
    });

    return {
        white_rating: whiteNewRating,
        black_rating: blackNewRating
    };
}

// Get full stats for a user
export async function getFullStats(user_id) {
    await initPlayerStats(user_id);

    const stats = await getPlayerStats(user_id);
    const matches = await getMatchHistoryForUser(user_id);
    const leaderboard = await getLeaderboardForUser(user_id);

    // Head-to-head stats for all opponents
    const headToHead = await getUserVsUserStats(user_id);

    return {
        stats,
        matches,
        headToHead,
        leaderboard
    };
}
