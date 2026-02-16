import * as THREE from 'three';

export class BattleEnvironment {
    constructor(battleGroup, mapManager) {
        this.battleGroup = battleGroup;
        this.mapManager = mapManager;
    }

    create() {
        if (!this.mapManager) return;

        // Clone textures to avoid affecting the main map's texture settings (repeat/offset)
        const floorTexture = this.mapManager.floorTexture ? this.mapManager.floorTexture.clone() : null;
        const wallTexture = this.mapManager.wallTexture ? this.mapManager.wallTexture.clone() : null;

        if (floorTexture) {
            floorTexture.needsUpdate = true; // Ensure clone is ready
            floorTexture.wrapS = THREE.RepeatWrapping;
            floorTexture.wrapT = THREE.RepeatWrapping;
            floorTexture.repeat.set(10, 10);

            const floorGeo = new THREE.PlaneGeometry(40, 40);
            const floorMat = new THREE.MeshLambertMaterial({ map: floorTexture, color: 0x666666 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            this.battleGroup.add(floor);
        }

        if (wallTexture) {
            wallTexture.needsUpdate = true;
            wallTexture.wrapS = THREE.RepeatWrapping;
            wallTexture.wrapT = THREE.RepeatWrapping;
            wallTexture.repeat.set(10, 2);

            // Simple box environment (skybox style but with walls)
            const wallGeo = new THREE.BoxGeometry(40, 10, 40);
            const wallMat = new THREE.MeshLambertMaterial({ map: wallTexture, side: THREE.BackSide, color: 0x444444 });
            const walls = new THREE.Mesh(wallGeo, wallMat);
            walls.position.y = 4.9; // Sit on floor
            this.battleGroup.add(walls);
        } else {
            // Fallback if no wall texture
            const wallGeo = new THREE.BoxGeometry(40, 10, 40);
            const wallMat = new THREE.MeshBasicMaterial({ color: 0x202020, side: THREE.BackSide });
            const walls = new THREE.Mesh(wallGeo, wallMat);
            walls.position.y = 4.9;
            this.battleGroup.add(walls);
        }
    }
}
