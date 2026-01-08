export const uservsuserstatsTable = `
CREATE TABLE IF NOT EXISTS uservsuserstats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  opponent_id BIGINT UNSIGNED NOT NULL,
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_uservsuser_pair (user_id, opponent_id),
  CONSTRAINT fk_uservsuser_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_uservsuser_opponent FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE RESTRICT
);
`;
