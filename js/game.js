import * as THREE from 'three';
import GameApi from './api.js';
import { MapManager } from './map_manager.js';
import { Player } from './player.js';
import { BattleSystem } from './battle_system.js';
import { STATE, BATTLE_PHASE } from './constants.js';

export class Game {
    constructor() {
        // オープニング演出中フラグ
        this.isOpening = true;
        // 0.0 (空) から 1.0 (完了) への進捗
        this.openingProgress = 0;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        this.worldGroup = null;
        this.battleGroup = null;

        this.mapManager = new MapManager();
        this.player = new Player(this.mapManager, () => this.checkEncounter());
        this.battleSystem = null;

        this.currentState = STATE.MAP;
        this.enemyMasterData = null;
        this.keys = {};

        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.currentNPCId = null;
        this.lastDialogTime = 0;

        this.isRunning = true;

        // --- Camera Settings ---
        this.cameraDefaultOffset = { x: 0, y: 2.0, z: 4.5 };
        this.cameraZoomOffset = { x: 0.8, y: 1.6, z: 2.0 };
        this.cameraSmoothness = 0.15;
        this.isZoomed = false;

        // --- メソッドのバインド (thisエラー対策) ---
        this.startGameLoop = this.startGameLoop.bind(this);

        // --- オープニング演出用変数 ---
        this.openingHeight = 10;
        this.openingTime = 0;           // 経過時間カウンター
        this.openingDuration = 3.0;     // 演出にかける時間
        this.openingStartPos = new THREE.Vector3(); // 開始時の空の位置

        this.init();
    }

    async init() {
        try {
            this.showLoading();
            await GameApi.initConfig();
            this.setupThreeJS();

            const [pRes, mRes, eRes] = await Promise.all([
                GameApi.getPlayerInitData(),
                GameApi.getMapData(1),
                GameApi.getEnemyData()
            ]);

            this.enemyMasterData = eRes.data.enemies;
            this.mapManager.init(mRes.data.map);
            this.worldGroup.add(this.mapManager.group);

            await this.player.init(pRes.data.player, mRes.data.map);
            this.worldGroup.add(this.player.mesh);

            const playerLight = new THREE.PointLight(0xffaa00, 1.5, 10);
            playerLight.position.set(0, 2, 0);
            this.player.mesh.add(playerLight);

            await this.mapManager.createNPCs();

            this.battleSystem = new BattleSystem(
                this.player, this.camera, this.battleGroup, this.enemyMasterData,
                (win) => this.onBattleEnd(win)
            );

            this.setupInput();
            this.hideLoading();

            // --- 2. オープニング演出のオーバーライド ---
            if (this.player.mesh) {
                const startPos = new THREE.Vector3(
                    this.player.mesh.position.x,
                    this.openingHeight,
                    this.player.mesh.position.z
                );
                this.camera.position.copy(startPos);
                this.openingStartPos.copy(startPos); // 開始地点を記憶しておく
            }

            this.startGameLoop();
        } catch (e) {
            console.error(e);
            this.showLoadingError(e.message);
        }
    }

