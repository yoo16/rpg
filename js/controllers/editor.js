let mapData = null;
let selectedEntity = null;
let state = {
    mode: 'tile',   // 'tile' or 'entity'
    brush: 1,       // 0:Floor, 1:Wall, 2:Water
    entity: 'npc',  // 'npc' or 'event'
    isMouseDown: false
};

// --- 初期化 ---
window.onload = async () => {
    await loadMapList();
    const urlParams = new URLSearchParams(window.location.search);
    const mapId = urlParams.get('id') || 1;
    await loadMap(mapId);
    setupEvents();
    updateUI();
};

async function loadMapList() {
    try {
        const res = await fetch('api/list_maps.php');
        const json = await res.json();
        const select = document.getElementById('map-select');
        select.innerHTML = '';

        json.data.forEach(map => {
            const opt = document.createElement('option');
            opt.value = map.id;
            opt.textContent = `${map.id}: ${map.name}`;
            select.appendChild(opt);
        });

        // Add listener
        select.onchange = (e) => loadMap(e.target.value);
    } catch (e) {
        console.error("Failed to load map list", e);
    }
}

async function loadMap(id) {
    try {
        const res = await fetch(`api/get_map.php?id=${id}`);
        if (!res.ok) throw new Error("Map not found");
        const json = await res.json();
        mapData = json.data.map;

        // Strictly enforce map_id to match the requested ID
        // This prevents overwriting other maps if the JSON file has a wrong internal ID (e.g. from copy-paste)
        mapData.map_id = parseInt(id);

        renderGrid();

        // Update Select UI to match loaded map
        const select = document.getElementById('map-select');
        if (select) select.value = id;

        console.log(`Loaded Map ${id} (Internal ID fixed to ${mapData.map_id})`);

    } catch (e) {
        console.error("Map Load Error:", e);
        showFlashMessage("マップ読み込みエラー", true);
    }
}

window.createNewMap = async () => {
    if (!confirm("新しいマップを作成しますか？")) return;

    // Get current IDs to find next
    const res = await fetch('api/list_maps.php');
    const json = await res.json();
    const ids = json.data.map(m => m.id);
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const newMap = {
        map_id: nextId,
        width: 20,
        height: 20,
        name: `Map ${nextId}`,
        tiles: Array(20).fill().map(() => Array(20).fill(1)), // All walls default
        legend: ["floor", "wall", "water"],
        npcs: [],
        events: [],
        start_x: 1,
        start_z: 1,
        start_dir: 0,
        encounter_rate: 0.05
    };

    // Client-side switch first
    mapData = newMap;
    // Save to create file
    await saveMap();
    // Reload list and UI
    await loadMapList();
    document.getElementById('map-select').value = nextId;
    renderGrid();
    showFlashMessage(`New Map ${nextId} created!`);
};

function setupEvents() {
    // 既存のイベント
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('#grid-canvas')) state.isMouseDown = true;
    });
    document.addEventListener('mouseup', () => {
        state.isMouseDown = false;
    });
    document.oncontextmenu = (e) => e.preventDefault();

    const dirSelect = document.getElementById('map-start-dir');
    if (dirSelect) {
        dirSelect.addEventListener('change', (e) => {
            if (mapData) {
                mapData.start_dir = parseFloat(e.target.value);
                console.log("Updated start_dir:", mapData.start_dir);
                renderGrid(); // 🚩の向きを更新
            }
        });
    }
}

// Add listener for type change to toggle visibility
document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('prop-ev-type');
    const warpFields = document.getElementById('prop-warp-fields');

    if (typeSelect && warpFields) {
        typeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'warp') {
                warpFields.classList.remove('hidden');
            } else {
                warpFields.classList.add('hidden');
            }
        });
    }

    const npcEvType = document.getElementById('prop-npc-ev-type');
    const npcEvAction = document.getElementById('prop-npc-ev-action');
    if (npcEvType && npcEvAction) {
        npcEvType.addEventListener('change', (e) => {
            if (e.target.value === 'set_flag') {
                npcEvAction.classList.remove('hidden');
            } else {
                npcEvAction.classList.add('hidden');
            }
        });
    }
});

