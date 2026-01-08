<?php
// Simple Router via PHP to handle SPA rewrite if .htaccess falls back to it
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Check if file exists
if (file_exists(__DIR__ . $path) && is_file(__DIR__ . $path)) {
    // Serve file directly (letting Apache handle MIME types usually, but if we're here, we might need to serve)
    // Actually, .htaccess usually handles files first.
    // If we're here, it means either file not found OR we want to serve index.html
    return false; // Let server handle it
}

// Serve index.html for everything else (SPA)
include __DIR__ . '/index.html';
?>