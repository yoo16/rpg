import * as THREE from 'three';
import { TILE_SIZE } from '../constants.js';

export class Wall {
    constructor(mapManager) {
        this.height = 4;
        this.color = 0x888888;
        this.mapManager = mapManager;
        this.group = this.mapManager.group;
        this.mapMeshes = this.mapManager.mapMeshes;
        this.textureImage = 'assets/textures/stone_wall.jpg';
        this.setTexture(this.textureImage);
    }

    setTexture(textureImage) {
        this.textureImage = textureImage;
        const textureLoader = new THREE.TextureLoader();
        this.texture = textureLoader.load(this.textureImage);
    }

    add(x, z) {
        const geometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.texture, color: this.color });

        for (let i = 0; i < this.height; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, (i * TILE_SIZE) + (TILE_SIZE / 2), z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            this.mapMeshes.push(mesh);
        }
    }

}