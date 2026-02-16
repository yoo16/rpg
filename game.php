<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web 3D RPG</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        safe: '#1931ec',
                        danger: '#ff6666',
                    },
                    fontFamily: {
                        mono: ['"MS Gothic"', '"Courier New"', 'Courier', 'monospace'],
                    }
                }
            }
        }
    </script>
    <link rel="stylesheet" href="css/game.css">
</head>

<body class="overflow-hidden bg-black text-white font-mono select-none">
    <div id="game-container" class="relative w-screen h-screen overflow-hidden">

        <!-- Loading UI -->
        <div id="loading-ui" class="fixed inset-0 bg-black/90 flex items-center justify-center z-[1000]">
            <div class="text-center">
                <div class="w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
                <p>🎮 データを読み込み中...</p>
            </div>
        </div>

        <div id="canvas-container" class="w-full h-full"></div>

        <!-- Dialog UI -->
        <div id="dialog-ui" class="fixed bottom-5 left-1/2 -translate-x-1/2 w-[70%] z-[1001] hidden">
            <div class="bg-black/80 text-gray-300 border-4 border-white/70 p-6 rounded-lg leading-loose">
                <div id="dialog-title" class="font-bold mb-2 text-white text-lg"></div>
                <div id="dialog-text" class="whitespace-pre-wrap"></div>
                <div class="text-right mt-2 text-sm text-gray-400">▼ Next (Enter/Space)</div>
            </div>
        </div>

        <div id="battle-ui" class="absolute inset-0 z-[100] pointer-events-none hidden">
            <div class="absolute bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl flex flex-col gap-4 pointer-events-auto">
                <!-- Command Area -->
                <div id="battle-commands" class="flex justify-center gap-4">
                    <button id="btn-attack" class="px-8 py-2 bg-black/90 border-2 border-white/70 text-white rounded-lg hover:bg-gray-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-all shadow-md">こうげき</button>
                    <button id="btn-run" class="px-8 py-2 bg-black/90 border-2 border-white/70 text-white rounded-lg hover:bg-gray-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-all shadow-md">にげる</button>
                </div>

                <!-- Message Area -->
                <div class="bg-black/80 border-4 border-white/70 rounded-xl p-6 backdrop-blur-sm min-h-[100px] flex items-center shadow-lg">
                    <div id="battle-message" class="text-md text-white font-bold w-full text-left leading-relaxed tracking-wider"></div>
                </div>

            </div>

            <!-- Enemy HP (Optional/Dynamic) -->
            <div id="enemy-status" class="absolute top-24 right-12 w-64 bg-white/80 border-2 border-black p-2 text-black font-bold hidden pointer-events-auto">
                <p>Enemy HP</p>
                <div class="w-full h-4 bg-gray-300 rounded overflow-hidden mt-1">
                    <div id="enemy-hp-bar" class="h-full bg-red-600 w-full transition-all duration-300"></div>
                </div>
                <div id="enemy-hp-text" class="text-right text-xs mt-1"></div>
            </div>
        </div>

        <!-- Player Status UI -->
        <div id="player-status-ui" class="absolute top-5 left-5 p-4 bg-black/50 text-gray-100 border-2 border-black/70 rounded-lg z-50 pointer-events-none backdrop-blur-sm min-w-[200px]">
            <div class="flex flex-col gap-2 text-sm">
                <p><span id="player-name" class="font-bold text-white text-base">読み込み中...</span></p>
                <p>Map: <span id="map-id">1</span></p>
                <p>Pos: (<span id="pos-x">0</span>, <span id="pos-z">0</span>)</p>
                <p>Lv.<span id="player-level" class="text-white">1</span></p>
                <p>EXP: <span id="player-exp">0</span></p>
                <p>Next: <span id="player-next-exp">0</span></p>

                <div class="w-full h-5 bg-white/60 rounded relative overflow-hidden">
                    <div id="player-hp-bar" class="h-full bg-safe w-full transition-all duration-300"></div>
                </div>
                <span id="player-hp-text" class="text-right block"></span>

                <?php if (true): ?>
                    <p class="mt-2 text-xs text-gray-400">FPS: <span id="fps">60</span></p>
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