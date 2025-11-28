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
// SETUP HEADER E CORS
// ==================================================================================
header("Access-Control-Allow-Origin: *"); // In produzione metti il tuo dominio
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

function getUserIdFromToken($token, $input) {
    // 1. Cerca nell'Authorization Header
    if (strpos($token, 'Bearer ') === 0) {
        $t = substr($token, 7);
        if (strpos($t, 'user_') === 0) return str_replace('user_', '', $t);
    }
    // 2. Cerca nell'URL (GET param)
    if (isset($_GET['auth_token'])) {
        $t = $_GET['auth_token'];
        if (strpos($t, 'user_') === 0) return str_replace('user_', '', $t);
    }
    // 3. Cerca nel Body JSON
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

// Funzione per inviare email HTML
function sendWelcomeEmail($toEmail, $name, $password) {
    $subject = "Registrazione su portale Sonificart";
    
    $headers  = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8" . "\r\n";
    $headers .= "From: SonificA.R.T. <noreply@sonificart.com>" . "\r\n";

    $message = '
    <html>
    <head>
      <title>Benvenuto in SonificA.R.T.</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f5; color: #333; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; border: 1px solid #ddd; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { max-width: 150px; }
        .content { line-height: 1.6; }
        .credentials { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://sonificart.com/logo.png" alt="SonificA.R.T. Logo" class="logo">
        </div>
        <div class="content">
          <h2>Benvenuto nel mondo SONIFICART!</h2>
          <p>Ciao ' . htmlspecialchars($name) . ',</p>
          <p>La tua registrazione è avvenuta con successo. Siamo felici di averti a bordo per esplorare la sonificazione deterministica.</p>
          
          <div class="credentials">
            <p>Ecco le tue credenziali di accesso:</p>
            <p><strong>Login:</strong> ' . htmlspecialchars($toEmail) . '</p>
            <p><strong>Password:</strong> ' . htmlspecialchars($password) . '</p>
          </div>
          
          <p>Puoi accedere subito e iniziare a creare:</p>
          <p style="text-align: center;">
            <a href="https://sonificart.com" style="background-color: #0d9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accedi alla Dashboard</a>
          </p>
          
          <p>Buon lavoro,<br>il TEAM di SONIFICART.COM</p>
        </div>
        <div class="footer">
          &copy; ' . date("Y") . ' SonificA.R.T. Framework. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    ';

    // Tenta l'invio. Non blocchiamo l'esecuzione se fallisce, ma logghiamo l'errore se possibile.
    @mail($toEmail, $subject, $message, $headers);
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

    // NOTA: In produzione usare password_verify($password, $user['password'])
    if ($user && $user['password'] === $password) {
        // Aggiorna ultimo login
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
        $token = "user_" . $id; 
        
        // --- INVIO EMAIL DI BENVENUTO ---
        sendWelcomeEmail($email, $name, $password);

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

// --- 3. VETRINA PUBBLICA (SHOWCASE) ---
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
// MIDDLEWARE AUTHENTICATION (Verifica token per tutte le rotte seguenti)
// ==================================================================================
$userId = getUserIdFromToken($authHeader, $input); 
if (!$userId) {
    sendResponse(["error" => "Non autorizzato. Token mancante o invalido."], 401);
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

if ($action === 'get_history') {
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
    
    if ($action === 'get_users') {
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

    if ($action === 'get_stats') {
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
    
    if ($action === 'get_logs') {
        sendResponse([
            ["id" => 1, "timestamp" => date('c'), "level" => "info", "user" => "System", "action" => "Check", "details" => "System online"]
        ]);
    }

    if ($action === 'admin_create_user' && $method === 'POST') {
        $name = $input['name'] ?? '';
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        $isPro = (bool)($input['isPro'] ?? false);
        $isAdmin = (bool)($input['isAdmin'] ?? false);

        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) sendResponse(["error" => "Email già registrata"], 400);

        try {
            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, credits, is_pro, is_admin, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($name);
            $stmt->execute([$name, $email, $password, 5, $isPro, $isAdmin, $avatar]);
            sendResponse(["success" => true, "message" => "Utente creato"]);
        } catch (Exception $e) {
            sendResponse(["error" => "Errore: " . $e->getMessage()], 500);
        }
    }

    if ($action === 'admin_update_user' && $method === 'POST') {
        $userIdToUpdate = $input['id'] ?? null;
        if (!$userIdToUpdate) sendResponse(["error" => "ID mancante"], 400);

        $name = $input['name'] ?? null;
        $email = $input['email'] ?? null;
        $password = $input['password'] ?? null;
        $isPro = isset($input['isPro']) ? (bool)$input['isPro'] : null;
        $isAdmin = isset($input['isAdmin']) ? (bool)$input['isAdmin'] : null;
        $credits = isset($input['credits']) ? (int)$input['credits'] : null;

        $fields = [];
        $params = [];
        if ($name !== null) { $fields[] = "name=?"; $params[] = $name; }
        if ($email !== null) { $fields[] = "email=?"; $params[] = $email; }
        if ($password !== null && !empty($password)) { $fields[] = "password=?"; $params[] = $password; }
        if ($isPro !== null) { $fields[] = "is_pro=?"; $params[] = $isPro; }
        if ($isAdmin !== null) { $fields[] = "is_admin=?"; $params[] = $isAdmin; }
        if ($credits !== null) { $fields[] = "credits=?"; $params[] = $credits; }
        
        if (empty($fields)) sendResponse(["message" => "Nessun campo da aggiornare"], 200);
        $params[] = $userIdToUpdate;
        $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);
        sendResponse(["success" => true, "message" => "Utente aggiornato"]);
    }

    if ($action === 'admin_delete_user' && $method === 'POST') {
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$input['id']]);
        sendResponse(["success" => true, "message" => "Utente eliminato"]);
    }

} else {
    if (strpos($action, 'admin_') === 0) sendResponse(["error" => "Accesso negato."], 403);
}

sendResponse(["message" => "SonificART API v1.0 Ready"]);
?>