<?php
header('Content-Type: application/json');

$playerData = [
    "status" => "success",
    "data" => [
        "player" => [
            "id" => "p001",
            "name" => "勇者",
            "assets" => [
                "idle_url" => "assets/fbx/players/player1_idle.fbx",
                "anim_walk_url" => "assets/fbx/players/player1_walk.fbx",
                "scale" => 0.01
            ],
            "stats" => [
                "hp" => 50,
                "maxHp" => 50,
                "attack" => 15,
                "defense" => 5
            ]
        ]
    ]
];

echo json_encode($playerData);
