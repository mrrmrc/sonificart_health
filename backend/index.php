<?php
// ===========================================================================
// 0. IMPOSTAZIONI SERVER
// ==================================================================================
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
$db_charset = 'utf8mb4'; 

// ==================================================================================
// 2. SETUP HEADER E CORS
// ==================================================================================
header("Access-Control-Allow-Origin: *"); 
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ==================================================================================
// 3. CONNESSIONE DATABASE
// ==================================================================================
$dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $db_user, $db_pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database Error", "details" => $e->getMessage()]);
    exit();
}

// ==================================================================================
// HELPER FUNCTIONS
// ==================================================================================
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

function getUserIdFromToken($token, $input) {
    if (strpos($token, 'Bearer ') === 0) {
        $t = substr($token, 7);
        if (strpos($t, 'user_') === 0) return str_replace('user_', '', $t);
    }
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
        sendResponse(["error" => "Credenziali non valide / Invalid credentials"], 401);
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
        sendResponse(["error" => "Email già registrata / Email already registered"], 400);
    }

    try {
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
                
                <p style='margin-bottom: 10px;'>Grazie per esserti unito a <strong>SonificART</strong>.</p>
                <p>Il tuo account è attivo. Ti abbiamo regalato <strong>5 Crediti</strong>.</p>
                <p>Ecco le tue credenziali di accesso:</p>
                
                <div style='background-color: #f9f9f9; padding: 15px; border-left: 4px solid #8A2BE2; text-align: left; margin: 20px auto; width: 80%;'>
                    <p><strong>Email:</strong> $email</p>
                    <p><strong>Password:</strong> $password</p>
                </div>

                <hr style='border: 0; border-top: 1px solid #eee; margin: 25px 0;'>

                <p style='margin-bottom: 10px;'>Thank you for joining <strong>SonificART</strong>.</p>
                <p>Your account is active. We have gifted you <strong>5 Credits</strong>.</p>
                <p>Here are your login credentials:</p>
                
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
        @mail($email, $subjectUser, $messageUser, $headersEmail);

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
        
        $subject = "Recupero Password / Password Recovery";
        $message = "
        <html>
        <body style='font-family: sans-serif; text-align: center;'>
            <img src='https://sonificart.com/logo.png' width='120'><br><br>
            <h3>Ciao " . $user['name'] . ",</h3>
            <p>La tua password è: <strong>" . $user['password'] . "</strong></p>
        </body>
        </html>";
        
        @mail($email, $subject, $message, $headersEmail);
        sendResponse(["success" => true, "message" => "Email di recupero inviata"]);
    } else {
        sendResponse(["success" => true, "message" => "Se la mail esiste, invieremo i dati."]);
    }
}

// --- 3. VETRINA ---
if ($action === 'get_showcase' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM showcase WHERE is_public = 1 ORDER BY created_at DESC");
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
                "stats" => ["duration" => $p['duration'], "notes" => (int)$p['notes_count']],
                "isPublic" => (bool)$p['is_public']
            ];
        }, $stmt->fetchAll());
        sendResponse($mapped);
    } catch (Exception $e) { sendResponse(["error" => $e->getMessage()], 500); }
}

// ==================================================================================
// MIDDLEWARE AUTHENTICATION
// ==================================================================================
$userId = getUserIdFromToken($authHeader, $input);
if (!$userId) {
    if (!in_array($action, ['login', 'register', 'get_showcase', 'reset_password'])) {
        sendResponse(["error" => "Unauthorized"], 401);
    }
}

// --- 4. CHECK SESSION ---
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

// --- 5. CREDITS ---
if ($action === 'consume_credits' && $method === 'POST') {
    $cost = $input['cost'] ?? 1;
    $user = $pdo->prepare("SELECT credits, is_pro FROM users WHERE id = ?");
    $user->execute([$userId]); $u = $user->fetch();
    if ($u['is_pro']) sendResponse(["success" => true, "credits" => 9999]);
    elseif ($u['credits'] >= $cost) {
        $pdo->prepare("UPDATE users SET credits = credits - ? WHERE id = ?")->execute([$cost, $userId]);
        sendResponse(["success" => true, "credits" => $u['credits'] - $cost]);
    } else sendResponse(["error" => "NO_CREDITS"], 403);
}

