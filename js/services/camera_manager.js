import * as THREE from 'three';

export class CameraManager {
    constructor(camera) {
        this.camera = camera;
        this.defaultOffset = { x: 0, y: 2.0, z: 4.5 };
        this.zoomOffset = { x: 0.8, y: 1.6, z: 2.0 };
        this.smoothness = 0.15;
        this.isZoomed = false;

        // Opening animation
        this.isOpening = true;
        this.openingTime = 0;
        this.openingDuration = 3.0;
        this.openingStartPos = new THREE.Vector3();
    }

    setupOpening(playerMesh) {
        if (!playerMesh) return;
        const startPos = new THREE.Vector3(
            playerMesh.position.x,
            10, // High up
            playerMesh.position.z
        );
        this.camera.position.copy(startPos);
        this.openingStartPos.copy(startPos);
    }

    update(delta, player, mapMeshes, currentNPCId, npcMeshes) {
        if (!player.mesh) return;

        let targetPos, lookAtTarget;
        const playerPos = player.mesh.position.clone();

        // 1. Calculate Ideal Position & LookAt
        if (this.isZoomed && currentNPCId) {
            // NPC conversation zoom
            const npcGroup = npcMeshes.find(g => g.userData.id === currentNPCId);
            if (npcGroup) {
                const npcPos = npcGroup.position.clone();
                lookAtTarget = npcPos.clone().add(new THREE.Vector3(0, 1.4, 0));

                const dir = playerPos.clone().sub(npcPos).normalize();
                const up = new THREE.Vector3(0, 1, 0);
                const right = new THREE.Vector3().crossVectors(up, dir).normalize();

                targetPos = npcPos.clone()
                    .add(dir.multiplyScalar(this.zoomOffset.z))
                    .add(right.multiplyScalar(this.zoomOffset.x));
                targetPos.y += this.zoomOffset.y;
            } else {
                // Fallback if NPC not found
                lookAtTarget = playerPos.clone();
                targetPos = playerPos.clone().add(new THREE.Vector3(0, 5, 5));
            }
        } else {
            // Standard Third Person
            lookAtTarget = playerPos.clone().add(new THREE.Vector3(0, 1.5, 0));
            const playerRotation = player.mesh.quaternion.clone();
            const offset = new THREE.Vector3(this.defaultOffset.x, this.defaultOffset.y, this.defaultOffset.z);
            offset.applyQuaternion(playerRotation);
            targetPos = playerPos.clone().add(offset);

            // Wall Collision (Raycast)
            const rayDir = targetPos.clone().sub(lookAtTarget).normalize();
            const dist = targetPos.distanceTo(lookAtTarget);
            const raycaster = new THREE.Raycaster(lookAtTarget, rayDir, 0, dist);
            const intersects = raycaster.intersectObjects(mapMeshes);

            if (intersects.length > 0) {
                targetPos = lookAtTarget.clone().add(rayDir.multiplyScalar(intersects[0].distance - 0.3));
            }
        }

        // 2. Apply Movement
        if (this.isOpening) {
            this.handleOpeningAnimation(delta, targetPos);
        } else {
            this.camera.position.lerp(targetPos, this.smoothness);
        }

        this.camera.lookAt(lookAtTarget);
    }

    handleOpeningAnimation(delta, finalTargetPos) {
        this.openingTime += delta;
        let progress = Math.min(this.openingTime / this.openingDuration, 1.0);

        // Cubic Out Easing
        progress = 1 - Math.pow(1 - progress, 3);

        this.camera.position.lerpVectors(this.openingStartPos, finalTargetPos, progress);

        if (progress >= 1.0) {
            this.isOpening = false;
        }
    }

    setZoom(isZoomed) {
        this.isZoomed = isZoomed;
    }
}
