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
                <div class="dialog-footer">▼ Next (Enter/Space)</div>
            </div>
        </div>

        <div id="battle-ui">
            <div class="battle-controls">
                <div id="battle-message" class="message-box"></div>
                <div class="command-box">
                    <button id="btn-attack" class="battle-button">こうげき</button>
                    <button id="btn-run" class="battle-button">にげる</button>
                </div>
            </div>
        </div>

        <div id="player-status-ui">
            <div class="status-panel">
                <p><span id="player-name" class="value">読み込み中...</span></p>
                <p><span id="player-level" class="value">Lv.1</span></p>
                <p><span id="player-exp" class="value"></span></p>
                <p><span id="player-next-exp" class="value"></span></p>
                <div class="hp-bar-container">
                    <div id="player-hp-bar" class="hp-bar-fill" style="width: 100%; background-color: var(--safe-color);"></div>
                </div>
                <span id="player-hp-text" class="hp-text"></span>
                <?php if (true): ?>
                    <p><span>FPS:</span><span id="fps">60</span></p>
                <?php endif; ?>
            </div>
        </div>
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