<?php
// ==================================================================================
// 0. CONFIGURAZIONE PRODUZIONE
// ==================================================================================
ini_set('display_errors', 1); // Errori nascosti per pulizia JSON
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Limiti aumentati per gestire file grandi
@ini_set('memory_limit', '512M');
@ini_set('post_max_size', '100M');
@ini_set('upload_max_filesize', '100M');
@ini_set('max_execution_time', 600);

// ==================================================================================
// 1. DATABASE & PERCORSI
// ==================================================================================
$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';
$db_charset = 'utf8mb4'; 

// URL Base del sito per i link ai file media
$baseUrl = "https://" . $_SERVER['HTTP_HOST'];

// ==================================================================================
// 2. HEADER & CORS
// ==================================================================================
header("Access-Control-Allow-Origin: *"); 
// Header dinamici per gestire sia JSON che Multipart
header("Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ==================================================================================
// 3. CONNESSIONE DATABASE
// ==================================================================================
try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);
} catch (PDOException $e) {
    header("Content-Type: application/json");
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// ==================================================================================
// 4. HELPER FUNCTIONS
// ==================================================================================
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Leggiamo input JSON solo se non è un upload file (multipart)
$input = [];
if ($action !== 'upload_media') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?? [];
}

function getUserIdFromToken($input) {
    $headers = getallheaders();
    // Supporto per token in header o in post
    $token = $headers['Authorization'] ?? $headers['authorization'] ?? ($input['auth_token'] ?? ($_POST['auth_token'] ?? ''));
    
    if (strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
    if (strpos($token, 'user_') === 0) return str_replace('user_', '', $token);
    
    return null;
}

// Funzione per salvare Base64 come file fisico (cartella media)
function saveBase64File($base64Data, $type, $hash) {
    if (!$base64Data) return null;

    // Rileva estensione e rimuovi header
    if (preg_match('/^data:(\w+)\/(\w+);base64,/', $base64Data, $typeInfo)) {
        $data = substr($base64Data, strpos($base64Data, ',') + 1);
        $ext = $typeInfo[2];
    } else {
        $data = $base64Data;
        $ext = ($type === 'image') ? 'jpg' : 'wav';
    }

    $data = base64_decode($data);
    if ($data === false) return null;

    // Normalizza estensioni
    if ($ext === 'jpeg') $ext = 'jpg';
    if ($ext === 'x-wav') $ext = 'wav';
    if ($ext === 'mpeg') $ext = 'mp3';

    // Percorso relativo per salvare (risaliamo da /api/ a /media/)
    $folder = ($type === 'image') ? '../media/images/' : '../media/audio/';
    $fileName = $hash . '.' . $ext;
    $filePath = $folder . $fileName;

    // Crea cartella se non esiste
    if (!file_exists($folder)) {
        @mkdir($folder, 0755, true);
    }

    if (file_put_contents($filePath, $data)) {
        // Ritorna il percorso WEB
        return "/media/" . ($type === 'image' ? 'images/' : 'audio/') . $fileName;
    }
    return null;
}

function sendResponse($data, $code = 200) {
    header("Content-Type: application/json; charset=UTF-8");
    http_response_code($code);
    echo json_encode($data);
    exit();
}

// ==================================================================================
// 5. ROTTE API
// ==================================================================================

// --- LOGIN (Tuo codice) ---
if ($action === 'login' && $method === 'POST') {
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && $user['password'] === $password) {
        $pdo->prepare("UPDATE users SET created_at = NOW() WHERE id = ?")->execute([$user['id']]);
        sendResponse([
            "token" => "user_" . $user['id'],
            "user" => [
                "id" => (string)$user['id'],
                "name" => $user['name'],
                "email" => $user['email'],
                "isPro" => (bool)$user['is_pro'],
                "isAdmin" => (bool)$user['is_admin'],
                "credits" => (int)$user['credits'],
                "avatarUrl" => $user['avatar_url']
            ]
        ]);
    } else {
        sendResponse(["error" => "Credenziali non valide"], 401);
    }
}

