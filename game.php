<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web 3D RPG</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            width: 100vw;
            height: 100vh;
            background-color: #000;
            font-family: Arial, sans-serif;
            overflow: hidden;
        }

        /* Loading UI */
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .loading-container {
            text-align: center;
            color: #0f0;
            font-family: monospace;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #0f0;
            border-top: 4px solid transparent;
            border-radius: 50%;
            margin: 0 auto 20px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        .loading-text {
            font-size: 18px;
            margin: 0;
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {

            0%,
            100% {
                opacity: 1;
            }

            50% {
                opacity: 0.5;
            }
        }

        #canvas-container {
            width: 100%;
            height: 100%;
        }

        #ui {
            position: absolute;
            top: 20px;
            left: 20px;
            color: #0f0;
            font-size: 14px;
            background: rgba(0, 0, 0, 0.7);
            padding: 15px;
            border: 2px solid #0f0;
            font-family: monospace;
            max-width: 300px;
        }

        #ui h2 {
            margin-bottom: 10px;
            color: #0f0;
        }

        #ui p {
            margin: 5px 0;
        }

        .label {
            color: #0f0;
            font-weight: bold;
        }

        .value {
            color: #aaa;
        }

        /* Battle UI Styles */
        #battle-ui {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            /* Let clicks pass through to 3D scene if needed, but we need buttons to work */
            display: none;
            z-index: 100;
        }

        /* Message Box at Top */
        .message-box {
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #0f0;
            padding: 15px;
            color: #0f0;
            font-family: monospace;
            font-size: 18px;
            text-align: center;
            border-radius: 8px;
            pointer-events: auto;
        }

        /* Bottom Control Panel */
        .battle-controls {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            background: rgba(0, 0, 0, 0.85);
            border: 3px solid #0f0;
            border-radius: 10px;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: auto;
        }

        .status-panel {
            display: flex;
            flex-direction: column;
            gap: 10px;
            color: #0f0;
            font-family: monospace;
            min-width: 200px;
        }

        .command-box {
            display: flex;
            gap: 15px;
        }

        .battle-button {
            padding: 12px 30px;
            font-size: 16px;
            background: #222;
            color: #0f0;
            border: 2px solid #0f0;
            cursor: pointer;
            font-family: monospace;
            font-weight: bold;
            transition: all 0.2s;
            border-radius: 5px;
        }

        .battle-button:hover {
            background: #0f0;
            color: #000;
        }

        .battle-button:active {
            transform: scale(0.95);
        }

        .battle-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            border-color: #555;
            color: #555;
        }

        .hp-bar-container {
            width: 100%;
            height: 15px;
            background: #111;
            border: 1px solid #0f0;
            position: relative;
        }

        .hp-fill {
            height: 100%;
            transition: width 0.3s ease;
            background: #0f0;
        }

        .hp-text {
            font-size: 12px;
            float: right;
        }

        /* Dialog UI Styles */
        #dialog-ui {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: rgba(0, 0, 0, 0.85);
            border-top: 3px solid #0f0;
            padding: 20px;
            display: none;
            z-index: 1001;
        }

        .dialog-box {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(0, 0, 0, 0.95);
            border: 3px solid #0f0;
            padding: 20px;
            color: #0f0;
            font-family: monospace;
            font-size: 16px;
            line-height: 1.8;
            min-height: 100px;
            position: relative;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }

        .dialog-title {
            font-weight: bold;
            margin-bottom: 15px;
            color: #ffff00;
            font-size: 18px;
            text-shadow: 0 0 10px rgba(255, 255, 0, 0.5);
        }

        #dialog-text {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 16px;
        }

        .dialog-arrow {
            position: absolute;
            bottom: -20px;
            right: 20px;
            color: #0f0;
            font-size: 20px;
            animation: blink 0.5s infinite;
        }

        @keyframes blink {

            0%,
            49% {
                opacity: 1;
            }

            50%,
            100% {
                opacity: 0;
            }
        }

        /* 画面を激しく揺らすアニメーション */
        @keyframes screen-shake {
            0% {
                transform: translate(0, 0);
            }

            10% {
                transform: translate(-5px, -5px);
            }

            20% {
                transform: translate(5px, 5px);
            }

            30% {
                transform: translate(-5px, 5px);
            }

            40% {
                transform: translate(5px, -5px);
            }

            50% {
                transform: translate(-5px, -2px);
            }

            60% {
                transform: translate(5px, 2px);
            }

            70% {
                transform: translate(-2px, -5px);
            }

            80% {
                transform: translate(2px, 5px);
            }

            90% {
                transform: translate(-2px, 2px);
            }

            100% {
                transform: translate(0, 0);
            }
        }

        /* クラスが付与された時だけ揺れる */
        .shake-active {
            animation: screen-shake 0.4s cubic-bezier(.36, .07, .19, .97) both;
        }

        /* 画面全体（UI含む）を激しく揺らす */
        @keyframes global-shake {
            0% {
                transform: translate(0, 0);
            }

            10% {
                transform: translate(-8px, -8px);
            }

            20% {
                transform: translate(8px, 8px);
            }

            30% {
                transform: translate(-8px, 8px);
            }

            40% {
                transform: translate(8px, -8px);
            }

            50% {
                transform: translate(-8px, -4px);
            }

            60% {
                transform: translate(8px, 4px);
            }

            70% {
                transform: translate(-4px, -8px);
            }

            80% {
                transform: translate(4px, 8px);
            }

            90% {
                transform: translate(-4px, 4px);
            }

            100% {
                transform: translate(0, 0);
            }
        }

        .screen-shake-active {
            animation: global-shake 0.4s cubic-bezier(.36, .07, .19, .97) both;
        }
    </style>
