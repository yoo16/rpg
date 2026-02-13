<?php
/**
 * 敵マスターデータ取得API
 * GET /api/get_enemies.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 敵マスターデータ
$enemyData = [
    'e001' => [
        'name' => 'おうむがえし',
        'hp' => 30,
        'maxHp' => 30,
        'attack' => 5,
        'defense' => 1,
        'color' => '#00dd00',
        'scale' => 0.02,
        'model_url' => 'assets/models/parrot.glb',
        'y_offset' => 1.5
    ],
    'e002' => [
        'name' => 'ふらふらみんご',
        'hp' => 60,
        'maxHp' => 60,
        'attack' => 12,
        'defense' => 2,
        'color' => '#aa7755',
        'scale' => 0.02,
        'model_url' => 'assets/models/flamingo.glb',
        'y_offset' => 1.0
    ],
    'e003' => [
        'name' => 'うまー',
        'hp' => 200,
        'maxHp' => 200,
        'attack' => 25,
        'defense' => 5,
        'color' => '#ff3333',
        'scale' => 0.015,
        'model_url' => 'assets/models/horse.glb',
        'y_offset' => 0
    ]
];

echo json_encode([
    'status' => 'success',
    'data' => [
        'enemies' => $enemyData
    ]
]);
?>
