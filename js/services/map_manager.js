import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TILE_SIZE } from '../constants.js';
import { NPC } from '../models/npc.js';
import { GameEvent } from '../models/event.js';
import GameApi from './api.js';

export class MapManager {
    constructor(game) {
        this.game = game;
        // FBXLoader
        this.loader = new FBXLoader();
        // グループ
        this.group = new THREE.Group();
        // マップ
        this.mapData = null;
        // NPC
        this.npcs = [];

        // メッシュ
        this.npcMeshes = [];
        this.mapMeshes = [];
        this.doorMeshes = new Map();
    }

    init(mapData, globalEventState = new Set()) {
        // マップデータの初期化
        this.mapData = mapData;
        // イベントの初期化と状態復元
        this.globalEventState = globalEventState;

        // テクスチャ読み込み
        const textureLoader = new THREE.TextureLoader();
        this.wallTexture = textureLoader.load('assets/textures/stone_wall.jpg');
        this.floorTexture = textureLoader.load('assets/textures/dungeon_floor.jpg');
        this.waterTexture = textureLoader.load('assets/textures/water.png');
        this.waterTexture.wrapS = THREE.RepeatWrapping;
        this.waterTexture.wrapS = THREE.RepeatWrapping;
        this.waterTexture.wrapT = THREE.RepeatWrapping;

        this.doorClosedTexture = textureLoader.load('assets/textures/door_closed.png');
        this.doorOpenTexture = textureLoader.load('assets/textures/door_open.png');

        // イベントの初期化と状態復元
        if (this.mapData.events) {
            this.mapData.events = this.mapData.events.map(evData => {
                const ev = new GameEvent(evData);
                const uniqueId = `${this.mapData.map_id}_${ev.id}`;
                if (this.globalEventState.has(uniqueId)) {
                    console.log(`Restoring event state: ${uniqueId}`);
                    ev.executed = true;
                }
                return ev;
            });
        }

        // マップの作成
        this.createMap();
    }

    async warp(mapId, startX, startZ) {
        const player = this.game.player;
        if (!player) return;

        console.log(`MapManager: Warping to Map ${mapId}...`);

        // アクセス UI と Game State via this.game
        this.game.uiManager.showLoading();
        this.game.isRunning = false;

        try {
            // 1. 現在のマップIDを保存して戻り先のワープを検索する
            const previousMapId = this.mapData ? this.mapData.map_id : null;

            // 2. マップデータを取得する
            const mRes = await GameApi.getMapData(mapId);

            // 3. マップを初期化する (テクスチャ、イベント、状態復元)
            this.init(mRes.data.map, this.game.globalEventState);
            this.game.uiManager.updateMapId(mapId);

            // 4. 起点位置を計算する
            const spawnPos = this.getSpawnPosition(previousMapId, startX, startZ);
            console.log(`Final Spawn Position: (${spawnPos.x}, ${spawnPos.z})`);

            // 5. プレイヤーの位置を更新
            player.warpTo(spawnPos.x, spawnPos.z, spawnPos.dir);

            // 6. NPCを生成する
            await this.createNPCs();

            // 7. カメラをリセットする
            this.game.cameraManager.snapToPlayer(player);

            // 8. ゲームループを再開する
            this.game.isRunning = true;
            this.game.startGameLoop();

        } catch (e) {
            console.error("Warp failed:", e);
            this.game.uiManager.showLoadingError("Map Load Failed");
        } finally {
            this.game.uiManager.hideLoading();
        }
    }

    // NPCグループを生成する
    async createNPCs() {
        if (!this.mapData.npcs) return;

        console.log("MapManager.createNPCs: this.loader is", this.loader);
        const loader = this.loader;

        this.npcs = [];
        this.npcMeshes = [];

        const promises = this.mapData.npcs.map(async (npcData) => {
            // NPCの生成
            const npc = await NPC.spawn(npcData, loader);
            // NPCをリストに追加
            this.npcs.push(npc);
            // NPCのメッシュをリストに追加
            this.npcMeshes.push(npc.group);
            // NPCをグループに追加
            this.group.add(npc.group);
        });
        // NPCを生成する
        await Promise.all(promises);
    }

