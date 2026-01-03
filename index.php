<?php
// SONIFICART - Dynamic Social Sharing Wrapper
// This file injects Open Graph meta tags into the React app based on the shared project.

$db_host = 'localhost';
$db_name = 'diq0p57p_sonificart';
$db_user = 'diq0p57p_sonifico';
$db_pass = 'DROPAxin2026!';
$db_charset = 'utf8mb4';

// Default metadata
$title = "SonificA.R.T. - I Suoni delle Immagini";
$description = "Il framework deterministico che trasforma le immagini in composizioni musicali sinestetiche.";
$image = "https://sonificart.com/logo_social.png"; // Fallback logo
$url = "https://sonificart.com" . $_SERVER['REQUEST_URI'];

try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=$db_charset";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Detect project ID from URL
    $projectId = null;
    $type = 'museum';

    if (isset($_GET['id'])) {
        $projectId = $_GET['id'];
        $type = 'museum';
    } elseif (isset($_GET['gallery_id'])) {
        $projectId = $_GET['gallery_id'];
        $type = 'gallery';
    }

    if ($projectId) {
        if ($type === 'gallery') {
            // Fetch from showcase
            $stmt = $pdo->prepare("SELECT title, description, image_url as imageUrl FROM showcase WHERE id = ?");
            $stmt->execute([$projectId]);
            $project = $stmt->fetch();
        } else {
            // Fetch from history
            $stmt = $pdo->prepare("SELECT title, tradition_name as tradition, image_url as imageUrl FROM history WHERE id = ?");
            $stmt->execute([$projectId]);
            $project = $stmt->fetch();
            if ($project) {
                $project['description'] = "Opera sinestetica basata sulla tradizione " . $project['tradition'];
            }
        }

        if ($project) {
            $title = $project['title'] . " | SonificA.R.T.";
            if (!empty($project['description'])) {
                $description = strip_tags($project['description']);
            }

            // Fix image URL
            if (!empty($project['imageUrl'])) {
                if (strpos($project['imageUrl'], 'data:') === 0) {
                    // It's a base64, we can't easily use it in OG tags without a proxy
                    // For now, use a generic image or the logo
                } elseif (strpos($project['imageUrl'], 'http') === 0) {
                    $image = $project['imageUrl'];
                } else {
                    $image = "https://sonificart.com/" . ltrim($project['imageUrl'], '/');
                }
            }
        }
    }
} catch (Exception $e) {
    // Silence errors, fallback to defaults
}

// Load the built index.html
$html = file_get_contents(__DIR__ . '/dist/index.html');

// Prepare meta tags
$metaTags = <<<EOD
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="{$url}">
  <meta property="og:title" content="{$title}">
  <meta property="og:description" content="{$description}">
  <meta property="og:image" content="{$image}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="{$url}">
  <meta property="twitter:title" content="{$title}">
  <meta property="twitter:description" content="{$description}">
  <meta property="twitter:image" content="{$image}">
EOD;

// Inject before </head>
$html = str_replace('</head>', $metaTags . "\n</head>", $html);

echo $html;
