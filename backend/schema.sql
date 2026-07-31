-- =============================================================================
-- SonificART - Schema database (MySQL / MariaDB)
--
-- NOTA: index.php crea/aggiorna automaticamente queste tabelle al primo avvio
-- (CREATE TABLE IF NOT EXISTS + ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
-- Questo file serve solo se preferisci importare lo schema a mano da phpMyAdmin
-- su un database vuoto. E' idempotente: puo' essere rieseguito senza danni.
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) DEFAULT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) DEFAULT NULL,
    credits INT DEFAULT 0,
    credits_consumed INT DEFAULT 0,
    is_pro TINYINT(1) DEFAULT 0,
    is_admin TINYINT(1) DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'free',
    pro_expires_at DATETIME DEFAULT NULL,
    token VARCHAR(255) DEFAULT NULL,
    token_expires_at DATETIME DEFAULT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    custom_logo_url VARCHAR(255) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    image_hash VARCHAR(255) DEFAULT NULL,
    paradigm VARCHAR(50) DEFAULT NULL,
    tradition_name VARCHAR(100) DEFAULT NULL,
    image_url VARCHAR(500) DEFAULT NULL,
    audio_url VARCHAR(500) DEFAULT NULL,
    original_audio_url VARCHAR(500) DEFAULT NULL,
    video_url VARCHAR(255) DEFAULT NULL,
    music_generation_prompt TEXT DEFAULT NULL,
    generated_ai_track_url VARCHAR(500) DEFAULT NULL,
    config_json LONGTEXT DEFAULT NULL,
    event_data LONGTEXT DEFAULT NULL,
    block_data LONGTEXT DEFAULT NULL,
    title VARCHAR(255) DEFAULT NULL,
    subtitle VARCHAR(255) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    audio_hash VARCHAR(255) DEFAULT NULL,
    acquisition_metadata TEXT DEFAULT NULL,
    validation_hashes TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS showcase (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    author_name VARCHAR(255),
    description TEXT,
    image_url VARCHAR(255),
    audio_url VARCHAR(255),
    video_url VARCHAR(255),
    paradigm VARCHAR(50),
    tradition VARCHAR(100),
    tags TEXT,
    duration VARCHAR(50),
    notes_count INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    owner_id INT,
    history_id INT DEFAULT NULL,
    is_public TINYINT(1) DEFAULT 1,
    is_home TINYINT(1) DEFAULT 0,
    is_featured TINYINT(1) DEFAULT 0,
    priority INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS registration_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    plan VARCHAR(50),
    address TEXT,
    piva VARCHAR(50),
    sdi VARCHAR(50),
    reason TEXT,
    institution_type VARCHAR(100),
    purpose TEXT,
    website VARCHAR(255),
    phone VARCHAR(50),
    city VARCHAR(100),
    invoice_sent TINYINT(1) DEFAULT 0,
    paid TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    session_id VARCHAR(50) NULL,
    action VARCHAR(50),
    details TEXT,
    level VARCHAR(20) DEFAULT 'INFO',
    ip_address VARCHAR(45),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value LONGTEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cookie_consents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    consent_uuid VARCHAR(50),
    essential TINYINT(1) DEFAULT 1,
    analytics TINYINT(1) DEFAULT 0,
    marketing TINYINT(1) DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserimento utente amministratore di default
-- La password verrà automaticamente cifrata (lazy migration) al primo login
INSERT IGNORE INTO users (name, email, password, is_admin, is_pro, credits) 
VALUES ('Amministratore', 'admin@sonificart.com', 'KIRAcoco2026!', 1, 1, 9999);

