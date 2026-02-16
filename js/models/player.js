import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TILE_SIZE, LEVEL_UP_BASE_XP, LEVEL_UP_GROWTH_FACTOR } from '../constants.js';

export class Player {
    constructor(mapManager, onEncounter) {
        this.mapManager = mapManager;
        this.onEncounter = onEncounter;

        this.gridX = 1;
        this.gridZ = 1;
        this.mesh = new THREE.Group();
        this.stats = {
            hp: 100,
            maxHp: 100,
            attack: 10,
            defense: 5,
            level: 1,
            xp: 0,
            nextXp: LEVEL_UP_BASE_XP
        };

        this.idleModel = null;
        this.walkModel = null;
        this.idleMixer = null;
        this.walkMixer = null;

        this.flags = new Map(); // Game state flags


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

        // Initialize stats with defaults if not present
        const baseStats = playerData.stats || {};
        this.stats = {
            hp: baseStats.hp || 100,
            maxHp: baseStats.maxHp || 100,
            attack: baseStats.attack || 10,
            defense: baseStats.defense || 5,
            level: baseStats.level || 1,
            xp: baseStats.xp || 0,
            nextXp: baseStats.nextXp || LEVEL_UP_BASE_XP
        };

        this.name = playerData.name;
        this.rotationTarget = mapData.start_dir !== undefined ? mapData.start_dir : 0;

        // 2. アセット情報の取得
        const assetInfo = playerData.assets;
        const modelUrl = assetInfo?.idle_url;
        const walkUrl = assetInfo?.anim_walk_url;
        const victoryUrl = assetInfo?.anim_victory_url;
        const scale = assetInfo?.scale || 0.01;

        // 3. モデルの読み込み試行
        let [mainData, walkData, victoryData] = await Promise.all([
            modelUrl ? this.loadModel(modelUrl) : Promise.resolve(null),
            walkUrl ? this.loadModel(walkUrl) : Promise.resolve(null),
            victoryUrl ? this.loadModel(victoryUrl) : Promise.resolve(null)
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

        if (victoryData) {
            this.victoryModel = victoryData.scene || victoryData;
            this.setupModel(this.victoryModel, scale);
            this.mesh.add(this.victoryModel);
            this.victoryMixer = new THREE.AnimationMixer(this.victoryModel);
            const victoryClip = victoryData.animations[0];
            if (victoryClip) this.victoryMixer.clipAction(victoryClip).setDuration(1).play();
            this.victoryModel.visible = false;
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
        if (!this.idleMixer && !this.walkMixer) return;

        if (this.currentAnimState !== 'Victory') {
            this.setAnimationState(this.isMoving ? 'Walk' : 'Idle');
        }

        this.updateMixers(delta);
    }

    updateMixers(delta) {
        if (this.idleMixer && this.idleModel?.visible) {
            this.idleMixer.update(delta);
            this.resetRootPosition(this.idleModel);
        }
        if (this.walkMixer && this.walkModel?.visible) {
            this.walkMixer.update(delta);
            this.resetRootPosition(this.walkModel);
        }
        if (this.victoryMixer && this.victoryModel?.visible) {
            this.victoryMixer.update(delta);
            this.resetRootPosition(this.victoryModel);
        }
    }

    setAnimationState(state) {
        if (this.currentAnimState === state) return;
        this.currentAnimState = state;
        const isWalk = (state === 'Walk');
        const isVictory = (state === 'Victory');

        if (this.idleModel) this.idleModel.visible = (!isWalk && !isVictory);
        if (this.walkModel) this.walkModel.visible = isWalk;
        if (this.victoryModel) this.victoryModel.visible = isVictory;
    }

    playVictory() {
        this.setAnimationState('Victory');
        if (this.victoryMixer && this.victoryModel?.visible) {
            this.victoryMixer.clipAction(this.victoryModel.animations[0]).play();
        }
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
        // Tile 1 is Wall
        // Tile 2 is Water (walkable)
        if (tiles[targetZ][targetX] === 1) return;

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
            if (this.onEncounter) this.onEncounter();
            return true; // Movement finished
        } else {
            const moveDir = targetPos.clone().sub(currentPos).normalize();
            currentPos.add(moveDir.multiplyScalar(Math.min(speed * deltaTime, distance)));
            return false;
        }
    }

    checkTileEvent() {
        // Event handling is now delegated to Game controller via mapManager
        // This method might be redundant or can be used to notify Game to check events
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

    flashEffect(color = 0xffffff) {
        // mesh（カプセルやモデル）の中にある全Meshの material を一時的に発光させる
        this.mesh.traverse(node => {
            if (node.isMesh && node.material) {
                const originalEmissive = node.material.emissive.getHex();
                const originalIntensity = node.material.emissiveIntensity;

                // 発光させる
                node.material.emissive.setHex(color);
                node.material.emissiveIntensity = 2.0;

                // 0.5秒かけて元に戻す
                setTimeout(() => {
                    node.material.emissive.setHex(originalEmissive);
                    node.material.emissiveIntensity = originalIntensity;
                }, 500);
            }
        });
    }

    createHealRing() {
        const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(geometry, material);

        // 足元に水平に配置
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        this.mesh.add(ring);

        // アニメーション：広がりながら消える
        const startTime = Date.now();
        const duration = 1000;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                ring.scale.set(1 + progress * 3, 1 + progress * 3, 1);
                ring.material.opacity = 1 - progress;
                requestAnimationFrame(animate);
            } else {
                this.mesh.remove(ring);
                geometry.dispose();
                material.dispose();
            }
        };
        animate();
    }

    createHealPillar() {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16, 1, true);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const pillar = new THREE.Mesh(geometry, material);
        pillar.position.y = 1; // プレイヤーを包む高さ
        this.mesh.add(pillar);

        const startTime = Date.now();
        const duration = 800;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                // 上に伸びながら細くなる演出
                pillar.scale.set(1 - progress, 1 + progress * 2, 1 - progress);
                pillar.material.opacity = (1 - progress) * 0.5;
                requestAnimationFrame(animate);
            } else {
                this.mesh.remove(pillar);
                geometry.dispose();
                material.dispose();
            }
        };
        animate();
    }

    gainXp(amount) {
        this.stats.xp += amount;
        let leveledUp = false;
        while (this.stats.xp >= this.stats.nextXp) {
            this.levelUp();
            leveledUp = true;
        }
        return leveledUp;
    }

    levelUp() {
        this.stats.level++;
        this.stats.maxHp += 20;
        this.stats.hp = this.stats.maxHp;
        this.stats.attack += 5;
        this.stats.defense += 2;
        this.stats.nextXp = Math.floor(this.stats.nextXp * LEVEL_UP_GROWTH_FACTOR);
    }

    healFull() {
        this.stats.hp = this.stats.maxHp;
        this.createHealRing();
        this.createHealPillar();
        window.dispatchEvent(new CustomEvent('player-healed', {
            detail: { hp: this.stats.hp, message: 'HPが全快した！' }
        }));
    }

    setFlag(key, value) {
        this.flags.set(key, value);
        console.log(`🚩 Flag Set: ${key} = ${value}`);
    }

    getFlag(key) {
        return this.flags.get(key);
    }

    get hpPercent() {
        if (!this.stats || this.stats.maxHp <= 0) return 0;
        return Math.min(100, Math.max(0, (this.stats.hp / this.stats.maxHp) * 100));
    }
}