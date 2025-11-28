<?php
// ==================================================================================
// 0. IMPOSTAZIONI SERVER E GESTIONE ERRORI
// ==================================================================================
// IMPORTANTE: Disabilita la stampa degli errori a schermo per non rompere il JSON
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// ==================================================================================
// 1. CONFIGURAZIONE DATABASE
// ==================================================================================
$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';
$db_charset = 'utf8mb4'; // Fondamentale per evitare l'errore charset

// ==================================================================================
// 2. SETUP HEADER E CORS
// ==================================================================================
// Assicuriamoci che l'header JSON venga inviato sempre, anche in caso di fatal error prima dell'output
header("Access-Control-Allow-Origin: *"); 
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ==================================================================================
// 3. CONNESSIONE DATABASE (CORRETTA)
// ==================================================================================
// Costruzione corretta della stringa di connessione usando le variabili definite sopra
$dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    // Usiamo $db_user e $db_pass corretti
    $pdo = new PDO($dsn, $db_user, $db_pass, $options);
} catch (\PDOException $e) {
    // In caso di errore, restituiamo un JSON valido al 100%
    http_response_code(500);
    echo json_encode([
        "error" => "Errore di connessione al Database",
        "details" => $e->getMessage()
    ]);
    exit();
}

// ==================================================================================
// HELPER FUNCTIONS
// ==================================================================================
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
// Leggiamo l'input JSON in modo sicuro
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

// Gestione header authorization (compatibilità Apache/Nginx)
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

function getUserIdFromToken($token, $input) {
    // 1. Cerca nell'Authorization Header (metodo standard)
    if (strpos($token, 'Bearer ') === 0) {
        $t = substr($token, 7);
        if (strpos($t, 'user_') === 0) return str_replace('user_', '', $t);
    }
    // 2. Se non trovato, cerca nel Body JSON (per hosting che filtrano header)
    if (isset($input['auth_token'])) {
        $t = $input['auth_token'];
        if (strpos($t, 'user_') === 0) return str_replace('user_', '', $t);
    }
    return null;
}

function sendResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

// ==================================================================================
// ROUTING API
// ==================================================================================

