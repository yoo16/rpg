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
        this.mixers = []; // {mixer, model} のペアで管理
    }

    init(mapData) {
        this.mapData = mapData;
        this.createMap();
    }

    async loadModel(url) {
        if (!url) return null;
        const ext = url.split('.').pop().toLowerCase();
        const loader = (ext === 'fbx') ? this.fbxLoader : this.gltfLoader;

        return new Promise((resolve) => {
            loader.load(
                url,
                (data) => resolve(data),
                undefined,
                (error) => {
                    console.warn(`Failed to load model: ${url}`, error);
                    resolve(null);
                }
            );
        });
    }

    async createNPCs() {
        if (!this.mapData.npcs) return;

        console.log(`👥 ${this.mapData.npcs.length} 体のNPCを読み込み中...`);

        for (const npcData of this.mapData.npcs) {
            let npcGroup = new THREE.Group();
            const modelUrl = npcData.model_url;
            const walkUrl = npcData.anim_walk_url;
            const scale = npcData.scale || 0.5;

            const [mainData, walkData] = await Promise.all([
                this.loadModel(modelUrl),
                this.loadModel(walkUrl)
            ]);

            let idleModel = null;
            let walkModel = null;

            if (mainData) {
                idleModel = mainData.scene || mainData;
                this.setupNPCModel(idleModel, scale);
                npcGroup.add(idleModel);

                const mixer = new THREE.AnimationMixer(idleModel);
                this.mixers.push({ mixer, model: idleModel });

                const idleClip = mainData.animations.find(a => a.name.toLowerCase().includes('idle')) || mainData.animations[0];
                if (idleClip) {
                    const action = mixer.clipAction(idleClip);
                    action.loop = THREE.LoopRepeat;
                    action.fadeIn(0.2); // ループの繋ぎ目を補正
                    action.play();
                    mixer.setTime(Math.random() * idleClip.duration);
                }
            }

            if (walkData) {
                walkModel = walkData.scene || walkData;
                this.setupNPCModel(walkModel, scale);
                npcGroup.add(walkModel);
                walkModel.visible = false;

                const mixer = new THREE.AnimationMixer(walkModel);
                this.mixers.push({ mixer, model: walkModel });

                const walkClip = walkData.animations[0];
                if (walkClip) {
                    const action = mixer.clipAction(walkClip);
                    action.loop = THREE.LoopRepeat;
                    action.fadeIn(0.2); // ループの繋ぎ目を補正
                    action.play();
                    mixer.setTime(Math.random() * walkClip.duration);
                }
            }

            if (!mainData) {
                const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 8);
                const material = new THREE.MeshLambertMaterial({ color: npcData.color || 0x0000FF });
                const fallbackMesh = new THREE.Mesh(geometry, material);
                fallbackMesh.position.y = 0.5;
                npcGroup.add(fallbackMesh);
            }

            const worldX = npcData.x * TILE_SIZE;
            const worldZ = npcData.z * TILE_SIZE;
            npcGroup.position.set(worldX, 0, worldZ);

            npcGroup.userData = {
                type: 'npc',
                id: npcData.id,
                name: npcData.name,
                x: npcData.x,
                z: npcData.z,
                dialogues: npcData.dialogues,
                idleModel: idleModel,
                walkModel: walkModel
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
                if (node.material) node.material = node.material.clone();
            }
        });
    }

    update(delta) {
        for (const item of this.mixers) {
            item.mixer.update(delta);
            // アニメーション更新直後にルートボーンの位置をリセット
            this.resetRootPosition(item.model);
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
                // 水平移動をキャンセルして「その場」でアニメーションさせる
                node.position.x = 0;
                node.position.z = 0;
            }
        });
    }

    createMap() {
        const { tiles, width, height } = this.mapData;
        this.clearMap();
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

    clearMap() {
        this.mapMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
                else mesh.material.dispose();
            }
            this.group.remove(mesh);
        });
        this.mapMeshes = [];
        this.npcMeshes.forEach(group => this.group.remove(group));
        this.npcMeshes = [];
        this.mixers = [];
    }

    createFloor(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    createWall(x, z) {
        const geometry = new THREE.BoxGeometry(TILE_SIZE, 1.0, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0.5, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    createWater(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.01, z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    getEventAt(x, z) {
        return this.mapData.events?.find(ev => ev.x === x && ev.z === z);
    }

    getNPCAt(x, z) {
        for (const npcMesh of this.npcMeshes) {
            if (npcMesh.userData.x === x && npcMesh.userData.z === z) {
                return npcMesh.userData;
            }
        }
        return null;
    }

    checkNPCProximity(playerX, playerZ, currentNPCId) {
        let adjacentToAny = false;
        let foundNPC = null;
        for (const npcMesh of this.npcMeshes) {
            const npcX = npcMesh.userData.x;
            const npcZ = npcMesh.userData.z;
            const isAdjacent = (playerX === npcX && Math.abs(playerZ - npcZ) === 1) || (playerZ === npcZ && Math.abs(playerX - npcX) === 1);
            if (isAdjacent) {
                adjacentToAny = true;
                if (currentNPCId === npcMesh.userData.id) return null;
                foundNPC = npcMesh.userData;
                break;
            }
        }
        return { adjacent: adjacentToAny, npc: foundNPC };
    }
}