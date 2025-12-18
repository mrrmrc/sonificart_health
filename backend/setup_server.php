<?php
header("Content-Type: text/html; charset=UTF-8");
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>SonificART Server Setup & Check</h1>";

// 1. FILE SYSTEM CHECK & FIX
echo "<h2>1. File System Permissions</h2>";

$baseDir = __DIR__;
$parentDir = dirname($baseDir);
$mediaDir = $parentDir . '/media';
$dirsToCreate = [
    $mediaDir,
    $mediaDir . '/images',
    $mediaDir . '/audio',
    $mediaDir . '/custom'
];

echo "<table border='1' cellpadding='5'><tr><th>Directory</th><th>Status</th><th>Action</th><th>Result</th></tr>";

foreach ($dirsToCreate as $dir) {
    echo "<tr>";
    echo "<td>" . str_replace($parentDir, '..', $dir) . "</td>";

    if (file_exists($dir)) {
        echo "<td style='color:green'>Exists</td>";
        if (is_writable($dir)) {
            echo "<td>Check Write</td><td style='color:green'>Writable</td>";
        } else {
            echo "<td>Check Write</td><td style='color:red'>NOT Writable (Try chmod 755 or 777 via FTP)</td>";
            // Try to chmod
            @chmod($dir, 0755);
        }
    } else {
        echo "<td style='color:red'>Missing</td>";
        echo "<td>Attempting Creation</td>";
        if (@mkdir($dir, 0755, true)) {
            echo "<td style='color:green'>Created</td>";
        } else {
            echo "<td style='color:red'>Failed (Check parent permissions)</td>";
        }
    }
    echo "</tr>";
}
echo "</table>";

// 2. DATABASE CHECK
echo "<h2>2. Database Connection & Schema</h2>";

// Credentials from index.php (Hardcoded for independence)
$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';
$db_charset = 'utf8mb4';

try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    echo "<p style='color:green'><strong>Database Connection Successful.</strong></p>";

    // Check columns
    echo "<h3>Column Check (history table)</h3>";
    try {
        $stmt = $pdo->query("DESCRIBE history");
        $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $required = ['event_data', 'block_data', 'processing_data'];
        $missing = [];

        echo "<ul>";
        foreach ($required as $col) {
            if (in_array($col, $columns)) {
                echo "<li style='color:green'>$col: FOUND</li>";
            } else {
                echo "<li style='color:red'>$col: MISSING! (Run Update Schema)</li>";
                $missing[] = $col;
            }
        }
        echo "</ul>";

        if (!empty($missing)) {
            echo "<p style='color:red'><strong>CRITICAL: Database schema is outdated.</strong></p>";
            // Try to add them? No, better link to update script or show SQL.
            echo "<pre>ALTER TABLE history ADD COLUMN event_data LONGTEXT, ADD COLUMN block_data LONGTEXT;</pre>";
        }

    } catch (Exception $e) {
        echo "Error checking table: " . $e->getMessage();
    }

} catch (PDOException $e) {
    echo "<p style='color:red'><strong>Database Connection Failed:</strong> " . $e->getMessage() . "</p>";
}

// 3. SERVER LIMITS
echo "<h2>3. Server Configuration</h2>";
echo "<ul>";
echo "<li>upload_max_filesize: " . ini_get('upload_max_filesize') . "</li>";
echo "<li>post_max_size: " . ini_get('post_max_size') . "</li>";
echo "<li>memory_limit: " . ini_get('memory_limit') . "</li>";
echo "</ul>";

echo "<hr><p><em>Delete this file after troubleshooting.</em></p>";
?>