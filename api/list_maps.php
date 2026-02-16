<?php

/**
 * マップ一覧取得API
 * GET /api/list_maps.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$mapDir = __DIR__ . '/../data/maps/';
$files = glob($mapDir . '*.json');

$maps = [];
foreach ($files as $file) {
    if (basename($file) === 'template.json') continue; // Skip template if exists

    $json = file_get_contents($file);
    $data = json_decode($json, true);

    // IDはファイル名から取るか、中身から取るか。
    // ファイル名が ID.json なのでファイル名推奨
    $id = pathinfo($file, PATHINFO_FILENAME);

    // 中身に name があれば使う
    $name = isset($data['name']) ? $data['name'] : "Map $id";

    $maps[] = [
        'id' => intval($id),
        'name' => $name,
        'width' => isset($data['width']) ? $data['width'] : 0,
        'height' => isset($data['height']) ? $data['height'] : 0
    ];
}

// ID順にソート
usort($maps, function ($a, $b) {
    return $a['id'] - $b['id'];
});

echo json_encode(['status' => 'success', 'data' => $maps]);
