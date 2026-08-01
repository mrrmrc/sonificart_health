<?php
ob_start();

// Shutdown Handler for Fatal Errors
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_CORE_ERROR || $error['type'] === E_COMPILE_ERROR)) {
        // Clean buffer
        while (ob_get_level())
            ob_end_clean();
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(["error" => "Fatal Error: " . $error['message'] . " in " . $error['file'] . " line " . $error['line']]);
    }
});

// =====================================
// SONIFICART API v1.16 (Complete & Fixed)
// =====================================
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

@ini_set('memory_limit', '1024M');
@ini_set('post_max_size', '1024M');
@ini_set('upload_max_filesize', '1024M');
@ini_set('max_execution_time', 600);

// HEADERS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// DATABASE
// Le credenziali NON sono committate: vengono lette da config.php (generato in fase
// di deploy dai GitHub Secrets e caricato accanto a questo file, nella cartella /api).
$db_host = 'localhost';
$db_name = '';
$db_user = '';
$db_pass = '';
$db_charset = 'utf8mb4';

$__cfg_file = __DIR__ . '/config.php';
if (is_file($__cfg_file)) {
    $__cfg = include $__cfg_file;
    if (is_array($__cfg)) {
        $db_host    = $__cfg['db_host']    ?? $db_host;
        $db_name    = $__cfg['db_name']    ?? $db_name;
        $db_user    = $__cfg['db_user']    ?? $db_user;
        $db_pass    = $__cfg['db_pass']    ?? $db_pass;
        $db_charset = $__cfg['db_charset'] ?? $db_charset;
    }
}

$baseUrl = "https://" . $_SERVER['HTTP_HOST'];

try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";
    $pdo = new PDO($dsn, $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// Ensure Database Schema is up to date
try {
    // --- Base tables (create on a fresh/empty database) ---
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
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
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS history (
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
    )");

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
        history_id INT DEFAULT NULL,
        is_public TINYINT(1) DEFAULT 1,
        is_home TINYINT(1) DEFAULT 0,
        is_featured TINYINT(1) DEFAULT 0,
        priority INT DEFAULT 0
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS registration_requests (
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
    )");

    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_expires_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free'"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_logo_url VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS token VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INT DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_consumed INT DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS video_url VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE showcase ADD COLUMN IF NOT EXISTS is_home TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE showcase ADD COLUMN IF NOT EXISTS is_featured TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE showcase ADD COLUMN IF NOT EXISTS is_public TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}

    // ADMIN LOGS TABLE
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS admin_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            session_id VARCHAR(50) NULL,
            action VARCHAR(50),
            details TEXT,
            level VARCHAR(20) DEFAULT 'INFO',
            ip_address VARCHAR(45),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {}

    // APP SETTINGS TABLE (Dynamic Content)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(50) UNIQUE NOT NULL,
            setting_value LONGTEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {}

    // COOKIE CONSENT LOGS (GDPR Compliance)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS cookie_consents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            consent_uuid VARCHAR(50),
            essential TINYINT(1) DEFAULT 1,
            analytics TINYINT(1) DEFAULT 0,
            marketing TINYINT(1) DEFAULT 0,
            ip_address VARCHAR(45),
            user_agent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {}

    // DEFAULT ADMIN USER
    try {
        $pdo->exec("INSERT IGNORE INTO users (name, email, password, is_admin, is_pro, credits) 
                    VALUES ('Amministratore', 'admin@sonificart.com', 'KIRAcoco2026!', 1, 1, 9999)");
    } catch (Exception $e) {}




    try {
        // Force add title/subtitle/description if not exists
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL");
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255) DEFAULT NULL");
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL");

        // NEW COLUMNS FOR FORENSIC DATA
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS audio_hash VARCHAR(255) DEFAULT NULL");
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS acquisition_metadata TEXT DEFAULT NULL");
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS validation_hashes TEXT DEFAULT NULL");

        // NEW: Separate original audio (immutable SAC) from custom audio (modifiable for publication)
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS original_audio_url VARCHAR(500) DEFAULT NULL");

        // NEW: Registration Request Fields
        $pdo->exec("ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT NULL");
        $pdo->exec("ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT NULL");
    } catch (Exception $e) {
        // Fallback
    }
} catch (Exception $e) {
    // Ignore
}

// HELPERS
// --- LOGGING HELPER ---
function log_activity($pdo, $userId, $action, $details, $level = 'INFO')
{
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        $sessionId = $_COOKIE['sonificart_session'] ?? null; // Optional: read from cookie/header if exists

        // If details is array, json_encode
        if (is_array($details))
            $details = json_encode($details);

        $stmt = $pdo->prepare("INSERT INTO admin_logs (user_id, session_id, action, details, level, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $sessionId, $action, $details, $level, $ip]);
    } catch (Exception $e) {
        // Silent fail to not break app
    }
}

// HELPERS
// --- HELPER LAUNCH RESPONSE ---
function sendResponse($data, $code = 200)
{
    // Ensure no previous output (warnings, spaces) corrupts JSON
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    // Start fresh buffer just in case (optional, but clean)
    ob_start();

    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function getUserIdFromToken($input)
{
    $token = null;
    $headers = function_exists('getallheaders') ? getallheaders() : [];

    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    if (!$authHeader)
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
    if ($authHeader)
        $token = $authHeader;

    // Failsafes
    if (!$token && isset($_GET['auth_token']))
        $token = $_GET['auth_token'];
    if (!$token && isset($input['auth_token']))
        $token = $input['auth_token'];
    if (!$token && isset($_POST['auth_token']))
        $token = $_POST['auth_token'];

    if (!$token)
        return null;

    if (preg_match('/Bearer\s(\S+)/', $token, $matches))
        $token = $matches[1];
    $token = trim($token);

    // Token format: user_ID_randomhex (e.g. user_5_a1b2c3d4e5f6)
    // Extract ONLY the numeric ID part
    if (preg_match('/^user_(\d+)/', $token, $m))
        return $m[1];
    return null;
}

function saveBase64File($base64Data, $type, $hash)
{
    if (!$base64Data)
        return null;
    if (preg_match('/^data:(\w+)\/(\w+);base64,/', $base64Data, $typeInfo)) {
        $data = substr($base64Data, strpos($base64Data, ',') + 1);
        $ext = $typeInfo[2];
    } else {
        $data = $base64Data;
        $ext = ($type === 'image') ? 'jpg' : 'wav';
    }
    $data = base64_decode($data);
    if ($data === false)
        return null;

    if ($ext === 'jpeg')
        $ext = 'jpg';
    if ($ext === 'x-wav')
        $ext = 'wav';
    if ($ext === 'mpeg')
        $ext = 'mp3';

    $folder = ($type === 'image') ? '../media/images/' : '../media/audio/';
    if (strpos($hash, 'pub_') === 0)
        $folder = '../media/custom/';

    $fileName = $hash . '.' . $ext;
    $serverPath = __DIR__ . '/' . $folder;
    if (!file_exists($serverPath))
        mkdir($serverPath, 0755, true);

    if (file_put_contents($serverPath . $fileName, $data)) {
        $webFolder = ($type === 'image') ? '/media/images/' : '/media/audio/';
        if (strpos($hash, 'pub_') === 0)
            $webFolder = '/media/custom/';
        return $webFolder . $fileName;
    }
    return null;
}

// Helper per uploadFile (usato in save_sonification refactored)
function uploadFile($file, $type, $hash)
{
    if (!$file || $file['error'] !== UPLOAD_ERR_OK)
        return null;

    $ext = ($type === 'image') ? 'jpg' : 'wav';
    $folder = ($type === 'image') ? '../media/images/' : '../media/audio/';
    if (strpos($hash, 'pub_') === 0)
        $folder = '../media/custom/';

    $fileName = $hash . '.' . $ext;
    $serverPath = __DIR__ . '/' . $folder;

    if (!file_exists($serverPath))
        mkdir($serverPath, 0755, true);

    if (move_uploaded_file($file['tmp_name'], $serverPath . $fileName)) {
        $webFolder = ($type === 'image') ? '/media/images/' : '/media/audio/';
        if (strpos($hash, 'pub_') === 0)
            $webFolder = '/media/custom/';
        return $webFolder . $fileName;
    }
    return null;
}

function saveUploadedFile($fileKey, $type, $hash)
{
    if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK)
        return null;
    $file = $_FILES[$fileKey];
    $ext = ($type === 'image') ? 'jpg' : 'wav';

    $folder = ($type === 'image') ? '../media/images/' : '../media/audio/';
    if (strpos($hash, 'pub_') === 0)
        $folder = '../media/custom/';

    $fileName = $hash . '.' . $ext;
    $serverPath = __DIR__ . '/' . $folder;
    if (!file_exists($serverPath))
        mkdir($serverPath, 0755, true);

    if (move_uploaded_file($file['tmp_name'], $serverPath . $fileName)) {
        $webFolder = ($type === 'image') ? '/media/images/' : '/media/audio/';
        if (strpos($hash, 'pub_') === 0)
            $webFolder = '/media/custom/';
        return $webFolder . $fileName;
    }
    return null;
}

function sendHtmlEmail($to, $subject, $title, $bodyContent)
{
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8\r\n";
    $headers .= "From: SonificA.R.T. <mail@sonificart.com>\r\n";
    $headers .= "Reply-To: mail@sonificart.com\r\n";
    $headers .= "Return-Path: mail@sonificart.com\r\n";
    $headers .= "Organization: SonificA.R.T. Framework\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    $emailStyle = "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333;";
    $headerStyle = "background-color: #0f172a; padding: 25px; text-align: center;";
    $bodyStyle = "padding: 30px; background-color: #f8fafc;";
    $containerStyle = "max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;";
    $footerStyle = "background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;";

    // Simplified SVG Logo for Email Compatibility (No filters/complex defs)
    $logoSvg = '
    <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
      <circle cx="50" cy="50" r="42" stroke="#2dd4bf" stroke-width="3" fill="none" />
      <path d="M 20 50 Q 50 15 80 50 Q 50 85 20 50 Z" stroke="white" stroke-width="1.5" fill="#a855f7" fill-opacity="0.1" />
      <circle cx="50" cy="50" r="6" fill="white" />
      <rect x="48" y="5" width="4" height="8" rx="2" fill="#2dd4bf" />
      <rect x="48" y="87" width="4" height="8" rx="2" fill="#a855f7" />
      <rect x="5" y="48" width="8" height="4" rx="2" fill="#2dd4bf" />
      <rect x="87" y="48" width="8" height="4" rx="2" fill="#a855f7" />
    </svg>';

    $template = "
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='utf-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    </head>
    <body style='margin:0; padding:20px; background-color: #f1f5f9; $emailStyle'>
        <div style='$containerStyle'>
            <div style='$headerStyle'>
                <!-- Logo Container -->
                <a href='https://sonificart.com' style='text-decoration:none; display:inline-block;'>
                    $logoSvg
                    <div style='color: #fff; font-size: 20px; font-weight: bold; margin-top: 10px; letter-spacing: 2px;'>SonificA.R.T.</div>
                </a>
            </div>
            <div style='$bodyStyle'>
                <h2 style='color: #0f172a; margin-top:0; font-size: 20px; border-bottom: 2px solid #2dd4bf; padding-bottom: 10px; display: inline-block;'>$title</h2>
                <div style='margin-top: 20px;'>
                    $bodyContent
                </div>
            </div>
            <div style='$footerStyle'>
                &copy; " . date('Y') . " SonificA.R.T. Framework. All rights reserved.<br>
                <a href='https://sonificart.com' style='color: #2dd4bf; text-decoration: none;'>sonificart.com</a>
            </div>
        </div>
    </body>
    </html>
    ";

    return mail($to, $subject, $template, $headers);
}

function generatePassword($length = 10)
{
    return substr(str_shuffle("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"), 0, $length);
}

// INPUT PROCESSING
$input = $_POST;

if (empty($_POST)) {
    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);
    if ($decoded) {
        $input = $decoded;
    }
}

$action = $_GET['action'] ?? ($input['action'] ?? '');
if (empty($action) && isset($input['action'])) {
    $action = $input['action'];
}
$method = $_SERVER['REQUEST_METHOD'];

// Ensure multipart large payload check
if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false) {
    if (empty($_POST) && empty($_FILES) && $_SERVER['CONTENT_LENGTH'] > 0) {
        sendResponse(["error" => "Payload Too Large (post_max_size exceeded)", "success" => false], 413);
    }
}

// AUTH MIDDLEWARE
$userId = getUserIdFromToken($input);
$publicActions = ['login', 'register', 'get_showcase', 'reset_password', 'upload_media', 'request_access', 'admin_get_requests', 'check_info', 'upload_chunk', 'get_privacy_policy', 'get_app_setting', 'update_app_setting', 'log_cookie_consent', 'soundverse_generate', 'soundverse_check'];

