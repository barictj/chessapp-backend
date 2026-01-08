export const playerstatsTable = `
CREATE TABLE IF NOT EXISTS playerstats (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  rating INT NOT NULL DEFAULT 1200,
  last_played_at DATETIME,
  CONSTRAINT fk_playerstats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
`;
