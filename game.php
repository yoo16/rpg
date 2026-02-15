<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web 3D RPG</title>
    <link rel="stylesheet" href="css/game.css">
</head>

<body>
    <div id="game-container">
        <div id="loading-ui" class="loading-overlay">
            <div class="loading-container">
                <div class="spinner"></div>
                <p>🎮 データを読み込み中...</p>
            </div>
        </div>

        <div id="canvas-container"></div>

        <div id="dialog-ui" style="display: none;">
            <div class="dialog-box">
                <div id="dialog-title" class="dialog-title"></div>
                <div id="dialog-text" class="dialog-text"></div>
                <div class="dialog-footer">▼ 次へ (Enter/Space)</div>
            </div>
        </div>

        <div id="battle-ui">
            <div id="battle-message" class="message-box"></div>

            <div class="battle-controls">
                <div class="status-panel">
                    <span>勇者 (Lv.1)</span>
                    <div class="hp-bar-container">
                        <div id="player-hp-bar" class="hp-fill" style="width: 100%; background-color: var(--safe-color);"></div>
                    </div>
                    <span id="player-hp-text" class="hp-text"></span>
                </div>
                <div class="command-box">
                    <button id="btn-attack" class="battle-button">こうげき</button>
                    <button id="btn-run" class="battle-button">にげる</button>
                </div>
            </div>
        </div>

        <?php if (true): ?>
            <div id="debug-ui">
                <p><span id="player-name" class="value">読み込み中...</span></p>
                <p><span class="label">FPS:</span> <span id="fps" class="value">60</span></p>
            </div>
        <?php endif; ?>
    </div>

    <script type="importmap">
        {
            "imports": {
                "three": "https://unpkg.com/three@0.150.0/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.150.0/examples/jsm/"
            }
        }
    </script>
    <script type="module" src="js/main.js"></script>
</body>

</html>