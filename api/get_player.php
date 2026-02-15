<?php
header('Content-Type: application/json');

$playerData = [
    "status" => "success",
    "data" => [
        "player" => [
            "id" => "p001",
            "name" => "勇者",
            "assets" => [
                "model_url" => "assets/fbx/character2_idle.fbx",
                "anim_walk_url" => "assets/fbx/character2_walk.fbx",
                "scale" => 0.01
            ],
            "stats" => [
                "hp" => 100,
                "maxHp" => 100,
                "attack" => 15,
                "defense" => 5
            ]
        ]
    ]
];

echo json_encode($playerData);