</head>

<body>
    <div id="loading-ui" class="loading-overlay">
        <div class="loading-container">
            <div class="spinner"></div>
            <p class="loading-text">🎮 データを読み込み中...</p>
        </div>
    </div>

    <div id="canvas-container"></div>
    <!-- Battle UI -->
    <div id="battle-ui">
        <!-- Message Log (Top) -->
        <div id="battle-message" class="message-box"></div>

        <!-- Controls (Bottom) -->
        <div class="battle-controls">
            <!-- Status (Left) -->
            <div class="status-panel">
                <div class="status-row">
                    <span id="enemy-name">Enemy</span>
                    <div class="hp-bar-container">
                        <div id="enemy-hp-bar" class="hp-fill" style="width: 100%; background-color: #ff6666;"></div>
                    </div>
                    <span id="enemy-hp-text" class="hp-text"></span>
                </div>
                <div class="status-row">
                    <span>勇者 (Lv.1)</span>
                    <div class="hp-bar-container">
                        <div id="player-hp-bar" class="hp-fill" style="width: 100%; background-color: #66ff66;"></div>
                    </div>
                    <span id="player-hp-text" class="hp-text"></span>
                </div>
            </div>

            <!-- Commands (Right) -->
            <div class="command-box">
                <button id="btn-attack" class="battle-button">こうげき</button>
                <button id="btn-run" class="battle-button">にげる</button>
            </div>
        </div>
    </div>

    <div id="dialog-ui" class="ui-overlay" style="display: none;">
        <div class="dialog-box">
            <div class="dialog-title" id="dialog-title">メッセージ</div>
            <p id="dialog-text">ここにメッセージが表示されます</p>
            <span class="dialog-arrow">▼</span>
        </div>
    </div>

    <div id="ui">
        <p><span class="label">名前:</span> <span id="player-name" class="value">読み込み中...</span></p>
        <p><span class="label">現在地:</span></p>
        <p style="margin-left: 20px;"><span class="label">X:</span> <span id="pos-x" class="value">0.00</span></p>
        <p style="margin-left: 20px;"><span class="label">Y:</span> <span id="pos-y" class="value">0.00</span></p>
        <p style="margin-left: 20px;"><span class="label">Z:</span> <span id="pos-z" class="value">0.00</span></p>
        <p><span class="label">FPS:</span> <span id="fps" class="value">60</span></p>
    </div>

    <!-- Three.js Import Map -->
    <script type="importmap">
        {
            "imports": {
                "three": "https://unpkg.com/three@0.150.0/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.150.0/examples/jsm/"
            }
        }
    </script>

    <!-- Game Scripts -->
    <script type="module" src="js/main.js"></script>
</body>

</html>