// migrations/20260106_create_moves_table.js (or include in your existing migration runner)
export const movesTable = `
-- create moves table (references games)
CREATE TABLE IF NOT EXISTS moves (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id BIGINT UNSIGNED NOT NULL,
  move_number INT NOT NULL,
  player_color ENUM('w','b') NOT NULL,
  san VARCHAR(64) NOT NULL,
  from_square VARCHAR(5) NOT NULL,
  to_square VARCHAR(5) NOT NULL,
  fen_after VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_moves_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  UNIQUE KEY uq_moves_game_move (game_id, move_number, player_color),
  INDEX idx_moves_game (game_id),
  INDEX idx_moves_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;