// --- 1. LOGIN ---
if ($action === 'login' && $method === 'POST') {
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && $user['password'] === $password) {
        $pdo->prepare("UPDATE users SET created_at = NOW() WHERE id = ?")->execute([$user['id']]);
        
        $token = "user_" . $user['id'];
        sendResponse([
            "token" => $token,
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

// --- 2. REGISTRAZIONE ---
if ($action === 'register' && $method === 'POST') {
    $name = $input['name'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        sendResponse(["error" => "Email già registrata"], 400);
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, avatar_url) VALUES (?, ?, ?, 5, ?)");
        $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
        $stmt->execute([$name, $email, $password, $avatar]);
        
        $id = $pdo->lastInsertId();
        $token = "user_" . $id; 
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

// --- 3. VETRINA PUBBLICA (SHOWCASE) - No Auth Required ---
if ($action === 'get_showcase' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM showcase WHERE is_public = 1 ORDER BY created_at DESC");
        $projects = $stmt->fetchAll();
        
        $mapped = array_map(function($p) {
            return [
                "id" => (string)$p['id'],
                "title" => $p['title'],
                "date" => $p['created_at'],
                "author" => $p['author_name'],
                "description" => $p['description'],
                "imageUrl" => $p['image_url'],
                "audioUrl" => $p['audio_url'] ?: null,
                "videoUrl" => $p['video_url'] ?: null,
                "paradigm" => $p['paradigm'],
                "tradition" => $p['tradition'],
                "tags" => $p['tags'] ? explode(',', $p['tags']) : [],
                "stats" => [
                    "duration" => $p['duration'],
                    "notes" => (int)$p['notes_count']
                ],
                "isPublic" => (bool)$p['is_public']
            ];
        }, $projects);
        
        sendResponse($mapped);
    } catch (Exception $e) {
        sendResponse(["error" => "Errore recupero showcase: " . $e->getMessage()], 500);
    }
}

// ==================================================================================
// MIDDLEWARE AUTHENTICATION
// ==================================================================================
$userId = getUserIdFromToken($authHeader, $input);
if (!$userId) {
    // Se l'azione richiede login ma non c'è token
    if ($action !== 'login' && $action !== 'register' && $action !== 'get_showcase') {
        sendResponse(["error" => "Non autorizzato. Token mancante o invalido."], 401);
    }
}

// --- 4. CONTROLLO SESSIONE ---
if ($action === 'check_session') {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if ($user) {
        sendResponse([
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
        sendResponse(["error" => "Utente non trovato"], 401);
    }
}

// --- 5. GESTIONE CREDITI ---
if ($action === 'consume_credits' && $method === 'POST') {
    $cost = $input['cost'] ?? 1;
    
    $stmt = $pdo->prepare("SELECT credits, is_pro FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if ($user['is_pro']) {
        sendResponse(["success" => true, "credits" => 9999]);
    } elseif ($user['credits'] >= $cost) {
        $stmt = $pdo->prepare("UPDATE users SET credits = credits - ? WHERE id = ?");
        $stmt->execute([$cost, $userId]);
        sendResponse(["success" => true, "credits" => $user['credits'] - $cost]);
    } else {
        sendResponse(["error" => "NO_CREDITS"], 403);
    }
}

// --- 6. CRONOLOGIA PERSONALE ---
if ($action === 'save_sonification' && $method === 'POST') {
    try {
        $stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $userId, 
            $input['imageHash'], 
            $input['paradigm'], 
            $input['traditionName'],
            $input['imageUrl'] 
        ]);
        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => "Errore salvataggio: " . $e->getMessage()], 500);
    }
}

if ($action === 'get_history' && $method === 'POST') {
    $stmt = $pdo->prepare("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC");
    $stmt->execute([$userId]);
    $history = $stmt->fetchAll();
    
    $mapped = array_map(function($h) {
        return [
            "id" => $h['image_hash'],
            "timestamp" => $h['timestamp'],
            "imageUrl" => $h['image_url'], 
            "paradigm" => $h['paradigm'],
            "traditionName" => $h['tradition_name']
        ];
    }, $history);
    
    sendResponse($mapped);
}

if ($action === 'clear_history' && $method === 'POST') {
    $stmt = $pdo->prepare("DELETE FROM history WHERE user_id = ?");
    $stmt->execute([$userId]);
    sendResponse(["success" => true]);
}

// --- 7. PUBBLICAZIONE STORIA -> VETRINA ---
if ($action === 'publish_history' && $method === 'POST') {
    $entryId = $input['entryId'];
    $meta = $input['metadata'];
    
    $stmt = $pdo->prepare("SELECT * FROM history WHERE image_hash = ? AND user_id = ?");
    $stmt->execute([$entryId, $userId]);
    $entry = $stmt->fetch();
    
    if ($entry) {
        $ustmt = $pdo->prepare("SELECT name FROM users WHERE id = ?");
        $ustmt->execute([$userId]);
        $author = $ustmt->fetch()['name'];

        $stmt = $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, paradigm, tradition, tags, duration, notes_count, created_at, owner_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)");
        
        $tags = is_array($meta['tags']) ? implode(',', $meta['tags']) : $meta['tags'];
        
        $stmt->execute([
            $meta['title'],
            $author,
            $meta['description'],
            $entry['image_url'],
            $entry['paradigm'],
            $entry['tradition_name'],
            $tags,
            "3m 00s", 
            1024, 
            $userId
        ]);
        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Entry non trovata"], 404);
    }
}

// --- 8. AMMINISTRAZIONE ---
$stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
$stmt->execute([$userId]);
$isAdmin = $stmt->fetchColumn();