// アイコンの更新 (NPC, Event, etc)
function refreshIcons(el, x, z) {
    el.innerHTML = ''; // Clear

    // 1. Start Position
    if (mapData.start_x === x && mapData.start_z === z) {
        el.innerText = '🚩';
        return;
    }

    // 2. NPC
    const npc = mapData.npcs.find(n => Math.round(n.x) === x && Math.round(n.z) === z);
    if (npc) {
        el.innerText = '👤';
        el.title = npc.name;
        return;
    }

    // 3. Event
    const evt = mapData.events.find(e => Math.round(e.x) === x && Math.round(e.z) === z);
    if (evt) {
        if (evt.type === 'open_door') {
            el.innerText = '🚪';
        } else if (evt.type === 'warp') {
            el.innerText = '🌀';
        } else if (evt.type === 'heal') {
            el.innerText = '💖';
        } else {
            el.innerText = '✨';
        }
        return;
    }
}

// --- グリッド描画 ---
function renderGrid() {
    const container = document.getElementById('grid-canvas');
    if (!mapData) return;

    container.style.gridTemplateColumns = `repeat(${mapData.width}, 32px)`;
    container.innerHTML = '';

    mapData.tiles.forEach((row, z) => {
        row.forEach((type, x) => {
            const tile = document.createElement('div');
            tile.className = `tile tile-${type}`;
            tile.id = `t-${x}-${z}`;

            refreshIcons(tile, x, z);

            tile.onmouseenter = () => { if (state.isMouseDown) handlePaint(x, z, tile); };
            tile.onmousedown = (e) => handleAction(e, x, z, tile);

            container.appendChild(tile);
        });
    });
}

// --- アクション制御 ---
function handleAction(e, x, z, el) {
    // Update Coords Display
    const coordEl = document.getElementById('selected-coords');
    if (coordEl) coordEl.textContent = `( ${x}, ${z} )`;

    // 右クリック(2) または Ctrl+クリックの場合：削除実行
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
        e.preventDefault();
        removeObject(x, z);
        return;
    }

    if (state.mode === 'tile') {
        handlePaint(x, z, el);
    } else {
        addObject(x, z);
    }
}

// タイルを塗る
function handlePaint(x, z, el) {
    if (state.mode !== 'tile') return;

    // プロパティパネルを閉じる（タイルモード時は編集しないため）
    const panel = document.getElementById('properties-panel');
    if (panel) panel.classList.add('hidden');

    mapData.tiles[z][x] = state.brush;
    el.className = `tile tile-${state.brush}`;
    refreshIcons(el, x, z);
}

// エンティティ追加/編集/移動
function addObject(x, z) {
    state.isMouseDown = false;

    // 1. プレイヤー初期位置の設定モード (既存)
    if (state.entity === 'player') {
        mapData.start_x = x;
        mapData.start_z = z;
        renderGrid();
        return;
    }

    // 2. クリックした場所に既存のエンティティがあるか確認
    let targetEntity = mapData.npcs.find(n => Math.round(n.x) === x && Math.round(n.z) === z);
    if (!targetEntity) {
        targetEntity = mapData.events.find(ev => Math.round(ev.x) === x && Math.round(ev.z) === z);
    }

    // 3. 移動ロジック：
    // すでに何かが「選択中」で、かつクリックした場所が「空」なら、そこに移動させる
    if (selectedEntity && !targetEntity) {
        // NPCの移動
        selectedEntity.x = x;
        selectedEntity.z = z;
        console.log(`🚚 Moved ${selectedEntity.name || 'Event'} to: (${x}, ${z})`);

        // 選択状態は維持したまま再描画
        renderGrid();
        return;
    }

    // 4. ロジック：
    // 何も選択されていない、かつクリックした場所が空の場合
    if (!targetEntity && state.entity === 'npc') {
        const newNpc = {
            id: 'n' + Date.now(),
            name: "New NPC",
            x: x,
            z: z,
            idle_url: "assets/fbx/characters/character1_idle.fbx",
            scale: 0.01,
            dialogues: ["こんにちは"]
        };
        mapData.npcs.push(newNpc);
        showProperties(newNpc);
        renderGrid();
    } else if (!targetEntity && state.entity === 'event') {
        const newEv = {
            id: 'ev' + Date.now(),
            type: 'heal',
            x: x,
            z: z,
            message: "体力が全快した！"
        };
        mapData.events.push(newEv);
        showProperties(newEv);
        renderGrid();
    } else if (!targetEntity && state.entity === 'door') {
        // Door Logic:
        // 1. Set tile to Wall (1)
        mapData.tiles[z][x] = 1;

        // 2. Create Event
        const newEv = {
            id: 'ev' + Date.now(),
            type: 'open_door',
            x: x,
            z: z,
            trigger: 'action',
            condition: { flag: 'has_key', value: true }, // Default: requires key
            message: "扉が開いた！",
            message_fail: "扉は封印されている...",
            once: false,
            message: "扉が開いた！",
            message_fail: "扉は封印されている...",
            once: false,
            action: null
        };
        mapData.events.push(newEv);

        showProperties(newEv);
        renderGrid();
    } else if (!targetEntity && state.entity === 'warp') {
        const newEv = {
            id: 'ev' + Date.now(),
            type: 'warp',
            x: x,
            z: z,
            trigger: 'touch',
            warp_to_map: null,
            warp_to_x: null,
            warp_to_z: null
        };
        mapData.events.push(newEv);
        showProperties(newEv);
        renderGrid();
    } else if (targetEntity) {
        // 5. すでにあるエンティティをクリックした場合は「選択（プロパティ表示）」
        showProperties(targetEntity);
    }
}

