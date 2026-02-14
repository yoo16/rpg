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
        // 'model_url' => 'assets/models/parrot.glb',
        'model_url' => 'assets/fbx/enemy1_idle.fbx',
        'attack_url' => 'assets/fbx/enemy1_attack.fbx',
        'y_offset' => -1.0
    ],
    'e002' => [
        'name' => 'ふらみんご',
        'hp' => 60,
        'maxHp' => 60,
        'attack' => 12,
        'defense' => 2,
        'color' => '#aa7755',
        'scale' => 0.02,
        // 'model_url' => 'assets/models/flamingo.glb',
        'model_url' => 'assets/fbx/enemy2_idle.fbx',
        'attack_url' => 'assets/fbx/enemy2_attack.fbx',
        'y_offset' => -1.2
    ],
    'e003' => [
        'name' => 'らいらいおん',
        'hp' => 100,
        'maxHp' => 100,
        'attack' => 15,
        'defense' => 4,
        'color' => '#ff3333',
        'scale' => 0.02,
        // 'model_url' => 'assets/models/horse.glb',
        'model_url' => 'assets/fbx/enemy3_idle.fbx',
        'attack_url' => 'assets/fbx/enemy3_attack.fbx',
        'y_offset' => 0
    ],
    'e004' => [
        'name' => 'むてきんぐ',
        'hp' => 200,
        'maxHp' => 200,
        'attack' => 25,
        'defense' => 5,
        'color' => '#ff3333',
        'scale' => 0.015,
        // 'model_url' => 'assets/models/horse.glb',
        'model_url' => 'assets/fbx/enemy4_idle.fbx',
        'attack_url' => 'assets/fbx/enemy4_attack.fbx',
        'y_offset' => 0
    ]
];

echo json_encode([
    'status' => 'success',
    'data' => [
        'enemies' => $enemyData
    ]
]);
