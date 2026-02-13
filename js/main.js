import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GameApi from './api.js';

/**
 * Web 3D RPG - Main Game Class
 * Handles game loop, rendering, and logic using Three.js
 */

// Constants
const TILE_SIZE = 1.0;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;

// Game States
const STATE = { MAP: 'MAP', BATTLE: 'BATTLE' };
const ENCOUNTER_RATE = 0.1;

// Battle Phases
const BATTLE_PHASE = {
    PLAYER_TURN: 'PLAYER_TURN',
    ENEMY_TURN: 'ENEMY_TURN',
    VICTORY: 'VICTORY',
    DEFEAT: 'DEFEAT'
};

// Directions
const DIRECTION = {
    UP: 'UP',
    DOWN: 'DOWN',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT'
};

class Game {
    constructor() {
        // Three.js Components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock(); // For animations

        // Scene Graph
        this.worldGroup = null;
        this.battleGroup = null;

        // Game State
        this.currentState = STATE.MAP;
        this.currentBattlePhase = BATTLE_PHASE.PLAYER_TURN;
        this.mapData = null;
        this.mapMeshes = [];
        this.npcMeshes = [];
        this.mixers = []; // Animation mixers

        this.player = {
            gridX: 1,
            gridZ: 1,
            mesh: null,
            model: null, // GLB model
            mixer: null, // Animation mixer
            actions: {}, // Animation actions (Idle, Walk)
            stats: null,
            name: '勇者',
            direction: DIRECTION.DOWN,
            isMoving: false,
            targetPosition: null,
            rotationTarget: 0 // Target Y rotation
        };

        this.enemy = null;
        this.enemyMasterData = null;
        this.keys = {};

        // Dialog State
        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.currentNPCId = null;
        this.lastDialogTime = 0;

        this.isRunning = true;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.fps = 60;

        // Camera Settings (Third Person / Follow)
        // Offset relative to player
        this.cameraOffset = { x: 0, y: 4, z: 6 };
        this.mapCameraTarget = { x: 0, y: 0, z: 0 };

        // Battle Camera
        this.battleCameraPos = { x: 0, y: 3, z: 8 }; // Moved back and up
        this.battleCameraTarget = { x: 0, y: 1.0, z: 0 }; // Look at center of large enemies

        // Loader
        this.loader = new GLTFLoader();

        this.init();
    }

