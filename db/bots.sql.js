export const botsTable = `
CREATE TABLE IF NOT EXISTS bots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  difficulty ENUM('easy','medium','hard','insane') NOT NULL,
  description VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
