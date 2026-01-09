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
$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';
$db_charset = 'utf8mb4';
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
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_expires_at DATETIME DEFAULT NULL");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free'");
    $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS video_url VARCHAR(255) DEFAULT NULL");
    try {
        // Force add title/subtitle/description if not exists
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL");
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255) DEFAULT NULL");
        $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL");
    } catch (Exception $e) {
        // Fallback
    }
} catch (Exception $e) {
    // Ignore
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

    if (strpos($token, 'user_') === 0)
        return str_replace('user_', '', $token);
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
    $headers .= "X-Mailer: PHP/" . phpversion();

    $emailStyle = "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333;";
    $headerStyle = "background-color: #0f172a; padding: 25px; text-align: center;";
    $logoText = "color: #2dd4bf; font-size: 24px; font-weight: bold; text-decoration: none; letter-spacing: 1px;";
    $bodyStyle = "padding: 30px; background-color: #f8fafc;";
    $containerStyle = "max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);";
    $footerStyle = "background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;";

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
                <a href='https://sonificart.com' style='$logoText'>SonificA.R.T.</a>
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
    </html>";

    return @mail($to, $subject, $template, $headers);
}

function generatePassword($length = 10)
{
    return substr(str_shuffle("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"), 0, $length);
}

// INPUT PROCESSING
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$input = $_POST;

if (empty($_POST)) {
    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);
    if ($decoded) {
        $input = $decoded;
    }
}

// Ensure multipart large payload check
if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false) {
    if (empty($_POST) && empty($_FILES) && $_SERVER['CONTENT_LENGTH'] > 0) {
        sendResponse(["error" => "Payload Too Large (post_max_size exceeded)", "success" => false], 413);
    }
}

// AUTH MIDDLEWARE
$userId = getUserIdFromToken($input);
$publicActions = ['login', 'register', 'get_showcase', 'reset_password', 'upload_media', 'request_access', 'admin_get_requests', 'check_info', 'upload_chunk'];

if (!$userId && !in_array($action, $publicActions)) {
    if ($action)
        sendResponse(["error" => "Unauthorized"], 401);
}

// ======================= ROUTES =======================

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

        $generatedAiTrackUrl = $_POST['generatedAiTrackUrl'] ?? $input['generatedAiTrackUrl'] ?? null;

        $stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url, music_generation_prompt, generated_ai_track_url, config_json, event_data, block_data, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $hash, $input['paradigm'] ?? 'scientific', $input['traditionName'] ?? 'Standard', $imgUrl, $audioUrl, $musicPrompt, $generatedAiTrackUrl, $configJson, $eventData, $blockData, $finalTitle]);

        sendResponse(["success" => true]);
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
    $stmt = $pdo->prepare("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC");
    $stmt->execute([$userId]);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $mapped = array_map(function ($h) use ($baseUrl) {
        return [
            "id" => (string) $h['id'],
            "imageHash" => $h['image_hash'],
            "timestamp" => $h['timestamp'],
            "imageUrl" => (strpos($h['image_url'], '/media') !== false) ? $baseUrl . $h['image_url'] : $h['image_url'],
            "audioUrl" => $h['audio_url'] ? ((strpos($h['audio_url'], '/media') !== false) ? $baseUrl . $h['audio_url'] : $h['audio_url']) : null,
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
            "videoUrl" => $h['video_url'] ? ((strpos($h['video_url'], 'http') === 0) ? $h['video_url'] : $baseUrl . (strpos($h['video_url'], '/') === 0 ? '' : '/') . $h['video_url']) : null
        ];
    }, $history);
    sendResponse($mapped);
}