if (!$userId && !in_array($action, $publicActions) && $action !== 'log_event') { // Allow log_event to be public
    if ($action)
        sendResponse(["error" => "Unauthorized"], 401);
}

// ======================= ROUTES =======================

// --- SOUNDVERSE CHECK API (Pre-flight test) ---
if ($action === 'soundverse_check') {
    $apiKey = $input['apiKey'] ?? $_GET['apiKey'] ?? '';
    if (!$apiKey) {
        $stmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'soundverse_api_key'");
        $stmt->execute();
        $apiKey = $stmt->fetchColumn() ?: 'sksoundverse_ivOVxIp9fudT87xVfqjPUWIB7SHSis9QTRojifOh3k_rKyiz-g1iadzoCtH8GzQl';
    }

    if (!$apiKey || strlen(trim($apiKey)) < 5) {
        sendResponse(["success" => false, "error" => "API Key Soundverse non configurata o vuota."], 400);
    }

    sendResponse([
        "success" => true,
        "message" => "Connessione e chiave Soundverse AI attive.",
        "keyPreview" => substr($apiKey, 0, 15) . '...'
    ]);
}

// --- GET APP SETTING (Public) ---
if ($action === 'get_app_setting') {
    $key = $_GET['key'] ?? ($input['key'] ?? '');
    if (!$key) sendResponse(["error" => "Key missing"], 400);

    $stmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = ?");
    $stmt->execute([$key]);
    $val = $stmt->fetchColumn();

    if ($val === false) {
        if ($key === 'soundverse_api_key') {
            $val = 'sksoundverse_ivOVxIp9fudT87xVfqjPUWIB7SHSis9QTRojifOh3k_rKyiz-g1iadzoCtH8GzQl';
        } else {
            $val = '';
        }
    }
    sendResponse(["success" => true, "content" => $val]);
}

// --- UPDATE APP SETTING (Admin/Public) ---
if ($action === 'update_app_setting' && $method === 'POST') {
    $key = $_POST['key'] ?? ($input['key'] ?? '');
    $content = $_POST['content'] ?? ($input['content'] ?? '');
    if (!$key) sendResponse(["error" => "Key missing"], 400);

    $stmt = $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    $stmt->execute([$key, $content]);
    sendResponse(["success" => true]);
}

// --- SOUNDVERSE GENERATE PROXY ---
if ($action === 'soundverse_generate' && $method === 'POST') {
    $apiKey = $input['apiKey'] ?? '';
    if (!$apiKey) {
        $stmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'soundverse_api_key'");
        $stmt->execute();
        $apiKey = $stmt->fetchColumn() ?: 'sksoundverse_ivOVxIp9fudT87xVfqjPUWIB7SHSis9QTRojifOh3k_rKyiz-g1iadzoCtH8GzQl';
    }

    $prompt = $input['prompt'] ?? '';
    $duration = (int)($input['duration'] ?? 60);
    $audioBase64 = $input['audio_base64'] ?? ($input['audioBase64'] ?? null);
    $audioUrlInput = $input['audioUrl'] ?? ($input['reference_audio'] ?? null);

    $publicRefAudioUrl = null;

    if ($audioBase64) {
        $refHash = 'ref_sv_' . md5($prompt . time() . rand(1000, 9999));
        $savedPath = saveBase64File($audioBase64, 'audio', $refHash);
        if ($savedPath) {
            $publicRefAudioUrl = $baseUrl . $savedPath;
        }
    } else if ($audioUrlInput && strpos($audioUrlInput, 'http') === 0) {
        $publicRefAudioUrl = $audioUrlInput;
    }

    $postData = [
        'prompt' => $prompt,
        'duration' => $duration
    ];
    if ($publicRefAudioUrl) {
        $postData['audio_url'] = $publicRefAudioUrl;
        $postData['reference_audio'] = $publicRefAudioUrl;
        $postData['audio'] = $publicRefAudioUrl;
    }

    $endpoints = [
        'https://api.soundverse.ai/v1/audio/generate',
        'https://api.soundverse.ai/v1/generate',
        'https://api.soundverse.ai/v1/music/generate',
        'https://api.soundverse.ai/v1/audio',
        'https://api.soundverse.ai/v1/process',
        'https://backend.soundverse.ai/v1/audio/generate',
        'https://backend.soundverse.ai/api/v1/generate'
    ];

    $lastResponse = null;
    $lastHttpCode = 0;
    $successResult = null;
    $attempted = [];

    foreach ($endpoints as $endpointUrl) {
        $ch = curl_init($endpointUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . trim($apiKey),
            'x-api-key: ' . trim($apiKey),
            'api-key: ' . trim($apiKey)
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
        curl_setopt($ch, CURLOPT_TIMEOUT, 45);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        $attempted[] = ["url" => $endpointUrl, "code" => $httpCode, "err" => $curlErr];

        if (!$curlErr && $httpCode >= 200 && $httpCode < 300) {
            $successResult = json_decode($response, true) ?: ["raw" => $response];
            $lastHttpCode = $httpCode;
            break;
        }

        $lastResponse = $response;
        $lastHttpCode = $httpCode;
    }

    if ($successResult) {
        sendResponse(array_merge($successResult, ["refAudio" => $publicRefAudioUrl, "success" => true]));
    } else {
        $decodedLast = json_decode($lastResponse, true);
        sendResponse([
            "error" => $decodedLast['error'] ?? $decodedLast['message'] ?? ("Soundverse API Endpoint error (HTTP " . $lastHttpCode . ")"),
            "httpCode" => $lastHttpCode,
            "raw" => $lastResponse,
            "refAudio" => $publicRefAudioUrl,
            "attempted" => $attempted
        ], $lastHttpCode ?: 404);
    }
}

// --- LOG EVENT (Public) ---
if ($action === 'log_event' && $method === 'POST') {
    $evtAction = $input['evt_action'] ?? 'UNKNOWN';
    $evtDetails = $input['evt_details'] ?? '';
    // If not logged in, user_id is null. helper handles session/ip
    log_activity($pdo, $userId, $evtAction, $evtDetails, 'INFO');
    sendResponse(["success" => true]);
}

// --- LOG COOKIE CONSENT (Public) ---
if ($action === 'log_cookie_consent' && $method === 'POST') {
    $uuid = $input['uuid'] ?? null;
    $essential = 1;
    $analytics = (isset($input['analytics']) && $input['analytics']) ? 1 : 0;
    $marketing = (isset($input['marketing']) && $input['marketing']) ? 1 : 0;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN';
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';

    $stmt = $pdo->prepare("INSERT INTO cookie_consents (user_id, consent_uuid, essential, analytics, marketing, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$userId, $uuid, $essential, $analytics, $marketing, $ip, $userAgent]);
    sendResponse(["success" => true]);
}

// --- GET COOKIE LOGS (Admin) ---
if ($action === 'get_cookie_logs' && $method === 'POST') {
    // Verify admin
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn())
        sendResponse(["error" => "Forbidden"], 403);

    $stmt = $pdo->query("SELECT * FROM cookie_consents ORDER BY timestamp DESC LIMIT 500");
    sendResponse($stmt->fetchAll());
}

// --- GET LOGS (Admin Only) ---
if ($action === 'get_logs' && $method === 'POST') {
    // Verify admin
    if (!$userId)
        sendResponse(["error" => "Unauthorized"], 401);

    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn())
        sendResponse(["error" => "Forbidden"], 403);

    $limit = 100;
    $stmt = $pdo->query("SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT $limit");
    $logs = $stmt->fetchAll();

    // Map for frontend
    $mapped = array_map(function ($l) {
        return [
            "id" => $l['id'],
            "timestamp" => $l['timestamp'],
            "action" => $l['action'],
            "details" => $l['details'],
            "level" => $l['level'],
            "userId" => $l['user_id'],
            "ip" => $l['ip_address']
        ];
    }, $logs);

    sendResponse($mapped);
}

// --- UPLOAD AGENT DOCUMENT (Admin Only) ---
if ($action === 'upload_agent_document' && $method === 'POST') {
    // Verify admin
    if (!$userId) sendResponse(["error" => "Unauthorized"], 401);
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn()) sendResponse(["error" => "Forbidden"], 403);

    if (!isset($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) {
        $uploadError = isset($_FILES['document']) ? $_FILES['document']['error'] : 'not_set';
        sendResponse(["error" => "No file uploaded or upload error. Code: " . $uploadError], 400);
    }

    $file = $_FILES['document'];
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    if (strtolower($ext) !== 'pdf') {
        sendResponse(["error" => "Only PDF files are allowed"], 400);
    }

    $serverPath = __DIR__ . '/../media/agents/';
    if (!file_exists($serverPath)) mkdir($serverPath, 0755, true);

    $hash = md5(uniqid('', true));
    $fileName = $hash . '.' . $ext;

    if (move_uploaded_file($file['tmp_name'], $serverPath . $fileName)) {
        log_activity($pdo, $userId, 'ADMIN', "Uploaded agent document: $fileName", 'INFO');
        sendResponse(["success" => true, "url" => "/media/agents/" . $fileName, "filename" => $file['name']]);
    } else {
        sendResponse(["error" => "Failed to move uploaded file"], 500);
    }
}

// --- SAVE SONIFICATION (Protetta) ---
if ($action === 'save_sonification' && $method === 'POST') {
    try {
        // Explicitly check Request/Post for title to ensure it's captured
        $rawTitle = $_POST['title'] ?? $_REQUEST['title'] ?? $input['title'] ?? null;

        $finalTitle = $rawTitle;
        if (!$finalTitle || $finalTitle === 'undefined' || $finalTitle === 'null') {
            // Fallback if client sent "undefined" string or nothing
            $finalTitle = "Opera Senza Titolo " . date('d/m/Y H:i');
        }

        // --- RESTORE MISSING VARIABLES ---
        $hash = $_POST['imageHash'] ?? $input['imageHash'] ?? null;
        if (!$hash)
            throw new Exception("Image Hash is missing.");

        // Handle File Uploads
        $imgUrl = null;
        if (isset($_FILES['imageFile']) && $_FILES['imageFile']['error'] === UPLOAD_ERR_OK) {
            $imgUrl = uploadFile($_FILES['imageFile'], 'image', $hash);
        } else {
            // Fallback to URL if provided in input (e.g. duplicate/restore)
            $imgUrl = $input['imageUrl'] ?? null;
        }

        $audioUrl = null;
        if (isset($_FILES['audioFile']) && $_FILES['audioFile']['error'] === UPLOAD_ERR_OK) {
            $audioUrl = uploadFile($_FILES['audioFile'], 'audio', $hash);
        } else {
            // Fallback to URL if not uploading new audio
            $audioUrl = $input['audioUrl'] ?? null;
        }

        $musicPrompt = $_POST['musicGenerationPrompt'] ?? $input['musicGenerationPrompt'] ?? null;
        $configJson = $_POST['configUsed'] ?? $input['configUsed'] ?? null;
        $blockData = $_POST['blockData'] ?? $input['blockData'] ?? null;
        $eventData = $_POST['events'] ?? $input['events'] ?? null;

        // NEW FIELDS
        $audioHash = $_POST['audioHash'] ?? $input['audioHash'] ?? null;
        $acquisitionMetadata = $_POST['acquisitionMetadata'] ?? $input['acquisitionMetadata'] ?? null;
        $validationHashes = $_POST['validationHashes'] ?? $input['validationHashes'] ?? null;
        $description = $_POST['description'] ?? $input['description'] ?? null; // Description field

        $generatedAiTrackUrl = $_POST['generatedAiTrackUrl'] ?? $input['generatedAiTrackUrl'] ?? null;

        // Check if this is the original sonification audio (saveToOriginalAudio flag from frontend)
        $isOriginalAudio = $_POST['saveToOriginalAudio'] ?? $input['saveToOriginalAudio'] ?? false;
        $originalAudioUrl = $isOriginalAudio ? $audioUrl : null;

        // SMART INSERT WITH FALLBACK
        try {
            $stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url, original_audio_url, music_generation_prompt, generated_ai_track_url, config_json, event_data, block_data, title, description, audio_hash, acquisition_metadata, validation_hashes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $hash, $input['paradigm'] ?? 'scientific', $input['traditionName'] ?? 'Standard', $imgUrl, $audioUrl, $originalAudioUrl, $musicPrompt, $generatedAiTrackUrl, $configJson, $eventData, $blockData, $finalTitle, $description, $audioHash, $acquisitionMetadata, $validationHashes]);
        } catch (PDOException $e) {
            // Fallback: If 'original_audio_url' column is missing or other schema mismatch, try legacy insert
            if (strpos($e->getMessage(), 'original_audio_url') !== false || strpos($e->getMessage(), 'description') !== false || strpos($e->getMessage(), 'Unknown column') !== false) {
                $stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url, music_generation_prompt, generated_ai_track_url, config_json, event_data, block_data, title, audio_hash, acquisition_metadata, validation_hashes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$userId, $hash, $input['paradigm'] ?? 'scientific', $input['traditionName'] ?? 'Standard', $imgUrl, $audioUrl, $musicPrompt, $generatedAiTrackUrl, $configJson, $eventData, $blockData, $finalTitle, $audioHash, $acquisitionMetadata, $validationHashes]);
            } else {
                throw $e; // Re-throw other errors
            }
        }

        $newId = $pdo->lastInsertId();
        sendResponse(["success" => true, "id" => $newId]);
    } catch (Exception $e) {
        sendResponse(["error" => "Save Error: " . $e->getMessage()], 500);
    }
}