// --- プロパティパネル制御 ---
function showProperties(entity) {
    selectedEntity = entity;
    const panel = document.getElementById('properties-panel');
    if (!panel) return;

    panel.classList.remove('hidden');

    // NPCかEventかで表示を切り替える
    const isNpc = entity.id.startsWith('n');
    const npcFields = document.getElementById('prop-npc-fields');
    const eventFields = document.getElementById('prop-event-fields');

    if (isNpc) {
        npcFields.classList.remove('hidden');
        eventFields.classList.add('hidden');

        document.getElementById('prop-name').value = entity.name || "";
        document.getElementById('prop-model').value = entity.idle_url || "";
        document.getElementById('prop-scale').value = entity.scale || 0.01;
        document.getElementById('prop-dialog').value = (entity.dialogues || []).join('\n');

        // On Talk
        const onTalk = entity.on_talk || {};
        const typeSelect = document.getElementById('prop-npc-ev-type');
        typeSelect.value = onTalk.type || "";

        const npcEvAction = document.getElementById('prop-npc-ev-action');
        if (onTalk.type === 'set_flag') npcEvAction.classList.remove('hidden');
        else npcEvAction.classList.add('hidden');

        document.getElementById('prop-npc-ev-key').value = onTalk.action ? onTalk.action.key : "";
        document.getElementById('prop-npc-ev-val').value = onTalk.action ? String(onTalk.action.value) : "true";
        document.getElementById('prop-npc-ev-msg').value = onTalk.message || "";
        document.getElementById('prop-npc-ev-once').checked = !!onTalk.once;
    } else {
        npcFields.classList.add('hidden');
        eventFields.classList.remove('hidden');

        document.getElementById('prop-ev-type').value = entity.type || 'heal';
        document.getElementById('prop-ev-trigger').value = entity.trigger || 'touch';

        // Conditions
        const condFlag = entity.condition ? entity.condition.flag : '';
        const condVal = entity.condition ? String(entity.condition.value) : 'true';
        document.getElementById('prop-ev-cond-flag').value = condFlag;
        document.getElementById('prop-ev-cond-val').value = condVal;

        // Actions
        const actKey = entity.action ? entity.action.key : '';
        const actVal = entity.action ? String(entity.action.value) : 'true';
        document.getElementById('prop-ev-act-key').value = actKey;
        document.getElementById('prop-ev-act-val').value = actVal;

        document.getElementById('prop-ev-msg').value = entity.message || "";
        document.getElementById('prop-ev-msg-fail').value = entity.message_fail || "";
        document.getElementById('prop-ev-once').checked = !!entity.once;

        // Warp Fields
        const warpMapInput = document.getElementById('prop-warp-map');
        warpMapInput.value = entity.warp_to_map || "";
        document.getElementById('prop-warp-x').value = entity.warp_to_x !== undefined && entity.warp_to_x !== null ? entity.warp_to_x : "";
        document.getElementById('prop-warp-z').value = entity.warp_to_z !== undefined && entity.warp_to_z !== null ? entity.warp_to_z : "";

        // Setup Target Helper
        const targetSelect = document.getElementById('prop-warp-target-event');
        targetSelect.innerHTML = '<option value="">-- Select Target --</option>';

        // Listeners for helper
        warpMapInput.onchange = async () => {
            const tid = warpMapInput.value;
            if (tid) await loadTargetMapEvents(tid, targetSelect);
        };

        targetSelect.onchange = () => {
            const data = targetSelect.value;
            if (data) {
                const [tx, tz] = data.split(',').map(Number);
                document.getElementById('prop-warp-x').value = tx;
                document.getElementById('prop-warp-z').value = tz;
            }
        };

        if (entity.warp_to_map) {
            loadTargetMapEvents(entity.warp_to_map, targetSelect);
        }

        // Toggle Warp Fields Visibility
        const warpFields = document.getElementById('prop-warp-fields');
        if (entity.type === 'warp') {
            warpFields.classList.remove('hidden');
        } else {
            warpFields.classList.add('hidden');
        }
    }
}

