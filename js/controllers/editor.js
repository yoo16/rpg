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
    await loadMap();
    setupEvents();
    updateUI();
};

async function loadMap() {
    try {
        const res = await fetch('api/get_map.php?id=1');
        const json = await res.json();
        mapData = json.data.map;
        renderGrid();
    } catch (e) {
        console.error("Map Load Error:", e);
    }
}

function setupEvents() {
    // 既存のイベント
    document.body.onmousedown = (e) => {
        if (e.target.closest('#grid-canvas')) state.isMouseDown = true;
    };
    document.body.onmouseup = () => state.isMouseDown = false;
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

function refreshIcons(el, x, z) {
    const isPlayerStart = (mapData.start_x === x && mapData.start_z === z);
    const npc = mapData.npcs.find(n => Math.round(n.x) === x && Math.round(n.z) === z);
    const ev = mapData.events.find(ev => Math.round(ev.x) === x && Math.round(ev.z) === z);

    el.classList.remove('icon-npc', 'icon-event', 'icon-player', 'selected-entity');

    if (isPlayerStart) el.classList.add('icon-player');

    if (npc) {
        el.classList.add('icon-npc');
        // 選択中ならクラス追加
        if (selectedEntity && selectedEntity.id === npc.id) el.classList.add('selected-entity');
    }

    if (ev) {
        el.classList.add('icon-event');
        if (selectedEntity && selectedEntity.id === ev.id) el.classList.add('selected-entity');
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
    setTimeout(() => {
        status.classList.remove('opacity-100');
        status.classList.add('opacity-0');
    }, 2000);
}

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