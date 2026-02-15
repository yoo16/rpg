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
        // 1. 座標とステータスの初期化
        this.gridX = mapData.start_x !== undefined ? mapData.start_x : 1;
        this.gridZ = mapData.start_z !== undefined ? mapData.start_z : 1;
        this.stats = JSON.parse(JSON.stringify(playerData.stats));
        this.name = playerData.name;

        // 2. アセット情報の取得
        const assetInfo = playerData.assets;
        const modelUrl = assetInfo?.model_url;
        const walkUrl = assetInfo?.anim_walk_url;
        const scale = assetInfo?.scale || 0.01;

        // 3. モデルの読み込み試行
        let [mainData, walkData] = await Promise.all([
            modelUrl ? this.loadModel(modelUrl) : Promise.resolve(null),
            walkUrl ? this.loadModel(walkUrl) : Promise.resolve(null)
        ]);

        // 4. モデルがあればセットアップ、なければプレースホルダーを作成
        if (mainData) {
            this.idleModel = mainData.scene || mainData;
            this.setupModel(this.idleModel, scale);
            this.mesh.add(this.idleModel);
            this.idleMixer = new THREE.AnimationMixer(this.idleModel);
            const idleClip = mainData.animations.find(a => a.name.toLowerCase().includes('idle')) || mainData.animations[0];
            if (idleClip) this.idleMixer.clipAction(idleClip).play();
        } else {
            // モデルがない場合のフォールバック
            this.createPlaceholder();
        }

        if (walkData) {
            this.walkModel = walkData.scene || walkData;
            this.setupModel(this.walkModel, scale);
            this.mesh.add(this.walkModel);
            this.walkMixer = new THREE.AnimationMixer(this.walkModel);
            const walkClip = walkData.animations[0];
            if (walkClip) this.walkMixer.clipAction(walkClip).setDuration(1).play();
            this.walkModel.visible = false;
        }

        this.updatePlayerPosition();
        this.mesh.rotation.y = this.rotationTarget;
    }

    createPlaceholder() {
        console.log("👻 Player placeholder created (Hidden)");
        const geometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const placeholderMesh = new THREE.Mesh(geometry, material);

        // 非表示に設定
        placeholderMesh.visible = false;

        placeholderMesh.position.y = 0.9;
        this.mesh.add(placeholderMesh);
    }

    // --- 以下、既存のロジックを継承 ---

    setupModel(model, scale) {
        model.scale.set(scale, scale, scale);
        model.rotation.y = Math.PI; // 初期向きをカメラに合わせる
        model.traverse(n => {
            if (n.isMesh) {
                n.castShadow = true;
                n.receiveShadow = true;
                n.frustumCulled = false;
                if (n.material) n.material = n.material.clone();
            }
        });
    }

    async loadModel(url) {
        const ext = url.split('.').pop().toLowerCase();
        return new Promise((resolve) => {
            const loader = (ext === 'fbx') ? this.fbxLoader : this.gltfLoader;
            loader.load(url, (data) => resolve(data), undefined, (err) => {
                console.warn(`Load failed for ${url}:`, err);
                resolve(null);
            });
        });
    }

    updateAnimation(delta) {
        if (!this.idleMixer && !this.walkMixer) return; // プレースホルダー時はスキップ

        this.setAnimationState(this.isMoving ? 'Walk' : 'Idle');

        if (this.idleMixer && this.idleModel?.visible) {
            this.idleMixer.update(delta);
            this.resetRootPosition(this.idleModel);
        }
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

        const npc = this.mapManager.getNPCAt(targetX, targetZ);
        if (npc) return;

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
            this.checkTileEvent();
            if (this.onEncounter) this.onEncounter();
        } else {
            const moveDir = targetPos.clone().sub(currentPos).normalize();
            currentPos.add(moveDir.multiplyScalar(Math.min(speed * deltaTime, distance)));
        }
    }

    checkTileEvent() {
        const event = this.mapManager.getEventAt(this.gridX, this.gridZ);
        if (event && event.type === 'heal') {
            if (this.stats) {
                this.stats.hp = this.stats.maxHp;
                window.dispatchEvent(new CustomEvent('player-healed', {
                    detail: { hp: this.stats.hp, message: event.message }
                }));
            }
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
            if (node.isBone && (node.name.toLowerCase().includes('hips') || node.name.toLowerCase().includes('root'))) {
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

    get hpPercent() {
        if (!this.stats || this.stats.maxHp <= 0) return 0;
        return Math.min(100, Math.max(0, (this.stats.hp / this.stats.maxHp) * 100));
    }
}