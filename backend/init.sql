CREATE DATABASE IF NOT EXISTS wascore_tabs DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wascore_tabs;

CREATE TABLE IF NOT EXISTS tabs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(255) DEFAULT '',
  song_name VARCHAR(255) DEFAULT '',
  band_name VARCHAR(255) DEFAULT '',
  file_type VARCHAR(10) DEFAULT '',
  file_path VARCHAR(512) DEFAULT '',
  download_url VARCHAR(512) DEFAULT '',
  gp_metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_song_name (song_name),
  INDEX idx_band_name (band_name),
  INDEX idx_updated (updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
