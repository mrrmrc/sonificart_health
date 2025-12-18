<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$headers = function_exists('getallheaders') ? getallheaders() : [];

$debug = [
    'headers_count' => count($headers),
    'authorization_header' => $headers['Authorization'] ?? $headers['authorization'] ?? 'MISSING',
    'GET_params' => $_GET,
    'POST_keys' => array_keys($_POST),
    'POST_auth_token' => $_POST['auth_token'] ?? 'MISSING',
    'FILES_keys' => array_keys($_FILES),
    'SERVER_HTTP_AUTHORIZATION' => $_SERVER['HTTP_AUTHORIZATION'] ?? 'MISSING',
    'SERVER_REDIRECT_HTTP_AUTHORIZATION' => $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? 'MISSING',
    'php_input_size' => strlen(file_get_contents('php://input')),
    'request_method' => $_SERVER['REQUEST_METHOD'],
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'MISSING',
];

echo json_encode($debug, JSON_PRETTY_PRINT);
?>