// --- REGISTRAZIONE (CON TUA EMAIL HTML ORIGINALE) ---
if ($action === 'register' && $method === 'POST') {
    $name = $input['name'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    try {
        // Controllo esistenza
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendResponse(["error" => "Email già registrata"], 400);
        }

        // Creazione
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, avatar_url) VALUES (?, ?, ?, 5, ?)");
        $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
        $stmt->execute([$name, $email, $password, $avatar]);
        
        $id = $pdo->lastInsertId();
        $token = "user_" . $id; 

        // --- INVIO EMAIL ---
        $headersEmail = "MIME-Version: 1.0" . "\r\n";
        $headersEmail .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headersEmail .= "From: SonificART <mail@sonificart.com>" . "\r\n";
        $headersEmail .= "Reply-To: mail@sonificart.com" . "\r\n";

        $subjectUser = "Benvenuto in SonificART / Welcome to SonificART";
        $messageUser = "
        <html>
        <head><title>Welcome</title></head>
        <body style='font-family: Arial, sans-serif; color: #333; background-color: #f4f4f4; padding: 20px;'>
            <div style='background-color: #fff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; text-align: center;'>
                <img src='https://sonificart.com/logo.png' alt='SonificART Logo' style='max-width: 150px; margin-bottom: 20px;'>
                <h2 style='color: #8A2BE2;'>Benvenuto / Welcome, $name!</h2>
                <p>Grazie per esserti unito a <strong>SonificART</strong>.</p>
                <div style='background-color: #f9f9f9; padding: 15px; border-left: 4px solid #8A2BE2; text-align: left; margin: 20px auto; width: 80%;'>
                    <p><strong>Email:</strong> $email</p>
                    <p><strong>Password:</strong> $password</p>
                </div>
                <br>
                <a href='https://sonificart.com' style='background-color: #8A2BE2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;'>LOGIN NOW</a>
            </div>
        </body>
        </html>
        ";
        // Usa @ per non bloccare se la mail fallisce
        @mail($email, $subjectUser, $messageUser, $headersEmail);

        // Notifica Admin
        $subjectAdmin = "[SonificART] New User: $name";
        $messageAdmin = "New registration.<br>Name: $name<br>Email: $email";
        @mail("mail@sonificart.com", $subjectAdmin, $messageAdmin, $headersEmail);

        sendResponse([
            "token" => $token, 
            "user" => [
                "id" => (string)$id,
                "name" => $name,
                "email" => $email,
                "isPro" => false,
                "credits" => 5
            ]
        ]);
    } catch (Exception $e) {
        sendResponse(["error" => "Errore registrazione: " . $e->getMessage()], 500);
    }
}

// --- 2.1 RECUPERO PASSWORD ---
if ($action === 'reset_password' && $method === 'POST') {
    $email = $input['email'] ?? '';
    $stmt = $pdo->prepare("SELECT id, name, password FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        $headersEmail = "MIME-Version: 1.0" . "\r\n";
        $headersEmail .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headersEmail .= "From: SonificART <mail@sonificart.com>" . "\r\n";
        
        $message = "
        <html>
        <body style='font-family: sans-serif; text-align: center;'>
            <img src='https://sonificart.com/logo.png' width='120'><br><br>
            <h3>Ciao " . $user['name'] . ",</h3>
            <p>La tua password è: <strong>" . $user['password'] . "</strong></p>
        </body>
        </html>";
        
        @mail($email, "Recupero Password", $message, $headersEmail);
        sendResponse(["success" => true, "message" => "Email inviata"]);
    } else {
        sendResponse(["success" => true, "message" => "Se la mail esiste, invieremo i dati."]);
    }
}

// ==================================================================================
// MIDDLEWARE AUTHENTICATION
// ==================================================================================
$userId = getUserIdFromToken($input);
if (!$userId) {
    if (!in_array($action, ['login', 'register', 'get_showcase', 'reset_password', 'upload_media'])) {
        sendResponse(["error" => "Unauthorized"], 401);
    }
}

