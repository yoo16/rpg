import * as THREE from 'three';
import GameApi from './api.js';
import { MapManager } from './map_manager.js';
import { Player } from './player.js';
import { BattleSystem } from './battle_system.js';
import { STATE, BATTLE_PHASE } from './constants.js';

export class Game {
    constructor() {
        // Three.js Components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Scene Groups
        this.worldGroup = null;
        this.battleGroup = null;

        // Managers
        this.mapManager = new MapManager();
        this.player = new Player(this.mapManager, () => this.checkEncounter());
        this.battleSystem = null; // Initialized after loading assets

        // Game State
        this.currentState = STATE.MAP;
        this.enemyMasterData = null;
        this.keys = {};

        // Dialog State
        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.currentNPCId = null;
        this.lastDialogTime = 0;

        this.isRunning = true;
        this.fps = 60;

        // Camera Settings
        this.cameraOffset = { x: 0, y: 4, z: 6 };
        this.mapCameraTarget = { x: 0, y: 0, z: 0 };

        this.init();
    }

    async init() {
        console.log('%c🎮 Web 3D RPG Refactored Initializing...', 'color: #0f0; font-size: 16px; font-weight: bold;');

        try {
            this.showLoading();
            await GameApi.initConfig();
            this.setupThreeJS();

            const [playerResponse, mapResponse, enemyResponse] = await Promise.all([
                GameApi.getPlayerInitData(),
                GameApi.getMapData(1),
                GameApi.getEnemyData()
            ]);

            this.enemyMasterData = enemyResponse.data.enemies;
            this.mapManager.init(mapResponse.data.map); // Init map data but meshes created via accessing properties? 
            // mapManager.init calls createMap which populates mapManager.group
            this.worldGroup.add(this.mapManager.group);

            await this.player.init(playerResponse.data.player, mapResponse.data.map);
            this.worldGroup.add(this.player.mesh);

            await this.mapManager.createNPCs();

            // Initialize BattleSystem
            this.battleSystem = new BattleSystem(
                this.player,
                this.camera,
                this.battleGroup,
                this.enemyMasterData,
                (isVictory) => this.onBattleEnd(isVictory)
            );

            this.setupInput();
            this.hideLoading();
            this.startGameLoop();

            console.log('%c✅ Initialization Complete!', 'color: #0f0; font-weight: bold;');
        } catch (error) {
            console.error('❌ Init Error:', error);
            this.showLoadingError('ゲームの初期化に失敗しました。');
        }
    }