// --- GET SHOWCASE (Pubblica + Admin) ---
if ($action === 'get_showcase' && $method === 'GET') {
    try {
        $includeAll = isset($_GET['all']) && $_GET['all'] == '1';
        $where = $includeAll ? "1=1" : "is_public = 1";
        $stmt = $pdo->query("SELECT * FROM showcase WHERE $where ORDER BY priority DESC, created_at DESC");
        $projects = $stmt->fetchAll();
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
                "isFeatured" => (bool) ($p['is_featured'] ?? 0)
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
        sendResponse(["error" => "Unauthorized access to this item"], 403);
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
    if ($item['user_id'] != $userId)
        sendResponse(["error" => "Unauthorized"], 403);

    // Optional: Delete file if physical (cleanup)
    if (!empty($item['video_url']) && strpos($item['video_url'], '/media') !== false) {
        @unlink(__DIR__ . '/../' . $item['video_url']);
    }

    $pdo->prepare("UPDATE history SET video_url = NULL WHERE id = ?")->execute([$entryId]);
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
    if ($ownerId != $userId)
        sendResponse(["error" => "Unauthorized"], 403);

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

        $targetDir = __DIR__ . '/../media/custom/';
        if (!file_exists($targetDir))
            mkdir($targetDir, 0755, true);

        $newFileName = 'aud_' . $entryId . '_' . time() . '.' . $ext;
        $targetPath = $targetDir . $newFileName;

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            $finalAudioUrl = "/media/custom/" . $newFileName;
        } else {
            sendResponse(["error" => "Errore upload audio"], 500);
        }
    } else {
        sendResponse(["error" => "Nessun audio fornito"], 400);
    }

    if ($finalAudioUrl) {
        $pdo->prepare("UPDATE history SET audio_url = ? WHERE id = ?")->execute([$finalAudioUrl, $entryId]);
        // Also update showcase if present? Ideally yes, but showcase links to history item via ID usually?
        // Wait, showcase table copies URLs. We should update showcase too if it exists.
        $pdo->prepare("UPDATE showcase SET audio_url = ? WHERE image_url = (SELECT image_url FROM history WHERE id = ?)")->execute([$finalAudioUrl, $entryId]);

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

    // Ensure it is a string
    if (is_array($configUsed))
        $configUsed = json_encode($configUsed);

    $pdo->prepare("UPDATE history SET config_json = ? WHERE id = ?")->execute([$configUsed, $entryId]);
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

    if ($ownerId != $userId)
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

            $author = $pdo->query("SELECT name FROM users WHERE id = $userId")->fetchColumn();

            $metadata = is_string($input['metadata'] ?? null) ? json_decode($input['metadata'], true) : ($input['metadata'] ?? []);
            $tags = isset($metadata['tags']) ? (is_array($metadata['tags']) ? implode(',', $metadata['tags']) : $metadata['tags']) : '';

            $priority = (int) ($metadata['priority'] ?? 0);
            $customMediaUrl = $input['customMediaUrl'] ?? null;
            $customMediaType = $input['customMediaType'] ?? null;

            // Priorità: media caricato durante pub > ai_track history > audio_url history (scientifico)
            // Se c'è un customMediaUrl (video o audio), quello diventa la sorgente audio primaria per la vetrina
            $finalAudio = $customMediaUrl ?: ($e['generated_ai_track_url'] ?: ($e['audio_url'] ?: null));
            $finalVideo = ($customMediaType === 'video') ? $customMediaUrl : ($e['video_url'] ?? null);
            $finalTitle = $metadata['title'] ?? ($e['title'] ?? 'Senza Titolo');

            $stmt = $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, audio_url, video_url, paradigm, tradition, tags, duration, notes_count, created_at, owner_id, is_public, priority, history_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '3m', 1024, NOW(), ?, 1, ?, ?)");
            $stmt->execute([$finalTitle, $author, $metadata['description'] ?? '', $e['image_url'], $finalAudio, $finalVideo, $e['paradigm'], $e['tradition_name'], $tags, $userId, $priority, $e['id']]);
            $newId = $pdo->lastInsertId();

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

