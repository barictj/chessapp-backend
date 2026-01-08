export const gamesTable = `


CREATE TABLE IF NOT EXISTS games (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  white_user_id BIGINT UNSIGNED NOT NULL,
  black_user_id BIGINT UNSIGNED DEFAULT NULL,
  bot_id BIGINT UNSIGNED DEFAULT NULL,
  status ENUM('pending','active','completed','abandoned') NOT NULL DEFAULT 'pending',
  result ENUM('white','black','draw') DEFAULT NULL,
  fen VARCHAR(100) NOT NULL DEFAULT 'startpos',
  pgn TEXT DEFAULT NULL,
  turn ENUM('w','b') NOT NULL DEFAULT 'w',
  last_move_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_games_white (white_user_id),
  INDEX idx_games_black (black_user_id),
  INDEX idx_games_last_move (last_move_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;
