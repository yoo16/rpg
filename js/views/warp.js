import * as THREE from 'three';
import { TILE_SIZE } from '../constants.js';

export class Warp {
    constructor(mapManager) {
        this.height = 4;
        this.color = 0x888888;
        this.mapManager = mapManager;
        this.group = this.mapManager.group;
        this.mapMeshes = this.mapManager.mapMeshes;
        this.textureImage = 'assets/textures/dungeon_floor.jpg';
        this.setTexture(this.textureImage);
    }

    setTexture(textureImage) {
        this.textureImage = textureImage;
        const textureLoader = new THREE.TextureLoader();
        this.texture = textureLoader.load(this.textureImage);
    }

    add(x, z) {
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ map: this.texture, color: 0xaa00ff, emissive: 0x330055, emissiveIntensity: 0.5 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

}