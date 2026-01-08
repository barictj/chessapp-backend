import { pool } from './index.js';

// Create a bot (optional admin functionality)
export async function createBot({ name, difficulty, description }) {
    const [result] = await pool.query(
        `INSERT INTO bots (name, difficulty, description)
     VALUES (?, ?, ?)`,
        [name, difficulty, description]
    );
    return result.insertId;
}

// Get a bot by ID
export async function getBotById(id) {
    const [rows] = await pool.query(
        `SELECT id, name, difficulty, description, created_at
     FROM bots
     WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
}

// List all bots
export async function listBots() {
    const [rows] = await pool.query(
        `SELECT id, name, difficulty, description, created_at
     FROM bots
     ORDER BY id ASC`
    );
    return rows;
}
