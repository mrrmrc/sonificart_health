<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header("Content-Type: text/plain");

$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connected successfully.\n";

    // 1. Showcase Table
    echo "Checking 'showcase' table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS showcase (
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
        is_public TINYINT(1) DEFAULT 1,
        priority INT DEFAULT 0
    )");

    // Add columns if missing
    $cols = [
        "is_public TINYINT(1) DEFAULT 1",
        "priority INT DEFAULT 0",
        "owner_id INT",
        "video_url VARCHAR(255)"
    ];

    foreach ($cols as $colDef) {
        try {
            $colName = explode(' ', $colDef)[0];
            $pdo->exec("ALTER TABLE showcase ADD COLUMN $colDef");
            echo "Added column $colName\n";
        } catch (Exception $e) {
            // Check if error is "Duplicate column name"
            if (strpos($e->getMessage(), "Duplicate column") !== false) {
                echo "Column " . explode(' ', $colDef)[0] . " already exists.\n";
            } else {
                echo "Note on $colDef: " . $e->getMessage() . "\n";
            }
        }
    }

    // 2. Registration Requests Table
    echo "Checking 'registration_requests' table...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS registration_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        plan VARCHAR(50),
        address TEXT,
        piva VARCHAR(50),
        sdi VARCHAR(50),
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    echo "\nDATABASE UPDATE COMPLETED SUCCESSFULLY.\n";

} catch (PDOException $e) {
    echo "CONNECTION FAILED: " . $e->getMessage();
}
?>