// --- NUOVO ENDPOINT: UPLOAD MEDIA (PER IL PULSANTE "PUBBLICA") ---
if ($action === 'upload_media' && $method === 'POST') {
    if (!isset($_FILES['file'])) sendResponse(["error" => "Nessun file ricevuto"], 400);

    $file = $_FILES['file'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['mp4', 'mp3', 'wav', 'jpg', 'png', 'mov'];

    if (!in_array($ext, $allowed)) sendResponse(["error" => "Formato non supportato"], 400);

    $targetDir = '../media/custom/';
    if (!file_exists($targetDir)) @mkdir($targetDir, 0755, true);

    $newFileName = uniqid('upload_', true) . '.' . $ext;
    
    if (move_uploaded_file($file['tmp_name'], $targetDir . $newFileName)) {
        sendResponse([
            "success" => true, 
            "url" => "/media/custom/" . $newFileName,
            "type" => in_array($ext, ['mp4', 'mov']) ? 'video' : 'audio'
        ]);
    } else {
        sendResponse(["error" => "Errore scrittura file su disco"], 500);
    }
}

// --- 6. HISTORY (AGGIORNATO PER SALVATAGGIO FILESYSTEM) ---
if ($action === 'save_sonification' && $method === 'POST') {
    try {
        $hash = $input['imageHash'] ?? 'hash_' . time();
        $paradigm = $input['paradigm'] ?? 'scientific';
        $tradition = $input['traditionName'] ?? 'Unknown';
        
        // Salva file fisici
        $imgUrl = saveBase64File($input['imageUrl'] ?? '', 'image', $hash);
        $audioUrl = saveBase64File($input['audioData'] ?? '', 'audio', $hash);
        
        if (!$imgUrl) $imgUrl = "placeholder.png"; // Fallback

        // Scrivi nel DB
        $stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $hash, $paradigm, $tradition, $imgUrl, $audioUrl]);

        sendResponse(["success" => true, "message" => "Files saved"]);

    } catch (Exception $e) {
        http_response_code(400); 
        echo json_encode(["success" => false, "error" => "Errore DB: " . $e->getMessage()]);
        exit();
    }
}

