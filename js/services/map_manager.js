import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TILE_SIZE } from '../constants.js';
import { NPC } from '../models/npc.js';
import { Floor } from '../views/floor.js';
import { Ceiling } from '../views/ceiling.js';
import { Wall } from '../views/wall.js';
import { Water } from '../views/water.js';
import { Door } from '../views/door.js';
import { Warp } from '../views/warp.js';
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
                const isDoor = event && event.type === 'open_door';

                if (tiles[z][x] === 1) {
                    // Wall
                    if (isDoor && !event.executed) {
                        this.createDoor(worldX, worldZ, x, z);
                    } else {
                        this.createWall(worldX, worldZ);
                    }
                } else if (tiles[z][x] === 2) {
                    // Water
                    this.createWater(worldX, worldZ);
                    this.createCeiling(worldX, worldZ);
                } else {
                    // Floor
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
        new Floor(this).add(x, z);
    }

    // 
    createDoor(worldX, worldZ, x, z) {
        new Door(this).add(worldX, worldZ, x, z);
    }

    // ワープタイルの作成 (紫色)
    createWarpTile(x, z) {
        new Warp(this).add(x, z);
    }

    // 壁の作成
    createWall(x, z) {
        new Wall(this).add(x, z);
    }

    // 天井の作成
    createCeiling(x, z) {
        new Ceiling(this).add(x, z);
    }

    // 水の作成
    createWater(x, z) {
        new Water(this).add(x, z);
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
