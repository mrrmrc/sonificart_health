<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Add event_data and block_data columns
    $sql = "ALTER TABLE history 
            ADD COLUMN IF NOT EXISTS event_data LONGTEXT,
            ADD COLUMN IF NOT EXISTS block_data LONGTEXT";

    $pdo->exec($sql);
    echo "Columns event_data and block_data added successfully (or already existed).<br>";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>