    setupThreeJS() {
        const container = document.getElementById('canvas-container');
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(0, 10, 10);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        this.worldGroup = new THREE.Group();
        this.battleGroup = new THREE.Group();
        this.scene.add(this.worldGroup);
        this.scene.add(this.battleGroup);

        this.worldGroup.visible = true;
        this.battleGroup.visible = false;

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;

            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (this.dialogActive) {
                    this.advanceDialog();
                } else if (this.currentState === STATE.MAP) {
                    const now = performance.now();
                    if (now - this.lastDialogTime < 500) return;
                    this.checkInteraction();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    checkEncounter() {
        if (this.currentState !== STATE.MAP) return;
        this.battleSystem.startBattle(this.mapManager.mapData.possible_enemies);
        this.currentState = STATE.BATTLE;
        this.worldGroup.visible = false;
        this.battleGroup.visible = true;
    }

    onBattleEnd(isVictory) {
        this.currentState = STATE.MAP;
        this.worldGroup.visible = true;
        this.battleGroup.visible = false;

        // Don't reset camera immediately needed? 
        // updateCamera will smooth it back anyway
    }

    checkInteraction() {
        const { x, z } = this.player.getFacingPosition();

        console.log(`🔍 Checking Interaction at (${x}, ${z})`);

        // Check NPC
        const npcData = this.mapManager.getNPCAt(x, z);
        if (npcData && npcData.dialogues?.length > 0) {
            console.log('✅ Found NPC');
            this.startNPCDialog(npcData);
            return;
        }

        // Check Event
        const event = this.mapManager.getEventAt(x, z);
        if (event) {
            console.log('✅ Found Event:', event.type);
            switch (event.type) {
                case 'heal':
                    this.executeHeal(event);
                    this.showDialog(event.message);
                    break;
                default:
                    console.log('Unknown event type:', event.type);
            }
        }
    }

    executeHeal(event) {
        this.player.stats.hp = this.player.stats.maxHp;
        console.log(`✅ HP Restored: ${this.player.stats.hp}`);
        this.updateUI();
    }

    startNPCDialog(npc) {
        this.currentDialog = { name: npc.name, dialogues: npc.dialogues || [] };
        this.currentNPCId = npc.id;
        this.dialogIndex = 0;
        this.showDialog();
    }

    showDialog(message = null) {
        const dialogUI = document.getElementById('dialog-ui');
        const dialogText = document.getElementById('dialog-text');
        const dialogTitle = document.getElementById('dialog-title');

        if (!dialogUI) return;

        if (message) {
            dialogText.textContent = message;
            dialogUI.style.display = 'block';
        } else if (this.currentDialog) {
            if (this.dialogIndex < this.currentDialog.dialogues.length) {
                dialogTitle.textContent = `【${this.currentDialog.name}】`;
                dialogText.textContent = this.currentDialog.dialogues[this.dialogIndex];
                dialogUI.style.display = 'block';
            } else {
                this.hideDialog();
            }
        }
        this.dialogActive = true;
    }

    advanceDialog() {
        if (!this.dialogActive || !this.currentDialog) {
            this.hideDialog();
            return;
        }

        this.dialogIndex++;
        if (this.dialogIndex >= this.currentDialog.dialogues.length) {
            this.hideDialog();
        } else {
            this.showDialog();
        }
    }

    hideDialog() {
        const dialogUI = document.getElementById('dialog-ui');
        if (dialogUI) dialogUI.style.display = 'none';

        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.lastDialogTime = performance.now();
    }

    checkNPCProximity() {
        if (this.currentState !== STATE.MAP) return;

        // mapManager check
        const result = this.mapManager.checkNPCProximity(this.player.gridX, this.player.gridZ, this.currentNPCId);

        if (result.npc) {
            this.startNPCDialog(result.npc);
        } else if (!result.adjacent) {
            this.currentNPCId = null;
        }
    }

    startGameLoop = () => {
        if (!this.isRunning) return;
        const delta = this.clock.getDelta();

        this.update(delta);
        this.render();
        requestAnimationFrame(this.startGameLoop);
    };

    update(delta) {
        if (this.currentState === STATE.MAP) {
            if (!this.dialogActive) {
                this.player.update(delta, this.keys);
                this.checkNPCProximity();
            } else {
                this.player.update(delta, {}); // Stop movement if dialog active
            }
            this.mapManager.update(delta);
            this.updateCamera();
        } else if (this.currentState === STATE.BATTLE) {
            if (this.battleSystem) this.battleSystem.update(delta);
        }

        this.updateUI();
    }

    updateCamera() {
        if (this.currentState !== STATE.MAP || !this.player.mesh) return;

        const targetX = this.player.mesh.position.x;
        const targetZ = this.player.mesh.position.z;

        const lerpFactor = 0.1;
        this.mapCameraTarget.x += (targetX - this.mapCameraTarget.x) * lerpFactor;
        this.mapCameraTarget.z += (targetZ - this.mapCameraTarget.z) * lerpFactor;

        this.camera.position.x = this.mapCameraTarget.x + this.cameraOffset.x;
        this.camera.position.y = this.mapCameraTarget.y + this.cameraOffset.y;
        this.camera.position.z = this.mapCameraTarget.z + this.cameraOffset.z;

        this.camera.lookAt(this.mapCameraTarget.x, this.mapCameraTarget.y + 1.0, this.mapCameraTarget.z);
    }

    updateUI() {
        // FPS update could be here
        if (this.player.mesh) {
            const nameElem = document.getElementById('player-name');
            if (nameElem) nameElem.textContent = this.player.name || '勇者';

            const posX = document.getElementById('pos-x');
            const posZ = document.getElementById('pos-z');
            if (posX) posX.textContent = this.player.gridX.toFixed(1);
            if (posZ) posZ.textContent = this.player.gridZ.toFixed(1);
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    showLoading() {
        const el = document.getElementById('loading-ui');
        if (el) el.style.display = 'flex';
    }
    hideLoading() {
        const el = document.getElementById('loading-ui');
        if (el) el.style.display = 'none';
    }
    showLoadingError(msg) {
        const el = document.getElementById('loading-ui');
        if (el) el.innerHTML = `<div style="color:red"><p>エラー</p><p>${msg}</p></div>`;
    }
}
