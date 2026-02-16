import * as THREE from 'three';
import GameApi from '../services/api.js';
import { BattleSystem } from '../controllers/battle_system.js';
import { GameEvent } from '../models/event.js';
import { Player } from '../models/player.js';
import { MapManager } from '../services/map_manager.js';
import { InputManager } from '../services/input_manager.js';
import { CameraManager } from '../services/camera_manager.js';
import { DialogManager } from '../services/dialog_manager.js';
import { UIManager } from '../views/ui_manager.js';
import { STATE } from '../constants.js';

export class Game {
    constructor() {
        this.uiManager = new UIManager();
        this.inputManager = new InputManager();
        this.mapManager = new MapManager();
        // Encounter callback passes to Player
        this.player = new Player(this.mapManager, () => this.checkEncounter());

        this.cameraManager = null;
        this.battleSystem = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.worldGroup = null;
        this.battleGroup = null;

        this.currentState = STATE.MAP;
        this.enemyMasterData = null;
        this.isRunning = true;

        // Interaction State
        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.currentNPCId = null;

        // Bind for loop
        this.startGameLoop = this.startGameLoop.bind(this);

        // Setup Input Hooks
        this.inputManager.onKeyDown = (e) => this.onKeyDown(e);

        this.init();
    }

    async init() {
        try {
            this.uiManager.showLoading();
            await GameApi.initConfig();
            this.setupThreeJS();

            // Setup DialogManager (needs game context for onEnd events and access to managers)
            // Note: We need player and mapManager initialized before some dialog actions,
            // but the constructor just references them. References are objects so it's fine
            // as long as we don't access properties immediately.
            // Actually, player is created in constructor, mapManager too.
            this.dialogManager = new DialogManager(this);

            const [pRes, mRes, eRes] = await Promise.all([
                GameApi.getPlayerInitData(),
                GameApi.getMapData(1),
                GameApi.getEnemyData()
            ]);

            // Enemy作成
            this.enemyMasterData = eRes.data.enemies;
            this.mapManager.init(mRes.data.map);
            this.uiManager.updateMapId(this.mapManager.mapData.id || 1);
            this.worldGroup.add(this.mapManager.group);

            // Player作成
            await this.player.init(pRes.data.player, mRes.data.map);
            this.worldGroup.add(this.player.mesh);

            // Playerのライト
            const playerLight = new THREE.PointLight(0xffaa00, 1.5, 10);
            playerLight.position.set(0, 2, 0);
            this.player.mesh.add(playerLight);

            // NPC作成
            await this.mapManager.createNPCs();

            // BattleSystem作成
            this.battleSystem = new BattleSystem(
                this.player, this.mapManager, this.camera, this.battleGroup, this.enemyMasterData,
                (win) => this.onBattleEnd(win)
            );

            // Loading画面を閉じる
            this.uiManager.hideLoading();

            // Setup Opening Camera
            if (this.cameraManager && this.player.mesh) {
                this.cameraManager.setupOpening(this.player.mesh);
            }

            this.startGameLoop();
        } catch (e) {
            console.error(e);
            this.uiManager.showLoadingError(e.message);
        }
    }

