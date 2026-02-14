import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        this.loader = new GLTFLoader();

        // Battle Camera Settings
        this.battleCameraPos = { x: 0, y: 3, z: 8 };
        this.battleCameraTarget = { x: 0, y: 1.0, z: 0 };

        this.setupUI();
    }

    setupUI() {
        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');

        if (btnAttack) {
            btnAttack.addEventListener('click', () => {
                if (this.phase === BATTLE_PHASE.PLAYER_TURN) {
                    this.onPlayerAttack();
                }
            });
        }

        if (btnRun) {
            btnRun.addEventListener('click', () => {
                if (this.enemy &&
                    this.phase !== BATTLE_PHASE.VICTORY &&
                    this.phase !== BATTLE_PHASE.DEFEAT) {
                    this.addBattleLog('💨 逃げ出した！');
                    this.disableButtons();
                    setTimeout(() => {
                        this.endBattle(false);
                    }, 1000);
                }
            });
        }
    }

    async startBattle(possibleEnemyIds) {
        this.phase = BATTLE_PHASE.PLAYER_TURN;
        console.log('⚔️ バトル開始！');

        try {
            if (!possibleEnemyIds || possibleEnemyIds.length === 0) throw new Error('No enemies here');

            const randomEnemyId = possibleEnemyIds[Math.floor(Math.random() * possibleEnemyIds.length)];
            const enemyData = this.enemyMasterData[randomEnemyId];

            if (!enemyData) throw new Error(`Enemy data not found for ${randomEnemyId}`);

            this.enemy = {
                id: randomEnemyId,
                name: enemyData.name,
                color: enemyData.color,
                scale: enemyData.scale,
                model_url: enemyData.model_url,
                y_offset: enemyData.y_offset || 0,
                position: { x: 0, y: 0.5, z: 0 },
                stats: {
                    hp: enemyData.maxHp,
                    maxHp: enemyData.maxHp,
                    attack: enemyData.attack,
                    defense: enemyData.defense
                },
                mesh: null,
                mixer: null
            };

            // Full heal player at start of battle? (as per main.js)
            this.player.stats.hp = this.player.stats.maxHp;

            await this.createEnemy();

            // Set Camera
            this.camera.position.set(this.battleCameraPos.x, this.battleCameraPos.y, this.battleCameraPos.z);
            this.camera.lookAt(this.battleCameraTarget.x, this.battleCameraTarget.y, this.battleCameraTarget.z);

            this.showBattleUI();
            this.updateBattleUI();

            setTimeout(() => {
                this.addBattleLog('あなたのターン！ コマンドを選択してください。');
                this.enableButtons();
            }, 500);

        } catch (error) {
            console.error('Battle Start Error:', error);
            this.endBattle(false);
        }
    }

    async createEnemy() {
        if (this.enemy.model_url) {
            console.log(`👹 敵モデル読み込み中... ${this.enemy.model_url}`);

            const gltf = await new Promise(resolve => {
                this.loader.load(this.enemy.model_url, resolve, undefined, () => resolve(null));
            });

            if (gltf) {
                this.enemy.mesh = gltf.scene;
                const scale = this.enemy.scale || 1.0;
                this.enemy.mesh.scale.set(scale, scale, scale);

                const y = this.enemy.y_offset !== undefined ? this.enemy.y_offset : 0;
                this.enemy.mesh.position.set(this.enemy.position.x, y, this.enemy.position.z);

                this.enemy.mesh.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                if (gltf.animations && gltf.animations.length > 0) {
                    this.enemy.mixer = new THREE.AnimationMixer(this.enemy.mesh);
                    const anim = gltf.animations[0];
                    const action = this.enemy.mixer.clipAction(anim);
                    action.play();
                }

                this.battleGroup.add(this.enemy.mesh);
                return;
            }
        }

        // Fallback
        const geometry = new THREE.SphereGeometry(this.enemy.scale * 0.5, 32, 32);
        const material = new THREE.MeshLambertMaterial({ color: this.enemy.color });
        this.enemy.mesh = new THREE.Mesh(geometry, material);
        this.enemy.mesh.position.set(this.enemy.position.x, this.enemy.position.y, this.enemy.position.z);
        this.enemy.mesh.castShadow = true;
        this.enemy.mesh.receiveShadow = true;
        this.battleGroup.add(this.enemy.mesh);
    }

    onPlayerAttack() {
        if (this.phase !== BATTLE_PHASE.PLAYER_TURN) return;

        this.disableButtons();

        const damage = Math.max(this.player.stats.attack - this.enemy.stats.defense, 1);
        this.addBattleLog(`⚔️ あなたの攻撃！ ${damage} のダメージ！`);
        this.enemy.stats.hp -= damage;

        this.flashMesh(this.enemy.mesh, '#ff0000');
        this.updateBattleUI();

        if (this.enemy.stats.hp <= 0) {
            this.phase = BATTLE_PHASE.VICTORY;
            this.addBattleLog('🎉 敵を倒した！');
            setTimeout(() => this.endBattle(true), 1500);
            return;
        }

        this.phase = BATTLE_PHASE.ENEMY_TURN;
        setTimeout(() => this.onEnemyAttack(), 1500);
    }

    onEnemyAttack() {
        if (this.phase !== BATTLE_PHASE.ENEMY_TURN) return;

        const damage = Math.max(this.enemy.stats.attack - this.player.stats.defense, 1);
        this.addBattleLog(`👹 敵の攻撃！ ${damage} のダメージ！`);
        this.player.stats.hp -= damage;

        this.shakeCamera();
        this.updateBattleUI();

        if (this.player.stats.hp <= 0) {
            this.phase = BATTLE_PHASE.DEFEAT;
            this.addBattleLog('💀 あなたは倒れた...');
            setTimeout(() => this.endBattle(false), 1500);
            return;
        }

        this.phase = BATTLE_PHASE.PLAYER_TURN;
        this.addBattleLog('あなたのターン！');
        this.enableButtons();
    }

    endBattle(isVictory) {
        if (this.enemy && this.enemy.mesh) {
            if (this.enemy.mixer) {
                this.enemy.mixer = null;
            }
            // Dispose
            this.enemy.mesh.traverse((node) => {
                if (node.isMesh) {
                    node.geometry.dispose();
                    if (node.material.map) node.material.map.dispose();
                    node.material.dispose();
                }
            });
            this.battleGroup.remove(this.enemy.mesh);
        }
        this.enemy = null;
        this.hideBattleUI();

        if (this.onBattleEnd) {
            this.onBattleEnd(isVictory);
        }
    }

    update(delta) {
        if (this.enemy && this.enemy.mixer) {
            this.enemy.mixer.update(delta);
        }
    }

    // UI Helpers
    showBattleUI() {
        const battleUI = document.getElementById('battle-ui');
        const battleMessage = document.getElementById('battle-message');
        if (battleMessage) battleMessage.textContent = `⚔️ 野生の ${this.enemy.name} があらわれた！`;
        if (battleUI) battleUI.style.display = 'block';
    }

    hideBattleUI() {
        const battleUI = document.getElementById('battle-ui');
        if (battleUI) battleUI.style.display = 'none';
    }

    updateBattleUI() {
        const enemyHPPercent = Math.max(0, (this.enemy.stats.hp / this.enemy.stats.maxHp) * 100);
        const enemyBar = document.getElementById('enemy-hp-bar');
        const enemyText = document.getElementById('enemy-hp-text');
        const enemyName = document.getElementById('enemy-name');

        if (enemyBar) enemyBar.style.width = enemyHPPercent + '%';
        if (enemyText) enemyText.textContent = `${Math.max(0, this.enemy.stats.hp)}/${this.enemy.stats.maxHp}`;
        if (enemyName) enemyName.textContent = this.enemy.name;

        const playerHPPercent = Math.max(0, (this.player.stats.hp / this.player.stats.maxHp) * 100);
        const playerBar = document.getElementById('player-hp-bar');
        const playerText = document.getElementById('player-hp-text');

        if (playerBar) {
            playerBar.style.width = playerHPPercent + '%';
            playerBar.style.backgroundColor = playerHPPercent < 30 ? '#ff6666' : '#66ff66';
        }
        if (playerText) playerText.textContent = `${Math.max(0, this.player.stats.hp)}/${this.player.stats.maxHp}`;
    }

    addBattleLog(message) {
        const el = document.getElementById('battle-message');
        if (el) el.textContent = message;
    }

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
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.color) originalColors.set(mat, mat.color.getHex());
                    });
                } else if (child.material.color) {
                    originalColors.set(child.material, child.material.color.getHex());
                }
            }
        });

        if (originalColors.size === 0) return;

        let toggle = false;
        const interval = setInterval(() => {
            originalColors.forEach((originalColor, material) => {
                material.color.setHex(toggle ? originalColor : new THREE.Color(color).getHex());
            });
            toggle = !toggle;
        }, 50);

        setTimeout(() => {
            clearInterval(interval);
            originalColors.forEach((originalColor, material) => {
                material.color.setHex(originalColor);
            });
        }, 300);
    }

    shakeCamera() {
        const originalPos = this.camera.position.clone();
        let shake = 5;
        const interval = setInterval(() => {
            this.camera.position.x = originalPos.x + (Math.random() - 0.5) * 0.2;
            this.camera.position.y = originalPos.y + (Math.random() - 0.5) * 0.2;
            shake--;
            if (shake <= 0) {
                clearInterval(interval);
                this.camera.position.copy(originalPos);
            }
        }, 50);
    }
}
