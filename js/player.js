import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TILE_SIZE, DIRECTION } from './constants.js';

export class Player {
    constructor(mapManager, onEncounter) {
        this.mapManager = mapManager;
        this.onEncounter = onEncounter;

        this.gridX = 1;
        this.gridZ = 1;
        this.mesh = new THREE.Group();

        this.idleModel = null;
        this.walkModel = null;
        this.idleMixer = null;
        this.walkMixer = null;

        this.direction = DIRECTION.DOWN;
        this.isMoving = false;
        this.targetPosition = null;
        this.rotationTarget = Math.PI;

        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();

        // 現在のアニメーション状態を保持する変数
        this.currentAnimState = 'Idle';
    }

    async init(playerData, mapData) {
        this.stats = JSON.parse(JSON.stringify(playerData.stats));
        this.name = playerData.name;

        const assetInfo = mapData.player_assets;
        const modelUrl = assetInfo ? assetInfo.model_url : null;
        const walkUrl = assetInfo ? assetInfo.anim_walk_url : null;
        const scale = assetInfo ? (assetInfo.scale || 0.5) : 0.5;

        let [mainData, walkData] = await Promise.all([
            modelUrl ? this.loadModel(modelUrl) : Promise.resolve(null),
            walkUrl ? this.loadModel(walkUrl) : Promise.resolve(null)
        ]);

        if (mainData) {
            this.idleModel = mainData.scene || mainData;
            this.setupModel(this.idleModel, scale);
            this.mesh.add(this.idleModel);
            this.idleMixer = new THREE.AnimationMixer(this.idleModel);
            const idleClip = mainData.animations.find(a => a.name.toLowerCase().includes('idle')) || mainData.animations[0];
            if (idleClip) {
                const action = this.idleMixer.clipAction(idleClip);
                action.loop = THREE.LoopRepeat;
                action.play();
            }
        }

        if (walkData) {
            this.walkModel = walkData.scene || walkData;
            this.setupModel(this.walkModel, scale);
            this.mesh.add(this.walkModel);
            this.walkMixer = new THREE.AnimationMixer(this.walkModel);
            const walkClip = walkData.animations[0];
            if (walkClip) {
                const action = this.walkMixer.clipAction(walkClip);
                action.loop = THREE.LoopRepeat;
                action.timeScale = 1.4;
                action.play();
            }
        }

        // 初期表示を明示的に設定
        this.currentAnimState = 'Idle';
        if (this.idleModel) this.idleModel.visible = true;
        if (this.walkModel) this.walkModel.visible = false;

        this.updatePlayerPosition();
        this.rotationTarget = this.getRotationFromDirection(this.direction);
        this.mesh.rotation.y = this.rotationTarget;
    }

    setupModel(model, scale) {
        model.scale.set(scale, scale, scale);
        model.traverse(n => {
            if (n.isMesh) {
                n.castShadow = true;
                n.receiveShadow = true;
                n.material = n.material.clone();
            }
        });
    }

    async loadModel(url) {
        const ext = url.split('.').pop().toLowerCase();
        return new Promise((resolve) => {
            const loader = (ext === 'fbx') ? this.fbxLoader : this.gltfLoader;
            loader.load(url, (data) => resolve(data), undefined, () => resolve(null));
        });
    }

    resetRootPosition(model) {
        if (!model) return;
        model.traverse(node => {
            if (node.isBone && (
                node.name.toLowerCase().includes('hips') ||
                node.name.toLowerCase().includes('root') ||
                node.name.toLowerCase().includes('pelvis')
            )) {
                node.position.x = 0;
                node.position.z = 0;
            }
        });
    }

    update(delta, keys) {
        // 1. Update movement first (to handle arrival and update isMoving)
        this.updateMovement(delta);

        // 2. Handle input next (to immediately start moving again if key held)
        this.handleInput(keys);

        // 3. Centralized animation state logic
        if (this.isMoving) {
            this.setAnimationState('Walk');
        } else {
            this.setAnimationState('Idle');
        }

        // 4. Update mixers
        if (this.idleMixer) {
            this.idleMixer.update(delta);
            this.resetRootPosition(this.idleModel);
        }
        if (this.walkMixer) {
            this.walkMixer.update(delta);
            this.resetRootPosition(this.walkModel);
        }
    }

    handleInput(keys) {
        if (this.isMoving || !this.mesh) return;
        let targetX = this.gridX;
        let targetZ = this.gridZ;
        let direction = null;

        if (keys['ArrowUp'] || keys['w'] || keys['W']) { targetZ--; direction = DIRECTION.UP; }
        else if (keys['ArrowDown'] || keys['s'] || keys['S']) { targetZ++; direction = DIRECTION.DOWN; }
        else if (keys['ArrowLeft'] || keys['a'] || keys['A']) { targetX--; direction = DIRECTION.LEFT; }
        else if (keys['ArrowRight'] || keys['d'] || keys['D']) { targetX++; direction = DIRECTION.RIGHT; }

        if (direction) {
            this.direction = direction;
            this.rotationTarget = this.getRotationFromDirection(direction);
            const { width, height, tiles } = this.mapManager.mapData;
            if (targetX < 0 || targetX >= width || targetZ < 0 || targetZ >= height) return;
            if (tiles[targetZ][targetX] === 1 || tiles[targetZ][targetX] === 2) return;
            this.gridX = targetX;
            this.gridZ = targetZ;
            this.isMoving = true;
            this.targetPosition = new THREE.Vector3(targetX * TILE_SIZE, 0, targetZ * TILE_SIZE);
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
            this.checkEncounter();
        } else {
            const moveDir = targetPos.clone().sub(currentPos).normalize();
            currentPos.add(moveDir.multiplyScalar(Math.min(speed * deltaTime, distance)));
        }
        this.smoothRotate(deltaTime);
    }

    checkEncounter() {
        const rate = this.mapManager.mapData.encounter_rate || 0.1;
        if (Math.random() < rate && this.onEncounter) this.onEncounter();
    }

    smoothRotate(deltaTime) {
        const currentRotation = this.mesh.rotation.y;
        let targetRotation = this.rotationTarget;
        const PI2 = Math.PI * 2;
        while (targetRotation - currentRotation > Math.PI) targetRotation -= PI2;
        while (targetRotation - currentRotation < -Math.PI) targetRotation += PI2;
        this.mesh.rotation.y += (targetRotation - currentRotation) * 10.0 * deltaTime;
    }

    getRotationFromDirection(dir) {
        const offset = Math.PI;
        switch (dir) {
            case DIRECTION.DOWN: return offset + Math.PI;
            case DIRECTION.UP: return offset + 0;
            case DIRECTION.LEFT: return offset + Math.PI / 2;
            case DIRECTION.RIGHT: return offset - Math.PI / 2;
            default: return 0;
        }
    }

    setAnimationState(state) {
        if (this.currentAnimState === state) return;

        this.currentAnimState = state;
        const isWalk = state === 'Walk';

        if (this.idleModel) this.idleModel.visible = !isWalk;
        if (this.walkModel) this.walkModel.visible = isWalk;
    }

    updatePlayerPosition() {
        if (this.mesh) this.mesh.position.set(this.gridX * TILE_SIZE, 0, this.gridZ * TILE_SIZE);
    }

    getFacingPosition() {
        let x = this.gridX; let z = this.gridZ;
        switch (this.direction) {
            case DIRECTION.UP: z--; break;
            case DIRECTION.DOWN: z++; break;
            case DIRECTION.LEFT: x--; break;
            case DIRECTION.RIGHT: x++; break;
        }
        return { x, z };
    }
}