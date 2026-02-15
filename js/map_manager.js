import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TILE_SIZE } from './constants.js';

export class MapManager {
    constructor() {
        this.group = new THREE.Group();
        this.mapData = null;
        this.mapMeshes = [];
        this.npcMeshes = [];
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        this.mixers = [];
    }

    init(mapData) {
        this.mapData = mapData;

        // テクスチャ読み込み
        const textureLoader = new THREE.TextureLoader();
        this.wallTexture = textureLoader.load('assets/textures/stone_wall.jpg');
        this.floorTexture = textureLoader.load('assets/textures/dungeon_floor.jpg');

        this.createMap();
    }

    async loadModel(url) {
        if (!url) return null;
        const ext = url.split('.').pop().toLowerCase();
        const loader = (ext === 'fbx') ? this.fbxLoader : this.gltfLoader;
        return new Promise((resolve) => {
            loader.load(url, (data) => resolve(data), undefined, (error) => {
                console.warn(`Failed to load model: ${url}`, error);
                resolve(null);
            });
        });
    }

    async createNPCs() {
        if (!this.mapData.npcs) return;
        for (const npcData of this.mapData.npcs) {
            let npcGroup = new THREE.Group();
            const [mainData, walkData] = await Promise.all([
                this.loadModel(npcData.model_url),
                this.loadModel(npcData.anim_walk_url)
            ]);

            let idleModel = null;
            if (mainData) {
                idleModel = mainData.scene || mainData;
                this.setupNPCModel(idleModel, npcData.scale || 0.5);
                npcGroup.add(idleModel);
                const mixer = new THREE.AnimationMixer(idleModel);
                this.mixers.push({ mixer, model: idleModel });
                const idleClip = mainData.animations.find(a => a.name.toLowerCase().includes('idle')) || mainData.animations[0];
                if (idleClip) mixer.clipAction(idleClip).play();
            }

            const worldX = npcData.x * TILE_SIZE;
            const worldZ = npcData.z * TILE_SIZE;
            npcGroup.position.set(worldX, 0, worldZ);

            npcGroup.userData = {
                type: 'npc',
                id: npcData.id,
                name: npcData.name,
                x: Math.round(npcData.x),
                z: Math.round(npcData.z),
                dialogues: npcData.dialogues
            };

            this.group.add(npcGroup);
            this.npcMeshes.push(npcGroup);
        }
    }

    setupNPCModel(model, scale) {
        model.scale.set(scale, scale, scale);
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    node.material = Array.isArray(node.material) ?
                        node.material.map(m => m.clone()) : node.material.clone();
                }
            }
        });
    }

    update(delta) {
        for (const item of this.mixers) {
            item.mixer.update(delta);
            this.resetRootPosition(item.model);
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

    // NPC判定
    getNPCAt(x, z) {
        const tx = Math.round(x);
        const tz = Math.round(z);
        for (const npcGroup of this.npcMeshes) {
            const data = npcGroup.userData;
            if (data.x === tx && data.z === tz) return data;
        }
        return null;
    }

    lookAtPlayer(npcId, playerGridX, playerGridZ) {
        const npcGroup = this.npcMeshes.find(g => g.userData.id === npcId);
        if (!npcGroup) return;

        const data = npcGroup.userData;
        // プレイヤーとNPCの相対位置から角度を計算
        const dx = playerGridX - data.x;
        const dz = playerGridZ - data.z;

        // Math.atan2(x, z) で方向を求める
        const angle = Math.atan2(dx, dz);

        // NPCのメッシュ（Group）を回転させる
        npcGroup.rotation.y = angle;
    }

    // イベント判定（エラー回避のため追加）
    getEventAt(x, z) {
        console.log('getEventAt', x, z);
        if (!this.mapData || !this.mapData.events) return null;

        // 座標が一致するイベントを探す
        return this.mapData.events.find(ev =>
            Math.round(ev.x) === x && Math.round(ev.z) === z
        );
    }

    checkNPCProximity(playerX, playerZ, currentNPCId) {
        const px = Math.round(playerX);
        const pz = Math.round(playerZ);
        let adjacentToAny = false;
        let foundNPC = null;

        for (const npcGroup of this.npcMeshes) {
            const data = npcGroup.userData;
            const dx = Math.abs(px - data.x);
            const dz = Math.abs(pz - data.z);
            const isAdjacent = (dx === 1 && dz === 0) || (dx === 0 && dz === 1);

            if (isAdjacent) {
                adjacentToAny = true;
                if (currentNPCId === data.id) continue;
                foundNPC = data;
                break;
            }
        }
        return { adjacent: adjacentToAny, npc: foundNPC };
    }

    createMap() {
        const { tiles, width, height } = this.mapData;
        this.clearMap();
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const worldX = x * TILE_SIZE;
                const worldZ = z * TILE_SIZE;
                if (tiles[z][x] === 1) {
                    this.createWall(worldX, worldZ);
                } else if (tiles[z][x] === 2) {
                    this.createWater(worldX, worldZ);
                    this.createCeiling(worldX, worldZ);
                } else {
                    this.createFloor(worldX, worldZ);
                    this.createCeiling(worldX, worldZ);
                }
            }
        }
    }

    clearMap() {
        this.mapMeshes.forEach(m => {
            if (m.geometry) m.geometry.dispose();
            this.group.remove(m);
        });
        this.mapMeshes = [];
        this.npcMeshes.forEach(g => this.group.remove(g));
        this.npcMeshes = [];
        this.mixers = [];
    }

    createFloor(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.floorTexture, color: 0x888888 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    createWall(x, z) {
        // 壁のブロック高さ（個数）
        const height = 4;
        const geometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.wallTexture, color: 0x888888 });

        for (let i = 0; i < height; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            // y座標: (i * TILE_SIZE) + (TILE_SIZE / 2)
            // i=0 -> 0.5, i=1 -> 1.5, i=2 -> 2.5, i=3 -> 3.5
            mesh.position.set(x, (i * TILE_SIZE) + (TILE_SIZE / 2), z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            this.mapMeshes.push(mesh);
        }
    }

    createCeiling(x, z) {
        const wallHeight = 4.0;
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.BackSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, wallHeight, z);
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    createWater(x, z) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE), new THREE.MeshLambertMaterial({ color: 0x4169E1 }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.01, z);
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }
}