// Helper to load events from another map
async function loadTargetMapEvents(mapId, selectEl) {
    try {
        const res = await fetch(`api/get_map.php?id=${mapId}`);
        if (!res.ok) return;
        const json = await res.json();
        const tMap = json.data.map;

        selectEl.innerHTML = '<option value="">-- Select Target --</option>';

        // Find suitable targets (Doors or Warps)
        const targets = tMap.events.filter(e => e.type === 'open_door' || e.type === 'warp');

        targets.forEach(t => {
            let safeX = t.x;
            let safeZ = t.z;

            const neighbors = [
                { dx: 0, dz: 1 }, { dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: -1, dz: 0 }
            ];

            for (let n of neighbors) {
                const nx = t.x + n.dx;
                const nz = t.z + n.dz;
                if (nx >= 0 && nx < tMap.width && nz >= 0 && nz < tMap.height) {
                    if (tMap.tiles[nz][nx] === 0) {
                        safeX = nx;
                        safeZ = nz;
                        break;
                    }
                }
            }

            const opt = document.createElement('option');
            opt.value = `${safeX},${safeZ}`;
            opt.textContent = `${t.type} at (${t.x}, ${t.z}) -> Spawn (${safeX}, ${safeZ})`;
            selectEl.appendChild(opt);
        });

    } catch (e) {
        console.error("Failed to load target map events", e);
    }
}

// Apply Changes ボタン (データの確定と選択解除)
window.applyProperties = () => {
    if (!selectedEntity) return;

    if (selectedEntity.id.startsWith('n')) {
        // NPCの更新
        selectedEntity.name = document.getElementById('prop-name').value;
        selectedEntity.idle_url = document.getElementById('prop-model').value;
        selectedEntity.scale = parseFloat(document.getElementById('prop-scale').value);
        selectedEntity.dialogues = document.getElementById('prop-dialog').value.split('\n').filter(line => line.trim() !== "");

        // On Talk
        const otType = document.getElementById('prop-npc-ev-type').value;
        if (otType) {
            selectedEntity.on_talk = {
                type: otType,
                message: document.getElementById('prop-npc-ev-msg').value,
                once: document.getElementById('prop-npc-ev-once').checked
            };
            if (otType === 'set_flag') {
                selectedEntity.on_talk.action = {
                    key: document.getElementById('prop-npc-ev-key').value,
                    value: document.getElementById('prop-npc-ev-val').value === 'true'
                };
            }
        } else {
            delete selectedEntity.on_talk;
        }
    } else {
        // イベントの更新
        selectedEntity.type = document.getElementById('prop-ev-type').value;
        selectedEntity.trigger = document.getElementById('prop-ev-trigger').value;
        selectedEntity.message = document.getElementById('prop-ev-msg').value;
        selectedEntity.message_fail = document.getElementById('prop-ev-msg-fail').value;
        selectedEntity.once = document.getElementById('prop-ev-once').checked;

        // 条件
        const condFlag = document.getElementById('prop-ev-cond-flag').value.trim();
        if (condFlag) {
            selectedEntity.condition = {
                flag: condFlag,
                value: document.getElementById('prop-ev-cond-val').value === 'true'
            };
        } else {
            selectedEntity.condition = null;
        }

        // アクション
        const actKey = document.getElementById('prop-ev-act-key').value.trim();
        if (actKey) {
            selectedEntity.action = {
                key: actKey,
                value: document.getElementById('prop-ev-act-val').value === 'true'
            };
        } else {
            selectedEntity.action = null;
        }

        // Warp Fields
        const wMap = document.getElementById('prop-warp-map').value;
        const wX = document.getElementById('prop-warp-x').value;
        const wZ = document.getElementById('prop-warp-z').value;

        selectedEntity.warp_to_map = wMap ? parseInt(wMap) : null;
        selectedEntity.warp_to_x = wX ? parseInt(wX) : null;
        selectedEntity.warp_to_z = wZ ? parseInt(wZ) : null;
    }

    // 変更を保存
    saveMap();

    // 選択状態の解除
    selectedEntity = null;
    const panel = document.getElementById('properties-panel');
    if (panel) panel.classList.add('hidden');

    renderGrid();
};