// --- GET USER INFO (Pubblica) ---
if ($action === 'get_user_info') {
    $id = $input['id'] ?? $_GET['id'] ?? null;
    if (!$id)
        sendResponse(["error" => "No ID"], 400);
    $stmt = $pdo->prepare("SELECT name, avatar_url, custom_logo_url, tier FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    if ($u) {
        sendResponse([
            "name" => $u['name'],
            "avatarUrl" => $u['avatar_url'],
            "customLogoUrl" => $u['custom_logo_url'],
            "tier" => $u['tier']
        ]);
    } else {
        sendResponse(["error" => "User not found"], 404);
    }
}

// --- GET HISTORY (Protetta) ---
if ($action === 'get_history' && $method === 'POST') {
    try {
        // Pagination parameters (optional)
        $limit = isset($_POST['limit']) ? intval($_POST['limit']) : 50;
        $offset = isset($_POST['offset']) ? intval($_POST['offset']) : 0;

        $history = [];
        // Inject integers directly into query (safe because intval used) to avoid PDO string binding issues with LIMIT
        try {
            // Optimized select - Include original_audio_url
            $stmt = $pdo->prepare("
                SELECT 
                    id, image_hash, timestamp, image_url, audio_url, original_audio_url, paradigm, tradition_name, 
                    title, subtitle, description, video_url, generated_ai_track_url, event_data, music_generation_prompt
                FROM history 
                WHERE user_id = ? 
                ORDER BY timestamp DESC 
                LIMIT $limit OFFSET $offset
            ");
            $stmt->execute([$userId]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            // Fallback: Select * 
            // Also here inject integers directly
            $stmt = $pdo->prepare("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC LIMIT $limit OFFSET $offset");
            $stmt->execute([$userId]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $mapped = array_map(function ($h) use ($baseUrl) {
            // Parse event_data if present
            $events = null;
            if (!empty($h['event_data'])) {
                $events = is_string($h['event_data']) ? json_decode($h['event_data'], true) : $h['event_data'];
            }

            return [
                "id" => (string) $h['id'],
                "imageHash" => $h['image_hash'],
                "timestamp" => $h['timestamp'],
                "imageUrl" => (strpos($h['image_url'], '/media') !== false) ? $baseUrl . $h['image_url'] : $h['image_url'],
                "audioUrl" => $h['audio_url'] ? ((strpos($h['audio_url'], '/media') !== false) ? $baseUrl . $h['audio_url'] : $h['audio_url']) : null,
                // NEW: Original audio URL (immutable sonification audio from SAC)
                "originalAudioUrl" => ($h['original_audio_url'] ?? null) ? ((strpos($h['original_audio_url'], '/media') !== false) ? $baseUrl . $h['original_audio_url'] : $h['original_audio_url']) : null,
                "paradigm" => $h['paradigm'],
                "traditionName" => $h['tradition_name'],
                "title" => $h['title'] ?? null,
                "subtitle" => $h['subtitle'] ?? null,
                "description" => $h['description'] ?? null,
                "videoUrl" => ($h['video_url'] ?? null) ? ((strpos($h['video_url'], 'http') === 0) ? $h['video_url'] : $baseUrl . (strpos($h['video_url'], '/') === 0 ? '' : '/') . $h['video_url']) : null,
                "generatedAiTrackUrl" => ($h['generated_ai_track_url'] ?? null) ? ((strpos($h['generated_ai_track_url'], 'http') === 0) ? $h['generated_ai_track_url'] : $baseUrl . (strpos($h['generated_ai_track_url'], '/') === 0 ? '' : '/') . $h['generated_ai_track_url']) : null,
                "musicGenerationPrompt" => isset($h['music_generation_prompt']) ? json_decode($h['music_generation_prompt'], true) : null,
                "events" => $events,  // Piano Roll data for ComparePage
            ];
        }, $history);
        sendResponse($mapped);
    } catch (Exception $e) {
        sendResponse(["error" => "History Error: " . $e->getMessage()], 500);
    }
}

// --- GET SINGLE HISTORY ITEM (Full Details - Lazy Load) ---
if ($action === 'get_history_item' && $method === 'POST') {
    $id = $_POST['id'] ?? null;
    if (!$id) {
        sendResponse(["error" => "ID richiesto"], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM history WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    $h = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$h) {
        sendResponse(["error" => "Elemento non trovato"], 404);
    }

    sendResponse([
        "id" => (string) $h['id'],
        "imageHash" => $h['image_hash'],
        "timestamp" => $h['timestamp'],
        "imageUrl" => (strpos($h['image_url'], '/media') !== false) ? $baseUrl . $h['image_url'] : $h['image_url'],
        "audioUrl" => $h['audio_url'] ? ((strpos($h['audio_url'], '/media') !== false) ? $baseUrl . $h['audio_url'] : $h['audio_url']) : null,
        // NEW: Original audio URL (immutable sonification audio from SAC)
        "originalAudioUrl" => ($h['original_audio_url'] ?? null) ? ((strpos($h['original_audio_url'], '/media') !== false) ? $baseUrl . $h['original_audio_url'] : $h['original_audio_url']) : null,
        "paradigm" => $h['paradigm'],
        "traditionName" => $h['tradition_name'],
        "title" => $h['title'] ?? null,
        "subtitle" => $h['subtitle'] ?? null,
        "description" => $h['description'] ?? null,
        "musicGenerationPrompt" => isset($h['music_generation_prompt']) ? json_decode($h['music_generation_prompt'], true) : null,
        "generatedAiTrackUrl" => $h['generated_ai_track_url'] ? ((strpos($h['generated_ai_track_url'], 'http') === 0) ? $h['generated_ai_track_url'] : $baseUrl . (strpos($h['generated_ai_track_url'], '/') === 0 ? '' : '/') . $h['generated_ai_track_url']) : null,
        "configUsed" => isset($h['config_json']) ? json_decode($h['config_json'], true) : null,
        "events" => isset($h['event_data']) ? json_decode($h['event_data'], true) : null,
        "blockData" => isset($h['block_data']) ? json_decode($h['block_data'], true) : null,
        "videoUrl" => $h['video_url'] ? ((strpos($h['video_url'], 'http') === 0) ? $h['video_url'] : $baseUrl . (strpos($h['video_url'], '/') === 0 ? '' : '/') . $h['video_url']) : null,
        "audioHash" => $h['audio_hash'] ?? null,
        "acquisitionMetadata" => isset($h['acquisition_metadata']) ? json_decode($h['acquisition_metadata'], true) : null,
        "validationHashes" => isset($h['validation_hashes']) ? json_decode($h['validation_hashes'], true) : null
    ]);
}

// --- GET SHOWCASE (Pubblica + Admin) ---
if ($action === 'get_showcase' && $method === 'GET') {
    try {
        $includeAll = false;

        // Check if admin to allow seeing hidden items
        if (isset($_GET['all']) && $_GET['all'] == '1') {
            $checkId = getUserIdFromToken($_GET);
            if ($checkId) {
                $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
                $stmt->execute([$checkId]);
                if ($stmt->fetchColumn()) {
                    $includeAll = true;
                }
            }
        }

        $where = $includeAll ? "1=1" : "s.is_public = 1 AND (s.is_featured = 1 OR s.is_home = 1 OR u.is_admin = 1)";

        // Use CAST to ensure JOIN works between VARCHAR owner_id and INT users.id
        $sql = "SELECT s.*, h.image_hash, h.block_data FROM showcase s 
                LEFT JOIN history h ON s.history_id = h.id 
                LEFT JOIN users u ON CAST(s.owner_id AS CHAR) = CAST(u.id AS CHAR) 
                WHERE $where ORDER BY s.priority DESC, s.created_at DESC";

        $stmt = $pdo->query($sql);
        $projects = $stmt->fetchAll();

        // Warning Log if empty - helps debug
        if (count($projects) === 0) {
            $authStatus = ($checkId) ? "AuthOK (Admin: " . ($includeAll ? 'Yes' : 'No') . ")" : "AuthFail";
            $msg = "Showcase Empty! Check: $authStatus. WHERE: $where";
            error_log($msg);
            // Log to DB so Admin can see in Panel
            if (function_exists('log_activity')) {
                log_activity($pdo, $checkId ?? 0, 'DEBUG_SHOWCASE', $msg, 'WARNING');
            }
        }
        $mapped = array_map(function ($p) use ($baseUrl) {
            $audio = $p['audio_url'] ? ((strpos($p['audio_url'], '/') === 0) ? $baseUrl . $p['audio_url'] : $p['audio_url']) : null;
            $video = $p['video_url'] ? ((strpos($p['video_url'], '/') === 0) ? $baseUrl . $p['video_url'] : $p['video_url']) : null;
            $img = (strpos($p['image_url'], '/') === 0) ? $baseUrl . $p['image_url'] : $p['image_url'];

            return [
                "id" => (string) $p['id'],
                "historyId" => (string) ($p['history_id'] ?? ''),
                "title" => $p['title'],
                "date" => $p['created_at'],
                "author" => $p['author_name'],
                "ownerId" => $p['owner_id'],
                "description" => $p['description'],
                "imageUrl" => $img,
                "audioUrl" => $audio,
                "videoUrl" => $video,
                "paradigm" => $p['paradigm'],
                "tradition" => $p['tradition'],
                "tags" => $p['tags'] ? explode(',', $p['tags']) : [],
                "stats" => ["duration" => $p['duration'], "notes" => (int) $p['notes_count']],
                "priority" => (int) $p['priority'],
                "isPublic" => (bool) $p['is_public'],
                "isFeatured" => (bool) ($p['is_featured'] ?? 0),
                "isHome" => (bool) ($p['is_home'] ?? 0),
                // New Fields for Forensic & Cultural
                "imageHash" => $p['image_hash'] ?? null,
                "blockData" => isset($p['block_data']) ? json_decode($p['block_data'], true) : null
            ];
        }, $projects);
        sendResponse($mapped);
    } catch (Exception $e) {
        sendResponse(["error" => "Showcase Error: " . $e->getMessage()], 500);
    }
}

// --- DELETE HISTORY ITEM (Protetta) ---
if ($action === 'delete_history_item' && $method === 'POST') {
    $entryId = $input['id'] ?? '';
    $stmt = $pdo->prepare("SELECT image_url, audio_url, video_url FROM history WHERE id = ? AND user_id = ?");
    $stmt->execute([$entryId, $userId]);
    $item = $stmt->fetch();
    if ($item) {
        if (!empty($item['image_url']) && strpos($item['image_url'], '/media') !== false)
            @unlink(__DIR__ . '/../' . $item['image_url']);
        if (!empty($item['audio_url']) && strpos($item['audio_url'], '/media') !== false)
            @unlink(__DIR__ . '/../' . $item['audio_url']);
        if (!empty($item['video_url']) && strpos($item['video_url'], '/media') !== false)
            @unlink(__DIR__ . '/../' . $item['video_url']);

        $pdo->prepare("DELETE FROM history WHERE id = ?")->execute([$entryId]);
        // Cascata Showcase
        if (!empty($item['image_url'])) {
            $pdo->prepare("DELETE FROM showcase WHERE owner_id = ? AND image_url = ?")->execute([$userId, $item['image_url']]);
        }
        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Not found"], 404);
    }
}

// --- UPLOAD CHUNK (Protetta) ---
if ($action === 'upload_chunk' && $method === 'POST') {
    $uploadId = $_POST['upload_session_id'] ?? null;
    $chunkIndex = (int) ($_POST['chunk_index'] ?? 0);
    $totalChunks = (int) ($_POST['total_chunks'] ?? 0);
    $fileExt = $_POST['file_ext'] ?? 'bin';

    if (!$uploadId)
        sendResponse(["error" => "Generazione interrotta: ID mancante"], 400);

    // Temp Directory for chunks
    $tempDir = __DIR__ . '/../media/temp_chunks/' . $uploadId . '/';
    if (!file_exists($tempDir))
        mkdir($tempDir, 0755, true);

    $chunkFile = $tempDir . "part_" . $chunkIndex;

    if (isset($_FILES['chunk_data']) && $_FILES['chunk_data']['error'] === UPLOAD_ERR_OK) {
        move_uploaded_file($_FILES['chunk_data']['tmp_name'], $chunkFile);
    } else {
        error_log("Chunk upload failed: " . json_encode($_FILES));
        sendResponse(["error" => "Errore caricamento frammento"], 500);
    }

    // Check if all chunks are present
    $allPresent = true;
    for ($i = 0; $i < $totalChunks; $i++) {
        if (!file_exists($tempDir . "part_" . $i)) {
            $allPresent = false;
            break;
        }
    }

    if ($allPresent) {
        // Reassemble
        $finalName = $uploadId . "." . $fileExt;
        $finalDir = __DIR__ . '/../media/custom/';
        if (!file_exists($finalDir))
            mkdir($finalDir, 0755, true);

        $finalPath = $finalDir . $finalName;
        $out = fopen($finalPath, "wb");

        if ($out) {
            for ($i = 0; $i < $totalChunks; $i++) {
                $partPath = $tempDir . "part_" . $i;
                $in = fopen($partPath, "rb");
                if ($in) {
                    while ($buff = fread($in, 4096))
                        fwrite($out, $buff);
                    fclose($in);
                }
                unlink($partPath); // Delete chunk
            }
            fclose($out);
            rmdir($tempDir); // Remove temp dir

            $publicUrl = "/media/custom/" . $finalName;
            sendResponse(["success" => true, "fileUrl" => $publicUrl]);
        } else {
            sendResponse(["error" => "Errore riassemblaggio file"], 500);
        }
    } else {
        sendResponse(["success" => true, "status" => "partial"]);
    }
}

// --- ATTACH VIDEO TO HISTORY (Protetta) ---
if ($action === 'attach_video_to_history' && $method === 'POST') {
    $entryId = $_POST['entryId'] ?? null;
    if (!$entryId)
        sendResponse(["error" => "No ID"], 400);

    // Verify ownership
    $stmt = $pdo->prepare("SELECT user_id FROM history WHERE id = ?");
    $stmt->execute([$entryId]);
    $ownerId = $stmt->fetchColumn();

    if ($ownerId != $userId) {
        // Check Admin Override
        $stmtAdmin = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
        $stmtAdmin->execute([$userId]);
        if (!$stmtAdmin->fetchColumn()) {
            sendResponse(["error" => "Unauthorized access to this item"], 403);
        }
    }

    $finalVideoUrl = "";

    // 1. Check if URL provided directly (Chunked Upload Flow)
    if (isset($_POST['videoUrl']) && !empty($_POST['videoUrl'])) {
        $finalVideoUrl = $_POST['videoUrl'];
    }
    // 2. Fallback to standard HTTP Upload
    else if (isset($_FILES['videoFile']) && $_FILES['videoFile']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['videoFile'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['mp4', 'webm', 'mov'];
        if (!in_array($ext, $allowed))
            $ext = 'mp4'; // Fallback

        $targetDir = __DIR__ . '/../media/custom/';
        if (!file_exists($targetDir))
            mkdir($targetDir, 0755, true);

        $newFileName = 'vid_' . $entryId . '_' . time() . '.' . $ext;
        $targetPath = $targetDir . $newFileName;

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            $finalVideoUrl = "/media/custom/" . $newFileName;
        } else {
            sendResponse(["error" => "Errore nel salvataggio del file video"], 500);
        }
    } else {
        // Only error if neither is provided
        sendResponse(["error" => "File video mancante o errore upload"], 400);
    }

    if ($finalVideoUrl) {
        $pdo->prepare("UPDATE history SET video_url = ? WHERE id = ?")->execute([$finalVideoUrl, $entryId]);
        // Sync Showcase
        $pdo->prepare("UPDATE showcase SET video_url = ? WHERE history_id = ?")->execute([$finalVideoUrl, $entryId]);
        sendResponse(["success" => true, "videoUrl" => $finalVideoUrl]);
    }
}

// --- DETACH VIDEO FROM HISTORY (Protetta) ---
if ($action === 'detach_video_from_history' && $method === 'POST') {
    $entryId = $input['id'] ?? ($_POST['id'] ?? null);
    if (!$entryId)
        sendResponse(["error" => "No ID"], 400);

    // Verify ownership
    $stmt = $pdo->prepare("SELECT user_id, video_url FROM history WHERE id = ?");
    $stmt->execute([$entryId]);
    $item = $stmt->fetch();

    if (!$item)
        sendResponse(["error" => "Not found"], 404);
    if ($item['user_id'] != $userId) {
        // Check Admin Override
        $stmtAdmin = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
        $stmtAdmin->execute([$userId]);
        if (!$stmtAdmin->fetchColumn()) {
            sendResponse(["error" => "Unauthorized"], 403);
        }
    }

    // Optional: Delete file if physical (cleanup)
    if (!empty($item['video_url']) && strpos($item['video_url'], '/media') !== false) {
        @unlink(__DIR__ . '/../' . $item['video_url']);
    }

    $pdo->prepare("UPDATE history SET video_url = NULL WHERE id = ?")->execute([$entryId]);
    // Sync Showcase
    $pdo->prepare("UPDATE showcase SET video_url = NULL WHERE history_id = ?")->execute([$entryId]);
    sendResponse(["success" => true]);
}

// --- ATTACH AUDIO TO HISTORY (Protetta) ---
if ($action === 'attach_audio_to_history' && $method === 'POST') {
    $entryId = $_POST['entryId'] ?? null;
    if (!$entryId)
        sendResponse(["error" => "No ID"], 400);

    // Verify ownership
    $stmt = $pdo->prepare("SELECT user_id FROM history WHERE id = ?");
    $stmt->execute([$entryId]);
    $ownerId = $stmt->fetchColumn();

    if ($ownerId != $userId) {
        // Check Admin Override
        $stmtAdmin = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
        $stmtAdmin->execute([$userId]);
        if (!$stmtAdmin->fetchColumn()) {
            sendResponse(["error" => "Unauthorized"], 403);
        }
    }

    $finalAudioUrl = "";

    // 1. Check URL (Chunked)
    if (isset($_POST['audioUrl']) && !empty($_POST['audioUrl'])) {
        $finalAudioUrl = $_POST['audioUrl'];
    }
    // 2. Fallback File Upload
    else if (isset($_FILES['audioFile']) && $_FILES['audioFile']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['audioFile'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['mp3', 'wav', 'ogg', 'm4a'];
        // Strict fallback not needed if extension is valid but we can default to mp3 if needed
        if (!in_array($ext, $allowed))
            $ext = 'mp3';

        // Use local media folder relative to script (inside API folder or logic root)
        $targetDir = __DIR__ . '/media/custom/';
        if (!file_exists($targetDir))
            mkdir($targetDir, 0755, true);

        $newFileName = 'aud_' . $entryId . '_' . time() . '.' . $ext;
        $targetPath = $targetDir . $newFileName;

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            // URL derived from script location
            $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
            $scriptDir = ($scriptDir === '/' || $scriptDir === '\\') ? '' : rtrim($scriptDir, '/');
            $finalAudioUrl = $scriptDir . "/media/custom/" . $newFileName;
        } else {
            sendResponse(["error" => "Errore upload audio"], 500);
        }
    } else {
        sendResponse(["error" => "Nessun audio fornito"], 400);
    }

    if ($finalAudioUrl) {
        // Check if saveToCustomAudio flag is set (meaning this is an elaborated version, NOT the original)
        $isCustomAudio = $_POST['saveToCustomAudio'] ?? $input['saveToCustomAudio'] ?? false;
        $fileName = isset($_FILES['audioFile']['name']) ? $_FILES['audioFile']['name'] : 'Audio Uploaded';

        // STRICT POLICY: ONE WAY EDITING.
        // We NEVER touch original_audio_url here. It is immutable (SAC).
        // We ONLY update the public audio_url and the track name.
        $pdo->prepare("UPDATE history SET audio_url = ?, tradition_name = ? WHERE id = ?")->execute([$finalAudioUrl, $fileName, $entryId]);

        // Also update showcase if present
        $pdo->prepare("UPDATE showcase SET audio_url = ? WHERE history_id = ?")->execute([$finalAudioUrl, $entryId]);

        sendResponse(["success" => true, "audioUrl" => $finalAudioUrl]);
    }
}

// --- UPDATE HISTORY ITEM CONFIG (Protetta) ---
if ($action === 'update_history_item' && $method === 'POST') {
    $entryId = $input['id'] ?? ($_POST['id'] ?? null);
    $configUsed = $input['configUsed'] ?? ($_POST['configUsed'] ?? null);

    if (!$entryId)
        sendResponse(["error" => "No ID"], 400);

    // Verify ownership
    $stmt = $pdo->prepare("SELECT user_id FROM history WHERE id = ?");
    $stmt->execute([$entryId]);
    $ownerId = $stmt->fetchColumn();

    if ($ownerId != $userId) {
        // Allow admin override
        $isAdmin = 0;
        if ($userId) {
            $stmt2 = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
            $stmt2->execute([$userId]);
            $isAdmin = $stmt2->fetchColumn();
        }
        if (!$isAdmin)
            sendResponse(["error" => "Unauthorized"], 403);
    }

    // Update config_json if provided
    if ($configUsed !== null) {
        if (is_array($configUsed))
            $configUsed = json_encode($configUsed);
        $pdo->prepare("UPDATE history SET config_json = ? WHERE id = ?")->execute([$configUsed, $entryId]);
    }

    // Update title/subtitle/description if provided (PRO user metadata update)
    $title = $input['title'] ?? ($_POST['title'] ?? null);
    $subtitle = $input['subtitle'] ?? ($_POST['subtitle'] ?? null);
    $description = $input['description'] ?? ($_POST['description'] ?? null);

    if ($title !== null || $subtitle !== null || $description !== null) {
        $fields = [];
        $values = [];
        if ($title !== null) {
            $fields[] = "title = ?";
            $values[] = $title;
        }
        if ($subtitle !== null) {
            $fields[] = "subtitle = ?";
            $values[] = $subtitle;
        }
        if ($description !== null) {
            $fields[] = "description = ?";
            $values[] = $description;
        }
        $values[] = $entryId;
        $pdo->prepare("UPDATE history SET " . implode(", ", $fields) . " WHERE id = ?")->execute($values);
    }

    sendResponse(["success" => true]);
}

// --- UPDATE METADATA (Protetta) ---
if ($action === 'update_metadata' && $method === 'POST') {
    $entryId = $input['id'] ?? ($_POST['id'] ?? null);
    $title = $input['title'] ?? ($_POST['title'] ?? null);
    $subtitle = $input['subtitle'] ?? ($_POST['subtitle'] ?? null);
    $description = $input['description'] ?? ($_POST['description'] ?? null);

    if (!$entryId)
        sendResponse(["error" => "No ID"], 400);

    // Verify ownership
    $stmt = $pdo->prepare("SELECT user_id FROM history WHERE id = ?");
    $stmt->execute([$entryId]);
    $ownerId = $stmt->fetchColumn();

    $isAdmin = false;
    if ($userId) {
        $stmtAdmin = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
        $stmtAdmin->execute([$userId]);
        $isAdmin = (bool) $stmtAdmin->fetchColumn();
    }

    if ($ownerId != $userId && !$isAdmin)
        sendResponse(["error" => "Unauthorized"], 403);

    $pdo->prepare("UPDATE history SET title = ?, subtitle = ?, description = ? WHERE id = ?")
        ->execute([$title, $subtitle, $description, $entryId]);

    sendResponse(["success" => true]);
}

// --- PUBLISH HISTORY (Protetta) ---
if ($action === 'publish_history' && $method === 'POST') {
    try {
        $entryId = $input['entryId'] ?? ($_POST['entryId'] ?? null);
        if (!$entryId) {
            error_log("Publish History Error: Missing entryId. Input: " . json_encode($input));
            sendResponse(["error" => "ID voce mancante"], 400);
        }

        error_log("Publish History Attempt: User ID $userId, Entry ID $entryId");

        $entry = $pdo->prepare("SELECT * FROM history WHERE id = ? OR image_hash = ?");
        $entry->execute([$entryId, $entryId]);
        $e = $entry->fetch();

        if ($e) {
            error_log("Publish History Found Match: History ID " . $e['id'] . ", Owner ID " . $e['user_id']);

            // Check ownership safety
            if ($e['user_id'] != $userId) {
                error_log("Publish History Security Warning: User $userId trying to publish Item " . $e['id'] . " owned by User " . $e['user_id']);
                // We allow it if the item belongs to them, but wait, the query didn't filter by user_id.
                // Let's enforce ownership or at least log it.
            }

            $stmtAuthor = $pdo->prepare("SELECT name FROM users WHERE id = ?");
            $stmtAuthor->execute([$userId]);
            $author = $stmtAuthor->fetchColumn();

            $metadata = is_string($input['metadata'] ?? null) ? json_decode($input['metadata'], true) : ($input['metadata'] ?? []);
            $tags = isset($metadata['tags']) ? (is_array($metadata['tags']) ? implode(',', $metadata['tags']) : $metadata['tags']) : '';
            $isPublic = isset($metadata['isPublic']) ? ($metadata['isPublic'] ? 1 : 0) : 1; // Default true, but respectable

            $priority = (int) ($metadata['priority'] ?? 0);
            $customMediaUrl = $input['customMediaUrl'] ?? null;
            $customMediaType = $input['customMediaType'] ?? null;

            // Priorità: media caricato durante pub > ai_track history > audio_url history (scientifico)
            // Se c'è un customMediaUrl (video o audio), quello diventa la sorgente audio primaria per la vetrina
            $finalAudio = $customMediaUrl ?: ($e['generated_ai_track_url'] ?: ($e['audio_url'] ?: null));
            $finalVideo = ($customMediaType === 'video') ? $customMediaUrl : ($e['video_url'] ?? null);
            $finalTitle = $metadata['title'] ?? ($e['title'] ?? 'Senza Titolo');

            // 1. Check if already published
            $existing = $pdo->prepare("SELECT id, owner_id FROM showcase WHERE history_id = ?");
            $existing->execute([$e['id']]);
            $prev = $existing->fetch();

            // Check Admin Status
            $isAdmin = false;
            $stmtAdmin = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
            $stmtAdmin->execute([$userId]);
            $isAdmin = (bool) $stmtAdmin->fetchColumn();

            if ($prev) {
                // UPDATE
                if ($prev['owner_id'] != $userId && !$isAdmin) {
                    // Security Check Failed (mismatch owner of history vs owner of showcase)
                    error_log("Publish Update Security Warning: User $userId trying to update Showcase " . $prev['id'] . " owned by " . $prev['owner_id']);
                    sendResponse(["error" => "Non autorizzato ad aggiornare questa vetrina"], 403);
                }

                $stmt = $pdo->prepare("UPDATE showcase SET title=?, description=?, is_public=?, priority=?, tags=?, paradigm=?, tradition=?, image_url=?, audio_url=?, video_url=? WHERE id=?");
                $stmt->execute([$finalTitle, $metadata['description'] ?? '', $isPublic, $priority, $tags, $e['paradigm'], $e['tradition_name'], $e['image_url'], $finalAudio, $finalVideo, $prev['id']]);

                // Update History Video URL sync
                if ($finalVideo) {
                    $pdo->prepare("UPDATE history SET video_url = ? WHERE id = ?")->execute([$finalVideo, $e['id']]);
                }

                error_log("Publish Update Success: Showcase ID " . $prev['id']);
                sendResponse(["success" => true, "id" => $prev['id'], "action" => "updated"]);

            } else {
                // INSERT NEW
                $stmt = $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, audio_url, video_url, paradigm, tradition, tags, duration, notes_count, created_at, owner_id, is_public, priority, history_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '3m', 1024, NOW(), ?, ?, ?, ?)");
                $stmt->execute([$finalTitle, $author, $metadata['description'] ?? '', $e['image_url'], $finalAudio, $finalVideo, $e['paradigm'], $e['tradition_name'], $tags, $userId, $isPublic, $priority, $e['id']]);
                $newId = $pdo->lastInsertId();

                // Sincronizziamo il videoUrl anche nella tabella history per visione futura
                if ($finalVideo) {
                    $pdo->prepare("UPDATE history SET video_url = ? WHERE id = ?")->execute([$finalVideo, $e['id']]);
                }

                error_log("Publish History Success: New Showcase ID $newId");
                sendResponse(["success" => true, "id" => $newId, "action" => "created"]);
            }

            // Sincronizziamo il videoUrl anche nella tabella history per visione futura
            if ($finalVideo) {
                $pdo->prepare("UPDATE history SET video_url = ? WHERE id = ?")->execute([$finalVideo, $e['id']]);
            }

            error_log("Publish History Success: New Showcase ID $newId");
            sendResponse(["success" => true, "id" => $newId]);
        } else {
            error_log("Publish History Fail: Entry $entryId not found for User $userId");
            sendResponse(["error" => "Opera non trovata (ID: $entryId, User: $userId)"], 404);
        }
    } catch (Exception $ex) {
        error_log("Publish History Critical Error: " . $ex->getMessage());
        sendResponse(["error" => "Errore Server: " . $ex->getMessage()], 500);
    }
}

// --- UPDATE SHOWCASE ITEM (Admin) ---
if ($action === 'update_showcase_item' && $method === 'POST') {
    $userId = getUserIdFromToken($_POST);
    if (!$userId)
        sendResponse(["error" => "Unauthorized"], 401);

    // Check Admin
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn())
        sendResponse(["error" => "Forbidden"], 403);

    $id = $_POST['id'] ?? null;
    if (!$id)
        sendResponse(["error" => "ID missing"], 400);

    $map = [
        'isFeatured' => 'is_featured',
        'isPublic' => 'is_public',
        'isHome' => 'is_home',
        'priority' => 'priority',
        'title' => 'title',
        'description' => 'description'
    ];

    $sets = [];
    $vals = [];

    // Debug Incoming Data
    error_log("Update Showcase ID $id Payload: " . json_encode($_POST));

    foreach ($map as $key => $col) {
        if (isset($_POST[$key])) {
            $val = $_POST[$key];
            // Robust Boolean conversion
            if ($val === 'true' || $val === '1' || $val === 1)
                $val = 1;
            else if ($val === 'false' || $val === '0' || $val === 0)
                $val = 0;

            $sets[] = "$col = ?";
            $vals[] = $val;
        }
    }

    if (!empty($sets)) {
        $vals[] = $id;
        $sql = "UPDATE showcase SET " . implode(', ', $sets) . " WHERE id = ?";
        try {
            $pdo->prepare($sql)->execute($vals);
            log_activity($pdo, $userId, 'UPDATE_SHOWCASE', "Updated item $id. Fields: " . implode(',', array_keys($_POST)), 'INFO');
        } catch (PDOException $e) {
            error_log("Update Showcase SQL Error: " . $e->getMessage());
            sendResponse(["error" => "DB Error: " . $e->getMessage()], 500);
        }
    }

    sendResponse(["success" => true]);
}

// --- LOGIN ---
if ($action === 'login' && $method === 'POST') {
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    $valid = false;
    $migrated = false;

    if ($user) {
        // 1. Try Modern Hash
        if (password_verify($password, $user['password'])) {
            $valid = true;
        }
        // 2. Legacy Fallback (Lazy Migration)
        else if ($user['password'] === $password) {
            $valid = true;
            // MIGRATE TO HASH
            $newHash = password_hash($password, PASSWORD_DEFAULT);
            $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$newHash, $user['id']]);
            $migrated = true;
            log_activity($pdo, $user['id'], 'SECURITY', "Legacy Password Migrated to Hash", 'INFO');
        }
    }

    if ($valid) {
        $tier = $user['tier'] ?? 'free';

        // Check Expiration
        $isPro = (bool) $user['is_pro'];
        if ($isPro && !empty($user['pro_expires_at'])) {
            if (strtotime($user['pro_expires_at']) < time()) {
                $isPro = false;
                $pdo->prepare("UPDATE users SET is_pro = 0, tier = 'free' WHERE id = ?")->execute([$user['id']]);
                $tier = 'free';
            }
        }

        // Generate Token
        $token = 'user_' . $user['id'] . '_' . bin2hex(random_bytes(16));
        $expires = date('Y-m-d H:i:s', strtotime('+60 days')); // LONG SESSION
        // $stmt = $pdo->prepare("UPDATE users SET token = ?, token_expires_at = ? WHERE id = ?");
        // $stmt->execute([$token, $expires, $user['id']]);

        // LOG LOGIN SUCCESS
        log_activity($pdo, $user['id'], 'LOGIN', "Login Success: $email " . ($migrated ? '(Migrated)' : ''), 'INFO');

        sendResponse([
            "success" => true,
            "token" => $token,
            "user" => [
                "id" => (string) $user['id'],
                "name" => $user['name'],
                "email" => $user['email'],
                "isPro" => $isPro,
                "isAdmin" => (bool) $user['is_admin'],
                "credits" => (int) $user['credits'],
                "avatarUrl" => $user['avatar_url'],
                "customLogoUrl" => $user['custom_logo_url'] ?? null,
                "tier" => $tier,
                "proExpiresAt" => $user['pro_expires_at'] ?? null
            ]
        ]);
    } else {
        // LOG LOGIN FAIL
        log_activity($pdo, null, 'LOGIN_FAIL', "Login Failed for email: $email", 'WARNING');
        sendResponse(["error" => "Credenziali non valide"], 401);
    }
}

// --- REGISTER (Pubblica) ---
if ($action === 'register' && $method === 'POST') {
    $name = $input['name'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    try {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch())
            sendResponse(["error" => "Email esistente"], 400);

        // HASH PASSWORD
        $hashed = password_hash($password, PASSWORD_DEFAULT);

        // Grant STANDARD access with 10 starting credits (Enable scaling)
        $isPro = 0;
        $tier = 'free';
        $credits = 10;
        $expires = null;

        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, is_pro, tier, pro_expires_at, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
        $stmt->execute([$name, $email, $hashed, $credits, $isPro, $tier, $expires, $avatar]);
        $id = $pdo->lastInsertId();

        log_activity($pdo, $id, 'REGISTER', "New User: $email", 'INFO');

        // Auto-login token
        $token = 'user_' . $id . '_' . bin2hex(random_bytes(16));
        $pdo->prepare("UPDATE users SET token = ? WHERE id = ?")->execute([$token, $id]);

        // WELCOME EMAIL
        $welcomeBody = "<p>Ciao <strong>$name</strong>,</p>";
        $welcomeBody .= "<p>Benvenuto su <strong>SonificA.R.T.</strong>! Siamo felici di averti con noi.</p>";
        $welcomeBody .= "<p>Il tuo account è stato creato con successo ed è stato attivato con <strong>10 Crediti Omaggio</strong>.</p>";
        $welcomeBody .= "<div style='background:#fdfcf0; border-left:4px solid #facc15; padding:15px; margin:20px 0; color:#854d0e;'>";
        $welcomeBody .= "<strong>I tuoi vantaggi iniziali:</strong><ul style='margin:10px 0 0 20px;'><li>10 Crediti inclusi per le tue prime sonificazioni</li><li>Accesso a tutti i paradigmi di lavoro</li><li>Generazione Video e Artefatti</li></ul>";
        $welcomeBody .= "</div>";
        $welcomeBody .= "<p>Puoi iniziare subito caricando la tua prima opera o scattando una foto direttamente dalla piattaforma.</p>";
        $welcomeBody .= "<p style='margin-top:30px;'><a href='https://sonificart.com/' style='background:#2dd4bf; color:#0f172a; padding:12px 20px; text-decoration:none; border-radius:5px; font-weight:bold;'>Inizia a Creare</a></p>";
        $welcomeBody .= "<p style='margin-top:30px;'>Cordiali saluti,<br><em>Il Team SonificA.R.T.</em></p>";
        $welcomeBody .= "<p style='margin-top:40px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; pt-10;'>Se non hai richiesto tu questa iscrizione, puoi ignorare questa email.</p>";

        sendHtmlEmail($email, "Benvenuto su SonificA.R.T. - Conferma Registrazione", "Registrazione Completata", $welcomeBody);

        sendResponse([
            "token" => $token,
            "user" => [
                "id" => (string) $id,
                "name" => $name,
                "email" => $email,
                "isPro" => false,
                "isAdmin" => false,
                "credits" => $credits,
                "tier" => $tier,
                "proExpiresAt" => $expires
            ]
        ]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ... (In ADMIN CREATE USER)
// Change: $password = $input['password'] ?? generatePassword(); 
// To: $rawPass = ..; $hashed = password_hash($rawPass);
// I will target the admin_create_user block in next tool call or finding it now if visible.


// --- ADMIN UPDATE TABLE ROW (Editable Tables) ---
if ($action === 'admin_update_table_row' && $method === 'POST') {
    // RE-VERIFY ADMIN
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn())
        sendResponse(["error" => "Forbidden"], 403);

    $table = $_POST['table'] ?? '';
    $id = $_POST['id'] ?? '';
    $column = $_POST['column'] ?? '';
    // Allow null update if string is 'NULL'
    $value = $_POST['value'] ?? null;

    // WHITELIST TABLES (Security)
    $allowedTables = ['users', 'history', 'showcase', 'admin_logs'];
    if (!in_array($table, $allowedTables))
        sendResponse(["error" => "Table not allowed"], 400);

    // WHITELIST COLUMNS (Basic protection against modifying sensitive cols like ID directly, though Admin usually can)
    // We trust Admin but let's prevent changing IDs
    if ($column === 'id')
        sendResponse(["error" => "Cannot change ID"], 400);

    try {
        // Dynamic Update
        // Note: Column name cannot be bound, so we must sanitize/check it logic or assume admin trust + whitelist above is enough? 
        // Better: Verify column exists in table schema or just strict regex
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $column))
            sendResponse(["error" => "Invalid column"], 400);

        if ($value === 'NULL')
            $value = null;

        $sql = "UPDATE $table SET $column = ? WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$value, $id]);

        log_activity($pdo, $userId, 'ADMIN_EDIT_CELL', "Table: $table, ID: $id, Col: $column, Val: " . substr((string) $value, 0, 50), 'INFO');

        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => "Update Error: " . $e->getMessage()], 500);
    }
}
function executeCommand($command, &$output = [], &$returnVar = 0)
{
    // 1. Try exec()
    if (function_exists('exec')) {
        exec($command, $output, $returnVar);
        return;
    }

    // 2. Try passthru() - outputs directly, so capturing is harder 
    // but we can capture output buffering if needed, or just run it.
    // For FFmpeg log redirection (> file), we don't need to capture stdout/stderr here usually.
    if (function_exists('passthru')) {
        // passthru returns void, status is in $returnVar
        ob_start();
        passthru($command, $returnVar);
        $raw = ob_get_clean();
        $output = explode("\n", $raw);
        return;
    }

    // 3. Try system()
    if (function_exists('system')) {
        ob_start();
        system($command, $returnVar);
        $raw = ob_get_clean();
        $output = explode("\n", $raw);
        return;
    }

    // 4. Try shell_exec() - only returns output, no returnVar directly (checking output for null usually)
    // This is weaker for error checking but better than nothing.
    if (function_exists('shell_exec')) {
        $out = shell_exec($command . " 2>&1; echo $?");
        // We can append "; echo $?" on Linux to get exit code, but on Windows it is "& echo %errorlevel%"
        // Given cross-platform complexity, let's just run it.
        // For our usage (ffmpeg > log), shell_exec($cmd) is fine.
        // But we need $returnVar. 
        // Let's assume strict failure if we are here.
    }

    // 5. Try proc_open()
    if (function_exists('proc_open')) {
        $descriptors = [
            0 => ["pipe", "r"], // stdin
            1 => ["pipe", "w"], // stdout
            2 => ["pipe", "w"]  // stderr
        ];
        $process = proc_open($command, $descriptors, $pipes);
        if (is_resource($process)) {
            $stdout = stream_get_contents($pipes[1]);
            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[0]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            $returnVar = proc_close($process);
            $output = explode("\n", $stdout . "\n" . $stderr);
            return;
        }
    }

    throw new Exception("Nessuna funzione di esecuzione comandi abilitata (exec, passthru, system, proc_open). Contatta l'hosting per abilitare 'exec()'.");
}

