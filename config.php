<?php
/**
 * ゲーム設定ファイル
 * .env ファイルから環境変数を読み込む
 */

// プロジェクトルートのパスを取得
$projectRoot = dirname(__FILE__);
$envFile = $projectRoot . '/.env';

// .env ファイルから設定を読み込む関数
function loadEnv($filePath) {
    $config = [];
    
    if (file_exists($filePath)) {
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // コメント行をスキップ
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            
            // KEY=VALUE 形式を解析
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $config[trim($key)] = trim($value);
            }
        }
    }
    
    return $config;
}

// .env ファイルをロード
$config = loadEnv($envFile);

// デフォルト設定
$appConfig = [
    'BASE_URL' => $config['BASE_URL'] ?? './api',
    'DEBUG' => $config['DEBUG'] ?? 'false',
    'ENVIRONMENT' => $config['ENVIRONMENT'] ?? 'development'
];

// グローバル変数として登録
$GLOBALS['APP_CONFIG'] = $appConfig;

// CLI スクリプトやエンドポイント用に定数として定義
if (!defined('APP_BASE_URL')) {
    define('APP_BASE_URL', $appConfig['BASE_URL']);
}

if (!defined('APP_DEBUG')) {
    define('APP_DEBUG', $appConfig['DEBUG'] === 'true');
}
?>