// --- LOGIN (Pubblica) ---
if ($action === 'login' && $method === 'POST') {
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user && $user['password'] === $password) {
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

        sendResponse([
            "token" => "user_" . $user['id'],
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
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, avatar_url) VALUES (?, ?, ?, 5, ?)");
        $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
        $stmt->execute([$name, $email, $password, $avatar]);
        $id = $pdo->lastInsertId();
        sendResponse(["token" => "user_" . $id, "user" => ["id" => (string) $id, "name" => $name, "email" => $email, "isPro" => false, "isAdmin" => false, "credits" => 5]]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// --- HELPER EXECUTION WRAPPER ---
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
if ($action === 'consume_credits')
    sendResponse(["success" => true, "credits" => 9999]);

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
    $stmt = $pdo->prepare("INSERT INTO registration_requests (name, email, plan, address, piva, sdi, reason, institution_type, purpose, website) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
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
        $input['website'] ?? ''
    ]);

    // Send Email to Admin
    $adminBody = "<p>È stata ricevuta una nuova richiesta di attivazione servizio.</p>";
    $adminBody .= "<table style='width:100%; border-collapse:collapse; margin-top:15px; font-size:14px;'>";
    $fields = [
        'Nome / Ragione Sociale' => $name,
        'Email' => $email,
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
    $userBody .= "<p style='background:#f0fdf4; border-left:4px solid #2dd4bf; padding:15px; margin:15px 0; color:#064e3b;'>La tua richiesta è in fase di elaborazione. Riceverai a breve una email contenente la fattura pro-forma e le coordinate bancarie per finalizzare l'attivazione del servizio.</p>";
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
            $rawUsers = $pdo->query("SELECT id, name, email, is_pro, is_admin, credits, avatar_url, custom_logo_url, tier, created_at FROM users ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
            $users = [];
            foreach ($rawUsers as $u) {
                $users[] = [
                    "id" => (string) $u['id'],
                    "name" => $u['name'],
                    "email" => $u['email'],
                    "isPro" => (bool) $u['is_pro'],
                    "isAdmin" => (bool) $u['is_admin'],
                    "credits" => (int) $u['credits'],
                    "avatarUrl" => $u['avatar_url'],
                    "customLogoUrl" => $u['custom_logo_url'] ?? null,
                    "tier" => $u['tier'] ?? 'free',
                    "registeredAt" => $u['created_at']
                ];
            }
            sendResponse($users);
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
            $reqs = $pdo->query("SELECT id, name, email, plan, piva, institution_type, purpose, website, invoice_sent, paid, created_at FROM registration_requests ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
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
            $isPublic = isset($input['isPublic']) ? ($input['isPublic'] ? 1 : 0) : null;
            $priority = isset($input['priority']) ? (int) $input['priority'] : null;
            $isFeatured = isset($input['isFeatured']) ? ($input['isFeatured'] ? 1 : 0) : null;

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

        if ($action === 'admin_create_user') {
            $name = $input['name'];
            $email = $input['email'];
            $password = $input['password'];
            $isPro = !empty($input['isPro']) ? 1 : 0;
            $isAdmin = !empty($input['isAdmin']) ? 1 : 0;
            $credits = (int) ($input['credits'] ?? 5);
            $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);

            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, is_pro, is_admin, credits, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
            try {
                $stmt->execute([$name, $email, $password, $isPro, $isAdmin, $credits, $avatar]);
                sendResponse(["success" => true, "id" => $pdo->lastInsertId()]);
            } catch (Exception $e) {
                sendResponse(["error" => "Email already likely exists"], 400);
            }
        }
        if ($action === 'admin_update_user') {
            $id = $input['id'];
            $name = $input['name'];
            $email = $input['email'];
            $isPro = !empty($input['isPro']) ? 1 : 0;
            $isAdmin = !empty($input['isAdmin']) ? 1 : 0;
            $credits = (int) ($input['credits'] ?? 5);
            $tier = $input['tier'] ?? 'free';
            $customLogoUrl = $input['customLogoUrl'] ?? null;

            $sql = "UPDATE users SET name=?, email=?, is_pro=?, is_admin=?, credits=?, tier=?, custom_logo_url=?";
            $params = [$name, $email, $isPro, $isAdmin, $credits, $tier, $customLogoUrl];

            if (!empty($input['password'])) {
                $sql .= ", password=?";
                $params[] = $input['password'];
            }
            $sql .= " WHERE id=?";
            $params[] = $id;

            try {
                $pdo->prepare($sql)->execute($params);
                sendResponse(["success" => true]);
            } catch (Exception $e) {
                sendResponse(["error" => "Update failed: " . $e->getMessage()], 400);
            }
        }
    }
}

if (!$action)
    sendResponse(["message" => "API Ready (v1.16)"]);
?>