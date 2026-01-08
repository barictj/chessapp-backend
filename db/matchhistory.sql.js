export const matchhistoryTable = `
CREATE TABLE IF NOT EXISTS matchhistory (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  game_id BIGINT UNSIGNED NOT NULL,
  result ENUM('win','loss','draw','abandoned') NOT NULL,
  opponent_id BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_matchhistory_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_matchhistory_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE RESTRICT,
  CONSTRAINT fk_matchhistory_opponent FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE RESTRICT
);
`;