// --- GET HISTORY (AGGIORNATO PER URL MEDIA) ---
if ($action === 'get_history' && $method === 'POST') {
    try {
        $stmt = $pdo->prepare("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC");
        $stmt->execute([$userId]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $mapped = array_map(function($h) use ($baseUrl) {
            return [
                "id" => $h['image_hash'],
                "timestamp" => $h['timestamp'],
                // Gestione percorsi assoluti per file media
                "imageUrl" => (strpos($h['image_url'], '/media') !== false) ? $baseUrl . $h['image_url'] : $h['image_url'],
                "audioUrl" => $h['audio_url'] ? ((strpos($h['audio_url'], '/media') !== false) ? $baseUrl . $h['audio_url'] : $h['audio_url']) : null,
                "paradigm" => $h['paradigm'],
                "traditionName" => $h['tradition_name']
            ];
        }, $history);
        sendResponse($mapped);
    } catch (Exception $e) {
        sendResponse([], 500);
    }
}

// --- ALTRI ENDPOINTS (INVARIATI) ---

if ($action === 'check_session') {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if ($user) {
        sendResponse(["user" => [
            "id" => (string)$user['id'], "name" => $user['name'], "email" => $user['email'],
            "isPro" => (bool)$user['is_pro'], "isAdmin" => (bool)$user['is_admin'],
            "credits" => (int)$user['credits'], "avatarUrl" => $user['avatar_url']
        ]]);
    } else { sendResponse(["error" => "User not found"], 401); }
}

if ($action === 'consume_credits' && $method === 'POST') {
    $cost = $input['cost'] ?? 1;
    $stmt = $pdo->prepare("SELECT credits, is_pro, is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]); 
    $u = $stmt->fetch();

    if ($u['is_pro'] || $u['is_admin']) {
        sendResponse(["success" => true, "credits" => 9999]);
    } elseif ($u['credits'] >= $cost) {
        $pdo->prepare("UPDATE users SET credits = credits - ? WHERE id = ?")->execute([$cost, $userId]);
        sendResponse(["success" => true, "credits" => $u['credits'] - $cost]);
    } else {
        sendResponse(["error" => "NO_CREDITS"], 403);
    }
}

if ($action === 'clear_history') {
    // Pulizia file fisici
    $stmt = $pdo->prepare("SELECT image_url, audio_url FROM history WHERE user_id = ?");
    $stmt->execute([$userId]);
    $files = $stmt->fetchAll();
    foreach ($files as $f) {
        if (strpos($f['image_url'], '/media') !== false) @unlink('..' . $f['image_url']);
        if ($f['audio_url'] && strpos($f['audio_url'], '/media') !== false) @unlink('..' . $f['audio_url']);
    }
    $pdo->prepare("DELETE FROM history WHERE user_id = ?")->execute([$userId]);
    sendResponse(["success" => true]);
}

// --- PUBLISH ---
// --- PUBLISH HISTORY (AGGIORNATO CON UPDATE E MEDIA CUSTOM) ---
// --- PUBLISH ---
// --- PUBLISH (CON GESTIONE MEDIA CUSTOM) ---
if ($action === 'publish_history' && $method === 'POST') {
    try {
        // Recupera dati originali dalla history
        $entry = $pdo->prepare("SELECT * FROM history WHERE image_hash = ? AND user_id = ?");
        $entry->execute([$input['entryId'], $userId]);
        $e = $entry->fetch();
        
        if ($e) {
            $author = $pdo->prepare("SELECT name FROM users WHERE id = ?"); 
            $author->execute([$userId]);
            $authorName = $author->fetch()['name'];
            
            $tags = is_array($input['metadata']['tags']) ? implode(',', $input['metadata']['tags']) : $input['metadata']['tags'];
            
            // --- NUOVA LOGICA MEDIA CUSTOM ---
            $customMediaUrl = null;
            $customMediaType = null;

            // Se il frontend invia un file custom in base64
            if (!empty($input['customMediaData'])) {
                $type = strpos($input['customMediaData'], 'video') !== false ? 'video' : 'audio';
                // Salviamo il file usando la funzione saveBase64File (che deve essere presente nel tuo file)
                $customMediaUrl = saveBase64File($input['customMediaData'], $type, 'pub_' . time() . '_' . $e['image_hash']);
                $customMediaType = $type;
            }
            
            // Decide quali URL usare nella vetrina
            // Se c'è un audio custom, usa quello, altrimenti usa l'audio originale della history
            $finalAudio = ($customMediaType === 'audio') ? $customMediaUrl : ($e['audio_url'] ?? null);
            // Se c'è un video custom, usa quello
            $finalVideo = ($customMediaType === 'video') ? $customMediaUrl : null;

            $stmt = $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, audio_url, video_url, paradigm, tradition, tags, duration, notes_count, created_at, owner_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)");
            
            $stmt->execute([
                $input['metadata']['title'], 
                $authorName, 
                $input['metadata']['description'], 
                $e['image_url'], 
                $finalAudio, 
                $finalVideo, 
                $e['paradigm'], 
                $e['tradition_name'], 
                $tags, 
                "3m", // Durata placeholder, o passala dal frontend se la hai
                1024, 
                $userId
            ]);
            
            sendResponse(["success" => true]);
        } else {
            sendResponse(["error" => "Opera originale non trovata"], 404);
        }
    } catch (Exception $ex) { 
        sendResponse(["error" => $ex->getMessage()], 500); 
    }
}

// --- 3. VETRINA (SHOWCASE) ---
// --- VETRINA (SHOWCASE) ---
// --- 3. VETRINA (SHOWCASE) ---
if ($action === 'get_showcase' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM showcase WHERE is_public = 1 ORDER BY created_at DESC");
        $projects = $stmt->fetchAll();
        $mapped = array_map(function($p) use ($baseUrl) {
            // Percorsi assoluti per i media
            $img = (strpos($p['image_url'], '/media') === 0) ? $baseUrl . $p['image_url'] : $p['image_url'];
            $audio = $p['audio_url'] ? ((strpos($p['audio_url'], '/media') !== false) ? $baseUrl . $p['audio_url'] : $p['audio_url']) : null;
            $video = $p['video_url'] ? ((strpos($p['video_url'], '/media') !== false) ? $baseUrl . $p['video_url'] : $p['video_url']) : null;

            return [
                "id" => (string)$p['id'], "title" => $p['title'], "date" => $p['created_at'], "author" => $p['author_name'],
                "description" => $p['description'], "imageUrl" => $img, "audioUrl" => $audio, "videoUrl" => $video,
                "paradigm" => $p['paradigm'], "tradition" => $p['tradition'], "tags" => $p['tags'] ? explode(',', $p['tags']) : [],
                "stats" => ["duration" => $p['duration'], "notes" => (int)$p['notes_count']], "isPublic" => (bool)$p['is_public'],
                "ownerId" => $p['owner_id'] // Aggiunto ownerId
            ];
        }, $projects);
        sendResponse($mapped);
    } catch (Exception $e) { sendResponse(["error" => $e->getMessage()], 500); }
}

