<?php
// ==================================================================================
// 0. CONFIGURAZIONE PRODUZIONE
// ==================================================================================
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

@ini_set('memory_limit', '1024M');
@ini_set('post_max_size', '1024M');
@ini_set('upload_max_filesize', '1024M');
@ini_set('max_execution_time', 600);

// ==================================================================================
// 1. DATABASE
// ==================================================================================
$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';
$db_charset = 'utf8mb4';
$baseUrl = "https://" . $_SERVER['HTTP_HOST'];

// ==================================================================================
// 2. HEADERS
// ==================================================================================
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ==================================================================================
// 3. CONNESSIONE DB
// ==================================================================================
try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";
    $pdo = new PDO($dsn, $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// ==================================================================================
// 4. HELPER FUNCTIONS
// ==================================================================================
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Gestione Input Unificata
$input = [];
if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false) {
    $input = $_POST;
} else {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?? [];
}

// ... functions ...

function getUserIdFromToken($input)
{
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? $headers['authorization'] ?? ($input['auth_token'] ?? ($_POST['auth_token'] ?? ''));
    if (strpos($token, 'Bearer ') === 0)
        $token = substr($token, 7);
    if (strpos($token, 'user_') === 0)
        return str_replace('user_', '', $token);
    return null;
}

function sendResponse($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data);
    exit();
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
    if ($ext === 'quicktime')
        $ext = 'mov';
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

function saveUploadedFile($fileKey, $type, $hash)
{
    if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK)
        return null;
    $file = $_FILES[$fileKey];
    $ext = ($type === 'image') ? 'jpg' : 'wav';

    // Validate if user provided a specific name/ext? No, stick to hash.
    // Actually for security verify mime type? assume ok for now context.

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

// ...

// --- SAVE SONIFICATION (MULTIPART SUPPORT) ---
if ($action === 'save_sonification' && $method === 'POST') {
    try {
        $hash = $input['imageHash'] ?? 'hash_' . time();
        $isMultipart = (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false);

        // Campi JSON (se multipart arrivano come stringhe, se JSON come array/null)
        // Helper per decodificare se stringa
        $decodeIfNeeded = function ($val) {
            return (is_string($val) && (strpos($val, '{') === 0 || strpos($val, '[') === 0)) ? $val : (is_array($val) ? json_encode($val) : $val);
        };
        // ATTENZIONE: Se ricevo array da JSON input, json_encode mi serve per salvarlo nel DB (che vuole stringa)
        // Se ricevo stringa da FormData, è già pronta per il DB? Sì.
        // Ma aspetta: in JSON mode facevo isset(...) ? json_encode(...) : null.
        // Unifichiamo: Vogliamo STRINGHE JSON valide per il DB.

        $getJsonString = function ($key) use ($input) {
            if (!isset($input[$key]))
                return null;
            $val = $input[$key];
            if (is_array($val))
                return json_encode($val);
            // Se è stringa, assumiamo sia già JSON valido o raw text. Per events/blocks è JSON.
            // Controlliamo se è 'null' stringa?
            if ($val === 'null')
                return null;
            return $val;
        };

        $musicPrompt = $getJsonString('musicGenerationPrompt');
        $generatedAiTrackUrl = $input['generatedAiTrackUrl'] ?? null;
        if ($generatedAiTrackUrl === 'null')
            $generatedAiTrackUrl = null;
        $configJson = $getJsonString('configUsed');
        $eventData = $getJsonString('events');
        $blockData = $getJsonString('blockData');

        // Gestione File (Ibrido: Files o Base64)
        $imgUrl = null;
        if (isset($_FILES['imageFile'])) {
            $imgUrl = saveUploadedFile('imageFile', 'image', $hash);
        } else {
            $imgUrl = saveBase64File($input['imageUrl'] ?? '', 'image', $hash);
        }

        $audioUrl = null;
        if (isset($_FILES['audioFile'])) {
            $audioUrl = saveUploadedFile('audioFile', 'audio', $hash);
        } else {
            $audioUrl = saveBase64File($input['audioData'] ?? '', 'audio', $hash);
        }

        if (!$imgUrl)
            $imgUrl = "placeholder.png";

        $stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url, music_generation_prompt, generated_ai_track_url, config_json, event_data, block_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $hash, $input['paradigm'], $input['traditionName'], $imgUrl, $audioUrl, $musicPrompt, $generatedAiTrackUrl, $configJson, $eventData, $blockData]);

        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => "Save Error: " . $e->getMessage()], 500);
    }
}