    // MapManagerを更新する
    update(delta) {
        // NPCを更新する
        this.npcs.forEach(npc => npc.update(delta));
    }

    // NPC判定
    getNPCAt(x, z) {
        const tx = Math.round(x);
        const tz = Math.round(z);
        return this.npcs.find(npc => npc.x === tx && npc.z === tz);
    }

    // イベント判定
    getEventAt(x, z) {
        if (!this.mapData || !this.mapData.events) return null;
        // 位置を丸める
        return this.mapData.events.find(ev =>
            Math.round(ev.x) === x && Math.round(ev.z) === z
        );
    }

    // NPCとの近接判定
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
                if (currentNPCId == npc.id) {
                    return { adjacent: true, npc: null };
                }
                foundNPC = npc;
                break;
            }
        }
        return { adjacent: adjacentToAny, npc: foundNPC };
    }

    // NPCの近くにいるか判定 (エンカウント防止用)
    isNearAnyNPC(x, z, radius = 3) {
        for (const npc of this.npcs) {
            const dx = Math.abs(x - npc.x);
            const dz = Math.abs(z - npc.z);
            // Check if within square radius (Chebyshev distance)
            if (dx <= radius && dz <= radius) {
                return true;
            }
        }
        return false;
    }

    // スポーン位置の決定
    getSpawnPosition(previousMapId, preferredX, preferredZ) {
        let destX = preferredX;
        let destZ = preferredZ;
        let destDir = this.mapData.start_dir || 0;

        // 座標指定がない場合、戻り先のワープイベントを探す (Warp Source Priority)
        if (typeof destX !== 'number' || typeof destZ !== 'number') {
            if (previousMapId) {
                console.log(`Searching for return warp to Map ${previousMapId} in Map ${this.mapData.map_id}...`);

                // 新しいマップの中から「前のマップへのワープ」を探す
                const returnWarp = this.getEventByWarpDestination(previousMapId);

                if (returnWarp) {
                    console.log(`✅ Found return warp at (${returnWarp.x}, ${returnWarp.z})`);
                    destX = returnWarp.x;
                    destZ = returnWarp.z;
                } else {
                    console.warn(`⚠️ No return warp found to Map ${previousMapId}.`);
                }
            }

            // それでも見つからなければマップの初期位置
            if (typeof destX !== 'number') destX = this.mapData.start_x || 1;
            if (typeof destZ !== 'number') destZ = this.mapData.start_z || 1;
        }

        return { x: destX, z: destZ, dir: destDir };
    }

    // ワープ先マップIDからイベントを検索
    getEventByWarpDestination(targetMapId) {
        if (!this.mapData || !this.mapData.events) return null;
        // Loose equality for robust matching
        return this.mapData.events.find(ev => ev.type === 'warp' && ev.warp_to_map == targetMapId);
    }

    // マップの作成
    createMap() {
        const { tiles, width, height } = this.mapData;
        this.clearMap();
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const worldX = x * TILE_SIZE;
                const worldZ = z * TILE_SIZE;

                // Check for warp event
                const event = this.getEventAt(x, z);
                const isWarp = event && event.type === 'warp';

                if (tiles[z][x] === 1) {
                    // Check for door event
                    const isDoor = event && event.type === 'open_door';

                    if (isDoor) {
                        if (event.executed) {
                            // Already open: Treat as floor
                            this.mapData.tiles[z][x] = 0;
                            if (isWarp) {
                                this.createWarpTile(worldX, worldZ);
                            } else {
                                this.createFloor(worldX, worldZ);
                            }
                            this.createCeiling(worldX, worldZ);
                        } else {
                            this.createDoor(worldX, worldZ, x, z);
                        }
                    } else {
                        this.createWall(worldX, worldZ);
                    }
                } else if (tiles[z][x] === 2) {
                    this.createWater(worldX, worldZ);
                    this.createCeiling(worldX, worldZ);
                } else {
                    if (isWarp) {
                        this.createWarpTile(worldX, worldZ);
                    } else {
                        this.createFloor(worldX, worldZ);
                    }
                    this.createCeiling(worldX, worldZ);
                }
            }
        }
    }

    // マップのクリア
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
        this.npcs = [];
        this.npcMeshes = [];
        this.doorMeshes = new Map();
    }

    // 床の作成
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

    // ワープタイルの作成 (紫色)
    createWarpTile(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.floorTexture, color: 0xaa00ff, emissive: 0x330055, emissiveIntensity: 0.5 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    // 壁の作成
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

    // ドアの作成
    createDoor(x, z, gridX, gridZ) {
        const height = 4;
        const doorHeightTiles = 2; // Door is 2 tiles high

        // 1. ドアの作成
        const doorGeo = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE * doorHeightTiles, TILE_SIZE * 0.4);
        const doorMat = new THREE.MeshLambertMaterial({ map: this.doorClosedTexture, color: 0xffffff });

        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(x, (doorHeightTiles * TILE_SIZE) / 2, z);
        doorMesh.castShadow = true;
        doorMesh.receiveShadow = true;

        this.group.add(doorMesh);
        this.mapMeshes.push(doorMesh);
        this.doorMeshes.set(`${gridX},${gridZ}`, doorMesh);

        // 2. ドアの上の壁の作成
        const wallTiles = height - doorHeightTiles;
        if (wallTiles > 0) {
            const wallGeo = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);
            const wallMat = new THREE.MeshLambertMaterial({ map: this.wallTexture, color: 0x888888 });

            for (let i = 0; i < wallTiles; i++) {
                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                // ドアの高さ + 現在の壁のインデックス
                const yPos = (doorHeightTiles * TILE_SIZE) + (i * TILE_SIZE) + (TILE_SIZE / 2);
                wallMesh.position.set(x, yPos, z);
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                this.group.add(wallMesh);
                this.mapMeshes.push(wallMesh);
            }
        }
    }

    // 天井の作成
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

    // 水の作成
    createWater(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.waterTexture });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.01, z);
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

    // ドアを開ける
    openDoor(x, z) {
        const key = `${x},${z}`;

        // Remove Door Mesh
        const doorMesh = this.doorMeshes.get(key);
        if (doorMesh) {
            this.group.remove(doorMesh);
            if (doorMesh.geometry) doorMesh.geometry.dispose();
            this.doorMeshes.delete(key);
        }

        // Remove Wall Meshes above the door
        // We need to find them. They are in this.mapMeshes, but not indexed by (x,z) easily.
        // However, we know they are at (x, z) world coordinates.
        const worldX = x * TILE_SIZE;
        const worldZ = z * TILE_SIZE;

        // Filter out meshes at this location that are walls
        const toRemove = [];
        this.mapMeshes.forEach(mesh => {
            // Check position (allowing for floating point errors)
            if (Math.abs(mesh.position.x - worldX) < 0.1 && Math.abs(mesh.position.z - worldZ) < 0.1) {
                // Check if it looks like a wall part (y > 0 usually, floor is at 0)
                if (mesh.position.y > 0) {
                    toRemove.push(mesh);
                }
            }
        });

        // メッシュを削除
        toRemove.forEach(mesh => {
            this.group.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            const idx = this.mapMeshes.indexOf(mesh);
            if (idx > -1) this.mapMeshes.splice(idx, 1);
        });
        // 床を再作成
        this.createFloor(worldX, worldZ);

        // 通行可能にする
        if (this.mapData.tiles[z] && this.mapData.tiles[z][x] !== undefined) {
            this.mapData.tiles[z][x] = 0;
        }


        console.log(`Door opened at ${x},${z}.`);
    }
}