    setupThreeJS() {
        const container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

        this.cameraManager = new CameraManager(this.camera);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        this.worldGroup = new THREE.Group();
        this.battleGroup = new THREE.Group();
        this.battleGroup.visible = false; // Hide initially directly
        this.scene.add(this.worldGroup, this.battleGroup);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 10, 7);
        this.scene.add(dl);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    onKeyDown(e) {
        if ((e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            if (this.currentState === STATE.BATTLE && this.battleSystem) {
                this.battleSystem.onKeyDown(e.key);
            } else if (this.dialogManager.isActive) {
                this.dialogManager.advance();
            } else if (this.currentState === STATE.MAP) {
                this.checkInteraction();
            }
        }
    }

    handleInput() {
        if (this.player.isMoving || this.player.isRotating || this.dialogManager.isActive || this.currentState !== STATE.MAP) return;

        const keys = this.inputManager.keys;
        if (keys['ArrowUp'] || keys['w']) {
            this.player.moveForward();
        } else if (keys['ArrowLeft'] || keys['a']) {
            this.player.rotateBy(Math.PI / 2);
            keys['ArrowLeft'] = false; keys['a'] = false;
        } else if (keys['ArrowRight'] || keys['d']) {
            this.player.rotateBy(-Math.PI / 2);
            keys['ArrowRight'] = false; keys['d'] = false;
        }
    }

    update(delta) {
        if (this.currentState === STATE.MAP) {
            const movementFinished = this.player.updateMovement(delta);
            if (movementFinished) {
                this.checkTileEvent();
            }
            this.handleInput();
            if (!this.dialogManager.isActive) this.checkNPCProximity();

            // Check for Action Input (Space/Enter)
            // if (this.inputManager.isActionPressed()) {
            //     this.handleAction();
            // }

            this.player.updateAnimation(delta);
            this.mapManager.update(delta);

            // Update Camera
            this.cameraManager.update(
                delta,
                this.player,
                this.mapManager.mapMeshes,
                this.currentNPCId,
                this.mapManager.npcMeshes
            );
        } else if (this.currentState === STATE.BATTLE && this.battleSystem) {
            this.battleSystem.update(delta);
        }

        // Update UI
        this.updateAllStatusUI();
    }

    updateAllStatusUI() {
        this.uiManager.updatePlayerStatus(this.player);
        this.uiManager.updateBattleStatus(this.player, this.battleSystem ? this.battleSystem.enemy : null);
    }

    checkEncounter() {
        if (this.currentState !== STATE.MAP) return;
        const rate = this.mapManager.mapData.encounter_rate;
        if (Math.random() < rate) { this.startBattle(); }
    }

    startBattle() {
        this.currentState = STATE.BATTLE;
        this.worldGroup.visible = false;
        this.battleGroup.visible = true;
        this.uiManager.showBattleUI();

        const enemies = this.mapManager.mapData.possible_enemies;
        this.battleSystem.startBattle(enemies);
    }

    onBattleEnd(isVictory) {
        this.currentState = STATE.MAP;
        this.worldGroup.visible = true;
        this.battleGroup.visible = false;
        this.uiManager.hideBattleUI();
    }

    // --- Interaction ---
    checkInteraction() {
        if (this.dialogManager.isActive) return;
        const { x, z } = this.player.getFacingPosition();

        const npcData = this.mapManager.getNPCAt(x, z);
        if (npcData) {
            this.startNPCDialog(npcData);
            return;
        }

        const event = this.mapManager.getEventAt(x, z);
        if (event && event.trigger === 'action') {
            const result = event.execute(this.player, this);

            // ダイアログを表示（成功メッセージ or 失敗メッセージ）
            if (result.message) {
                this.dialogManager.show(null, result.message);
            }

            // --- 追加：イベント成功時の View 更新ロジック ---
            if (result.success) {
                if (event.type === 'open_door') {
                    // 3D空間上の壁への反映は event.execute 内の MapManager 経由で行われるが、
                    // エフェクトはここで再生する
                    this.player.flashEffect(0xffffff);
                }
                this.updateAllStatusUI();
            }
        }
    }

    handleAction() {
        // ... (handleAction logic if referenced, but seems unused in update loop now)
        // Leaving it or updating it just in case:
        const target = this.player.getForwardTile();
        const event = this.mapManager.getEventAt(target.x, target.z);

        if (event && event.trigger === 'action') {
            const result = event.execute(this.player, this);
            if (result.message) {
                this.dialogManager.show(null, result.message);
            }
            return;
        }

        // Check for NPC interaction
        if (this.currentNPCId && !this.dialogManager.isActive) {
            const npc = this.mapManager.npcs.find(n => n.id === this.currentNPCId);
            if (npc) {
                this.startNPCDialog(npc);
            }
        }
    }

    // NPCとの会話開始
    startNPCDialog(npc) {
        this.currentNPCId = npc.id;
        this.dialogManager.start(npc);
    }

    // NPCとの距離チェック
    checkNPCProximity() {
        const px = this.player.gridX;
        const pz = this.player.gridZ;
        const result = this.mapManager.checkNPCProximity(px, pz, this.currentNPCId);

        if (result.npc) {
            this.startNPCDialog(result.npc);
        } else if (!result.adjacent) {
            // ダイアログがアクティブでない場合のみ、currentNPCIdをnullにする
            if (!this.dialogManager.isActive) this.currentNPCId = null;
        }
    }

    // ゲームループ
    startGameLoop() {
        if (!this.isRunning) return;
        const delta = this.clock.getDelta();
        this.update(delta);
        this.render();
        requestAnimationFrame(this.startGameLoop);
    }

    // タイルイベントチェック
    checkTileEvent() {
        const { x, z } = this.player;
        const px = this.player.gridX;
        const pz = this.player.gridZ;
        const event = this.mapManager.getEventAt(px, pz);
        console.log(x, z, event);
        if (event && event.trigger === 'touch') {
            const result = event.execute(this.player, this);
            if (result.message) {
                this.dialogManager.show(null, result.message);
            }
            if (result.type === 'warp') {
                this.warpToMap(result.mapId, result.x, result.z);
            }
        }
    }

    // マップ遷移
    async warpToMap(mapId, startX, startZ) {
        console.log(`Warping to Map ${mapId}...`);
        this.uiManager.showLoading();
        this.isRunning = false;

        try {
            // マップデータを取得
            const mRes = await GameApi.getMapData(mapId);

            // マップを再初期化
            this.mapManager.init(mRes.data.map);
            this.uiManager.updateMapId(mapId);

            // スタート位置を設定
            const destX = (typeof startX === 'number') ? startX : (mRes.data.map.start_x || 1);
            const destZ = (typeof startZ === 'number') ? startZ : (mRes.data.map.start_z || 1);

            this.player.gridX = destX;
            this.player.gridZ = destZ;
            this.player.rotationTarget = mRes.data.map.start_dir || 0;
            this.player.updatePlayerPosition();
            this.player.mesh.rotation.y = this.player.rotationTarget;

            // NPCを再作成
            await this.mapManager.createNPCs();

            // カメラをリセット
            // this.cameraManager.snapToPlayer();

            // ゲームループを再開
            this.isRunning = true;
            this.startGameLoop();
        } catch (e) {
            console.error("Warp failed:", e);
            this.uiManager.showLoadingError("Map Load Failed");
        } finally {
            this.uiManager.hideLoading();
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}