// chess/backend/db/index.js
import { pool } from '../index.js';

import { usersTable } from './users.sql.js';
import { botsTable } from './bots.sql.js';
import { gamesTable } from './games.sql.js';
import { movesTable } from './moves.sql.js';
import { friendsTable } from './friends.sql.js';
import { chatTable } from './chat.sql.js';
import { playerstatsTable } from './playerstats.sql.js';
import { matchhistoryTable } from './matchhistory.sql.js';
import { uservsuserstatsTable } from './uservsuserstats.sql.js';
import { notificationsTable } from './notifications.sql.js';
import { leaderboardsTable } from './leaderboards.sql.js';

export async function initSchema() {
    const tables = [
        usersTable,
        botsTable,
        gamesTable,
        movesTable,
        friendsTable,
        chatTable,
        playerstatsTable,
        matchhistoryTable,
        uservsuserstatsTable,
        notificationsTable,
        leaderboardsTable,
    ];

    for (const sql of tables) {
        await pool.query(sql);
    }

    console.log("All tables created.");
}
