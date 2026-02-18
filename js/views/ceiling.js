import * as THREE from 'three';
import { TILE_SIZE } from '../constants.js';

export class Ceiling {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.group = this.mapManager.group;
        this.mapMeshes = this.mapManager.mapMeshes;
        this.color = 0x222222;
        // this.textureImage = 'assets/textures/dungeon_floor.jpg';
        // this.setTexture(this.textureImage);
    }

    setTexture(textureImage) {
        this.textureImage = textureImage;
        const textureLoader = new THREE.TextureLoader();
        this.floorTexture = textureLoader.load(this.textureImage);
    }

    add(x, z) {
        const wallHeight = 4.0;
        const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const material = new THREE.MeshLambertMaterial({ color: this.color, side: THREE.BackSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, wallHeight, z);
        this.group.add(mesh);
        this.mapMeshes.push(mesh);
    }

}