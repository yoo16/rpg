import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TILE_SIZE } from './constants.js';

export class MapManager {
    constructor() {
        this.group = new THREE.Group();
        this.mapData = null;
        this.mapMeshes = [];
        this.npcMeshes = [];
        this.loader = new GLTFLoader();
        this.mixers = []; // Animation mixers for NPCs
    }

    init(mapData) {
        this.mapData = mapData;
        this.createMap();
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

        // Clear existing map if any
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
        // Dispose geometries and materials
        this.mapMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
            this.group.remove(mesh);
        });
        this.mapMeshes = [];

        this.npcMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            // Dispose materials...
            this.group.remove(mesh);
        });
        this.npcMeshes = [];
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

            this.group.add(mesh);
            this.npcMeshes.push(mesh);
        }
    }

    update(delta) {
        for (const mixer of this.mixers) {
            mixer.update(delta);
        }
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
                if (currentNPCId === npcMesh.userData.id) return null; // Already interacting or recently interacted
                foundNPC = npcMesh.userData;
                break;
            }
        }

        return { adjacent: adjacentToAny, npc: foundNPC };
    }
}