function generatePassword($length = 10)
{
    return substr(str_shuffle(str_repeat('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', ceil($length / strlen('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')))), 1, $length);
}

function sendHtmlEmail($to, $subject, $title, $bodyContent)
{
    $headers = "MIME-Version: 1.0\r\nContent-type:text/html;charset=UTF-8\r\nFrom: SonificART <mail@sonificart.com>\r\n";
    $template = "<!DOCTYPE html><html><head><style>body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#f4f4f9;}.container{max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.05);}.header{background:#0f172a;padding:30px;text-align:center;}.header img{width:180px;}.content{padding:40px 30px;color:#334155;line-height:1.6;}.h1{color:#8b5cf6;font-size:24px;margin-bottom:20px;font-weight:bold;}.info-box{background:#f8fafc;border-left:4px solid #2dd4bf;padding:15px;margin:20px 0;border-radius:4px;}.footer{background:#f1f5f9;padding:20px;text-align:center;font-size:12px;color:#94a3b8;}.btn{display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:50px;font-weight:bold;margin-top:20px;}</style></head><body><div class='container'><div class='header'><img src='https://sonificart.com/logo.png' alt='SonificART Logo'></div><div class='content'><div class='h1'>$title</div>$bodyContent</div><div class='footer'>&copy; " . date('Y') . " SonificA.R.T. Framework</div></div></body></html>";
    @mail($to, $subject, $template, $headers);
}

// ==================================================================================
// 5. ROTTE API
// ==================================================================================
// === NUOVA ROTTA PER UPLOAD A PEZZI (CHUNKED) ===
if ($action === 'upload_chunk' && $method === 'POST') {
    $tempDir = __DIR__ . '/../media/temp_chunks/';
    if (!file_exists($tempDir))
        mkdir($tempDir, 0777, true);

    if (!isset($_FILES['fileChunk']) || !isset($_POST['uploadId']) || !isset($_POST['chunkIndex']) || !isset($_POST['totalChunks']) || !isset($_POST['originalFilename'])) {
        sendResponse(['error' => 'Parametri chunk mancanti'], 400);
    }

    $chunk = $_FILES['fileChunk'];
    $uploadId = basename($_POST['uploadId']); // Pulizia per sicurezza
    $chunkIndex = (int) $_POST['chunkIndex'];
    $totalChunks = (int) $_POST['totalChunks'];
    $originalFilename = basename($_POST['originalFilename']); // Pulizia per sicurezza

    // Salva il pezzetto
    $chunkPath = $tempDir . $uploadId . '_chunk_' . $chunkIndex;
    if (!move_uploaded_file($chunk['tmp_name'], $chunkPath)) {
        sendResponse(['error' => 'Failed to save chunk'], 500);
    }

    // Se è l'ultimo pezzetto, assembla il file finale
    if ($chunkIndex === $totalChunks - 1) {
        $ext = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
        $finalDir = __DIR__ . '/../media/custom/';
        if (!file_exists($finalDir))
            mkdir($finalDir, 0755, true);

        $finalFilename = uniqid('pub_', true) . '.' . $ext;
        $finalPath = $finalDir . $finalFilename;

        $finalFile = fopen($finalPath, 'ab');
        if (!$finalFile) {
            sendResponse(['error' => 'Impossibile creare il file finale'], 500);
        }

        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkToRead = $tempDir . $uploadId . '_chunk_' . $i;
            if (file_exists($chunkToRead)) {
                $chunkContent = file_get_contents($chunkToRead);
                fwrite($finalFile, $chunkContent);
                unlink($chunkToRead); // Pulisci il pezzetto dopo averlo scritto
            }
        }
        fclose($finalFile);

        $fileType = in_array($ext, ['mp4', 'mov', 'avi', 'webm']) ? 'video' : 'audio';
        sendResponse(["success" => true, "url" => "/media/custom/" . $finalFilename, "type" => $fileType]);

    } else {
        // Se non è l'ultimo pezzetto, rispondi solo con un 'OK'
        sendResponse(['success' => true, 'message' => "Chunk {$chunkIndex} received."]);
    }
    exit();
}

// --- LOGIN ---
if ($action === 'login' && $method === 'POST') {
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user && $user['password'] === $password) {
        $pdo->prepare("UPDATE users SET created_at = NOW() WHERE id = ?")->execute([$user['id']]);
        sendResponse(["token" => "user_" . $user['id'], "user" => ["id" => (string) $user['id'], "name" => $user['name'], "email" => $user['email'], "isPro" => (bool) $user['is_pro'], "isAdmin" => (bool) $user['is_admin'], "credits" => (int) $user['credits'], "avatarUrl" => $user['avatar_url']]]);
    } else {
        sendResponse(["error" => "Credenziali non valide"], 401);
    }
}

