import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class Enemy {
    constructor(id, data) {
        this.id = id;
        this.name = data.name;
        this.level = Number(data.level) || 1;
        this.exp = Number(data.exp) || 10;
        this.stats = {
            hp: Number(data.maxHp),
            maxHp: Number(data.maxHp),
            attack: Number(data.attack),
            defense: Number(data.defense)
        };

        // Visual properties
        this.scale = data.scale || 1.0;
        this.y_offset = data.y_offset || 0;

        // Asset URLs
        this.urls = {
            idle: data.idle_url,
            attack: data.attack_url,
            damage: data.damage_url,
            death: data.death_url
        };

        // 3D Objects & Animations
        this.group = new THREE.Group();
        this.meshes = {
            idle: null,
            attack: null,
            damage: null,
            death: null
        };
        this.mixers = {
            idle: null,
            attack: null,
            damage: null,
            death: null
        };

        // Loaders
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
    }

    async load() {
        const [idle, attack, damage, death] = await Promise.all([
            this._loadModel(this.urls.idle),
            this._loadModel(this.urls.attack),
            this._loadModel(this.urls.damage),
            this._loadModel(this.urls.death)
        ]);

        this._setupMesh('idle', idle, true);
        this._setupMesh('attack', attack, false);
        this._setupMesh('damage', damage, false);
        this._setupMesh('death', death, false);
    }

    _loadModel(url) {
        if (!url) return Promise.resolve(null);
        const ext = url.split('.').pop().toLowerCase();
        const loader = (ext === 'fbx') ? this.fbxLoader : this.gltfLoader;

        return new Promise(resolve => {
            loader.load(url, (data) => resolve(data), undefined, (err) => {
                console.warn(`Failed to load model: ${url}`, err);
                resolve(null);
            });
        });
    }



    // Improved play logic with action storage
    _setupMesh(type, data, isVisible) {
        if (!data) return;

        const mesh = data.scene || data;
        const animations = data.animations || [];

        this.meshes[type] = mesh;
        mesh.visible = isVisible;
        mesh.scale.set(this.scale, this.scale, this.scale);
        mesh.position.set(0, this.y_offset, 0);

        mesh.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    const mats = Array.isArray(node.material) ? node.material : [node.material];
                    const clonedMats = mats.map(m => m.clone());
                    node.material = Array.isArray(node.material) ? clonedMats : clonedMats[0];
                }
            }
        });

        this.mixers[type] = new THREE.AnimationMixer(mesh);

        if (animations.length > 0) {
            const clip = animations[0];
            const action = this.mixers[type].clipAction(clip);
            if (type !== 'idle') {
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            } else {
                action.play();
            }
            // Store clip for duration query
            this.meshes[type].userData = { clip: clip, action: action };
        }

        this.group.add(mesh);
    }

    play(type) {
        // Hide all
        Object.values(this.meshes).forEach(m => { if (m) m.visible = false; });

        const mesh = this.meshes[type];
        if (!mesh) {
            // Fallback
            if (this.meshes.idle) this.meshes.idle.visible = true;
            return 0;
        }

        mesh.visible = true;
        const userData = mesh.userData;
        if (userData && userData.action) {
            userData.action.reset().play();
            return userData.clip.duration * 1000;
        }
        return 1000; // Default
    }

    update(delta) {
        Object.values(this.mixers).forEach(mixer => {
            if (mixer) mixer.update(delta);
        });

        // Reset root bone position (hips) to keep them centered
        Object.values(this.meshes).forEach(mesh => {
            if (mesh && mesh.visible) {
                this._resetRootPosition(mesh);
            }
        });
    }

    _resetRootPosition(model) {
        model.traverse(node => {
            if (node.isBone && (node.name.toLowerCase().includes('hips') || node.name.toLowerCase().includes('root'))) {
                node.position.x = 0;
                node.position.z = 0;
            }
        });
    }

    dispose() {
        Object.values(this.meshes).forEach(mesh => {
            if (mesh) {
                mesh.traverse(node => {
                    if (node.isMesh) {
                        node.geometry.dispose();
                        const mats = Array.isArray(node.material) ? node.material : [node.material];
                        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
                    }
                });
                this.group.remove(mesh);
            }
        });
    }
}
