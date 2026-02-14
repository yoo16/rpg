import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TILE_SIZE, DIRECTION } from './constants.js';

export class Player {
    constructor(mapManager, onEncounter) {
        this.mapManager = mapManager;
        this.onEncounter = onEncounter;

        this.gridX = 1;
        this.gridZ = 1;
        this.mesh = null;
        this.model = null;
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.stats = null;
        this.name = '勇者';
        this.direction = DIRECTION.DOWN;
        this.isMoving = false;
        this.targetPosition = null;
        this.rotationTarget = Math.PI; // Default DOWN

        this.loader = new GLTFLoader();
    }

    async init(playerData, mapData) {
        this.stats = JSON.parse(JSON.stringify(playerData.stats));
        this.name = playerData.name;

        // Asset info from mapData (for player model overrides per map? or global?)
        // main.js used this.mapData.player_assets. 
        const assetInfo = mapData.player_assets;
        const modelUrl = assetInfo ? assetInfo.model_url : null;
        const scale = assetInfo ? (assetInfo.scale || 0.5) : 0.5;

        console.log(`👤 プレイヤーモデル読み込み中... ${modelUrl}`);

        let gltf = null;
        if (modelUrl) {
            gltf = await this.loadModel(modelUrl);
        }

        if (gltf) {
            this.model = gltf.scene;
            this.mesh = this.model;
            this.mesh.scale.set(scale, scale, scale);
            this.mesh.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.model);

                // Try to find Idle and Walk (or Run)
                const idleAnim = gltf.animations.find(a => a.name.toLowerCase().includes('idle')) || gltf.animations[0];
                const walkAnim = gltf.animations.find(a =>
                    a.name.toLowerCase().includes('walk') ||
                    a.name.toLowerCase().includes('run') ||
                    a.name.toLowerCase().includes('move')
                ) || gltf.animations[1];

                if (idleAnim) {
                    this.actions['Idle'] = this.mixer.clipAction(idleAnim);
                    this.actions['Idle'].play();
                    this.currentAction = this.actions['Idle'];
                }
                if (walkAnim) {
                    const action = this.mixer.clipAction(walkAnim);
                    action.timeScale = 1.5;
                    this.actions['Walk'] = action;
                }
            }
        } else {
            console.warn('Using fallback player model');
            const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const material = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
            this.mesh = new THREE.Mesh(geometry, material);
        }

        this.updatePlayerPosition();
        this.rotationTarget = this.getRotationFromDirection(this.direction);
        this.mesh.rotation.y = this.rotationTarget;
    }

    loadModel(url) {
        return new Promise((resolve) => {
            this.loader.load(url, (gltf) => resolve(gltf), undefined, (err) => {
                console.warn(`Failed to load player model: ${url}`, err);
                resolve(null);
            });
        });
    }

    updatePlayerPosition() {
        if (!this.mesh) return;
        const worldX = this.gridX * TILE_SIZE;
        const worldZ = this.gridZ * TILE_SIZE;
        const y = this.model ? 0 : 0.4;
        this.mesh.position.set(worldX, y, worldZ);
    }

    update(delta, keys) {
        this.handleInput(keys);
        this.updateMovement(delta);

        if (this.mixer) {
            this.mixer.update(delta);
        }
    }

    handleInput(keys) {
        if (this.isMoving || !this.mesh) return;

        let targetX = this.gridX;
        let targetZ = this.gridZ;
        let direction = null;

        if (keys['ArrowUp'] || keys['w'] || keys['W']) {
            targetZ--; direction = DIRECTION.UP;
        } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
            targetZ++; direction = DIRECTION.DOWN;
        } else if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
            targetX--; direction = DIRECTION.LEFT;
        } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
            targetX++; direction = DIRECTION.RIGHT;
        }

        if (direction) {
            this.direction = direction;
            this.rotationTarget = this.getRotationFromDirection(direction);

            const mapWidth = this.mapManager.mapData.width;
            const mapHeight = this.mapManager.mapData.height;

            if (targetX < 0 || targetX >= mapWidth || targetZ < 0 || targetZ >= mapHeight) return;

            // Check collision with map tiles
            const tileType = this.mapManager.mapData.tiles[targetZ][targetX];
            if (tileType === 1 || tileType === 2) return;

            // Check collision with NPCs?

            this.gridX = targetX;
            this.gridZ = targetZ;
            this.isMoving = true;
            this.targetPosition = new THREE.Vector3(targetX * TILE_SIZE, 0, targetZ * TILE_SIZE);
            if (this.model) this.targetPosition.y = 0;
            else this.targetPosition.y = 0.4;

            this.checkEncounter();
        }
    }

    checkEncounter() {
        const rate = this.mapManager.mapData.encounter_rate || 0.1;
        if (Math.random() < rate) {
            if (this.onEncounter) this.onEncounter();
        }
    }

    updateMovement(deltaTime) {
        if (!this.isMoving || !this.targetPosition || !this.mesh) {
            this.smoothRotate(deltaTime);
            return;
        }

        const speed = 4.0;
        const currentPos = this.mesh.position;
        const targetPos = this.targetPosition;
        const distance = currentPos.distanceTo(targetPos);

        if (distance < 0.05) {
            this.mesh.position.copy(targetPos);
            this.isMoving = false;
            this.targetPosition = null;
            this.setAnimation('Idle');
        } else {
            const direction = targetPos.clone().sub(currentPos).normalize();
            const moveDistance = Math.min(speed * deltaTime, distance);
            currentPos.add(direction.multiplyScalar(moveDistance));
            this.setAnimation('Walk');
        }

        this.smoothRotate(deltaTime);
    }

    smoothRotate(deltaTime) {
        if (!this.mesh) return;

        const currentRotation = this.mesh.rotation.y;
        let targetRotation = this.rotationTarget;

        const PI2 = Math.PI * 2;
        while (targetRotation - currentRotation > Math.PI) targetRotation -= PI2;
        while (targetRotation - currentRotation < -Math.PI) targetRotation += PI2;

        const rotationSpeed = 10.0;
        this.mesh.rotation.y += (targetRotation - currentRotation) * rotationSpeed * deltaTime;
    }

    getRotationFromDirection(dir) {
        switch (dir) {
            case DIRECTION.DOWN: return Math.PI;
            case DIRECTION.UP: return 0;
            case DIRECTION.LEFT: return Math.PI / 2;
            case DIRECTION.RIGHT: return -Math.PI / 2;
            default: return 0;
        }
    }

    setAnimation(name) {
        if (!this.actions[name]) return;
        const newAction = this.actions[name];

        if (this.currentAction !== newAction) {
            if (this.currentAction) {
                this.currentAction.fadeOut(0.2);
            }
            newAction.reset().fadeIn(0.2).play();
            this.currentAction = newAction;
        }
    }

    getFacingPosition() {
        let x = this.gridX;
        let z = this.gridZ;
        switch (this.direction) {
            case DIRECTION.UP: z--; break;
            case DIRECTION.DOWN: z++; break;
            case DIRECTION.LEFT: x--; break;
            case DIRECTION.RIGHT: x++; break;
        }
        return { x, z };
    }
}
