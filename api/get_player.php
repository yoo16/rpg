<?php
header('Content-Type: application/json');

$playerData = [
    "status" => "success",
    "data" => [
        "player" => [
            "id" => "p001",
            "name" => "勇者",
            "color" => "#ff0000",
            "size" => 1.0,
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
