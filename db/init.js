import mysql from "mysql2/promise";

import { usersTable } from "./users.sql.js";
import { gamesTable } from "./games.sql.js";
import { movesTable } from "./moves.sql.js";
import { friendsTable } from "./friends.sql.js";
import { chatTable } from "./chat.sql.js";
import { leaderboardsTable } from "./leaderboards.sql.js";
import { matchhistoryTable } from "./matchhistory.sql.js";
import { notificationsTable } from "./notifications.sql.js";
import { playerstatsTable } from "./playerstats.sql.js";
import { uservsuserstatsTable } from "./uservsuserstats.sql.js";
import { botsTable } from "./bots.sql.js";

export async function initializeDatabase() {

    // -------------------------------------------------
    // WAIT FOR MYSQL TO BE READY BEFORE CONNECTING
    // -------------------------------------------------
    async function waitForMySQL() {
        const maxRetries = 50;
        const delay = ms => new Promise(res => setTimeout(res, ms));

        for (let i = 1; i <= maxRetries; i++) {
            try {
                const conn = await mysql.createConnection({
                    host: process.env.MYSQL_HOST,
                    user: process.env.MYSQL_USER,
                    password: process.env.MYSQL_PASSWORD,
                    multipleStatements: true,
                });
                return conn;
            } catch (err) {
                console.log(`MySQL not ready (attempt ${i}/${maxRetries})`);
                await delay(1500);
            }
        }

        throw new Error("MySQL did not become ready in time");
    }

    // Connect using retry logic
    const connection = await waitForMySQL();

    // -------------------------------------------------
    // CREATE DATABASE + SELECT IT
    // -------------------------------------------------
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.MYSQL_DATABASE}\`;`);
    await connection.query(`USE \`${process.env.MYSQL_DATABASE}\`;`);

    // -------------------------------------------------
    // TABLE CREATION ORDER (FOREIGN KEY SAFE)
    // -------------------------------------------------
    const tables = [
        usersTable,            // base table
        botsTable,             // games references bots
        gamesTable,            // moves/chat/matchhistory reference games
        movesTable,            // depends on games
        chatTable,             // depends on games + users
        friendsTable,          // depends on users
        matchhistoryTable,     // depends on users + games
        notificationsTable,    // depends on users
        leaderboardsTable,     // depends on users
        playerstatsTable,      // depends on users
        uservsuserstatsTable,  // depends on users
    ];

    // -------------------------------------------------
    // EXECUTE EACH TABLE CREATION STATEMENT
    // -------------------------------------------------
    for (const sql of tables) {
        try {
            await connection.query(sql);
        } catch (err) {
            console.error("Error creating table:", err);
        }
    }

    await connection.end();
}