    setupThreeJS() {
        const container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        // this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        this.worldGroup = new THREE.Group();
        this.battleGroup = new THREE.Group();
        this.scene.add(this.worldGroup, this.battleGroup);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 10, 7);
        this.scene.add(dl);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if ((e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                if (this.dialogActive) this.advanceDialog();
                else if (this.currentState === STATE.MAP) this.checkInteraction();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
    }

    handleInput() {
        if (this.player.isMoving || this.player.isRotating || this.dialogActive || this.currentState !== STATE.MAP) return;

        if (this.keys['ArrowUp'] || this.keys['w']) {
            this.player.moveForward();
        } else if (this.keys['ArrowDown'] || this.keys['s']) {
            this.player.rotateBy(Math.PI);
            this.keys['ArrowDown'] = false; this.keys['s'] = false;
        } else if (this.keys['ArrowLeft'] || this.keys['a']) {
            this.player.rotateBy(Math.PI / 2);
            this.keys['ArrowLeft'] = false; this.keys['a'] = false;
        } else if (this.keys['ArrowRight'] || this.keys['d']) {
            this.player.rotateBy(-Math.PI / 2);
            this.keys['ArrowRight'] = false; this.keys['d'] = false;
        }
    }

    update(delta) {
        if (this.currentState === STATE.MAP) {
            this.player.updateMovement(delta);
            this.handleInput();
            if (!this.dialogActive) this.checkNPCProximity();
            this.player.updateAnimation(delta);
            this.mapManager.update(delta);
            // ここに delta を追加！
            this.updateCamera(delta);
        } else if (this.currentState === STATE.BATTLE && this.battleSystem) {
            this.battleSystem.update(delta);
        }
        this.updateUI();
    }

    updateCamera(delta) {
        if (!this.player.mesh || this.currentState !== STATE.MAP) return;

        let targetPos, lookAtTarget;
        const playerPos = this.player.mesh.position.clone();

        // --- 1. 本来あるべき「理想のカメラ位置」と「注視点」を計算 ---
        if (this.isZoomed && this.currentNPCId) {
            // 会話中ロジック (既存)
            const npcGroup = this.mapManager.npcMeshes.find(g => g.userData.id === this.currentNPCId);
            const npcPos = npcGroup.position.clone();
            lookAtTarget = npcPos.clone().add(new THREE.Vector3(0, 1.4, 0));
            const dir = playerPos.clone().sub(npcPos).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(up, dir).normalize();
            targetPos = npcPos.clone()
                .add(dir.multiplyScalar(this.cameraZoomOffset.z))
                .add(right.multiplyScalar(this.cameraZoomOffset.x));
            targetPos.y += this.cameraZoomOffset.y;
        } else {
            // 通常時ロジック (既存)
            lookAtTarget = playerPos.clone().add(new THREE.Vector3(0, 1.5, 0));
            const playerRotation = this.player.mesh.quaternion.clone();
            const offset = new THREE.Vector3(this.cameraDefaultOffset.x, this.cameraDefaultOffset.y, this.cameraDefaultOffset.z);
            offset.applyQuaternion(playerRotation);
            targetPos = playerPos.clone().add(offset);

            const rayDir = targetPos.clone().sub(lookAtTarget).normalize();
            const raycaster = new THREE.Raycaster(lookAtTarget, rayDir, 0, targetPos.distanceTo(lookAtTarget));
            const intersects = raycaster.intersectObjects(this.mapManager.mapMeshes);
            if (intersects.length > 0) {
                targetPos = lookAtTarget.clone().add(rayDir.multiplyScalar(intersects[0].distance - 0.3));
            }
        }
        if (this.isOpening) {
            this.openingTime += delta;
            let progress = Math.min(this.openingTime / this.openingDuration, 1.0);

            // イージング（滑らかに減速）をかける場合: Cubic Out
            progress = 1 - Math.pow(1 - progress, 3);

            this.camera.position.lerpVectors(this.openingStartPos, targetPos, progress);
            if (progress >= 1.0) {
                this.isOpening = false;
            }
        } else {
            this.camera.position.lerp(targetPos, this.cameraSmoothness);
        }
        this.camera.lookAt(lookAtTarget);
    }

    updateAllStatusUI() {
        const p = this.player;
        if (!p || !p.stats) return;

        const pPercent = p.hpPercent;

        // 1. HPバーの更新（共通の player-hp-bar を使用）
        const hpBar = document.getElementById('player-hp-bar');
        if (hpBar) {
            hpBar.style.width = `${pPercent}%`;
            // 色の更新
            hpBar.style.backgroundColor = pPercent < 20 ? 'var(--danger-color)' :
                pPercent < 50 ? 'var(--caution-color)' :
                    'var(--safe-color)';
        }

        // 2. HPテキストの更新（共通の player-hp-text を使用）
        const hpText = document.getElementById('player-hp-text');
        if (hpText) {
            hpText.textContent = `${Math.floor(p.stats.hp)} / ${p.stats.maxHp}`;
        }

        // 3. 名前の更新
        const nameElem = document.getElementById('player-name');
        if (nameElem) nameElem.textContent = p.name;
    }

    startGameLoop() {
        if (!this.isRunning) return;
        const delta = this.clock.getDelta();
        this.update(delta);
        this.render();
        requestAnimationFrame(this.startGameLoop);
    }

    // --- 会話システム ---
    // Game.js の startNPCDialog メソッドを修正
    startNPCDialog(npc) {
        this.currentDialog = { name: npc.name, dialogues: npc.dialogues || [] };
        this.currentNPCId = npc.id;
        this.dialogIndex = 0;

        // --- プレイヤーをNPCの方向に向かせる ---
        if (this.player) {
            // NPCのグリッド座標を取得（npcオブジェクトに x, z がある前提）
            const dx = npc.x - this.player.gridX;
            const dz = npc.z - this.player.gridZ;

            const targetAngle = Math.atan2(-dx, -dz);

            // Playerクラスの rotationTarget を更新（updateMovement 内の smoothRotate で回転する）
            this.player.rotationTarget = targetAngle;
            this.player.isRotating = true;
        }

        // NPC側もプレイヤーの方を向かせる
        this.mapManager.lookAtPlayer(npc.id, this.player.gridX, this.player.gridZ);

        this.isZoomed = true;
        // プレイヤーを少し半透明にする演出（もし実装されていれば）
        if (this.player.setOpacity) this.player.setOpacity(0.3);

        this.showDialog();
    }

    hideDialog() {
        const dialogUI = document.getElementById('dialog-ui');
        if (dialogUI) dialogUI.style.display = 'none';

        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.lastDialogTime = performance.now();

        this.isZoomed = false;
        if (this.player.setOpacity) this.player.setOpacity(1.0);
    }

    checkEncounter() {
        if (this.currentState !== STATE.MAP) return;
        const rate = this.mapManager.mapData.encounter_rate || 0.05;
        if (Math.random() < rate) { this.startBattle(); }
    }
    startBattle() {
        this.currentState = STATE.BATTLE;
        this.worldGroup.visible = false;
        this.battleGroup.visible = true;
        const enemies = this.mapManager.mapData.possible_enemies;
        this.battleSystem.startBattle(enemies);
    }
    onBattleEnd() { this.currentState = STATE.MAP; this.worldGroup.visible = true; this.battleGroup.visible = false; }
    checkInteraction() {
        if (this.dialogActive) return;
        const { x, z } = this.player.getFacingPosition();
        const npcData = this.mapManager.getNPCAt(x, z);
        if (npcData) { this.startNPCDialog(npcData); return; }
        const event = this.mapManager.getEventAt(x, z);
        if (event && event.type === 'heal') { this.executeHeal(); this.showDialog(event.message); }
    }
    executeHeal() { this.player.stats.hp = this.player.stats.maxHp; this.updateUI(); }
    showDialog(message = null) {
        const dialogUI = document.getElementById('dialog-ui');
        const dialogText = document.getElementById('dialog-text');
        const dialogTitle = document.getElementById('dialog-title');
        if (!dialogUI) return;
        if (message) { dialogText.textContent = message; dialogTitle.textContent = "【案内】"; }
        else if (this.currentDialog) { dialogTitle.textContent = `【${this.currentDialog.name}】`; dialogText.textContent = this.currentDialog.dialogues[this.dialogIndex]; }
        dialogUI.style.display = 'block';
        this.dialogActive = true;
    }
    advanceDialog() {
        this.dialogIndex++;
        if (!this.currentDialog || this.dialogIndex >= this.currentDialog.dialogues.length) { this.hideDialog(); }
        else { this.showDialog(); }
    }
    checkNPCProximity() {
        const px = this.player.gridX;
        const pz = this.player.gridZ;
        const result = this.mapManager.checkNPCProximity(px, pz, this.currentNPCId);
        if (result.npc) { this.startNPCDialog(result.npc); }
        else if (!result.adjacent) { this.currentNPCId = null; }
    }
    updateUI() {
        if (this.player.mesh) {
            const nameElem = document.getElementById('player-name');
            if (nameElem) nameElem.textContent = this.player.name;
            const posX = document.getElementById('pos-x');
            const posZ = document.getElementById('pos-z');
            if (posX) posX.textContent = this.player.gridX.toFixed(0);
            if (posZ) posZ.textContent = this.player.gridZ.toFixed(0);
        }
    }
    render() { this.renderer.render(this.scene, this.camera); }
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    showLoading() { document.getElementById('loading-ui').style.display = 'flex'; }
    hideLoading() { document.getElementById('loading-ui').style.display = 'none'; }
    showLoadingError(msg) {
        const el = document.getElementById('loading-ui');
        if (el) el.innerHTML = `<div style="color:red"><p>エラー</p><p>${msg}</p></div>`;
    }
}