if ($isAdmin) {
    
    if ($action === 'get_users' && $method === 'POST') {
        $stmt = $pdo->query("SELECT id, name, email, is_pro, is_admin, credits, avatar_url, created_at as registeredAt, created_at as lastLogin FROM users ORDER BY created_at DESC");
        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['is_pro'] = (bool)$u['is_pro'];
            $u['is_admin'] = (bool)$u['is_admin'];
            $u['credits'] = (int)$u['credits'];
        }
        sendResponse($users);
    }

    if ($action === 'admin_add_showcase' && $method === 'POST') {
        $p = $input;
        $stmt = $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, audio_url, video_url, paradigm, tradition, tags, duration, notes_count, created_at, is_public, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)");
        $tags = is_array($p['tags']) ? implode(',', $p['tags']) : $p['tags'];
        $stmt->execute([
            $p['title'], $p['author'], $p['description'], $p['imageUrl'], $p['audioUrl'], $p['videoUrl'], 
            $p['paradigm'], $p['tradition'], $tags, $p['stats']['duration'], $p['stats']['notes'], $p['date'],
            $userId
        ]);
        sendResponse(["success" => true]);
    }

    if ($action === 'admin_update_showcase' && $method === 'POST') {
        $p = $input;
        $stmt = $pdo->prepare("UPDATE showcase SET title=?, author_name=?, description=?, image_url=?, audio_url=?, video_url=?, paradigm=?, tradition=?, tags=?, duration=?, notes_count=?, created_at=? WHERE id=? AND owner_id=?");
        $tags = is_array($p['tags']) ? implode(',', $p['tags']) : $p['tags'];
        $stmt->execute([
            $p['title'], $p['author'], $p['description'], $p['imageUrl'], $p['audioUrl'], $p['videoUrl'], 
            $p['paradigm'], $p['tradition'], $tags, $p['stats']['duration'], $p['stats']['notes'], $p['date'],
            $p['id'], $userId
        ]);
        sendResponse(["success" => true]);
    }

    if ($action === 'admin_delete_showcase' && $method === 'POST') {
        $stmt = $pdo->prepare("DELETE FROM showcase WHERE id = ? AND owner_id = ?");
        $stmt->execute([$input['id'], $userId]);
        sendResponse(["success" => true]);
    }

    if ($action === 'get_stats' && $method === 'POST') {
        $totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $totalSonifications = $pdo->query("SELECT COUNT(*) FROM history")->fetchColumn();
        
        sendResponse([
            "totalUsers" => (int)$totalUsers,
            "activeUsers24h" => 5,
            "totalSonifications" => (int)$totalSonifications,
            "serverHealth" => ["cpu" => 12, "memory" => 45, "uptime" => "99.9%"],
            "apiStatus" => [
                "gemini" => ["serviceName" => "Gemini", "used" => 0, "limit" => 10000, "unit" => "req", "costEstimated" => 0],
                "storage" => ["serviceName" => "Storage", "used" => 0, "limit" => 100, "unit" => "GB", "costEstimated" => 0],
                "paddle" => ["serviceName" => "Paddle", "used" => 0, "limit" => 0, "unit" => "EUR", "costEstimated" => 0]
            ]
        ]);
    }
    
    if ($action === 'get_logs' && $method === 'POST') {
        sendResponse([
            ["id" => 1, "timestamp" => date('c'), "level" => "info", "user" => "System", "action" => "Server Start", "details" => "System online"],
            ["id" => 2, "timestamp" => date('c', time() - 3600), "level" => "success", "user" => "admin@example.com", "action" => "User Login", "details" => "Admin user logged in."],
            ["id" => 3, "timestamp" => date('c', time() - 7200), "level" => "warning", "user" => "System", "action" => "DB Query", "details" => "Slow query detected on history table."],
        ]);
    }
    
    if ($action === 'admin_create_user' && $method === 'POST') {
        $name = $input['name'] ?? '';
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        $isPro = (bool)($input['isPro'] ?? false);
        $isAdminReg = (bool)($input['isAdmin'] ?? false); // Rinomino per evitare conflitto con $isAdmin della sessione

        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendResponse(["error" => "Email già registrata"], 400);
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, is_pro, is_admin, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
            $stmt->execute([$name, $email, $password, 5, $isPro, $isAdminReg, $avatar]);
            sendResponse(["success" => true, "message" => "Utente creato"]);
        } catch (Exception $e) {
            sendResponse(["error" => "Errore creazione utente: " . $e->getMessage()], 500);
        }
    }

    if ($action === 'admin_update_user' && $method === 'POST') {
        $userIdToUpdate = $input['id'] ?? null;
        if (!$userIdToUpdate) sendResponse(["error" => "ID utente mancante"], 400);

        $name = $input['name'] ?? null;
        $email = $input['email'] ?? null;
        $password = $input['password'] ?? null;
        $isPro = isset($input['isPro']) ? (bool)$input['isPro'] : null;
        $isAdminUpd = isset($input['isAdmin']) ? (bool)$input['isAdmin'] : null;
        $credits = isset($input['credits']) ? (int)$input['credits'] : null;

        $fields = [];
        $params = [];

        if ($name !== null) { $fields[] = "name=?"; $params[] = $name; }
        if ($email !== null) { $fields[] = "email=?"; $params[] = $email; }
        if ($password !== null && !empty($password)) { $fields[] = "password=?"; $params[] = $password; }
        if ($isPro !== null) { $fields[] = "is_pro=?"; $params[] = $isPro; }
        if ($isAdminUpd !== null) { $fields[] = "is_admin=?"; $params[] = $isAdminUpd; }
        if ($credits !== null) { $fields[] = "credits=?"; $params[] = $credits; }
        
        if (empty($fields)) sendResponse(["message" => "Nessun campo da aggiornare"], 200);

        $params[] = $userIdToUpdate;
        $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);
        sendResponse(["success" => true, "message" => "Utente aggiornato"]);
    }

    if ($action === 'admin_delete_user' && $method === 'POST') {
        $userIdToDelete = $input['id'] ?? null;
        if (!$userIdToDelete) sendResponse(["error" => "ID utente mancante"], 400);

        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$userIdToDelete]);
        sendResponse(["success" => true, "message" => "Utente eliminato"]);
    }

} else {
    // Se userId è autenticato ma non è admin e tenta azioni admin
    if (strpos($action, 'admin_') === 0) {
        sendResponse(["error" => "Accesso negato. Richiede privilegi di amministratore."], 403);
    }
}

// Fallback se nessuna azione è stata intercettata
if ($userId && !$action) {
    sendResponse(["message" => "SonificART API v1.0 Ready (Authenticated)"]);
} elseif (!$action) {
    sendResponse(["message" => "SonificART API v1.0 Ready"]);
}
?>