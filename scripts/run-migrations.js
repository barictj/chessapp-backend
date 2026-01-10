// scripts/run-migrations.js
import mysql from 'mysql2/promise';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'rootpass';
const DB_NAME = process.env.DB_NAME || 'chess_test';

(async function migrate() {
    let conn;
    try {
        conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS });

        // Create database if missing and switch to it
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
        await conn.changeUser({ database: DB_NAME });

        // Minimal games table
        await conn.query(`
      CREATE TABLE IF NOT EXISTS games (
        id INT PRIMARY KEY,
        white_user_id INT,
        black_user_id INT,
        fen TEXT NOT NULL,
        turn CHAR(1) NOT NULL,
        last_move_id INT DEFAULT NULL,
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

        // Minimal moves table
        await conn.query(`
      CREATE TABLE IF NOT EXISTS moves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        san VARCHAR(64),
        from_square VARCHAR(8),
        to_square VARCHAR(8),
        fen_after TEXT,
        request_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        UNIQUE KEY uq_moves_game_request (game_id, request_id)
      ) ENGINE=InnoDB;
    `);

        // Optional: ensure last_move_id column can reference moves.id (deferred FK not required for tests)
        // If you want a foreign key constraint for last_move_id, uncomment the block below:
        /*
        await conn.query(`
          ALTER TABLE games
          ADD CONSTRAINT fk_games_last_move
          FOREIGN KEY (last_move_id) REFERENCES moves(id)
          ON DELETE SET NULL
        `).catch(() => {});
        */

        console.log('Migrations applied to', DB_NAME);
        await conn.end();
        process.exit(0);
    } catch (err) {
        console.error('Migration failed', err);
        if (conn) await conn.end().catch(() => { });
        process.exit(1);
    }
})();
