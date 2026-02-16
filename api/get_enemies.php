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
        'exp' => 10,
        'level' => 1,
        'color' => '#00dd00',
        'scale' => 0.02,
        'idle_url' => 'assets/fbx/enemies/enemy1_idle.fbx',
        'attack_url' => 'assets/fbx/enemies/enemy1_attack.fbx',
        'damage_url' => 'assets/fbx/enemies/enemy1_damage.fbx',
        'death_url' => 'assets/fbx/enemies/enemy1_death.fbx',
        'y_offset' => 0
    ],
    'e002' => [
        'name' => 'ふらみんご',
        'hp' => 35,
        'maxHp' => 35,
        'attack' => 6,
        'defense' => 6,
        'exp' => 15,
        'level' => 1,
        'color' => '#aa7755',
        'scale' => 0.02,
        'idle_url' => 'assets/fbx/enemies/enemy2_idle.fbx',
        'attack_url' => 'assets/fbx/enemies/enemy2_attack.fbx',
        'damage_url' => 'assets/fbx/enemies/enemy2_damage.fbx',
        'death_url' => 'assets/fbx/enemies/enemy2_death.fbx',
        'y_offset' => 0
    ],
    'e003' => [
        'name' => 'らいらいおん',
        'hp' => 50,
        'maxHp' => 50,
        'attack' => 10,
        'defense' => 8,
        'exp' => 30,
        'level' => 3,
        'color' => '#ff3333',
        'scale' => 0.02,
        'idle_url' => 'assets/fbx/enemies/enemy3_idle.fbx',
        'attack_url' => 'assets/fbx/enemies/enemy3_attack.fbx',
        'damage_url' => 'assets/fbx/enemies/enemy3_damage.fbx',
        'death_url' => 'assets/fbx/enemies/enemy3_death.fbx',
        'y_offset' => 0
    ],
    'e004' => [
        'name' => 'つよつよ',
        'hp' => 100,
        'maxHp' => 100,
        'attack' => 20,
        'defense' => 15,
        'exp' => 100,
        'level' => 10,
        'color' => '#ff3333',
        'scale' => 0.015,
        'idle_url' => 'assets/fbx/enemies/enemy4_idle.fbx',
        'attack_url' => 'assets/fbx/enemies/enemy4_attack.fbx',
        'damage_url' => 'assets/fbx/enemies/enemy4_damage.fbx',
        'death_url' => 'assets/fbx/enemies/enemy4_death.fbx',
        'y_offset' => 0
    ],
    'e005' => [
        'name' => 'むてきんぐ',
        'hp' => 20,
        'maxHp' => 1000,
        'attack' => 35,
        'defense' => 35,
        'exp' => 500,
        'level' => 20,
        'color' => '#ff3333',
        'scale' => 0.015,
        'idle_url' => 'assets/fbx/enemies/enemy5_idle.fbx',
        'attack_url' => 'assets/fbx/enemies/enemy5_attack.fbx',
        'damage_url' => 'assets/fbx/enemies/enemy5_damage.fbx',
        'death_url' => 'assets/fbx/enemies/enemy5_death.fbx',
        'y_offset' => 0
    ]
];

echo json_encode([
    'status' => 'success',
    'data' => [
        'enemies' => $enemyData
    ]
]);
