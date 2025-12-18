<?php
// Script di diagnostica per verificare limiti di upload e configurazione
header("Content-Type: text/plain");

echo "=== DIAGNOSTICA SERVER SONIFICART ===\n\n";

echo "PHP Version: " . phpversion() . "\n";
echo "Server Software: " . $_SERVER['SERVER_SOFTWARE'] . "\n\n";

echo "--- LIMITI UPLOAD ---\n";
echo "upload_max_filesize: " . ini_get('upload_max_filesize') . "\n";
echo "post_max_size: " . ini_get('post_max_size') . "\n";
echo "memory_limit: " . ini_get('memory_limit') . "\n";
echo "max_execution_time: " . ini_get('max_execution_time') . "\n";
echo "max_input_time: " . ini_get('max_input_time') . "\n";

echo "\n--- TEST PERMESSI SCRITTURA ---\n";
$mediaDirs = ['../media', '../media/images', '../media/audio', '../media/custom'];
foreach ($mediaDirs as $dir) {
    $fullPath = __DIR__ . '/' . $dir;
    if (file_exists($fullPath)) {
        echo "Dir [$dir]: Esiste. ";
        echo is_writable($fullPath) ? "SCRIVIBILE OK." : "NON SCRIVIBILE (ERRORE).";
    } else {
        echo "Dir [$dir]: NON ESISTE (verrà creata dallo script se permessi ok).";
    }
    echo "\n";
}

echo "\n--- TEST DATABASE ---\n";
include 'index.php'; // Include per usare la connessione $pdo se non esce
if (isset($pdo)) {
    echo "Connessione DB: OK.\n";
    // Check max_allowed_packet
    try {
        $stmt = $pdo->query("SHOW VARIABLES LIKE 'max_allowed_packet'");
        $row = $stmt->fetch();
        $bytes = $row['Value'];
        echo "MySQL max_allowed_packet: " . $bytes . " bytes (" . round($bytes / 1024 / 1024, 2) . " MB)\n";
    } catch (Exception $e) {
        echo "Impossibile leggere variabili MySQL: " . $e->getMessage() . "\n";
    }
} else {
    echo "Connessione DB: NON DISPONIBILE (o index.php ha fatto exit).\n";
}
?>