import * as THREE from 'three';
import { TILE_SIZE } from '../constants.js';

export class Door {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.group = this.mapManager.group;
        this.mapMeshes = this.mapManager.mapMeshes;
        this.doorMeshes = this.mapManager.doorMeshes;

        const textureLoader = new THREE.TextureLoader();
        this.wallTexture = textureLoader.load('assets/textures/stone_wall.jpg');
        this.doorClosedTexture = textureLoader.load('assets/textures/door_closed.png');
    }

    add(x, z, gridX, gridZ) {
        const height = 4;
        const doorHeightTiles = 2;

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
                this.mapMeshes.push(wallMesh);
                this.group.add(wallMesh);
            }
        }
    }
}