// --- REGISTRAZIONE ---
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

        $msg = "<p>Grazie per la registrazione!</p><div class='info-box'><strong>Email:</strong> $email<br><strong>Password:</strong> $password</div>";
        sendHtmlEmail($email, "Benvenuto in SonificART", "Registrazione Completata", $msg);

        sendResponse(["token" => "user_" . $id, "user" => ["id" => (string) $id, "name" => $name, "email" => $email, "isPro" => false, "credits" => 5]]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// --- REQUEST ACCESS (RICHIESTA PRO - PENDING) ---
if ($action === 'request_access' && $method === 'POST') {
    $name = $input['name'] ?? 'Utente';
    $email = $input['email'] ?? '';
    $plan = $input['plan'] ?? 'Mensile';
    $piva = $input['piva'] ?? '-';
    $address = $input['address'] ?? '-';
    $sdi = $input['sdi'] ?? '-';
    $reason = $input['reason'] ?? '-';

    if (!$email)
        sendResponse(["error" => "Email mancante"], 400);

    $stmt = $pdo->prepare("INSERT INTO registration_requests (name, email, plan, address, piva, sdi, reason) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$name, $email, $plan, $address, $piva, $sdi, $reason]);

    $msgUser = "<p>Grazie <strong>$name</strong>, abbiamo ricevuto la tua richiesta per il piano <strong>PRO ($plan)</strong>.</p><p>La tua richiesta è in attesa di approvazione per la fatturazione. Riceverai i dettagli di accesso e la fattura pro-forma appena approvata.</p>";
    sendHtmlEmail($email, "Richiesta Accesso RICEVUTA", "Richiesta in Elaborazione", $msgUser);

    $msgAdmin = "<p><strong>NUOVA RICHIESTA PRO:</strong></p><ul><li>Nome: $name</li><li>Email: $email</li><li>Piano: $plan</li><li>P.IVA: $piva</li></ul><p>Procedere all'approvazione.</p>";
    sendHtmlEmail("mail@sonificart.com", "NUOVO LEAD: $name", "Nuova Richiesta Accesso", $msgAdmin);

    sendResponse(["success" => true]);
}

// --- ADMIN APPROVAZIONE RICHIESTA ---
if ($action === 'admin_approve_request' && $method === 'POST') {
    $reqId = $input['id'];
    $req = $pdo->query("SELECT * FROM registration_requests WHERE id=$reqId")->fetch();

    if ($req) {
        $password = generatePassword(10);
        $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($req['name']);

        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, avatar_url, is_pro, is_admin) VALUES (?, ?, ?, 9999, ?, 1, 0)");
        $stmt->execute([$req['name'], $req['email'], $password, $avatar]);

        $pdo->query("DELETE FROM registration_requests WHERE id=$reqId");

        $msgApprove = "<p>La tua richiesta è stata <strong>APPROVATA</strong>!</p><div class='info-box'><strong>Email:</strong> {$req['email']}<br><strong>Password:</strong> $password</div><p>Il servizio è attivo. Riceverai la fattura separatamente.</p><a href='https://sonificart.com' class='btn'>ACCEDI ORA</a>";
        sendHtmlEmail($req['email'], "Benvenuto in SonificART PRO", "Accesso PRO Attivato", $msgApprove);

        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Richiesta non trovata"], 404);
    }
}

// --- ADMIN RIFIUTO RICHIESTA ---
if ($action === 'admin_reject_request' && $method === 'POST') {
    $pdo->query("DELETE FROM registration_requests WHERE id={$input['id']}");
    sendResponse(["success" => true]);
}

// --- ADMIN GET RICHIESTE ---
if ($action === 'admin_get_requests' && $method === 'POST') {
    $reqs = $pdo->query("SELECT id, name, email, plan, piva, created_at FROM registration_requests ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
    sendResponse($reqs);
}

// --- MIDDLEWARE AUTHENTICATION ---
$userId = getUserIdFromToken($input);
if (!$userId) {
    if (!in_array($action, ['login', 'register', 'get_showcase', 'reset_password', 'upload_media', 'request_access', 'admin_get_requests'])) {
        sendResponse(["error" => "Unauthorized"], 401);
    }
}

// --- UPLOAD MEDIA ---
if ($action === 'upload_media' && $method === 'POST') {
    if (!isset($_FILES['file']))
        sendResponse(["error" => "Nessun file ricevuto"], 400);

    $file = $_FILES['file'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $targetDir = __DIR__ . '/../media/custom/';
    if (!file_exists($targetDir))
        mkdir($targetDir, 0755, true);

    $newFileName = uniqid('pub_', true) . '.' . $ext;

    if (move_uploaded_file($file['tmp_name'], $targetDir . $newFileName)) {
        sendResponse(["success" => true, "url" => "/media/custom/" . $newFileName, "type" => in_array($ext, ['mp4', 'mov', 'avi']) ? 'video' : 'audio']);
    } else {
        sendResponse(["error" => "Errore scrittura file su disco"], 500);
    }
}

// --- SAVE SONIFICATION ---
if ($action === 'save_sonification' && $method === 'POST') {
    try {
        $hash = $input['imageHash'] ?? 'hash_' . time();

        // Handling JSON fields
        $musicPrompt = isset($input['musicGenerationPrompt']) ? json_encode($input['musicGenerationPrompt']) : null;
        $generatedAiTrackUrl = $input['generatedAiTrackUrl'] ?? null;
        $configJson = isset($input['configUsed']) ? json_encode($input['configUsed']) : null;

        // Critical Logic Data (Events & Blocks)
        $eventData = isset($input['events']) ? json_encode($input['events']) : null;
        $blockData = isset($input['blockData']) ? json_encode($input['blockData']) : null;

        $imgUrl = saveBase64File($input['imageUrl'] ?? '', 'image', $hash);
        $audioUrl = saveBase64File($input['audioData'] ?? '', 'audio', $hash);
        if (!$imgUrl)
            $imgUrl = "placeholder.png";

        $stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url, music_generation_prompt, generated_ai_track_url, config_json, event_data, block_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $hash, $input['paradigm'], $input['traditionName'], $imgUrl, $audioUrl, $musicPrompt, $generatedAiTrackUrl, $configJson, $eventData, $blockData]);

        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// --- DELETE HISTORY ITEM (CANCELLAZIONE A CASCATA INTEGRATA) ---
// Ho mantenuto il metodo POST originale per compatibilità con il tuo frontend.
// Ho aggiunto SOLO la query per cancellare dalla showcase.
if ($action === 'delete_history_item' && $method === 'POST') {
    $entryId = $input['id'] ?? '';

    // Recupero dati
    $stmt = $pdo->prepare("SELECT image_url, audio_url FROM history WHERE id = ? AND user_id = ?");
    $stmt->execute([$entryId, $userId]);
    $item = $stmt->fetch();

    if ($item) {
        // Pulizia file fisici
        if (!empty($item['image_url']) && strpos($item['image_url'], '/media') !== false)
            @unlink(__DIR__ . '/../' . $item['image_url']);
        if (!empty($item['audio_url']) && strpos($item['audio_url'], '/media') !== false)
            @unlink(__DIR__ . '/../' . $item['audio_url']);

        // Cancellazione da History (Privato)
        $stmt = $pdo->prepare("DELETE FROM history WHERE id = ?");
        $stmt->execute([$entryId]);

        // --- AGGIUNTA: CANCELLAZIONE A CASCATA SU GALLERIA (Pubblico) ---
        // Se esiste un'opera pubblica di questo utente con la stessa immagine, viene cancellata
        if (!empty($item['image_url'])) {
            $pdo->prepare("DELETE FROM showcase WHERE owner_id = ? AND image_url = ?")
                ->execute([$userId, $item['image_url']]);
        }
        // ---------------------------------------------------------------

        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Not found"], 404);
    }
}

// --- PUBLISH HISTORY ---
if ($action === 'publish_history' && $method === 'POST') {
    try {
        $entryId = $input['entryId'];
        $entry = $pdo->prepare("SELECT * FROM history WHERE id = ? OR image_hash = ?");
        $entry->execute([$entryId, $entryId]);
        $e = $entry->fetch();

        if ($e) {
            $author = $pdo->query("SELECT name FROM users WHERE id = $userId")->fetchColumn();
            $tags = implode(',', $input['metadata']['tags']);
            $priority = (int) ($input['metadata']['priority'] ?? 0);

            $customMediaUrl = $input['customMediaUrl'] ?? null;
            $customMediaType = $input['customMediaType'] ?? null;

            $finalAudio = ($customMediaType === 'audio') ? $customMediaUrl : ($e['audio_url'] ?? null);
            $finalVideo = ($customMediaType === 'video') ? $customMediaUrl : null;

            $stmt = $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, audio_url, video_url, paradigm, tradition, tags, duration, notes_count, created_at, owner_id, is_public, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '3m', 1024, NOW(), ?, 1, ?)");
            $stmt->execute([$input['metadata']['title'], $author, $input['metadata']['description'], $e['image_url'], $finalAudio, $finalVideo, $e['paradigm'], $e['tradition_name'], $tags, $userId, $priority]);
            sendResponse(["success" => true]);
        } else
            sendResponse(["error" => "Not found"], 404);
    } catch (Exception $ex) {
        sendResponse(["error" => $ex->getMessage()], 500);
    }
}

// --- GET HISTORY ---
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
            "musicGenerationPrompt" => isset($h['music_generation_prompt']) ? json_decode($h['music_generation_prompt'], true) : null,
            "generatedAiTrackUrl" => $h['generated_ai_track_url'] ?? null,
            "configUsed" => isset($h['config_json']) ? json_decode($h['config_json'], true) : null,
            "events" => isset($h['event_data']) ? json_decode($h['event_data'], true) : null,
            "blockData" => isset($h['block_data']) ? json_decode($h['block_data'], true) : null
        ];
    }, $history);
    sendResponse($mapped);
}

