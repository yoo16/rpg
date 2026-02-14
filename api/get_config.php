<?php
/**
 * アプリケーション設定取得API
 * GET /api/get_config.php
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 設定をJSONで返す
echo json_encode([
    'status' => 'success',
    'data' => [
        'config' => [
            'baseUrl' => APP_BASE_URL,
            'debug' => APP_DEBUG,
            'environment' => 'development'
        ]
    ]
]);
?>
