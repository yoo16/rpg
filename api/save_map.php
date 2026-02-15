<?php

/**
 * マップデータ保存API
 * POST /api/save_map.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if ($data && isset($data['map_id'])) {
    $mapId = $data['map_id'];
    $filePath = __DIR__ . "/../data/maps/{$mapId}.json";

    // 既存のファイルを読み込んでマージするか、単純に上書きするか
    // ここでは単純に受け取ったデータを保存する形にするが、
    // 必要に応じて既存データの読み込みとマージを行う

    if (file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
        echo json_encode(['status' => 'success']);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Failed to write file']);
    }
} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
}
