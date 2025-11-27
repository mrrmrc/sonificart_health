<?php
// ==================================================================================
// CONFIGURAZIONE DATABASE - MODIFICA QUESTA PARTE CON I DATI DEL TUO HOSTING
// ==================================================================================
$host = 'localhost:3306';      // Host database (es. localhost o IP)
$db   = 'ip62rd08_wordpress_b';    // Nome del database
$user = 'ip62rd08_wordpress_f';     // Username database
$pass = '_817EznfCVrd';   // Password database
$charset = 'utf8mb4';

// ==================================================================================
// SETUP HEADER E CORS (Non modificare se non sai cosa stai facendo)
// ==================================================================================
header("Access-Control-Allow-Origin: *"); // In produzione, metti il tuo dominio es: https://sonificart.com
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ==================================================================================
// CONNESSIONE DATABASE
// ==================================================================================
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Errore di connessione al Database: " . $e->getMessage()]);
    exit();
}

// ==================================================================================
// HELPER FUNCTIONS
// ==================================================================================
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

function getUserIdFromToken($token) {
    // Semplice simulazione token "user_ID". In produzione usare JWT.
    if (strpos($token, 'Bearer ') === 0) {
        $t = substr($token, 7);
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

    // In una app reale usare password_verify($password, $user['password'])
    // Qui per compatibilità con il sistema demo controlliamo se la password è quella salvata
    if ($user && $user['password'] === $password) {
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

    // Controllo esistenza
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        sendResponse(["error" => "Email già registrata"], 400);
    }

    try {
        // In produzione usare password_hash($password, PASSWORD_DEFAULT)
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, avatar_url) VALUES (?, ?, ?, 5, ?)");
        $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
        $stmt->execute([$name, $email, $password, $avatar]);
        
        $id = $pdo->lastInsertId();
        sendResponse([
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
}

// ==================================================================================
// MIDDLEWARE AUTHENTICATION
// ==================================================================================
$userId = getUserIdFromToken($authHeader);
if (!$userId) {
    sendResponse(["error" => "Non autorizzato"], 401);
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
            $input['imageUrl'] // Base64 string
        ]);
        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => "Errore salvataggio: " . $e->getMessage()], 500);
    }
}

if ($action === 'get_history' && $method === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC");
    $stmt->execute([$userId]);
    $history = $stmt->fetchAll();
    
    $mapped = array_map(function($h) {
        return [
            "id" => $h['image_hash'],
            "timestamp" => $h['timestamp'],
            "imageUrl" => $h['image_url'], // Base64
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
    
    // Recupera dati dalla history
    $stmt = $pdo->prepare("SELECT * FROM history WHERE image_hash = ? AND user_id = ?");
    $stmt->execute([$entryId, $userId]);
    $entry = $stmt->fetch();
    
    if ($entry) {
        // Recupera nome autore
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
            "3m 00s", // Placeholder
            1024, // Placeholder
            $userId
        ]);
        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Entry non trovata"], 404);
    }
}

// --- 8. AMMINISTRAZIONE ---
// Check Admin permissions for following routes
$stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
$stmt->execute([$userId]);
$isAdmin = $stmt->fetchColumn();

if ($isAdmin) {
    
    // GET USERS
    if ($action === 'get_users') {
        $stmt = $pdo->query("SELECT id, name, email, is_pro, is_admin, credits, avatar_url, created_at as registeredAt, created_at as lastLogin FROM users ORDER BY created_at DESC");
        $users = $stmt->fetchAll();
        // Converti i tipi per il frontend
        foreach ($users as &$u) {
            $u['is_pro'] = (bool)$u['is_pro'];
            $u['is_admin'] = (bool)$u['is_admin'];
            $u['credits'] = (int)$u['credits'];
        }
        sendResponse($users);
    }

    // UPDATE SHOWCASE
    if ($action === 'admin_add_showcase' && $method === 'POST') {
        $p = $input;
        $stmt = $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, audio_url, video_url, paradigm, tradition, tags, duration, notes_count, created_at, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
        $tags = is_array($p['tags']) ? implode(',', $p['tags']) : $p['tags'];
        $stmt->execute([
            $p['title'], $p['author'], $p['description'], $p['imageUrl'], $p['audioUrl'], $p['videoUrl'], 
            $p['paradigm'], $p['tradition'], $tags, $p['stats']['duration'], $p['stats']['notes'], $p['date']
        ]);
        sendResponse(["success" => true]);
    }

    if ($action === 'admin_delete_showcase' && $method === 'POST') {
        $stmt = $pdo->prepare("DELETE FROM showcase WHERE id = ?");
        $stmt->execute([$input['id']]);
        sendResponse(["success" => true]);
    }

    if ($action === 'get_stats') {
        $totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $totalSonifications = $pdo->query("SELECT COUNT(*) FROM history")->fetchColumn();
        
        sendResponse([
            "totalUsers" => (int)$totalUsers,
            "activeUsers24h" => 5, // Mock calc
            "totalSonifications" => (int)$totalSonifications,
            "serverHealth" => ["cpu" => 12, "memory" => 45, "uptime" => "99.9%"],
            "apiStatus" => [
                "gemini" => ["serviceName" => "Gemini", "used" => 1200, "limit" => 10000, "unit" => "req", "costEstimated" => 0.5],
                "storage" => ["serviceName" => "Storage", "used" => 45, "limit" => 100, "unit" => "GB", "costEstimated" => 1.2],
                "paddle" => ["serviceName" => "Paddle", "used" => 120, "limit" => 0, "unit" => "EUR", "costEstimated" => 0]
            ]
        ]);
    }
    
    // Logs (Mock for now as no table created)
    if ($action === 'get_logs') {
        sendResponse([
            ["id" => 1, "timestamp" => date('c'), "level" => "info", "user" => "System", "action" => "Check", "details" => "System online"]
        ]);
    }
}

sendResponse(["message" => "SonificART API v1.0 Ready"]);
?>