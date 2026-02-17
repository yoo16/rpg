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
        this.container = document.getElementById('canvas-container');
        this.uiManager = new UIManager();
        this.inputManager = new InputManager();
        this.mapManager = new MapManager(this);
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

        // Global Event State (Persistent across maps)
        this.globalEventState = new Set();

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
            this.dialogManager = new DialogManager(this);

            const [pRes, mRes, eRes] = await Promise.all([
                GameApi.getPlayerInitData(),
                GameApi.getMapData(1),
                GameApi.getEnemyData()
            ]);

            // Enemy作成
            this.enemyMasterData = eRes.data.enemies;
            this.mapManager.init(mRes.data.map, this.globalEventState); // Pass global state
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
        // シーン
        this.scene = new THREE.Scene();
        // カメラ
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
        // カメラマネージャー
        this.cameraManager = new CameraManager(this.camera);
        // レンダラー
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.container.appendChild(this.renderer.domElement);

        // ワールドグループ
        this.worldGroup = new THREE.Group();
        // バトルグループ
        this.battleGroup = new THREE.Group();
        this.battleGroup.visible = false; // Hide initially directly

        // シーンにグループを追加
        this.scene.add(this.worldGroup, this.battleGroup);

        // 環境光
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        // 平行光
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 10, 7);
        this.scene.add(dl);
        // リサイズイベント
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onKeyDown(e) {
        if ((e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            if (this.currentState === STATE.BATTLE && this.battleSystem) {
                // バトル中のキー入力
                this.battleSystem.onKeyDown(e.key);
            } else if (this.dialogManager.isActive) {
                // ダイアログ中のキー入力
                this.dialogManager.advance();
            } else if (this.currentState === STATE.MAP) {
                // マップ中のキー入力
                this.checkInteraction();
            }
        }
    }

    handleInput() {
        // 移動中、回転中、ダイアログ中、マップ中でない場合は何もしない
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

    // ゲームループ
    update(delta) {
        if (this.currentState === STATE.MAP) {
            // 移動終了チェック
            const movementFinished = this.player.updateMovement(delta);
            if (movementFinished) {
                this.checkTileEvent();
            }
            // キー入力処理
            this.handleInput();
            if (!this.dialogManager.isActive) this.checkNPCProximity();

            // プレイヤーアニメーション更新
            this.player.updateAnimation(delta);

            // マップアニメーション更新
            this.mapManager.update(delta);

            // カメラ更新
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

        // Skip encounter if near NPC (Safe Zone)
        if (this.mapManager.isNearAnyNPC(this.player.gridX, this.player.gridZ, 3)) {
            return;
        }

        const rate = this.mapManager.mapData.encounter_rate;
        // if (Math.random() < rate) { this.startBattle(); }
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

        // イベントチェック
        const event = this.mapManager.getEventAt(x, z);
        console.log("CheckInteraction Event at", x, z, event);

        // アクションイベント
        if (event && event.trigger === 'action') {
            console.log("Executing Action Event", event.id);
            const result = event.execute(this.player, this);
            console.log("Execution Result:", result);

            // ダイアログを表示（成功メッセージ or 失敗メッセージ）
            if (result.message) {
                console.log("Showing Dialog:", result.message);
                this.dialogManager.show(null, result.message);
            }

            // イベント成功時の View 更新ロジック
            if (result.success) {
                if (event.once || event.type === 'open_door' || event.type === 'set_flag') {
                    const uniqueId = `${this.mapManager.mapData.map_id}_${event.id}`;
                    this.globalEventState.add(uniqueId);
                    console.log(`Saved event state: ${uniqueId}`);
                }
                // Update UI
                this.updateAllStatusUI();
            }
        }
    }

    handleAction() {
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
        // 前回のフレームからの経過時間を取得
        const delta = this.clock.getDelta();
        // 更新
        this.update(delta);
        // レンダリング
        this.render();
        // 次のフレームをリクエスト
        requestAnimationFrame(this.startGameLoop);
    }

    // タイルイベントチェック
    checkTileEvent() {
        const px = this.player.gridX;
        const pz = this.player.gridZ;
        const event = this.mapManager.getEventAt(px, pz);
        console.log("CheckTileEvent", px, pz, event);
        if (event && event.trigger.includes('touch', 'action')) {
            const result = event.execute(this.player, this);
            if (result.message) {
                this.dialogManager.show(null, result.message);
            }
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