<?php
$filePath = __DIR__ . "/../data/maps/1.json";
echo "Resolved path: " . realpath($filePath) . "\n";
echo "Original path: " . $filePath . "\n";
echo "File exists: " . (file_exists($filePath) ? "Yes" : "No") . "\n";
