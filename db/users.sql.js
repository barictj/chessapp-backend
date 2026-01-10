export const usersTable = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(255) NULL UNIQUE,
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  provider ENUM('local','google') NOT NULL DEFAULT 'local',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`;

// Idempotent seed for a CI/dev Google user. Safe to run repeatedly.
export const usersSeed = `
INSERT INTO users (username, email, google_id, display_name, avatar_url, provider, is_active, created_at)
VALUES ('ci_test_google', 'ci_test_google@example.com', 'ci-google-0001', 'CI Google Test', 'https://example.com/avatar-ci.png', 'google', 1, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
`;
export const usersSeedTwo = `
INSERT INTO users (username, email, google_id, display_name, avatar_url, provider, is_active, created_at) VALUES ('ci_test_google_b', 'ci_test_google_b@example.com', 'ci-google-0002', 'CI Google Test B', 'https://example.com/avatar-ci-b.png', 'google', 1, NOW()) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
`;