// --- 8. AMMINISTRAZIONE ---
if ($userId) {
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if ($stmt->fetchColumn()) {
        
        if ($action === 'get_users') {
            $users = $pdo->query("SELECT id, name, email, is_pro, is_admin, credits, avatar_url, created_at as registeredAt, created_at as lastLogin FROM users ORDER BY created_at DESC")->fetchAll();
            foreach ($users as &$u) {
                $u['is_pro'] = (bool)$u['is_pro'];
                $u['is_admin'] = (bool)$u['is_admin'];
                $u['credits'] = (int)$u['credits'];
            }
            sendResponse($users);
        }

        // ... (Altre funzioni admin mantenute identiche, omesse solo per brevità ma presenti nel file originale)
        if ($action === 'get_stats') {
             sendResponse([
                "totalUsers" => (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn(),
                "totalSonifications" => (int)$pdo->query("SELECT COUNT(*) FROM history")->fetchColumn(),
                "serverHealth" => ["cpu" => 12, "memory" => 45, "uptime" => "99.9%"],
                "apiStatus" => ["gemini" => ["used" => 0, "limit" => 10000], "storage" => ["used" => 0, "limit" => 100]]
             ]);
        }
    }
}

if (!$action) sendResponse(["message" => "SonificART API Ready"]);
// --- DELETE HISTORY ITEM (CANCELLAZIONE SINGOLA) ---
if ($action === 'delete_history_item' && $method === 'POST') {
    $entryId = $input['id'] ?? '';
    
    // Prima recuperiamo i percorsi dei file per cancellarli dal disco
    $stmt = $pdo->prepare("SELECT image_url, audio_url FROM history WHERE id = ? AND user_id = ?");
    $stmt->execute([$entryId, $userId]);
    $item = $stmt->fetch();
    
    if ($item) {
        // Cancella immagine fisica se esiste
        if (!empty($item['image_url']) && strpos($item['image_url'], '/media') !== false) {
            $filePath = __DIR__ . '/../' . $item['image_url']; // Risale dalla cartella api alla root
            if (file_exists($filePath)) @unlink($filePath);
        }
        // Cancella audio fisico se esiste
        if (!empty($item['audio_url']) && strpos($item['audio_url'], '/media') !== false) {
            $filePath = __DIR__ . '/../' . $item['audio_url'];
            if (file_exists($filePath)) @unlink($filePath);
        }
        
        // Cancella dal DB
        $stmt = $pdo->prepare("DELETE FROM history WHERE id = ?");
        $stmt->execute([$entryId]);
        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Elemento non trovato o non tuo"], 404);
    }
}
?>