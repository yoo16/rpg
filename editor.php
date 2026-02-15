<!DOCTYPE html>
<html lang="ja" class="h-full bg-slate-900">

<head>
    <meta charset="UTF-8">
    <title>Map Editor Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="css/editor.css">
</head>

<body class="h-full flex text-slate-200 overflow-hidden">

    <aside id="palette" class="w-72 bg-slate-800 border-r border-slate-700 p-6 flex flex-col gap-8 overflow-y-auto">
        <div>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <span class="text-2xl">🗺️</span> Map Editor Pro
            </h1>
        </div>

        <section>
            <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Edit Mode</h2>
            <div class="flex bg-slate-900 p-1 rounded-lg">
                <button onclick="setMode('tile')" id="mode-tile" class="flex-1 py-1.5 text-xs rounded-md transition active-mode">Tiles</button>
                <button onclick="setMode('entity')" id="mode-entity" class="flex-1 py-1.5 text-xs rounded-md transition text-slate-400 hover:text-white">Entities</button>
            </div>
        </section>

        <section id="palette-tile" class="palette-section">
            <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Tiles</h2>
            <div class="grid grid-cols-1 gap-2">
                <button onclick="setBrush(0)" id="btn-brush-0" class="brush-btn active-tool flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition text-sm w-full">
                    <span class="w-4 h-4 rounded bg-slate-200 inline-block border border-slate-400"></span> Floor (0)
                </button>
                <button onclick="setBrush(1)" id="btn-brush-1" class="brush-btn flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition text-sm w-full">
                    <span class="w-4 h-4 rounded bg-slate-600 inline-block border border-slate-400"></span> Wall (1)
                </button>
                <button onclick="setBrush(2)" id="btn-brush-2" class="brush-btn flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition text-sm w-full">
                    <span class="w-4 h-4 rounded bg-blue-500 inline-block border border-blue-400"></span> Water (2)
                </button>
            </div>
        </section>

        <section id="palette-entity" class="palette-section hidden">
            <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Entities / System</h2>
            <div class="grid grid-cols-1 gap-2">
                <button onclick="setEntity('player')" id="btn-ent-player" class="brush-btn flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition text-sm w-full">
                    🚩 Player Start
                </button>
                <button onclick="setEntity('npc')" id="btn-ent-npc" class="brush-btn flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition text-sm w-full">
                    👤 NPC
                </button>
                <button onclick="setEntity('event')" id="btn-ent-event" class="brush-btn flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition text-sm w-full">
                    ✨ Heal Point
                </button>
            </div>
        </section>

        <div class="mt-auto pt-6 border-t border-slate-700">
            <button onclick="saveMap()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition">
                💾 Save JSON
            </button>
            <div id="status" class="mt-4 text-center text-xs font-mono text-slate-500 min-h-[1em]"></div>
        </div>
    </aside>

    <main class="flex-1 overflow-auto flex justify-center items-center p-12 bg-slate-900 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]">
        <div id="grid-canvas" class="border-4 border-slate-700 rounded-sm shadow-2xl"></div>
    </main>

    <aside id="properties-panel" class="w-80 bg-slate-800 border-l border-slate-700 p-6 overflow-y-auto hidden">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Properties</h2>
            <button onclick="document.getElementById('properties-panel').classList.add('hidden')" class="text-slate-500 hover:text-white text-lg">&times;</button>
        </div>

        <div id="prop-npc-fields" class="space-y-4">
            <div>
                <label class="text-xs text-slate-400">Name</label>
                <input type="text" id="prop-name" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm mt-1 focus:ring-1 focus:ring-blue-500 outline-none">
            </div>
            <div>
                <label class="text-xs text-slate-400">Model URL</label>
                <select id="prop-model" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm mt-1 focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="assets/fbx/character4_idle.fbx">Villager (Male)</option>
                    <option value="assets/fbx/character3_idle.fbx">Guard</option>
                    <option value="assets/fbx/character2_idle.fbx">Witch</option>
                </select>
            </div>
            <div>
                <label class="text-xs text-slate-400">Scale</label>
                <input type="number" id="prop-scale" step="0.001" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm mt-1 focus:ring-1 focus:ring-blue-500 outline-none">
            </div>
            <div>
                <label class="text-xs text-slate-400">Dialogues / Message</label>
                <textarea id="prop-dialog" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm mt-1 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="NPCの台詞またはイベントメッセージ"></textarea>
            </div>
            <button onclick="applyProperties()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-sm font-bold shadow-lg transition-colors">Apply Changes</button>
        </div>
    </aside>

    <script src="js/editor.js" type="module"></script>
</body>

</html>