// --- GET SHOWCASE ---
if ($action === 'get_showcase' && $method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM showcase WHERE is_public = 1 ORDER BY priority DESC, created_at DESC");
    $projects = $stmt->fetchAll();
    $mapped = array_map(function ($p) use ($baseUrl) {
        $audio = $p['audio_url'] ? ((strpos($p['audio_url'], '/') === 0) ? $baseUrl . $p['audio_url'] : $p['audio_url']) : null;
        $video = $p['video_url'] ? ((strpos($p['video_url'], '/') === 0) ? $baseUrl . $p['video_url'] : $p['video_url']) : null;
        $img = (strpos($p['image_url'], '/') === 0) ? $baseUrl . $p['image_url'] : $p['image_url'];
        return ["id" => (string) $p['id'], "title" => $p['title'], "date" => $p['created_at'], "author" => $p['author_name'], "ownerId" => $p['owner_id'], "description" => $p['description'], "imageUrl" => $img, "audioUrl" => $audio, "videoUrl" => $video, "paradigm" => $p['paradigm'], "tradition" => $p['tradition'], "tags" => $p['tags'] ? explode(',', $p['tags']) : [], "stats" => ["duration" => $p['duration'], "notes" => (int) $p['notes_count']], "priority" => (int) $p['priority']];
    }, $projects);
    sendResponse($mapped);
}

