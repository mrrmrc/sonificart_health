<?php
require_once 'index.php'; // To get PDO and helpers if needed, but we can just use the config

$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->exec("UPDATE users SET is_pro = 0, credits = 10 WHERE is_pro = 1 AND tier = 'trial' OR tier = 'full'");
    echo "<h1>Registrazioni corrette!</h1><p>Gli account di prova sono stati convertiti al sistema a crediti (10 CR). Effettua il logout e rientra.</p>";
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage();
}
unlink(__FILE__); // Autodistruzione per sicurezza
