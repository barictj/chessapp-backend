export const leaderboardsTable = `
CREATE TABLE IF NOT EXISTS leaderboards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  rating INT NOT NULL,
  rank_global INT,
  rank_friends INT,
  snapshot_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leaderboards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
`;
