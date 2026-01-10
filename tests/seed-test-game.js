// scripts/seed-test-game.js
import mysql from 'mysql2/promise';

const GAME_ID = process.env.GAME_ID || 35;
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'rootpass';
const DB_NAME = process.env.DB_NAME || 'chess_test';

async function seed() {
    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME });
    // remove any existing test game
    await conn.execute('DELETE FROM moves WHERE game_id = ?', [GAME_ID]);
    await conn.execute('DELETE FROM games WHERE id = ?', [GAME_ID]);

    // insert a reproducible game row (adjust columns to your schema)
    await conn.execute(
        `INSERT INTO games (id, white_user_id, black_user_id, fen, turn, status, created_at, updated_at)
     VALUES (?, 1, 2, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w', 'active', NOW(), NOW())`,
        [GAME_ID]
    );

    console.log('Seeded test game id', GAME_ID);
    await conn.end();
}

seed().catch(err => {
    console.error('Seed failed', err);
    process.exit(1);
});