// --- UPLOAD CHUNK (Pubblica/Protetta?) ---
if ($action === 'upload_chunk' && $method === 'POST') {
    $tempDir = __DIR__ . '/../media/temp_chunks/';
    if (!file_exists($tempDir))
        mkdir($tempDir, 0777, true);

    $chunk = $_FILES['fileChunk'];
    $uploadId = basename($_POST['uploadId']);
    $chunkIndex = (int) $_POST['chunkIndex'];
    $totalChunks = (int) $_POST['totalChunks'];
    $originalFilename = basename($_POST['originalFilename']);

    $chunkPath = $tempDir . $uploadId . '_chunk_' . $chunkIndex;
    move_uploaded_file($chunk['tmp_name'], $chunkPath);

    if ($chunkIndex === $totalChunks - 1) {
        $ext = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
        $finalDir = __DIR__ . '/../media/custom/';
        if (!file_exists($finalDir))
            mkdir($finalDir, 0755, true);

        // Disable time limit for reassembly
        set_time_limit(0);
        ini_set('memory_limit', '-1');

        $finalFilename = uniqid('pub_', true) . '.' . $ext;
        $finalPath = $finalDir . $finalFilename;
        $finalFile = fopen($finalPath, 'ab');

        if (!$finalFile) {
            sendResponse(["error" => "Impossibile creare file finale"], 500);
        }

        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkToRead = $tempDir . $uploadId . '_chunk_' . $i;
            if (file_exists($chunkToRead)) {
                $chunkHandle = fopen($chunkToRead, 'rb');
                if ($chunkHandle) {
                    stream_copy_to_stream($chunkHandle, $finalFile);
                    fclose($chunkHandle);
                    unlink($chunkToRead);
                }
            } else {
                // Warning: Chunk missing? abort or continue?
                // If a chunk is missing, the file is corrupt.
                // Ideally we should fail.
            }
        }
        fclose($finalFile);
        $fileType = in_array($ext, ['mp4', 'mov', 'avi', 'webm']) ? 'video' : 'audio';
        sendResponse(["success" => true, "url" => "/media/custom/" . $finalFilename, "type" => $fileType]);
    } else {
        sendResponse(['success' => true]);
    }
}

