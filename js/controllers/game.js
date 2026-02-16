import * as THREE from 'three';
import GameApi from '../services/api.js';
import { BattleSystem } from '../controllers/battle_system.js';
import { GameEvent } from '../models/event.js';
import { Player } from '../models/player.js';
import { MapManager } from '../services/map_manager.js';
import { InputManager } from '../services/input_manager.js';
import { CameraManager } from '../services/camera_manager.js';
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

            const [pRes, mRes, eRes] = await Promise.all([
                GameApi.getPlayerInitData(),
                GameApi.getMapData(1),
                GameApi.getEnemyData()
            ]);

            // Enemy作成
            this.enemyMasterData = eRes.data.enemies;
            this.mapManager.init(mRes.data.map);
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
            } else if (this.dialogActive) {
                this.advanceDialog();
            } else if (this.currentState === STATE.MAP) {
                this.checkInteraction();
            }
        }
    }

    handleInput() {
        if (this.player.isMoving || this.player.isRotating || this.dialogActive || this.currentState !== STATE.MAP) return;

        const keys = this.inputManager.keys;
        if (keys['ArrowUp'] || keys['w']) {
            this.player.moveForward();
            // } else if (keys['ArrowDown'] || keys['s']) {
            //     this.player.rotateBy(Math.PI);
            //     keys['ArrowDown'] = false; keys['s'] = false;
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
            if (!this.dialogActive) this.checkNPCProximity();
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
        if (this.dialogActive) return;
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
                this.showDialog(null, result.message);
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

    startNPCDialog(npc) {
        this.currentDialog = {
            name: npc.name,
            dialogues: npc.dialogues || [],
            onEnd: npc.onTalk // Already a GameEvent instance
        };
        this.currentNPCId = npc.id;
        this.dialogIndex = 0;

        // Turn player to NPC
        if (this.player) {
            const dx = npc.x - this.player.gridX;
            const dz = npc.z - this.player.gridZ;
            this.player.rotationTarget = Math.atan2(-dx, -dz);
            this.player.isRotating = true;
        }

        // Turn NPC to player
        this.mapManager.lookAtPlayer(npc.id, this.player.gridX, this.player.gridZ);

        this.cameraManager.setZoom(true);
        if (this.player.setOpacity) this.player.setOpacity(0.3);

        this.showDialog();
    }

    showDialog(title = null, message = null) {
        let displayTitle = title;
        let displayText = message;

        if (!message && this.currentDialog) {
            displayTitle = `【${this.currentDialog.name}】`;
            displayText = this.currentDialog.dialogues[this.dialogIndex];
        } else if (!title && message) {
            displayTitle = "【案内】";
        }

        this.dialogActive = true;
        this.uiManager.showDialog(displayTitle, displayText);
    }

    advanceDialog() {
        this.dialogIndex++;
        if (!this.currentDialog || this.dialogIndex >= this.currentDialog.dialogues.length) {
            this.hideDialog();
        } else {
            this.showDialog();
        }
    }

    hideDialog() {
        // Check for post-dialogue event
        if (this.currentDialog && this.currentDialog.onEnd) {
            const result = this.currentDialog.onEnd.execute(this.player, this);

            // If the event executed successfully and returned a message, show it.
            if (result.success && result.message) {
                // Clear the current dialog context so we don't return to it
                this.currentDialog = null;
                this.dialogIndex = 0;

                // Show the event result message
                this.showDialog(null, result.message);
                return;
            }
        }

        this.uiManager.hideDialog();
        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        // Do NOT clear currentNPCId here, to prevent immediate re-trigger
        // this.currentNPCId = null; 

        this.cameraManager.setZoom(false);
        if (this.player.setOpacity) this.player.setOpacity(1.0);
    }

    checkNPCProximity() {
        const px = this.player.gridX;
        const pz = this.player.gridZ;
        const result = this.mapManager.checkNPCProximity(px, pz, this.currentNPCId);

        if (result.npc) {
            this.startNPCDialog(result.npc);
        } else if (!result.adjacent) {
            // Only clear if not adjacent anymore AND not currently in a triggered dialog
            if (!this.dialogActive) this.currentNPCId = null;
        }
    }

    startGameLoop() {
        if (!this.isRunning) return;
        const delta = this.clock.getDelta();
        this.update(delta);
        this.render();
        requestAnimationFrame(this.startGameLoop);
    }

    checkTileEvent() {
        const { x, z } = this.player; // Player grid coords are updated
        const px = this.player.gridX;
        const pz = this.player.gridZ;

        const event = this.mapManager.getEventAt(px, pz);
        console.log(x, z, event);
        if (event && event.trigger === 'touch') {
            const result = event.execute(this.player, this);
            if (result.message) {
                this.showDialog(null, result.message);
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