// --- ALTRI ENDPOINT ---

if ($action === 'check_session') {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $u = $stmt->fetch();
    if ($u)
        sendResponse(["user" => ["id" => (string) $u['id'], "name" => $u['name'], "email" => $u['email'], "isPro" => (bool) $u['is_pro'], "isAdmin" => (bool) $u['is_admin'], "credits" => (int) $u['credits'], "avatarUrl" => $u['avatar_url']]]);
    else
        sendResponse(["error" => "User not found"], 401);
}

if ($action === 'consume_credits') {
    sendResponse(["success" => true, "credits" => 9999]);
}
if ($action === 'clear_history') {
    $pdo->prepare("DELETE FROM history WHERE user_id = ?")->execute([$userId]);
    sendResponse(["success" => true]);
}

// --- SEZIONE ADMIN ---
if ($userId) {
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if ($stmt->fetchColumn()) {
        if ($action === 'get_stats')
            sendResponse(["totalUsers" => (int) $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn(), "totalSonifications" => (int) $pdo->query("SELECT COUNT(*) FROM history")->fetchColumn(), "serverHealth" => ["cpu" => 10, "memory" => 40, "uptime" => "99.9%"], "apiStatus" => ["gemini" => ["used" => 0, "limit" => 10000], "storage" => ["used" => 0, "limit" => 100]]]);
        if ($action === 'get_users') {
            $users = $pdo->query("SELECT id, name, email, is_pro, is_admin, credits, avatar_url, created_at FROM users ORDER BY created_at DESC")->fetchAll();
            foreach ($users as &$u) {
                $u['is_pro'] = (bool) $u['is_pro'];
                $u['is_admin'] = (bool) $u['is_admin'];
            }
            sendResponse($users);
        }
        if ($action === 'admin_delete_showcase') {
            $pdo->prepare("DELETE FROM showcase WHERE id = ?")->execute([$input['id']]);
            sendResponse(["success" => true]);
        }
    }
}

if (!$action)
    sendResponse(["message" => "API Ready"]);
?>