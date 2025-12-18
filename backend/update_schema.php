<?php
// backend/update_schema.php
// Script per aggiornare lo schema del database automaticamente

require_once 'config.php';

// Abilita CORS per debug facile
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
}

header('Content-Type: application/json');

try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $updates = [];

    // 1. Aggiungi colonna 'music_generation_prompt' se manca (fix precedente, repetita iuvant)
    try {
        $pdo->query("SELECT music_generation_prompt FROM history LIMIT 1");
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE history ADD COLUMN music_generation_prompt TEXT DEFAULT NULL");
        $updates[] = "Aggiunta colonna 'music_generation_prompt'";
    }

    // 2. Aggiungi colonna 'generated_ai_track_url' se manca
    try {
        $pdo->query("SELECT generated_ai_track_url FROM history LIMIT 1");
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE history ADD COLUMN generated_ai_track_url VARCHAR(512) DEFAULT NULL");
        $updates[] = "Aggiunta colonna 'generated_ai_track_url'";
    }

    // 3. Aggiungi colonna 'config_json' (CRUCIALE PER IL FIX RISOLUZIONE)
    try {
        $pdo->query("SELECT config_json FROM history LIMIT 1");
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE history ADD COLUMN config_json TEXT DEFAULT NULL");
        $updates[] = "Aggiunta colonna 'config_json' (Fix Risoluzione/Durata)";
    }

    echo json_encode(["success" => true, "updates" => $updates, "message" => count($updates) > 0 ? "Database aggiornato con successo." : "Database già aggiornato."]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>