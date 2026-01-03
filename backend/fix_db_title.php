<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';
$db_charset = 'utf8mb4';

echo "Connessione al database in corso...\n";

try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";
    $pdo = new PDO($dsn, $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "Connessione riuscita.\n";

    echo "Tentativo di aggiunta colonna 'title' alla tabella 'history'...\n";

    // Check if column exists first to be verbose
    $stmt = $pdo->query("SHOW COLUMNS FROM history LIKE 'title'");
    if ($stmt->fetch()) {
        echo "La colonna 'title' esiste GIA'. Nessuna azione necessaria.\n";
    } else {
        $pdo->exec("ALTER TABLE history ADD COLUMN title VARCHAR(255) DEFAULT NULL");
        echo "SUCCESSO: Colonna 'title' aggiunta correttamente!\n";
    }

} catch (PDOException $e) {
    echo "ERRORE PDO: " . $e->getMessage() . "\n";
} catch (Exception $e) {
    echo "ERRORE GENERALE: " . $e->getMessage() . "\n";
}
?>