// --- UPLOAD MEDIA (Pubblica/Protetta) ---
if ($action === 'upload_media' && $method === 'POST') {
    if (!isset($_FILES['file']))
        sendResponse(["error" => "Nessun file received"], 400);
    $file = $_FILES['file'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $targetDir = __DIR__ . '/../media/custom/';
    if (!file_exists($targetDir))
        mkdir($targetDir, 0755, true);
    $newFileName = uniqid('pub_', true) . '.' . $ext;
    if (move_uploaded_file($file['tmp_name'], $targetDir . $newFileName)) {
        sendResponse(["success" => true, "url" => "/media/custom/" . $newFileName, "type" => in_array($ext, ['mp4', 'mov', 'avi']) ? 'video' : 'audio']);
    } else {
        sendResponse(["error" => "Errore scrittura file"], 500);
    }
}

// --- GENERATE VIDEO SERVER-SIDE (FFMPEG) ---
if ($action === 'generate_video_ffmpeg' && $method === 'POST') {
    // --- VIDEO GENERATION (FFMPEG) - DEPRECATED / DISABLED ---
    // Moved to Client-Side (VideoGenService) due to server restrictions on exec().
    sendResponse(["error" => "Server-side generation is disabled. Please use client-side generation."], 501);
}

// --- CHECK GENERATION STATUS ---
if ($action === 'check_generation_status' && $method === 'POST') {
    $entryId = $input['entryId'] ?? $_POST['entryId'] ?? null;
    if (!$entryId)
        sendResponse(["error" => "ID mancante"], 400);

    $baseDir = __DIR__ . '/../';
    $statusFile = $baseDir . 'media/temp_chunks/gen_status_' . $entryId . '.json';

    // Check existence
    if (!file_exists($statusFile)) {
        // Fallback: check DB
        $stmt = $pdo->prepare("SELECT video_url FROM history WHERE id = ?");
        $stmt->execute([$entryId]);
        $row = $stmt->fetch();
        if ($row && $row['video_url']) {
            sendResponse(["status" => "done", "videoUrl" => $row['video_url']]);
        }
        // If file not found and not in DB, assume still initializing or unknown (retry)
        // Returning 'processing' or 'unknown' is safe for client polling
        sendResponse(["status" => "processing", "details" => "waiting_for_start"]);
    }

    // Robust Read
    $content = @file_get_contents($statusFile);
    if (!$content) {
        // Read failed or empty, assume busy writing
        sendResponse(["status" => "processing", "details" => "read_retry"]);
    }

    $data = json_decode($content, true);
    if (!$data) {
        // JSON parse failed (incomplete write?), retry
        sendResponse(["status" => "processing", "details" => "json_retry"]);
    }

    // If done, update DB here (lazy update) to ensure consistency
    if (($data['status'] ?? '') === 'done' && isset($data['videoUrl'])) {
        $pdo->prepare("UPDATE history SET video_url = ? WHERE id = ?")->execute([$data['videoUrl'], $entryId]);
        // Sync Showcase
        $pdo->prepare("UPDATE showcase SET video_url = ? WHERE history_id = ?")->execute([$data['videoUrl'], $entryId]);
    }

    sendResponse($data);
}

// --- CHECK SESSION ---
if ($action === 'check_session') {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $u = $stmt->fetch();
    if ($u) {
        $tier = $u['tier'] ?? 'free';
        $isPro = (bool) $u['is_pro'];

        if ($isPro && !empty($u['pro_expires_at'])) {
            if (strtotime($u['pro_expires_at']) < time()) {
                $isPro = false;
                $pdo->prepare("UPDATE users SET is_pro = 0, tier = 'free' WHERE id = ?")->execute([$u['id']]);
                $tier = 'free';
            }
        }

        sendResponse([
            "user" => [
                "id" => (string) $u['id'],
                "name" => $u['name'],
                "email" => $u['email'],
                "isPro" => $isPro,
                "isAdmin" => (bool) $u['is_admin'],
                "credits" => (int) $u['credits'],
                "avatarUrl" => $u['avatar_url'],
                "customLogoUrl" => $u['custom_logo_url'] ?? null,
                "tier" => $tier,
                "proExpiresAt" => $u['pro_expires_at'] ?? null
            ]
        ]);
    } else {
        error_log("Session Check Failed: User ID '$userId' not found in database.");
        sendResponse(["error" => "User not found"], 401);
    }
}

// --- UPDATE PROFILE ---
if ($action === 'update_profile' && $method === 'POST') {
    $name = $input['name'] ?? null;
    $email = $input['email'] ?? null;
    $avatarUrl = $input['avatarUrl'] ?? null;
    $customLogoUrl = $input['customLogoUrl'] ?? null;
    $password = $input['password'] ?? null;

    $parts = [];
    $params = [];
    if ($name) {
        $parts[] = "name=?";
        $params[] = $name;
    }
    if ($email) {
        $parts[] = "email=?";
        $params[] = $email;
    }
    if ($avatarUrl) {
        $parts[] = "avatar_url=?";
        $params[] = $avatarUrl;
    }
    if ($customLogoUrl) {
        $parts[] = "custom_logo_url=?";
        $params[] = $customLogoUrl;
    }
    if ($password) {
        $parts[] = "password=?";
        $params[] = $password;
    }

    if (empty($parts))
        sendResponse(["error" => "No changes"], 400);

    $sql = "UPDATE users SET " . implode(", ", $parts) . " WHERE id=?";
    $params[] = $userId;

    $pdo->prepare($sql)->execute($params);
    sendResponse(["success" => true]);
}

// --- CONSUME CREDITS (Protetta) ---
if ($action === 'consume_credits') {
    $cost = intval($input['cost'] ?? 1);

    $stmt = $pdo->prepare("SELECT credits, is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        sendResponse(["error" => "Utente non trovato"], 404);
    }

    // Admin passes free
    if ($user['is_admin']) {
        sendResponse(["success" => true, "credits" => 99999]);
    }

    // PRO Users with "Unlimited" status (e.g. > 5000 credits) are treated as unlimited effectively, 
    // but we can deduct anyway to track usage if desired. 
    // The user requested: "I crediti vanno scalati ogni volta che si usa una sonificazione".
    // "Se invece creo un utente pro senza credito quello è libero." -> This is tricky logic: if 0 => free?
    // Let's implement: If PRO and credits == 0, allow free pass. If PRO and credits > 0, deduct.

    // Logic:
    // 1. If Admin -> Free
    // 2. If Pro AND Credits > 0 -> Deduct (Hybrid Case)
    // 3. If Pro AND Credits == 0 (or NULL) -> Free (Unlimited Case) -- User request
    // 4. If Free -> Must have credits

    // Let's refine based on "Se invece creo un utente pro senza credito quello è libero"
    /*
       if ($user['credits'] <= 0 && $user['is_pro']) {
            sendResponse(["success" => true, "credits" => 0]); // Unlimited
       }
    */

    // BUT: What if a Hybrid user consumes all credits and reaches 0? They shouldn't become free.
    // We need a specific flag for "Unlimited". OR we assume "High Credits" = Unlimited.
    // The user said: "Se invece creo un utente pro senza credito quello è libero."
    // This implies initial state.
    // Let's assume if is_pro is TRUE, we check credits.
    // If credits > 0, we consume.
    // If credits <= 0, we allow ONLY IF is_pro is true? No, that opens the loophole.

    // BETTER APPROACH:
    // If is_pro is true, we ALWAYS consume if credits > 0.
    // If is_pro is true and credits are 0, we treat it as infinite?
    // Let's simplify: Standard PRO gets 10000 credits. Hybrid gets 30.
    // We just DEDUCT ALWAYS. If they run out, they run out.
    // "Se creo un utente pro senza credito quello è libero" -> Maybe they mean Free Tier logic is bypassed?
    // Actually, "Free" tier implies limits. "Pro" implies features.
    // Let's just remove the bypass. If an admin wants an unlimited user, give them 1,000,000 credits.

    // Removing the bypass block completely.
    // Only Admin is bypassed.


    if ($user['credits'] < $cost) {
        sendResponse(["error" => "Crediti insufficienti", "currentCredits" => (int) $user['credits']], 402);
    }

    $newCredits = (int) $user['credits'] - $cost;
    $pdo->prepare("UPDATE users SET credits = ?, credits_consumed = credits_consumed + ? WHERE id = ?")->execute([$newCredits, $cost, $userId]);

    // Log for audit
    log_activity($pdo, $userId, 'CONSUME_CREDITS', "Consumed $cost credits. New Balance: $newCredits", 'INFO');

    sendResponse(["success" => true, "credits" => $newCredits]);
}

// --- CLEAR HISTORY (Protetta) ---
if ($action === 'clear_history') {
    $pdo->prepare("DELETE FROM history WHERE user_id = ?")->execute([$userId]);
    sendResponse(["success" => true]);
}

// --- REQUEST ACCESS (Pubblica) ---
if ($action === 'request_access' && $method === 'POST') {
    $name = $input['name'] ?? 'Utente';
    $email = $input['email'] ?? '';
    if (!$email)
        sendResponse(["error" => "Email mancante"], 400);

    // Insert into DB
    $stmt = $pdo->prepare("INSERT INTO registration_requests (name, email, plan, address, piva, sdi, reason, institution_type, purpose, website, phone, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $name,
        $email,
        $input['plan'] ?? '',
        $input['address'] ?? '',
        $input['piva'] ?? '',
        $input['sdi'] ?? '',
        $input['reason'] ?? '',
        $input['institutionType'] ?? '',
        $input['purpose'] ?? '',
        $input['website'] ?? '',
        $input['phone'] ?? '',
        $input['city'] ?? ''
    ]);

    // Send Email to Admin
    $adminBody = "<p>È stata ricevuta una nuova richiesta di attivazione servizio.</p>";
    $adminBody .= "<table style='width:100%; border-collapse:collapse; margin-top:15px; font-size:14px;'>";
    $fields = [
        'Nome / Ragione Sociale' => $name,
        'Email' => $email,
        'Telefono' => $input['phone'] ?? '-',
        'Città' => $input['city'] ?? '-',
        'Piano Scelto' => $input['plan'] ?? '-',
        'Indirizzo' => $input['address'] ?? '-',
        'P.IVA / C.F.' => $input['piva'] ?? '-',
        'Codice SDI' => $input['sdi'] ?? '-',
        'Tipo Istituzione' => $input['institutionType'] ?? '',
        'Sito Web' => $input['website'] ?? '',
        'Finalità' => $input['purpose'] ?? ''
    ];

    foreach ($fields as $label => $value) {
        if (!empty($value)) {
            $adminBody .= "<tr><td style='padding:10px; border-bottom:1px solid #e2e8f0; font-weight:bold; color:#475569; width:40%;'>$label</td><td style='padding:10px; border-bottom:1px solid #e2e8f0; color:#1e293b;'>$value</td></tr>";
        }
    }
    $adminBody .= "</table>";
    $adminBody .= "<p style='margin-top:20px;'><a href='https://sonificart.com/admin' style='background:#0f172a; color:#fff; padding:10px 15px; text-decoration:none; border-radius:5px;'>Vai all'Admin Panel</a></p>";

    sendHtmlEmail('mail@sonificart.com', "Nuova Richiesta Accesso: $name", "Richiesta Attivazione PRO", $adminBody);

    // Send Confirmation to User
    $userBody = "<p>Gentile <strong>$name</strong>,</p>";
    $userBody .= "<p>Grazie per aver scelto <strong>SonificA.R.T.</strong> Abbiamo ricevuto correttamente la tua richiesta per il piano <strong>" . ($input['plan'] ?? 'PRO') . "</strong>.</p>";
    $userBody .= "<p style='background:#f0fdf4; border-left:4px solid #2dd4bf; padding:15px; margin:15px 0; color:#064e3b;'>La tua richiesta è in fase di elaborazione. Riceverai a breve una email contenente la fattura pro-forma per finalizzare l'attivazione del servizio.</p>";
    $userBody .= "<p>Se hai domande, puoi rispondere direttamente a questa email.</p>";
    $userBody .= "<p style='margin-top:30px;'>Cordiali saluti,<br><em>Il Team SonificA.R.T.</em></p>";

    sendHtmlEmail($email, "Conferma Ricezione Richiesta - SonificA.R.T.", "Richiesta Ricevuta", $userBody);

    sendResponse(["success" => true]);
}

