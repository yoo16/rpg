import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { BATTLE_PHASE } from './constants.js';

export class BattleSystem {
    constructor(player, camera, battleGroup, enemyMasterData, onBattleEnd) {
        this.player = player;
        this.camera = camera;
        this.battleGroup = battleGroup;
        this.enemyMasterData = enemyMasterData;
        this.onBattleEnd = onBattleEnd;

        this.phase = BATTLE_PHASE.PLAYER_TURN;
        this.enemy = null;

        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();

        this.battleCameraPos = { x: 0, y: 3, z: 8 };
        this.battleCameraTarget = { x: 0, y: 1.0, z: 0 };

        this.setupUI();
    }

    async loadModel(url) {
        if (!url) return null;
        const ext = url.split('.').pop().toLowerCase();
        const loader = (ext === 'fbx') ? this.fbxLoader : this.gltfLoader;

        return new Promise(resolve => {
            loader.load(url, (data) => resolve(data), undefined, (err) => {
                console.warn(`Failed to load model: ${url}`, err);
                resolve(null);
            });
        });
    }

    async startBattle(possibleEnemyIds) {
        this.phase = BATTLE_PHASE.PLAYER_TURN;
        try {
            const randomEnemyId = possibleEnemyIds[Math.floor(Math.random() * possibleEnemyIds.length)];
            const enemyData = this.enemyMasterData[randomEnemyId];

            this.enemy = {
                id: randomEnemyId,
                name: enemyData.name,
                color: enemyData.color,
                scale: enemyData.scale,
                model_url: enemyData.model_url,
                attack_url: enemyData.attack_url,
                y_offset: enemyData.y_offset || 0,
                stats: {
                    hp: Number(enemyData.maxHp),
                    maxHp: Number(enemyData.maxHp),
                    attack: Number(enemyData.attack),
                    defense: Number(enemyData.defense)
                },
                idleMesh: null,
                attackMesh: null,
                idleMixer: null,
                attackMixer: null
            };

            await this.createEnemy();

            this.camera.position.set(this.battleCameraPos.x, this.battleCameraPos.y, this.battleCameraPos.z);
            this.camera.lookAt(this.battleCameraTarget.x, this.battleCameraTarget.y, this.battleCameraTarget.z);

            this.showBattleUI();
            this.updateBattleUI();

            setTimeout(() => {
                this.addBattleLog(`野生の ${this.enemy.name} があらわれた！`);
                this.enableButtons();
            }, 500);
        } catch (error) {
            console.error("Battle Start Error:", error);
            this.endBattle(false);
        }
    }

    async createEnemy() {
        const [idleData, attackData] = await Promise.all([
            this.loadModel(this.enemy.model_url),
            this.loadModel(this.enemy.attack_url)
        ]);

        const scale = this.enemy.scale || 1.0;
        const y = this.enemy.y_offset || 0;

        if (idleData) {
            this.enemy.idleMesh = idleData.scene || idleData;
            this.setupEnemyMesh(this.enemy.idleMesh, scale, y);
            this.enemy.idleMixer = new THREE.AnimationMixer(this.enemy.idleMesh);
            const clip = idleData.animations[0];
            if (clip) this.enemy.idleMixer.clipAction(clip).play();
            this.battleGroup.add(this.enemy.idleMesh);
        }

        if (attackData) {
            this.enemy.attackMesh = attackData.scene || attackData;
            this.setupEnemyMesh(this.enemy.attackMesh, scale, y);
            this.enemy.attackMesh.visible = false;
            this.enemy.attackMixer = new THREE.AnimationMixer(this.enemy.attackMesh);
            const clip = attackData.animations[0];
            if (clip) {
                const action = this.enemy.attackMixer.clipAction(clip);
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            }
            this.battleGroup.add(this.enemy.attackMesh);
        }
    }

