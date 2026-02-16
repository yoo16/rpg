import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TILE_SIZE } from '../constants.js';
import { NPC } from '../models/npc.js';
import { GameEvent } from '../models/event.js';

export class MapManager {
    constructor() {
        this.group = new THREE.Group();
        this.mapData = null;
        this.mapMeshes = [];
        this.npcs = []; // List of NPC instances
        this.npcMeshes = []; // Keep for raycasting or external access if needed (optional)

        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
    }

    init(mapData) {
        this.mapData = mapData;

        // テクスチャ読み込み
        const textureLoader = new THREE.TextureLoader();
        this.wallTexture = textureLoader.load('assets/textures/stone_wall.jpg');
        this.floorTexture = textureLoader.load('assets/textures/dungeon_floor.jpg');
        this.waterTexture = textureLoader.load('assets/textures/water.png');
        this.waterTexture.wrapS = THREE.RepeatWrapping;
        this.waterTexture.wrapT = THREE.RepeatWrapping;

        // Parse Events
        if (this.mapData.events) {
            this.mapData.events = this.mapData.events.map(evData => new GameEvent(evData));
        }

        this.createMap();
    }

    async createNPCs() {
        if (!this.mapData.npcs) return;

        this.npcs = [];
        this.npcMeshes = [];

        const promises = this.mapData.npcs.map(async (npcData) => {
            const npc = new NPC(npcData);
            await npc.load(this.gltfLoader, this.fbxLoader);

            this.npcs.push(npc);
            this.npcMeshes.push(npc.group); // For compatibility/references
            this.group.add(npc.group);
        });

        await Promise.all(promises);
    }

    update(delta) {
        this.npcs.forEach(npc => npc.update(delta));
    }

    // NPC判定
    getNPCAt(x, z) {
        const tx = Math.round(x);
        const tz = Math.round(z);
        return this.npcs.find(npc => npc.x === tx && npc.z === tz);
    }

    lookAtPlayer(npcId, playerGridX, playerGridZ) {
        const npc = this.npcs.find(n => n.id === npcId);
        if (npc) {
            npc.lookAt(playerGridX, playerGridZ);
        }
    }

    // イベント判定
    getEventAt(x, z) {
        if (!this.mapData || !this.mapData.events) return null;
        return this.mapData.events.find(ev =>
            Math.round(ev.x) === x && Math.round(ev.z) === z
        );
    }

    checkNPCProximity(playerX, playerZ, currentNPCId) {
        const px = Math.round(playerX);
        const pz = Math.round(playerZ);
        let adjacentToAny = false;
        let foundNPC = null;

        for (const npc of this.npcs) {
            const dx = Math.abs(px - npc.x);
            const dz = Math.abs(pz - npc.z);
            const isAdjacent = (dx === 1 && dz === 0) || (dx === 0 && dz === 1);

            if (isAdjacent) {
                adjacentToAny = true;
                if (currentNPCId === npc.id) continue;
                foundNPC = npc;
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

        // Clear NPCs
        this.npcs.forEach(npc => {
            this.group.remove(npc.group);
            // Dispose logic if needed
        });
        this.npcs = [];
        this.npcMeshes = [];
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
        const height = 4;
        const geometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.wallTexture, color: 0x888888 });

        for (let i = 0; i < height; i++) {
            const mesh = new THREE.Mesh(geometry, material);
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
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.waterTexture });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.01, z);
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    openDoor(x, z) {
        // タイル座標をワールド座標に変換
        const targetX = x * TILE_SIZE;
        const targetZ = z * TILE_SIZE;

        // 壁メッシュを削除
        const toRemove = [];
        this.mapMeshes.forEach(mesh => {
            if (Math.abs(mesh.position.x - targetX) < 0.1 && Math.abs(mesh.position.z - targetZ) < 0.1) {
                toRemove.push(mesh);
            }
        });

        // 壁メッシュを削除
        toRemove.forEach(mesh => {
            this.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            const idx = this.mapMeshes.indexOf(mesh);
            if (idx > -1) this.mapMeshes.splice(idx, 1);
        });

        // Create Floor
        this.createFloor(targetX, targetZ);
        this.createCeiling(targetX, targetZ);

        // Update Map Data to be walkable
        if (this.mapData.tiles[z] && this.mapData.tiles[z][x] !== undefined) {
            this.mapData.tiles[z][x] = 0;
        }
    }
}