    async init() {
        console.log('%c🎮 Web 3D RPG Phase 8 (Expanded Map + Camera) Initializing...', 'color: #0f0; font-size: 16px; font-weight: bold;');

        try {
            this.showLoading();
            await GameApi.initConfig();
            this.setupThreeJS();

            const [playerResponse, mapResponse, enemyResponse] = await Promise.all([
                GameApi.getPlayerInitData(),
                GameApi.getMapData(1),
                GameApi.getEnemyData()
            ]);

            this.player.stats = JSON.parse(JSON.stringify(playerResponse.data.player.stats));
            this.player.name = playerResponse.data.player.name;
            this.mapData = mapResponse.data.map;
            this.enemyMasterData = enemyResponse.data.enemies;

            this.createMap();
            await this.createPlayer(); // Async for model loading
            await this.createNPCs();   // Async for model loading

            this.setupInput();
            this.setupBattleUI();
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

        // Initial Camera Position (Updated in updateCamera)
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000); // FOV 60 for better view
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

    loadModel(url) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => resolve(gltf),
                undefined,
                (error) => {
                    console.warn(`Failed to load model: ${url}`, error);
                    resolve(null);
                }
            );
        });
    }

    createMap() {
        console.log('🗺️ マップ生成中...');
        const { tiles, width, height } = this.mapData;

        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const tileType = tiles[z][x];
                const worldX = x * TILE_SIZE;
                const worldZ = z * TILE_SIZE;

                switch (tileType) {
                    case 0: this.createFloor(worldX, worldZ); break;
                    case 1: this.createWall(worldX, worldZ); break;
                    case 2: this.createWater(worldX, worldZ); break;
                }
            }
        }
    }

    createFloor(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        this.worldGroup.add(mesh);
        this.mapMeshes.push(mesh);
    }

    createWall(x, z) {
        const geometry = new THREE.BoxGeometry(TILE_SIZE, 1.0, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0.5, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.worldGroup.add(mesh);
        this.mapMeshes.push(mesh);
    }

    createWater(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.01, z);
        mesh.receiveShadow = true;
        this.worldGroup.add(mesh);
        this.mapMeshes.push(mesh);
    }

    async createPlayer() {
        const assetInfo = this.mapData.player_assets;
        const modelUrl = assetInfo ? assetInfo.model_url : null;
        const scale = assetInfo ? (assetInfo.scale || 0.5) : 0.5;

        console.log(`👤 プレイヤーモデル読み込み中... ${modelUrl}`);

        let gltf = null;
        if (modelUrl) {
            gltf = await this.loadModel(modelUrl);
        }

        if (gltf) {
            this.player.model = gltf.scene;
            this.player.mesh = this.player.model;
            this.player.mesh.scale.set(scale, scale, scale);
            this.player.mesh.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            if (gltf.animations && gltf.animations.length > 0) {
                this.player.mixer = new THREE.AnimationMixer(this.player.model);
                this.mixers.push(this.player.mixer);

                console.log('Player Animations:', gltf.animations.map(a => a.name));

                // Try to find Idle and Walk (or Run)
                const idleAnim = gltf.animations.find(a => a.name.toLowerCase().includes('idle')) || gltf.animations[0];
                const walkAnim = gltf.animations.find(a =>
                    a.name.toLowerCase().includes('walk') ||
                    a.name.toLowerCase().includes('run') ||
                    a.name.toLowerCase().includes('move')
                ) || gltf.animations[1];

                if (idleAnim) {
                    this.player.actions['Idle'] = this.player.mixer.clipAction(idleAnim);
                    this.player.actions['Idle'].play();
                }
                if (walkAnim) {
                    const action = this.player.mixer.clipAction(walkAnim);
                    action.timeScale = 1.5; // Make legs move faster to match speed
                    this.player.actions['Walk'] = action;
                }
            }

        } else {
            console.warn('Using fallback player model');
            const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const material = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
            this.player.mesh = new THREE.Mesh(geometry, material);
        }

        this.updatePlayerPosition();
        this.player.rotationTarget = this.getRotationFromDirection(this.player.direction);
        this.player.mesh.rotation.y = this.player.rotationTarget;

        this.worldGroup.add(this.player.mesh);
        console.log(`✅ プレイヤー作成完了 (${this.player.gridX}, ${this.player.gridZ})`);
    }

    async createNPCs() {
        if (!this.mapData.npcs) return;

        console.log(`👥 ${this.mapData.npcs.length} 体のNPCを読み込み中...`);

        for (const npcData of this.mapData.npcs) {
            let mesh = null;
            const modelUrl = npcData.model_url;
            const scale = npcData.scale || 0.5;

            let gltf = null;
            if (modelUrl) {
                gltf = await this.loadModel(modelUrl);
            }

            if (gltf) {
                mesh = gltf.scene;
                mesh.scale.set(scale, scale, scale);
                mesh.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                if (gltf.animations && gltf.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(mesh);
                    this.mixers.push(mixer);
                    const idleAnim = gltf.animations.find(a => a.name.toLowerCase().includes('idle')) || gltf.animations[0];
                    if (idleAnim) {
                        mixer.clipAction(idleAnim).play();
                    }
                }

            } else {
                const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 8);
                const material = new THREE.MeshLambertMaterial({ color: npcData.color || 0x0000FF });
                mesh = new THREE.Mesh(geometry, material);
            }

            const worldX = npcData.x * TILE_SIZE;
            const worldZ = npcData.z * TILE_SIZE;
            mesh.position.set(worldX, 0, worldZ);

            mesh.userData = {
                type: 'npc',
                id: npcData.id,
                name: npcData.name,
                x: npcData.x,
                z: npcData.z,
                dialogues: npcData.dialogues
            };

            this.worldGroup.add(mesh);
            this.npcMeshes.push(mesh);
        }
    }

    updatePlayerPosition() {
        const worldX = this.player.gridX * TILE_SIZE;
        const worldZ = this.player.gridZ * TILE_SIZE;
        const y = this.player.model ? 0 : 0.4;
        this.player.mesh.position.set(worldX, y, worldZ);
    }

    updateMovement(deltaTime) {
        if (!this.player.isMoving || !this.player.targetPosition || !this.player.mesh) {
            this.smoothRotate(deltaTime);
            return;
        }

        const speed = 4.0;
        const currentPos = this.player.mesh.position;
        const targetPos = this.player.targetPosition;
        const distance = currentPos.distanceTo(targetPos);

        if (distance < 0.05) {
            this.player.mesh.position.copy(targetPos);
            this.player.isMoving = false;
            this.player.targetPosition = null;
            this.setAnimation('Idle');
        } else {
            const direction = targetPos.clone().sub(currentPos).normalize();
            const moveDistance = Math.min(speed * deltaTime, distance);
            currentPos.add(direction.multiplyScalar(moveDistance));
            this.setAnimation('Walk');
        }

        this.smoothRotate(deltaTime);
    }

    getRotationFromDirection(dir) {
        switch (dir) {
            case DIRECTION.DOWN: return Math.PI; // Was 0
            case DIRECTION.UP: return 0;       // Was Math.PI
            case DIRECTION.LEFT: return Math.PI / 2;
            case DIRECTION.RIGHT: return -Math.PI / 2;
            default: return 0;
        }
    }

    smoothRotate(deltaTime) {
        if (!this.player.mesh) return;

        const currentRotation = this.player.mesh.rotation.y;
        let targetRotation = this.player.rotationTarget;

        const PI2 = Math.PI * 2;
        while (targetRotation - currentRotation > Math.PI) targetRotation -= PI2;
        while (targetRotation - currentRotation < -Math.PI) targetRotation += PI2;

        const rotationSpeed = 10.0;
        this.player.mesh.rotation.y += (targetRotation - currentRotation) * rotationSpeed * deltaTime;
    }

    setAnimation(name) {
        if (!this.player.actions[name]) return;
        const currentAction = this.player.currentAction;
        const newAction = this.player.actions[name];

        if (currentAction !== newAction) {
            if (currentAction) {
                currentAction.fadeOut(0.2);
            }
            newAction.reset().fadeIn(0.2).play();
            this.player.currentAction = newAction;
        }
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

    checkInteraction() {
        const frontX = this.player.gridX;
        const frontZ = this.player.gridZ;

        let targetX = frontX;
        let targetZ = frontZ;

        switch (this.player.direction) {
            case DIRECTION.UP: targetZ--; break;
            case DIRECTION.DOWN: targetZ++; break;
            case DIRECTION.LEFT: targetX--; break;
            case DIRECTION.RIGHT: targetX++; break;
        }

        if (targetX < 0 || targetX >= this.mapData.width || targetZ < 0 || targetZ >= this.mapData.height) return;

        console.log(`🔍 Checking Interaction at (${targetX}, ${targetZ})`);

        for (const npcMesh of this.npcMeshes) {
            if (npcMesh.userData.x === targetX && npcMesh.userData.z === targetZ) {
                if (npcMesh.userData.dialogues?.length > 0) {
                    console.log('✅ Found NPC');
                    this.startNPCDialog(npcMesh.userData);
                    return;
                }
            }
        }

        const event = this.mapData.events?.find(ev => ev.x === targetX && ev.z === targetZ);
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

    handleInput() {
        if (this.currentState !== STATE.MAP) return;
        if (this.dialogActive) return;
        if (this.player.isMoving) return;

        let targetX = this.player.gridX;
        let targetZ = this.player.gridZ;
        let direction = null;

        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) {
            targetZ--; direction = DIRECTION.UP;
        } else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) {
            targetZ++; direction = DIRECTION.DOWN;
        } else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            targetX--; direction = DIRECTION.LEFT;
        } else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            targetX++; direction = DIRECTION.RIGHT;
        }

        if (direction) {
            this.player.direction = direction;
            this.player.rotationTarget = this.getRotationFromDirection(direction);

            if (targetX < 0 || targetX >= this.mapData.width || targetZ < 0 || targetZ >= this.mapData.height) return;
            const tileType = this.mapData.tiles[targetZ][targetX];
            if (tileType === 1 || tileType === 2) return;

            this.player.gridX = targetX;
            this.player.gridZ = targetZ;
            this.player.isMoving = true;
            this.player.targetPosition = new THREE.Vector3(targetX * TILE_SIZE, 0, targetZ * TILE_SIZE);
            if (this.player.model) this.player.targetPosition.y = 0;
            else this.player.targetPosition.y = 0.4;

            this.checkEncounter();
        }
    }

    checkEncounter() {
        if (this.currentState !== STATE.MAP) return;
        const rate = this.mapData.encounter_rate || ENCOUNTER_RATE;
        if (Math.random() < rate) {
            this.startBattle();
        }
    }

    checkNPCProximity() {
        if (this.currentState !== STATE.MAP) return;

        const playerX = this.player.gridX;
        const playerZ = this.player.gridZ;
        let adjacentToAny = false;

        for (const npcMesh of this.npcMeshes) {
            const npcX = npcMesh.userData.x;
            const npcZ = npcMesh.userData.z;
            const isAdjacent = (playerX === npcX && Math.abs(playerZ - npcZ) === 1) || (playerZ === npcZ && Math.abs(playerX - npcX) === 1);

            if (isAdjacent) {
                adjacentToAny = true;
                if (this.currentNPCId === npcMesh.userData.id) return;

                this.startNPCDialog(npcMesh.userData);
                return;
            }
        }

        if (!adjacentToAny) {
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
        this.handleInput();
        this.updateMovement(delta);

        if (!this.dialogActive) {
            this.checkNPCProximity();
        }

        for (const mixer of this.mixers) {
            mixer.update(delta);
        }

        this.updateCamera(); // New Camera Follow Logic
        this.updateUI();
    }

    // New: Camera Follow Logic
    updateCamera() {
        if (this.currentState !== STATE.MAP || !this.player.mesh) return;

        // Target: Player position
        const targetX = this.player.mesh.position.x;
        const targetZ = this.player.mesh.position.z;

        // Smooth follow
        const lerpFactor = 0.1;
        this.mapCameraTarget.x += (targetX - this.mapCameraTarget.x) * lerpFactor;
        this.mapCameraTarget.z += (targetZ - this.mapCameraTarget.z) * lerpFactor;

        // Camera Position: Offset from target
        // this.cameraOffset = { x: 0, y: 4, z: 6 };
        this.camera.position.x = this.mapCameraTarget.x + this.cameraOffset.x;
        this.camera.position.y = this.mapCameraTarget.y + this.cameraOffset.y;
        this.camera.position.z = this.mapCameraTarget.z + this.cameraOffset.z;

        this.camera.lookAt(this.mapCameraTarget.x, this.mapCameraTarget.y + 1.0, this.mapCameraTarget.z); // Look slightly above feet
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    updateUI() {
        if (!this.player.mesh) return;
        const pos = this.player.mesh.position;
        const fpsElem = document.getElementById('fps');
        if (fpsElem) fpsElem.textContent = this.fps;

        const nameElem = document.getElementById('player-name');
        if (nameElem) nameElem.textContent = this.player.name || '勇者';

        const posX = document.getElementById('pos-x');
        const posZ = document.getElementById('pos-z');
        if (posX) posX.textContent = this.player.gridX.toFixed(1);
        if (posZ) posZ.textContent = this.player.gridZ.toFixed(1);
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // --- Battle Logic ---

    showLoading() { document.getElementById('loading-ui').style.display = 'flex'; }
    hideLoading() { document.getElementById('loading-ui').style.display = 'none'; }
    showLoadingError(msg) {
        const el = document.getElementById('loading-ui');
        if (el) el.innerHTML = `<div style="color:red"><p>エラー</p><p>${msg}</p></div>`;
    }

    setupBattleUI() {
        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');

        btnAttack.addEventListener('click', () => {
            if (this.currentBattlePhase === BATTLE_PHASE.PLAYER_TURN) {
                this.onPlayerAttack();
            }
        });

        btnRun.addEventListener('click', () => {
            if (this.currentState === STATE.BATTLE &&
                this.currentBattlePhase !== BATTLE_PHASE.VICTORY &&
                this.currentBattlePhase !== BATTLE_PHASE.DEFEAT) {
                this.addBattleLog('💨 逃げ出した！');
                document.getElementById('btn-attack').disabled = true;
                document.getElementById('btn-run').disabled = true;
                setTimeout(() => {
                    this.endBattle(false);
                }, 1000);
            }
        });
    }

    async startBattle() {
        this.currentState = STATE.BATTLE;
        this.currentBattlePhase = BATTLE_PHASE.PLAYER_TURN;
        console.log('⚔️ バトル開始！');

        try {
            const possibleEnemyIds = this.mapData.possible_enemies;
            if (!possibleEnemyIds || possibleEnemyIds.length === 0) throw new Error('No enemies here');

            const randomEnemyId = possibleEnemyIds[Math.floor(Math.random() * possibleEnemyIds.length)];
            const enemyMasterData = this.enemyMasterData[randomEnemyId];

            if (!enemyMasterData) throw new Error(`Enemy data not found for ${randomEnemyId}`);

            this.enemy = {
                id: randomEnemyId,
                name: enemyMasterData.name,
                color: enemyMasterData.color,
                scale: enemyMasterData.scale,
                model_url: enemyMasterData.model_url,
                y_offset: enemyMasterData.y_offset || 0,
                position: { x: 0, y: 0.5, z: 0 },
                stats: {
                    hp: enemyMasterData.maxHp,
                    maxHp: enemyMasterData.maxHp,
                    attack: enemyMasterData.attack,
                    defense: enemyMasterData.defense
                }
            };

            this.player.stats.hp = this.player.stats.maxHp;

            await this.createEnemy();

            this.worldGroup.visible = false;
            this.battleGroup.visible = true;

            this.camera.position.set(this.battleCameraPos.x, this.battleCameraPos.y, this.battleCameraPos.z);
            this.camera.lookAt(this.battleCameraTarget.x, this.battleCameraTarget.y, this.battleCameraTarget.z);

            this.showBattleUI();
            this.updateBattleUI();

            setTimeout(() => {
                this.addBattleLog('あなたのターン！ コマンドを選択してください。');
                document.getElementById('btn-attack').disabled = false;
                document.getElementById('btn-run').disabled = false;
            }, 500);

        } catch (error) {
            console.error('Battle Start Error:', error);
            this.endBattle(false);
        }
    }

    endBattle(isVictory = true) {
        this.currentState = STATE.MAP;
        this.currentBattlePhase = BATTLE_PHASE.PLAYER_TURN;

        if (isVictory) {
            this.addBattleLog('🏆 勝利！');
        } else {
            this.addBattleLog('💀 敗北...');
        }

        setTimeout(() => {
            if (this.enemy && this.enemy.mesh) {
                // Remove mixer
                if (this.enemy.mixer) {
                    const index = this.mixers.indexOf(this.enemy.mixer);
                    if (index > -1) this.mixers.splice(index, 1);
                    this.enemy.mixer = null;
                }

                this.enemy.mesh.traverse((node) => {
                    if (node.isMesh) {
                        node.geometry.dispose();
                        if (node.material.map) node.material.map.dispose();
                        node.material.dispose();
                    }
                });
                this.battleGroup.remove(this.enemy.mesh);
            }
            this.enemy = null;

            this.battleGroup.visible = false;
            this.worldGroup.visible = true;

            // Reset Camera is handled by update() loop now
            this.hideBattleUI();
        }, isVictory ? 2000 : 3000);
    }

    async createEnemy() {
        if (this.enemy.model_url) {
            console.log(`👹 敵モデル読み込み中... ${this.enemy.model_url}`);
            const gltf = await this.loadModel(this.enemy.model_url);

            if (gltf) {
                this.enemy.mesh = gltf.scene;
                const scale = this.enemy.scale || 1.0;
                this.enemy.mesh.scale.set(scale, scale, scale);

                // Adjust Y position based on offset
                const y = this.enemy.y_offset !== undefined ? this.enemy.y_offset : 0;
                this.enemy.mesh.position.set(this.enemy.position.x, y, this.enemy.position.z);

                this.enemy.mesh.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                // Animation
                if (gltf.animations && gltf.animations.length > 0) {
                    this.enemy.mixer = new THREE.AnimationMixer(this.enemy.mesh);
                    this.mixers.push(this.enemy.mixer);

                    // Play a random animation or the first one (usually includes 'Fly', 'Run' etc)
                    const anim = gltf.animations[0];
                    const action = this.enemy.mixer.clipAction(anim);
                    action.play();
                    console.log(`Enemy playing animation: ${anim.name}`);
                }

                this.battleGroup.add(this.enemy.mesh);
                return;
            }
        }

        // Fallback or if no model_url
        const geometry = new THREE.SphereGeometry(this.enemy.scale * 0.5, 32, 32);
        const material = new THREE.MeshLambertMaterial({ color: this.enemy.color });
        this.enemy.mesh = new THREE.Mesh(geometry, material);
        this.enemy.mesh.position.set(this.enemy.position.x, this.enemy.position.y, this.enemy.position.z);
        this.enemy.mesh.castShadow = true;
        this.enemy.mesh.receiveShadow = true;
        this.battleGroup.add(this.enemy.mesh);
    }

    showBattleUI() {
        const battleUI = document.getElementById('battle-ui');
        const battleMessage = document.getElementById('battle-message');
        battleMessage.textContent = `⚔️ 野生の ${this.enemy.name} があらわれた！`;
        battleUI.style.display = 'block';
    }

    hideBattleUI() {
        document.getElementById('battle-ui').style.display = 'none';
    }

    onPlayerAttack() {
        if (this.currentBattlePhase !== BATTLE_PHASE.PLAYER_TURN) return;

        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');
        btnAttack.disabled = true;
        btnRun.disabled = true;

        const damage = Math.max(this.player.stats.attack - this.enemy.stats.defense, 1);
        this.addBattleLog(`⚔️ あなたの攻撃！ ${damage} のダメージ！`);
        this.enemy.stats.hp -= damage;

        this.flashMesh(this.enemy.mesh, '#ff0000');
        this.updateBattleUI();

        if (this.enemy.stats.hp <= 0) {
            this.currentBattlePhase = BATTLE_PHASE.VICTORY;
            this.addBattleLog('🎉 敵を倒した！');
            setTimeout(() => this.endBattle(true), 1500);
            return;
        }

        this.currentBattlePhase = BATTLE_PHASE.ENEMY_TURN;
        setTimeout(() => this.onEnemyAttack(), 1500);
    }

    onEnemyAttack() {
        if (this.currentBattlePhase !== BATTLE_PHASE.ENEMY_TURN) return;

        const damage = Math.max(this.enemy.stats.attack - this.player.stats.defense, 1);
        this.addBattleLog(`👹 敵の攻撃！ ${damage} のダメージ！`);
        this.player.stats.hp -= damage;

        this.shakeCamera();
        this.updateBattleUI();

        if (this.player.stats.hp <= 0) {
            this.currentBattlePhase = BATTLE_PHASE.DEFEAT;
            this.addBattleLog('💀 あなたは倒れた...');
            setTimeout(() => this.endBattle(false), 1500);
            return;
        }

        this.currentBattlePhase = BATTLE_PHASE.PLAYER_TURN;
        this.addBattleLog('あなたのターン！');
        document.getElementById('btn-attack').disabled = false;
        document.getElementById('btn-run').disabled = false;
    }

    updateBattleUI() {
        // Enemy
        const enemyHPPercent = Math.max(0, (this.enemy.stats.hp / this.enemy.stats.maxHp) * 100);
        document.getElementById('enemy-hp-bar').style.width = enemyHPPercent + '%';
        document.getElementById('enemy-hp-text').textContent = `${Math.max(0, this.enemy.stats.hp)}/${this.enemy.stats.maxHp}`;
        document.getElementById('enemy-name').textContent = this.enemy.name;

        // Player
        const playerHPPercent = Math.max(0, (this.player.stats.hp / this.player.stats.maxHp) * 100);
        const playerBar = document.getElementById('player-hp-bar');
        playerBar.style.width = playerHPPercent + '%';
        playerBar.style.backgroundColor = playerHPPercent < 30 ? '#ff6666' : '#66ff66';
        document.getElementById('player-hp-text').textContent = `${Math.max(0, this.player.stats.hp)}/${this.player.stats.maxHp}`;
    }

    addBattleLog(message) {
        document.getElementById('battle-message').textContent = message;
    }


    flashMesh(mesh, color) {
        if (!mesh) return;

        const originalColors = new Map();

        mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.color) originalColors.set(mat, mat.color.getHex());
                    });
                } else if (child.material.color) {
                    originalColors.set(child.material, child.material.color.getHex());
                }
            }
        });

        if (originalColors.size === 0) return;

        let toggle = false;
        const interval = setInterval(() => {
            originalColors.forEach((originalColor, material) => {
                material.color.setHex(toggle ? originalColor : color);
            });
            toggle = !toggle;
        }, 50);

        setTimeout(() => {
            clearInterval(interval);
            originalColors.forEach((originalColor, material) => {
                material.color.setHex(originalColor);
            });
        }, 300);
    }

    shakeCamera() {
        const originalPos = this.camera.position.clone();
        let shake = 5;
        const interval = setInterval(() => {
            this.camera.position.x = originalPos.x + (Math.random() - 0.5) * 0.2;
            this.camera.position.y = originalPos.y + (Math.random() - 0.5) * 0.2;
            shake--;
            if (shake <= 0) {
                clearInterval(interval);
                this.camera.position.copy(originalPos);
            }
        }, 50);
    }
}

// Start Game
window.game = new Game();