    setupEnemyMesh(mesh, scale, y) {
        mesh.scale.set(scale, scale, scale);
        mesh.position.set(0, y, 0);
        mesh.traverse(node => {
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

    onEnemyAttack() {
        if (this.phase !== BATTLE_PHASE.ENEMY_TURN) return;

        // 1. 攻撃開始：モデル切り替え
        let animDuration = 1000; // デフォルト値
        if (this.enemy.attackMesh && this.enemy.idleMesh) {
            this.enemy.idleMesh.visible = false;
            this.enemy.attackMesh.visible = true;

            const clip = this.enemy.attackMesh.animations[0];
            animDuration = clip ? clip.duration * 1000 : 1000;

            const action = this.enemy.attackMixer.clipAction(clip);
            action.reset().play();
        }

        // 2. 攻撃完了（アニメーションが半分〜終わる頃）に画面を揺らす
        const hitTiming = animDuration * 0.6; // 60%くらいでヒットと仮定
        const waitAfterAttack = 800;

        setTimeout(() => {
            const damage = Math.max(this.enemy.stats.attack - this.player.stats.defense, 1);
            this.player.stats.hp -= damage;

            this.addBattleLog(`👹 ${this.enemy.name} の攻撃！ ${damage} のダメージ！`);

            // 画面を揺らす
            // this.shakeCamera();
            // this.shakeCanvas();
            this.shakeScreen();
            this.updateBattleUI();

        }, hitTiming);

        // 3. 全工程終了後に待機ポーズへ戻る
        setTimeout(() => {
            if (this.enemy.attackMesh && this.enemy.idleMesh) {
                this.enemy.attackMesh.visible = false;
                this.enemy.idleMesh.visible = true;
            }

            if (this.player.stats.hp <= 0) {
                this.phase = BATTLE_PHASE.DEFEAT;
                this.addBattleLog('💀 あなたは倒れた...');
                setTimeout(() => this.endBattle(false), 1500);
            } else {
                this.phase = BATTLE_PHASE.PLAYER_TURN;
                this.addBattleLog('あなたのターン！');
                this.enableButtons();
            }
        }, animDuration + waitAfterAttack);
    }

    // 強化版：カメラシェイク演出
    shakeCamera() {
        const originalPos = new THREE.Vector3().copy(this.camera.position);
        // 揺れる時間(ms)
        const duration = 400;
        // 揺れる幅
        const range = 1.5;
        const start = Date.now();

        const animateShake = () => {
            const elapsed = Date.now() - start;
            if (elapsed < duration) {
                const progress = 1 - (elapsed / duration);
                // 時間とともに揺れを弱める
                const intensity = range * progress;

                this.camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity;
                this.camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity;

                requestAnimationFrame(animateShake);
            } else {
                // 元の位置に復帰
                this.camera.position.copy(originalPos);
            }
        };
        animateShake();
    }

    shakeCanvas() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        canvas.classList.remove('shake-active');
        canvas.classList.add('shake-active');
        setTimeout(() => {
            canvas.classList.remove('shake-active');
        }, 400);
    }

    shakeScreen() {
        const container = document.getElementById('game-container') || document.body;
        container.classList.remove('screen-shake-active');
        void container.offsetWidth;
        container.classList.add('screen-shake-active');
        setTimeout(() => {
            container.classList.remove('screen-shake-active');
        }, 400);
    }

    update(delta) {
        if (this.enemy) {
            if (this.enemy.idleMixer) {
                this.enemy.idleMixer.update(delta);
                this.resetRootPosition(this.enemy.idleMesh);
            }
            if (this.enemy.attackMixer) {
                this.enemy.attackMixer.update(delta);
                this.resetRootPosition(this.enemy.attackMesh);
            }
        }
    }

    resetRootPosition(model) {
        if (!model) return;
        model.traverse(node => {
            if (node.isBone && (node.name.toLowerCase().includes('hips') || node.name.toLowerCase().includes('root'))) {
                node.position.x = 0;
                node.position.z = 0;
            }
        });
    }

    endBattle(isVictory) {
        [this.enemy.idleMesh, this.enemy.attackMesh].forEach(mesh => {
            if (mesh) {
                mesh.traverse(node => {
                    if (node.isMesh) {
                        node.geometry.dispose();
                        const mats = Array.isArray(node.material) ? node.material : [node.material];
                        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
                    }
                });
                this.battleGroup.remove(mesh);
            }
        });
        this.enemy = null;
        this.hideBattleUI();
        if (this.onBattleEnd) this.onBattleEnd(isVictory);
    }

    setupUI() {
        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');
        if (btnAttack) btnAttack.onclick = () => this.onPlayerAttack();
        if (btnRun) btnRun.onclick = () => {
            if (this.phase === BATTLE_PHASE.PLAYER_TURN) {
                this.addBattleLog('💨 逃げ出した！');
                this.disableButtons();
                setTimeout(() => this.endBattle(false), 1000);
            }
        };
    }

    onPlayerAttack() {
        if (this.phase !== BATTLE_PHASE.PLAYER_TURN) return;
        this.disableButtons();
        const damage = Math.max(this.player.stats.attack - this.enemy.stats.defense, 1);
        this.enemy.stats.hp -= damage;
        this.addBattleLog(`⚔️ あなたの攻撃！ ${this.enemy.name} に ${damage} のダメージ！`);
        this.shakeCanvas();
        this.flashMesh(this.enemy.idleMesh, '#ff0000');
        this.updateBattleUI();
        if (this.enemy.stats.hp <= 0) {
            this.phase = BATTLE_PHASE.VICTORY;
            setTimeout(() => {
                this.addBattleLog('🎉 勝利！');
                setTimeout(() => this.endBattle(true), 1500);
            }, 1000);
        } else {
            this.phase = BATTLE_PHASE.ENEMY_TURN;
            setTimeout(() => this.onEnemyAttack(), 1000);
        }
    }

    updateBattleUI() {
        if (!this.enemy || !this.player) return;
        const enemyHPPercent = Math.max(0, (this.enemy.stats.hp / this.enemy.stats.maxHp) * 100);
        const enemyBar = document.getElementById('enemy-hp-bar');
        const enemyText = document.getElementById('enemy-hp-text');
        if (enemyBar) enemyBar.style.width = `${enemyHPPercent}%`;
        if (enemyText) enemyText.textContent = `${Math.max(0, Math.floor(this.enemy.stats.hp))}/${this.enemy.stats.maxHp}`;
        const playerHPPercent = Math.max(0, (this.player.stats.hp / this.player.stats.maxHp) * 100);
        const playerBar = document.getElementById('player-hp-bar');
        const playerText = document.getElementById('player-hp-text');
        if (playerBar) {
            playerBar.style.width = `${playerHPPercent}%`;
            playerBar.style.backgroundColor = playerHPPercent < 30 ? '#ff6666' : '#66ff66';
        }
        if (playerText) playerText.textContent = `${Math.max(0, Math.floor(this.player.stats.hp))}/${this.player.stats.maxHp}`;
    }

    showBattleUI() { const ui = document.getElementById('battle-ui'); if (ui) ui.style.display = 'block'; }
    hideBattleUI() { const ui = document.getElementById('battle-ui'); if (ui) ui.style.display = 'none'; }
    addBattleLog(msg) { const el = document.getElementById('battle-message'); if (el) el.textContent = msg; }
    enableButtons() {
        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');
        if (btnAttack) btnAttack.disabled = false;
        if (btnRun) btnRun.disabled = false;
    }
    disableButtons() {
        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');
        if (btnAttack) btnAttack.disabled = true;
        if (btnRun) btnRun.disabled = true;
    }

    flashMesh(mesh, color) {
        if (!mesh) return;
        const originalColors = new Map();
        mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat.color) originalColors.set(mat, mat.color.getHex());
                });
            }
        });
        let toggle = false;
        const interval = setInterval(() => {
            originalColors.forEach((originalColor, material) => {
                material.color.setHex(toggle ? originalColor : new THREE.Color(color).getHex());
            });
            toggle = !toggle;
        }, 50);
        setTimeout(() => {
            clearInterval(interval);
            originalColors.forEach((originalColor, material) => material.color.setHex(originalColor));
        }, 300);
    }
}