// --- 6. HISTORY ---
if ($action === 'save_sonification' && $method === 'POST') {
    $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url) VALUES (?, ?, ?, ?, ?)")
        ->execute([$userId, $input['imageHash'], $input['paradigm'], $input['traditionName'], $input['imageUrl']]);
    sendResponse(["success" => true]);
}

if ($action === 'get_history' && $method === 'POST') {
    $stmt = $pdo->prepare("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC");
    $stmt->execute([$userId]);
    $mapped = array_map(function($h) {
        return ["id" => $h['image_hash'], "timestamp" => $h['timestamp'], "imageUrl" => $h['image_url'], "paradigm" => $h['paradigm'], "traditionName" => $h['tradition_name']];
    }, $stmt->fetchAll());
    sendResponse($mapped);
}
if ($action === 'clear_history' && $method === 'POST') {
    $pdo->prepare("DELETE FROM history WHERE user_id = ?")->execute([$userId]);
    sendResponse(["success" => true]);
}

// --- 7. PUBLISH ---
if ($action === 'publish_history' && $method === 'POST') {
    $entry = $pdo->prepare("SELECT * FROM history WHERE image_hash = ? AND user_id = ?");
    $entry->execute([$input['entryId'], $userId]); $e = $entry->fetch();
    if ($e) {
        $author = $pdo->prepare("SELECT name FROM users WHERE id = ?"); $author->execute([$userId]);
        $tags = is_array($input['metadata']['tags']) ? implode(',', $input['metadata']['tags']) : $input['metadata']['tags'];
        $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, paradigm, tradition, tags, duration, notes_count, created_at, owner_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)")
            ->execute([$input['metadata']['title'], $author->fetch()['name'], $input['metadata']['description'], $e['image_url'], $e['paradigm'], $e['tradition_name'], $tags, "3m 00s", 1024, $userId]);
        sendResponse(["success" => true]);
    } else sendResponse(["error" => "Not found"], 404);
}