// 削除・補助機能
function removeObject(x, z) {
    const initialNpcCount = mapData.npcs.length;
    const initialEventCount = mapData.events.length;

    mapData.npcs = mapData.npcs.filter(n => Math.round(n.x) !== x || Math.round(n.z) !== z);
    mapData.events = mapData.events.filter(e => Math.round(e.x) !== x || Math.round(e.z) !== z);

    if (mapData.npcs.length !== initialNpcCount || mapData.events.length !== initialEventCount) {
        console.log(`🗑️ (${x}, ${z}) のオブジェクトを解除しました`);
        renderGrid();
    }
}




// --- UI操作用 (windowに公開) ---
window.setMode = (m) => {
    state.mode = m;
    updateUI();
};

window.setBrush = (b) => {
    state.brush = b;
    updateUI();
};

window.setEntity = (e) => {
    state.entity = e;
    updateUI();
};

function updateUI() {
    const tilePal = document.getElementById('palette-tile');
    const entPal = document.getElementById('palette-entity');
    if (tilePal) tilePal.classList.toggle('hidden', state.mode !== 'tile');
    if (entPal) entPal.classList.toggle('hidden', state.mode !== 'entity');

    document.querySelectorAll('.brush-btn, #mode-tile, #mode-entity').forEach(el => el.classList.remove('active-tool', 'active-mode'));
    const activeModeBtn = document.getElementById(`mode-${state.mode}`);
    if (activeModeBtn) activeModeBtn.classList.add('active-mode');

    if (state.mode === 'tile') {
        const activeBrushBtn = document.getElementById(`btn-brush-${state.brush}`);
        if (activeBrushBtn) activeBrushBtn.classList.add('active-tool');
    } else {
        const activeEntBtn = document.getElementById(`btn-ent-${state.entity}`);
        if (activeEntBtn) activeEntBtn.classList.add('active-tool');
    }
}

// --- メッセージを表示する関数 ---
function showFlashMessage(text, isError = false) {
    const status = document.getElementById('status');
    if (!status) return;

    // テキストと色の設定
    status.innerText = text;
    if (isError) {
        status.classList.replace('bg-blue-600/90', 'bg-red-600/90');
    } else {
        status.classList.replace('bg-red-600/90', 'bg-blue-600/90');
    }

    // 表示
    status.classList.remove('opacity-0');
    status.classList.add('opacity-100');

    // 2秒後に非表示
    // 2秒後に非表示
    setTimeout(() => {
        status.classList.remove('opacity-100');
        status.classList.add('opacity-0');
    }, 2000);
}

// Global expose
window.showStatus = showFlashMessage;

window.saveMap = async () => {
    try {
        const res = await fetch('api/save_map.php', {
            method: 'POST',
            body: JSON.stringify(mapData)
        });

        if (res.ok) {
            showFlashMessage('✅ マップを保存しました');
        } else {
            throw new Error('Server Error');
        }
    } catch (e) {
        showFlashMessage('❌ 保存に失敗しました', true);
        console.error(e);
    }
};