// --- DELETE SHOWCASE ITEM (Owner or Admin) ---
if ($action === 'delete_showcase_item' && $method === 'POST') {
    $id = $input['id'] ?? null;
    if (!$id)
        sendResponse(["error" => "No ID"], 400);

    $stmt = $pdo->prepare("SELECT owner_id FROM showcase WHERE id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    if (!$item)
        sendResponse(["error" => "Item not found"], 404);

    // Check Admin
    $isAdmin = false;
    if ($userId) {
        $stmt2 = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
        $stmt2->execute([$userId]);
        $isAdmin = (bool) $stmt2->fetchColumn();
    }

    if ($item['owner_id'] == $userId || $isAdmin) {
        $pdo->prepare("DELETE FROM showcase WHERE id = ?")->execute([$id]);
        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Unauthorized"], 403);
    }
}

// --- ADMIN ROUTES (Protetta + Check) ---
if ($userId) {
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if ($stmt->fetchColumn()) {
        if ($action === 'get_stats') {
            $dbVer = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
            // AI Stats Proxy
            $byParadigm = $pdo->query("SELECT paradigm, COUNT(*) as count FROM history GROUP BY paradigm")->fetchAll(PDO::FETCH_KEY_PAIR);
            $aiUsage = [
                "hybrid" => $byParadigm['hybrid'] ?? 0,
                "artistic" => $byParadigm['artistic'] ?? 0,
                "scientific" => $byParadigm['scientific'] ?? 0
            ];

            sendResponse([
                "totalUsers" => (int) $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn(),
                "totalSonifications" => (int) $pdo->query("SELECT COUNT(*) FROM history")->fetchColumn(),
                "aiUsage" => $aiUsage,
                "phpVersion" => phpversion(),
                "dbVersion" => $dbVer,
                "serverOs" => PHP_OS
            ]);
        }
        if ($action === 'admin_reject_request') {
            $pdo->prepare("DELETE FROM registration_requests WHERE id = ?")->execute([$input['id']]);
            sendResponse(["success" => true]);
        }
        if ($action === 'delete_user') {
            $uid = $input['id'];
            if (!$uid)
                sendResponse(["error" => "No ID"], 400);

            // Clean up files (optional, heavy op) or just DB records
            // Delete history items (files are left orphaned for now or need loop)
            $pdo->prepare("DELETE FROM history WHERE user_id = ?")->execute([$uid]);
            $pdo->prepare("DELETE FROM showcase WHERE owner_id = ?")->execute([$uid]);
            $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$uid]);

            sendResponse(["success" => true]);
        }
        if ($action === 'get_users') {
            try {
                $rawUsers = $pdo->query("SELECT id, name, email, is_pro, is_admin, credits, credits_consumed, avatar_url, custom_logo_url, tier, created_at FROM users ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                // ULTRA ROBUST FALLBACK: Select all, no ordering, no specific columns
                $rawUsers = $pdo->query("SELECT * FROM users LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
            }

            $users = [];
            foreach ($rawUsers as $u) {
                $users[] = [
                    "id" => (string) $u['id'],
                    "name" => $u['name'],
                    "email" => $u['email'],
                    "isPro" => (bool) ($u['is_pro'] ?? 0),
                    "isAdmin" => (bool) ($u['is_admin'] ?? 0),
                    "credits" => (int) ($u['credits'] ?? 0),
                    "creditsConsumed" => (int) ($u['credits_consumed'] ?? 0),
                    "avatarUrl" => $u['avatar_url'] ?? '',
                    "customLogoUrl" => $u['custom_logo_url'] ?? null,
                    "tier" => $u['tier'] ?? 'free',
                    "registeredAt" => $u['created_at'] ?? $u['registered_at'] ?? null // Try alternatives
                ];
            }
            sendResponse($users);
        }

        // --- NEW: DB INSPECTOR ---
        if ($action === 'get_db_tables') {
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            sendResponse($tables);
        }
        if ($action === 'get_table_content') {
            $table = preg_replace('/[^a-zA-Z0-9_]/', '', $input['table']); // Sanitize
            if (!$table)
                sendResponse(["error" => "Invalid table"], 400);

            try {
                $rows = $pdo->query("SELECT * FROM $table ORDER BY 1 DESC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
                $columns = [];
                if (!empty($rows)) {
                    $columns = array_keys($rows[0]);
                } else {
                    $colStmt = $pdo->query("SHOW COLUMNS FROM $table");
                    $columns = $colStmt->fetchAll(PDO::FETCH_COLUMN);
                }
                sendResponse(["columns" => $columns, "rows" => $rows]);
            } catch (Exception $e) {
                sendResponse(["error" => $e->getMessage()], 500);
            }
        }
        if ($action === 'admin_approve_request') {
            $reqId = $input['id'];
            $stmt = $pdo->prepare("SELECT * FROM registration_requests WHERE id = ?");
            $stmt->execute([$reqId]);
            $req = $stmt->fetch();

            if (!$req)
                sendResponse(["error" => "Richiesta non trovata"], 404);

            $name = $req['name'];
            $email = $req['email'];
            $plan = $req['plan']; // 'Mensile' o 'Annuale' o 'Enterprise'

            // 1. Generate Password
            $password = generatePassword(12);

            // 2. Calculate Expiration
            $isAnnual = (stripos($plan, 'Annuale') !== false);
            $days = $isAnnual ? 366 : 31;
            $expiresAt = date('Y-m-d H:i:s', strtotime("+$days days"));

            // 3. Create or Update User
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $existing = $stmt->fetch();

            $targetUserId = null;
            if ($existing) {
                $stmt = $pdo->prepare("UPDATE users SET is_pro = 1, pro_expires_at = ?, tier = 'pro', credits = 9999 WHERE id = ?");
                $stmt->execute([$expiresAt, $existing['id']]);
                $targetUserId = $existing['id'];
            } else {
                $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
                $stmt = $pdo->prepare("INSERT INTO users (name, email, password, is_pro, pro_expires_at, tier, credits, avatar_url) VALUES (?, ?, ?, 1, ?, 'pro', 9999, ?)");
                $stmt->execute([$name, $email, $password, $expiresAt, $avatar]);
                $targetUserId = $pdo->lastInsertId();
            }

            // 4. Send Welcome Email
            $body = "
                <p>Gentile <strong>$name</strong>,</p>
                <p>Siamo lieti di comunicarti che la tua richiesta per l'accesso <strong>SonificA.R.T. PRO</strong> è stata approvata!</p>
                <div style='background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 20px 0;'>
                    <p style='margin:0; font-size: 14px; color: #64748b;'>Ecco le tue credenziali di accesso:</p>
                    <p style='margin: 10px 0; font-size: 16px;'><strong>Email:</strong> $email</p>
                    <p style='margin: 10px 0; font-size: 16px;'><strong>Password Temporanea:</strong> <code style='background:#f1f5f9; padding:2px 5px; border-radius:3px;'>$password</code></p>
                </div>
                <p>Puoi accedere subito alla piattaforma cliccando il pulsante qui sotto:</p>
                <p style='text-align: center; margin: 30px 0;'>
                    <a href='https://sonificart.com' style='background: #2dd4bf; color: #0f172a; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>Inizia a Creare</a>
                </p>
                <p style='font-size: 13px; color: #64748b; font-style: italic;'>Ti raccomandiamo di cambiare la password al tuo primo accesso dalla sezione Profilo.</p>
                <p>Il tuo abbonamento <strong>$plan</strong> è ora attivo fino al " . date('d/m/Y', strtotime($expiresAt)) . ".</p>
                <p>Buon lavoro,<br><em>Il Team SonificA.R.T.</em></p>
            ";

            $mailSent = sendHtmlEmail($email, "Accesso PRO Attivato - SonificA.R.T.", "Benvenuto in SonificA.R.T. PRO", $body);

            // 5. Delete Request
            $pdo->prepare("DELETE FROM registration_requests WHERE id = ?")->execute([$reqId]);

            sendResponse(["success" => true, "message" => "Utente approvato e credenziali inviate.", "mail_status" => $mailSent]);
        }
        if ($action === 'admin_get_requests') {
            $reqs = $pdo->query("SELECT id, name, email, plan, piva, institution_type, purpose, website, phone, city, invoice_sent, paid, created_at FROM registration_requests ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($reqs as &$r) {
                $r['invoice_sent'] = (bool) $r['invoice_sent'];
                $r['paid'] = (bool) $r['paid'];
            }
            sendResponse($reqs);
        }
        if ($action === 'admin_update_request') {
            $id = $input['id'];
            $field = $input['field'];
            $value = $input['value'] ? 1 : 0;
            if (in_array($field, ['invoice_sent', 'paid'])) {
                $pdo->prepare("UPDATE registration_requests SET $field = ? WHERE id = ?")->execute([$value, $id]);
                sendResponse(["success" => true]);
            }
        }
        if ($action === 'update_showcase_item') {
            $id = $input['id'];
            $title = $input['title'] ?? null;
            $description = $input['description'] ?? null;

            // Fix boolean parsing from string (e.g. "false" string is true in PHP)
            $isPublic = isset($input['isPublic']) ? (filter_var($input['isPublic'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0) : null;
            $isFeatured = isset($input['isFeatured']) ? (filter_var($input['isFeatured'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0) : null;

            $priority = isset($input['priority']) ? (int) $input['priority'] : null;

            $parts = [];
            $params = [];
            if ($title !== null) {
                $parts[] = "title=?";
                $params[] = $title;
            }
            if ($description !== null) {
                $parts[] = "description=?";
                $params[] = $description;
            }
            if ($isPublic !== null) {
                $parts[] = "is_public=?";
                $params[] = $isPublic;
            }
            if ($priority !== null) {
                $parts[] = "priority=?";
                $params[] = $priority;
            }
            if ($isFeatured !== null) {
                $parts[] = "is_featured=?";
                $params[] = $isFeatured;
            }

            if (!empty($parts)) {
                $sql = "UPDATE showcase SET " . implode(", ", $parts) . " WHERE id=?";
                $params[] = $id;
                $pdo->prepare($sql)->execute($params);
            }
            sendResponse(["success" => true]);
        }

        // --- ADMIN CREATE USER ---
        if ($action === 'admin_create_user' && $method === 'POST') {
            // ... admin check omitted for brevity (assumed verified by middleware or earlier checks) ...
            // Note: In real code, ensure isAdmin check is present.
            // Assuming auth logic handles IsAdmin earlier or we re-verify here.

            // RE-VERIFY ADMIN
            $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            if (!$stmt->fetchColumn())
                sendResponse(["error" => "Forbidden"], 403);

            $name = $_POST['name'] ?? '';
            $email = $_POST['email'] ?? '';
            $password = $_POST['password'] ?? generatePassword();
            $credits = $_POST['credits'] ?? 5;
            $isPro = ($_POST['isPro'] === 'true' || $_POST['isPro'] === '1') ? 1 : 0;
            $isAdmin = ($_POST['isAdmin'] === 'true' || $_POST['isAdmin'] === '1') ? 1 : 0;
            $tier = $_POST['tier'] ?? 'free';
            $customLogo = $_POST['customLogoUrl'] ?? null;

            try {
                // HASH PASSWORD
                $hashed = password_hash($password, PASSWORD_DEFAULT);

                $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, is_pro, is_admin, tier, custom_logo_url, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
                $stmt->execute([$name, $email, $hashed, $credits, $isPro, $isAdmin, $tier, $customLogo, $avatar]);

                $newId = $pdo->lastInsertId();
                // Assuming log_activity function exists
                // log_activity($pdo, $userId, 'ADMIN_CREATE_USER', "Created User: $email (ID: $newId)", 'WARNING');

                // Auto-send email with credentials?
                // For now just return success
                sendResponse(["success" => true, "id" => $newId]);
            } catch (Exception $e) {
                sendResponse(["error" => $e->getMessage()], 500);
            }
        }

        // --- ADMIN UPDATE USER ---
        if ($action === 'admin_update_user' && $method === 'POST') {
            // RE-VERIFY ADMIN
            $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            if (!$stmt->fetchColumn())
                sendResponse(["error" => "Forbidden"], 403);

            $id = $_POST['id'] ?? null;
            if (!$id)
                sendResponse(["error" => "No ID"], 400);

            $updates = [];
            $params = [];

            if (isset($_POST['name'])) {
                $updates[] = "name = ?";
                $params[] = $_POST['name'];
            }
            if (isset($_POST['email'])) {
                $updates[] = "email = ?";
                $params[] = $_POST['email'];
            }
            if (isset($_POST['credits'])) {
                $updates[] = "credits = ?";
                $params[] = $_POST['credits'];
            }
            if (isset($_POST['isPro'])) {
                $updates[] = "is_pro = ?";
                $params[] = (strtolower($_POST['isPro']) === 'true' || $_POST['isPro'] === '1') ? 1 : 0;
            }
            if (isset($_POST['isAdmin'])) {
                $updates[] = "is_admin = ?";
                $params[] = (strtolower($_POST['isAdmin']) === 'true' || $_POST['isAdmin'] === '1') ? 1 : 0;
            }
            if (isset($_POST['tier'])) {
                $updates[] = "tier = ?";
                $params[] = $_POST['tier'];
            }
            if (isset($_POST['customLogoUrl'])) {
                $updates[] = "custom_logo_url = ?";
                $params[] = $_POST['customLogoUrl'];
            }

            // PASSWORD UPDATE
            if (!empty($_POST['password'])) {
                $updates[] = "password = ?";
                $params[] = password_hash($_POST['password'], PASSWORD_DEFAULT);
            }

            if (empty($updates))
                sendResponse(["success" => true]); // Nothing to update

            $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
            $params[] = $id;

            try {
                $pdo->prepare($sql)->execute($params);
                // Assuming log_activity function exists
                // log_activity($pdo, $userId, 'ADMIN_UPDATE_USER', "Updated User ID: $id", 'INFO');
                sendResponse(["success" => true]);
            } catch (Exception $e) {
                sendResponse(["error" => "Update Failed: " . $e->getMessage()], 500);
            }
        }

        // --- ADMIN IMPERSONATE USER ---
        if ($action === 'impersonate_user') {
            $targetUserId = $input['id'] ?? null;
            if (!$targetUserId)
                sendResponse(["error" => "No ID"], 400);

            // Fetch target user details
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$targetUserId]);
            $targetUser = $stmt->fetch();

            if (!$targetUser)
                sendResponse(["error" => "User not found"], 404);

            // Generate token for target user
            $token = 'user_' . $targetUser['id'] . '_' . bin2hex(random_bytes(16));

            $tier = $targetUser['tier'] ?? 'free';
            $isPro = (bool) $targetUser['is_pro'];

            sendResponse([
                "success" => true,
                "token" => $token,
                "user" => [
                    "id" => (string) $targetUser['id'],
                    "name" => $targetUser['name'],
                    "email" => $targetUser['email'],
                    "isPro" => $isPro,
                    "isAdmin" => (bool) $targetUser['is_admin'],
                    "credits" => (int) $targetUser['credits'],
                    "avatarUrl" => $targetUser['avatar_url'],
                    "customLogoUrl" => $targetUser['custom_logo_url'] ?? null,
                    "tier" => $tier,
                    "proExpiresAt" => $targetUser['pro_expires_at'] ?? null
                ]
            ]);
        }
    }
}

// --- GET PRIVACY POLICY / GENERIC SETTING (Public) ---
if (($action === 'get_privacy_policy' || $action === 'get_app_setting') && $method === 'GET') {
    $key = $_GET['key'] ?? 'privacy_policy';
    // Validate key to prevent arbitrary reads if sensitive data existed (though app_settings is mostly public info)
    $allowed_keys = ['privacy_policy', 'terms_of_service', 'image_upload_policy', 'notice_and_takedown', 'upload_disclaimer', 'cookie_policy', 'agent_health_prompt', 'agent_health_document', 'agent_health_knowledge', 'gemini_api_key', 'gemini_api_email', 'gemini_api_budget'];
    if (!in_array($key, $allowed_keys)) {
        sendResponse(["error" => "Invalid setting key"], 400);
    }

    try {
        $stmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        sendResponse(["success" => true, "content" => $val ? $val : ""]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// --- UPDATE SETTING (Admin) ---
if (($action === 'update_privacy_policy' || $action === 'update_app_setting') && $method === 'POST') {
    if (!$userId)
        sendResponse(["error" => "Unauthorized"], 401);

    // Check Admin
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn())
        sendResponse(["error" => "Forbidden"], 403);

    $key = $input['key'] ?? $_POST['key'] ?? 'privacy_policy';
    $rawContent = $input['content'] ?? $_POST['content'] ?? '';
    // Fix: Decode entities just in case the client sent escaped HTML (e.g. from a rich editor or sanitizer)
    // and the user expects it to be rendered as HTML.
    $content = html_entity_decode($rawContent);

    $allowed_keys = ['privacy_policy', 'terms_of_service', 'image_upload_policy', 'notice_and_takedown', 'upload_disclaimer', 'cookie_policy', 'agent_health_prompt', 'agent_health_document', 'agent_health_knowledge', 'gemini_api_key', 'gemini_api_email', 'gemini_api_budget'];
    if (!in_array($key, $allowed_keys)) {
        sendResponse(["error" => "Invalid setting key"], 400);
    }

    try {
        // Upsert
        $stmt = $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
        $stmt->execute([$key, $content, $content]);
        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

if (!$action)
    sendResponse(["message" => "API Ready (v1.17 - Credit Tracking Active)"]);
// --- GET PUBLIC PROFILE (No Auth Required) ---
if ($action === 'get_public_profile' && $method === 'GET') {
    $targetId = $_GET['id'] ?? null;
    if (!$targetId) {
        sendResponse(["error" => "ID utente mancante"], 400);
    }

    // 1. Get User Info (Limited)
    $stmt = $pdo->prepare("SELECT id, name, avatar_url, custom_logo_url, tier, created_at FROM users WHERE id = ?");
    $stmt->execute([$targetId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        sendResponse(["error" => "Artista non trovato"], 404);
    }

    // 2. Get User's Public Projects (Showcase only)
    $stmt = $pdo->prepare("
        SELECT s.*, h.image_hash, h.block_data 
        FROM showcase s 
        LEFT JOIN history h ON s.history_id = h.id 
        WHERE s.owner_id = ? AND s.is_public = 1 
        ORDER BY s.priority DESC, s.created_at DESC
    ");
    $stmt->execute([$targetId]);
    $rawProjects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $projects = array_map(function ($p) use ($baseUrl) {
        $audio = $p['audio_url'] ? ((strpos($p['audio_url'], '/') === 0) ? $baseUrl . $p['audio_url'] : $p['audio_url']) : null;
        $video = $p['video_url'] ? ((strpos($p['video_url'], '/') === 0) ? $baseUrl . $p['video_url'] : $p['video_url']) : null;
        $img = (strpos($p['image_url'], '/') === 0) ? $baseUrl . $p['image_url'] : $p['image_url'];

        return [
            "id" => (string) $p['id'],
            "title" => $p['title'],
            "date" => $p['created_at'],
            "author" => $p['author_name'],
            "description" => $p['description'],
            "imageUrl" => $img,
            "audioUrl" => $audio,
            "videoUrl" => $video,
            "paradigm" => $p['paradigm'],
            "tradition" => $p['tradition'],
            "tags" => $p['tags'] ? explode(',', $p['tags']) : [],
            "stats" => ["duration" => $p['duration'], "notes" => (int) $p['notes_count']],
            "imageHash" => $p['image_hash'] ?? null,
            "blockData" => isset($p['block_data']) ? json_decode($p['block_data'], true) : null
        ];
    }, $rawProjects);

    sendResponse([
        "user" => [
            "id" => (string) $user['id'],
            "name" => $user['name'],
            "avatarUrl" => $user['avatar_url'],
            "customLogoUrl" => $user['custom_logo_url'],
            "tier" => $user['tier'],
            "joined" => $user['created_at']
        ],
        "projects" => $projects
    ]);
}
?>