// --- 8. AMMINISTRAZIONE ---
if ($userId) {
    $isAdmin = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $isAdmin->execute([$userId]);
    if ($isAdmin->fetchColumn()) {
        
        // GET USERS
        if ($action === 'get_users') {
            $users = $pdo->query("SELECT id, name, email, is_pro, is_admin, credits, avatar_url, created_at as registeredAt, created_at as lastLogin FROM users ORDER BY created_at DESC")->fetchAll();
            // Casting booleans
            foreach ($users as &$u) {
                $u['is_pro'] = (bool)$u['is_pro'];
                $u['is_admin'] = (bool)$u['is_admin'];
                $u['credits'] = (int)$u['credits'];
            }
            sendResponse($users);
        }

        // SHOWCASE MANAGEMENT
        if ($action === 'admin_delete_showcase') {
            $pdo->prepare("DELETE FROM showcase WHERE id = ? AND owner_id = ?")->execute([$input['id'], $userId]);
            sendResponse(["success" => true]);
        }

        if ($action === 'admin_add_showcase') {
            $p = $input;
            $tags = is_array($p['tags']) ? implode(',', $p['tags']) : $p['tags'];
            $pdo->prepare("INSERT INTO showcase (title, author_name, description, image_url, audio_url, video_url, paradigm, tradition, tags, duration, notes_count, created_at, is_public, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)")
                ->execute([$p['title'], $p['author'], $p['description'], $p['imageUrl'], $p['audioUrl'], $p['videoUrl'], $p['paradigm'], $p['tradition'], $tags, $p['stats']['duration'], $p['stats']['notes'], $p['date'], $userId]);
            sendResponse(["success" => true]);
        }

        if ($action === 'admin_update_showcase') {
            $p = $input;
            $tags = is_array($p['tags']) ? implode(',', $p['tags']) : $p['tags'];
            $pdo->prepare("UPDATE showcase SET title=?, author_name=?, description=?, image_url=?, audio_url=?, video_url=?, paradigm=?, tradition=?, tags=?, duration=?, notes_count=?, created_at=? WHERE id=? AND owner_id=?")
                ->execute([$p['title'], $p['author'], $p['description'], $p['imageUrl'], $p['audioUrl'], $p['videoUrl'], $p['paradigm'], $p['tradition'], $tags, $p['stats']['duration'], $p['stats']['notes'], $p['date'], $p['id'], $userId]);
            sendResponse(["success" => true]);
        }

        // USER MANAGEMENT
        if ($action === 'admin_create_user') {
            $email = $input['email'] ?? '';
            $check = $pdo->prepare("SELECT id FROM users WHERE email = ?"); $check->execute([$email]);
            if ($check->fetch()) sendResponse(["error" => "Email exists"], 400);

            $avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=" . urlencode($input['name']);
            $pdo->prepare("INSERT INTO users (name, email, password, credits, is_pro, is_admin, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)")
                ->execute([$input['name'], $email, $input['password'], 5, (int)$input['isPro'], (int)$input['isAdmin'], $avatar]);
            sendResponse(["success" => true]);
        }

        if ($action === 'admin_update_user') {
            $uid = $input['id'];
            $fields = []; $params = [];
            if (isset($input['name'])) { $fields[]="name=?"; $params[]=$input['name']; }
            if (isset($input['email'])) { $fields[]="email=?"; $params[]=$input['email']; }
            if (!empty($input['password'])) { $fields[]="password=?"; $params[]=$input['password']; }
            if (isset($input['isPro'])) { $fields[]="is_pro=?"; $params[]=(int)$input['isPro']; }
            if (isset($input['isAdmin'])) { $fields[]="is_admin=?"; $params[]=(int)$input['isAdmin']; }
            
            if (!empty($fields)) {
                $params[] = $uid;
                $pdo->prepare("UPDATE users SET " . implode(',', $fields) . " WHERE id = ?")->execute($params);
            }
            sendResponse(["success" => true]);
        }

        if ($action === 'admin_delete_user') {
            $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$input['id']]);
            sendResponse(["success" => true]);
        }

        // SYSTEM LOGS (MOCK)
        if ($action === 'get_logs') {
            sendResponse([
                ["id" => 1, "timestamp" => date('c'), "level" => "info", "user" => "System", "action" => "Server Start", "details" => "System online"],
                ["id" => 2, "timestamp" => date('c', time() - 3600), "level" => "success", "user" => "admin@sonificart.com", "action" => "User Login", "details" => "Admin user logged in."],
            ]);
        }

        // STATS (ECCO LA PARTE CHE MANCAVA)
        if ($action === 'get_stats') {
             $totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
             $totalSonifications = $pdo->query("SELECT COUNT(*) FROM history")->fetchColumn();
             
             sendResponse([
                "totalUsers" => (int)$totalUsers,
                "activeUsers24h" => 5, // Mock value
                "totalSonifications" => (int)$totalSonifications,
                "serverHealth" => ["cpu" => 12, "memory" => 45, "uptime" => "99.9%"],
                "apiStatus" => [
                    "gemini" => ["serviceName" => "Gemini", "used" => 0, "limit" => 10000, "unit" => "req", "costEstimated" => 0],
                    "storage" => ["serviceName" => "Storage", "used" => 0, "limit" => 100, "unit" => "GB", "costEstimated" => 0],
                    "paddle" => ["serviceName" => "Paddle", "used" => 0, "limit" => 0, "unit" => "EUR", "costEstimated" => 0]
                ]
             ]);
        }
    }
}

if (!$action) sendResponse(["message" => "SonificART API Ready"]);
?> 