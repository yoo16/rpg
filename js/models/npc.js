import * as THREE from 'three';
import { TILE_SIZE } from '../constants.js';

import { GameEvent } from './event.js';

export class NPC {
    static async spawn(data, loader) {
        console.log(loader);
        const npc = new NPC(data);
        await npc.load(loader);
        return npc;
    }

    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.x = Math.round(data.x);
        this.z = Math.round(data.z);
        this.dialogues = data.dialogues;
        this.modelUrl = data.idle_url;
        this.animWalkUrl = data.anim_walk_url;
        this.animVictoryUrl = data.anim_victory_url;
        this.scale = data.scale || 0.5;
        this.color = data.color;
        this.onTalk = data.on_talk ? new GameEvent(data.on_talk) : null;

        this.group = new THREE.Group();
        this.mesh = null;
        this.mixer = null;

        this.group.position.set(this.x * TILE_SIZE, 0, this.z * TILE_SIZE);
        this.group.userData = { id: this.id, npc: this };
    }

    async load(loader) {
        const loadModel = (url) => {
            if (!url) return Promise.resolve(null);

            // キャッシュ回避用のパラメータを追加
            const cacheBuster = `?t=${new Date().getTime()}`;
            const dynamicUrl = url + cacheBuster;

            return new Promise((resolve) => {
                console.log("Loading NPC model (no-cache):", dynamicUrl);
                loader.load(dynamicUrl, (data) => resolve(data), undefined, (err) => {
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
            const idleClip = mainData.animations.find(a => a.name.toLowerCase().includes('idle')) || mainData.animations[0];
            if (idleClip) {
                this.mixer.clipAction(idleClip).play();
            }
        } else {
            // Fallback: Create a simple box if model fails to load
            const geometry = new THREE.BoxGeometry(0.5, 1.0, 0.5);
            const material = new THREE.MeshLambertMaterial({ color: this.color || 0x00ff00 });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.position.y = 0.5; // Sit on ground
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            this.group.add(this.mesh);
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
        // グリッド差分を計算
        const dx = targetX - this.x;
        const dz = targetZ - this.z;
        const angle = Math.atan2(dx, dz);
        this.group.rotation.y = angle;
    }

    // NPCの向きを調整
    lookAtPlayer(player) {
        this.lookAt(player.gridX, player.gridZ);
    }
}
