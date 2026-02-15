<?php

/**
 * マップデータ取得API
 * GET /api/get_map.php?id=1
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$mapId = isset($_GET['id']) ? intval($_GET['id']) : 1;
$filePath = __DIR__ . "/../data/maps/{$mapId}.json";

if (file_exists($filePath)) {
    $json = file_get_contents($filePath);
    echo json_encode([
        'status' => 'success',
        'data' => [
            'map' => json_decode($json)
        ]
    ]);
} else {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'Map not found']);
}
