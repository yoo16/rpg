import * as THREE from 'three';
import { TILE_SIZE } from '../constants.js';

export class NPC {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.x = Math.round(data.x);
        this.z = Math.round(data.z);
        this.dialogues = data.dialogues;
        this.modelUrl = data.idle_url;
        this.animWalkUrl = data.anim_walk_url;
        this.scale = data.scale || 0.5;
        this.color = data.color;

        this.group = new THREE.Group();
        this.mesh = null;
        this.mixer = null;

        // Initial position
        this.group.position.set(this.x * TILE_SIZE, 0, this.z * TILE_SIZE);

        // Store reference to this instance in userData for raycasting/lookup if needed
        this.group.userData = { id: this.id, npc: this };
    }

    async load(gltfLoader, fbxLoader) {
        // Helper to choose loader
        const loadModel = (url) => {
            if (!url) return Promise.resolve(null);
            const ext = url.split('.').pop().toLowerCase();
            const loader = (ext === 'fbx') ? fbxLoader : gltfLoader;
            return new Promise((resolve) => {
                loader.load(url, (data) => resolve(data), undefined, (err) => {
                    console.warn(`Failed to load NPC model: ${url}`, err);
                    resolve(null);
                });
            });
        };

        const [mainData, walkData] = await Promise.all([
            loadModel(this.modelUrl),
            loadModel(this.animWalkUrl)
        ]);

        if (mainData) {
            this.mesh = mainData.scene || mainData;
            this.setupMesh(this.mesh);
            this.group.add(this.mesh);

            this.mixer = new THREE.AnimationMixer(this.mesh);
            // Play Idle animation (usually the first one or named 'idle')
            const idleClip = mainData.animations.find(a => a.name.toLowerCase().includes('idle')) || mainData.animations[0];
            if (idleClip) {
                this.mixer.clipAction(idleClip).play();
            }
        }
    }

    setupMesh(mesh) {
        mesh.scale.set(this.scale, this.scale, this.scale);
        mesh.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    node.material = Array.isArray(node.material) ?
                        node.material.map(m => m.clone()) : node.material.clone();
                }
            }
        });
    }

    update(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
            this.resetRootPosition();
        }
    }

    resetRootPosition() {
        if (!this.mesh) return;
        this.mesh.traverse(node => {
            if (node.isBone && (node.name.toLowerCase().includes('hips') || node.name.toLowerCase().includes('root'))) {
                node.position.x = 0;
                node.position.z = 0;
            }
        });
    }

    lookAt(targetX, targetZ) {
        // Calculate grid difference
        const dx = targetX - this.x;
        const dz = targetZ - this.z;
        const angle = Math.atan2(dx, dz);
        this.group.rotation.y = angle;
    }
}
