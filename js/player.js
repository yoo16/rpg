import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TILE_SIZE } from './constants.js';

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

        this.isMoving = false;
        this.isRotating = false;
        this.targetPosition = null;
        this.rotationTarget = 0;

        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        this.currentAnimState = 'Idle';
    }

    async init(playerData, mapData) {
        this.stats = JSON.parse(JSON.stringify(playerData.stats));
        this.name = playerData.name;

        const assetInfo = mapData.player_assets;
        const modelUrl = assetInfo?.model_url;
        const walkUrl = assetInfo?.anim_walk_url;
        const scale = assetInfo?.scale || 0.5;

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
            if (idleClip) this.idleMixer.clipAction(idleClip).play();
            this.idleModel.visible = true; // 初期状態
        }

        if (walkData) {
            this.walkModel = walkData.scene || walkData;
            this.setupModel(this.walkModel, scale);
            this.mesh.add(this.walkModel);
            this.walkMixer = new THREE.AnimationMixer(this.walkModel);
            const walkClip = walkData.animations[0];
            if (walkClip) {
                const action = this.walkMixer.clipAction(walkClip);
                action.timeScale = 1.4;
                action.play();
            }
            this.walkModel.visible = false; // 初期状態は隠す
        }

        this.updatePlayerPosition();
        this.mesh.rotation.y = this.rotationTarget;
    }

    setupModel(model, scale) {
        model.scale.set(scale, scale, scale);
        // モデルの向きを180度回転させて、カメラの向き（北向きデフォルト）と合わせる
        model.rotation.y = Math.PI;
        model.traverse(n => {
            if (n.isMesh) {
                n.castShadow = true;
                n.receiveShadow = true;
                n.frustumCulled = false; // ちらつき防止
                if (n.material) n.material = n.material.clone();
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

    // Game.jsから分離して呼び出される想定
    updateAnimation(delta) {
        // アニメーション状態の切り替え
        if (this.isMoving) {
            this.setAnimationState('Walk');
        } else {
            this.setAnimationState('Idle');
        }

        // ミキサー更新とボーン固定
        // idle
        if (this.idleMixer && this.idleModel?.visible) {
            this.idleMixer.update(delta);
            this.resetRootPosition(this.idleModel);
        }
        // walk
        if (this.walkMixer && this.walkModel?.visible) {
            this.walkMixer.update(delta);
            this.resetRootPosition(this.walkModel);
        }
    }

    setAnimationState(state) {
        if (this.currentAnimState === state) return;
        this.currentAnimState = state;
        const isWalk = (state === 'Walk');
        if (this.idleModel) this.idleModel.visible = !isWalk;
        if (this.walkModel) this.walkModel.visible = isWalk;
    }

    rotateBy(angle) {
        if (this.isMoving) return;
        this.rotationTarget += angle;
        this.isRotating = true;
    }

    moveForward() {
        if (this.isMoving || this.isRotating) return;

        const dx = -Math.round(Math.sin(this.rotationTarget));
        const dz = -Math.round(Math.cos(this.rotationTarget));

        const targetX = this.gridX + dx;
        const targetZ = this.gridZ + dz;

        const { width, height, tiles } = this.mapManager.mapData;
        if (targetX < 0 || targetX >= width || targetZ < 0 || targetZ >= height) return;
        if (tiles[targetZ][targetX] === 1 || tiles[targetZ][targetX] === 2) return;

        this.gridX = targetX;
        this.gridZ = targetZ;
        this.isMoving = true;
        this.targetPosition = new THREE.Vector3(targetX * TILE_SIZE, 0, targetZ * TILE_SIZE);
    }

    updateMovement(deltaTime) {
        this.smoothRotate(deltaTime);

        if (!this.isMoving || !this.targetPosition) return;

        const speed = 4.0;
        const currentPos = this.mesh.position;
        const targetPos = this.targetPosition;
        const distance = currentPos.distanceTo(targetPos);

        if (distance < 0.05) {
            this.mesh.position.copy(targetPos);
            this.isMoving = false;
            this.targetPosition = null;
            if (this.onEncounter) this.onEncounter();
        } else {
            const moveDir = targetPos.clone().sub(currentPos).normalize();
            currentPos.add(moveDir.multiplyScalar(Math.min(speed * deltaTime, distance)));
        }
    }

    smoothRotate(deltaTime) {
        const currentRotation = this.mesh.rotation.y;
        let targetRotation = this.rotationTarget;
        const PI2 = Math.PI * 2;

        while (targetRotation - currentRotation > Math.PI) targetRotation -= PI2;
        while (targetRotation - currentRotation < -Math.PI) targetRotation += PI2;

        const diff = targetRotation - currentRotation;
        if (Math.abs(diff) < 0.01) {
            this.mesh.rotation.y = targetRotation;
            this.isRotating = false;
        } else {
            this.mesh.rotation.y += diff * 10.0 * deltaTime;
        }
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

    getFacingPosition() {
        const dx = -Math.round(Math.sin(this.rotationTarget));
        const dz = -Math.round(Math.cos(this.rotationTarget));
        return { x: this.gridX + dx, z: this.gridZ + dz };
    }

    updatePlayerPosition() {
        if (this.mesh) this.mesh.position.set(this.gridX * TILE_SIZE, 0, this.gridZ * TILE_SIZE);
    }
}