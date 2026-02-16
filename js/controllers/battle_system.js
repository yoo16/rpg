import * as THREE from 'three';
import { Enemy } from '../models/enemy.js';
import { BATTLE_PHASE } from '../constants.js';
import { BattleEnvironment } from '../views/battle_environment.js';

export class BattleSystem {
    constructor(player, mapManager, camera, battleGroup, enemyMasterData, onBattleEnd) {
        this.player = player;
        this.mapManager = mapManager;
        this.camera = camera;
        this.battleGroup = battleGroup;
        this.enemyMasterData = enemyMasterData;
        this.onBattleEnd = onBattleEnd;

        this.phase = BATTLE_PHASE.PLAYER_TURN;
        this.enemy = null;

        this.battleCameraPos = { x: 0, y: 3, z: 8 };
        this.battleCameraTarget = { x: 0, y: 1.0, z: 0 };

        this.setupUI();

        this.environment = new BattleEnvironment(this.battleGroup, this.mapManager);
        this.environment.create();
    }



    async startBattle(possibleEnemyIds) {
        this.phase = BATTLE_PHASE.PLAYER_TURN;
        try {
            // Filter enemies based on player level
            const validEnemies = possibleEnemyIds.filter(id => {
                const data = this.enemyMasterData[id];
                const enemyLevel = data.level ? Number(data.level) : 1;
                return enemyLevel <= this.player.stats.level;
            });

            if (validEnemies.length === 0) {
                console.log("No valid enemies for current level.");
                this.endBattle(true);
                return;
            }

            const randomEnemyId = validEnemies[Math.floor(Math.random() * validEnemies.length)];
            const enemyData = this.enemyMasterData[randomEnemyId];

            // Initialize Enemy Model
            this.enemy = new Enemy(randomEnemyId, enemyData);
            await this.enemy.load();
            this.battleGroup.add(this.enemy.group);

            this.camera.position.set(this.battleCameraPos.x, this.battleCameraPos.y, this.battleCameraPos.z);
            this.camera.lookAt(this.battleCameraTarget.x, this.battleCameraTarget.y, this.battleCameraTarget.z);

            this.showBattleUI();
            this.updateBattleUI();

            setTimeout(() => {
                this.addBattleLog(`${this.enemy.name} (Lv.${this.enemy.level}) があらわれた！`);
                this.enableButtons();
            }, 500);
        } catch (error) {
            console.error("Battle Start Error:", error);
            this.endBattle(false);
        }
    }

    onEnemyAttack() {
        if (this.phase !== BATTLE_PHASE.ENEMY_TURN) return;

        // Play enemy attack animation
        const animDuration = this.enemy.play('attack');

        const hitTiming = animDuration * 0.6;
        const waitAfterAttack = 800;

        setTimeout(() => {
            const damage = Math.max(this.enemy.stats.attack - this.player.stats.defense, 1);
            this.player.stats.hp -= damage;

            this.addBattleLog(`${this.enemy.name} の攻撃！ 勇者に ${damage} のダメージ！`);
            this.shakeScreen();
            this.updateBattleUI();

        }, hitTiming);

        setTimeout(() => {
            this.enemy.play('idle');

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

    onPlayerAttack() {
        if (this.phase !== BATTLE_PHASE.PLAYER_TURN) return;
        this.disableButtons();

        // Player animation could be triggered here if we had one

        const damage = Math.max(this.player.stats.attack - this.enemy.stats.defense, 1);
        this.enemy.stats.hp -= damage;

        this.addBattleLog(`${this.player.name} が ${this.enemy.name} に ${damage} のダメージを与えた！`);
        this.enemy.play('damage');
        this.shakeCamera();
        this.updateBattleUI();

        if (this.enemy.stats.hp <= 0) {
            this.phase = BATTLE_PHASE.VICTORY;
            setTimeout(async () => {
                const deathDuration = this.enemy.play('death');

                const xpReward = (this.enemy.exp !== undefined) ? this.enemy.exp : 1;
                this.addBattleLog(`${this.enemy.name}を倒した！${xpReward} 経験値を得た！`);

                await new Promise(r => setTimeout(r, Math.min(deathDuration, 1000)));

                await this.enemy.fadeOut(1000);

                // Gain EXP
                const leveledUp = this.player.gainXp(xpReward);

                if (leveledUp) {
                    this.startLevelUpSequence(xpReward);
                } else {
                    this.endBattle(true);
                }
            }, 500);
        } else {
            this.phase = BATTLE_PHASE.ENEMY_TURN;
            setTimeout(() => {
                this.enemy.play('idle');
                setTimeout(() => this.onEnemyAttack(), 500);
            }, 1000);
        }
    }

    async startLevelUpSequence(xpReward) {
        this.phase = BATTLE_PHASE.LEVEL_UP;

        // 1. 敵を消す
        await this.enemy.fadeOut(1000);

        // 2. 経験値を表示
        const message = `
        ${this.player.name}が ${this.player.stats.level} にレベルアップ！
        `;
        this.addBattleLog(message);

        // 3. Move Player to Battle Scene Center
        this.originalPlayerParent = this.player.mesh.parent;
        this.originalPlayerPos = this.player.mesh.position.clone();
        this.originalPlayerRot = this.player.mesh.rotation.y;
        this.originalPlayerScale = this.player.mesh.scale.clone(); // Store scale

        this.battleGroup.add(this.player.mesh);
        this.player.mesh.position.set(0, 0, 0);
        this.player.mesh.rotation.y = Math.PI;
        // Scale up
        this.player.mesh.scale.set(1.5, 1.5, 1.5);
        this.player.mesh.visible = true;

        // Camera Zoom
        this.originalCameraPos = this.camera.position.clone();
        this.camera.position.set(0, 1.5, 4); // Zoom in
        this.camera.lookAt(0, 0.5, 0);

        // 4. PlayerのVictory Animationを再生
        this.player.playVictory();
    }

    onKeyDown(key) {
        if (this.phase === BATTLE_PHASE.LEVEL_UP && key === 'Enter') {
            this.endBattle(true);
        }
    }

    update(delta) {
        if (this.enemy) {
            this.enemy.update(delta);
        }
        if (this.phase === BATTLE_PHASE.LEVEL_UP && this.player) {
            this.player.updateMixers(delta);
        }
    }

    shakeCamera() {
        if (!this.camera) return;
        const originalPos = new THREE.Vector3().copy(this.camera.position);
        const duration = 500;
        const start = Date.now();
        const animateShake = () => {
            const elapsed = Date.now() - start;
            if (elapsed < duration) {
                const progress = 1 - (elapsed / duration);
                const intensity = 0.5 * progress;
                this.camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity;
                this.camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity;
                this.camera.position.z = originalPos.z + (Math.random() - 0.5) * intensity;
                requestAnimationFrame(animateShake);
            } else {
                this.camera.position.copy(originalPos);
            }
        };
        animateShake();
    }

    shakeScreen() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.classList.remove('screen-shake-active');
        void container.offsetWidth;
        container.classList.add('screen-shake-active');
        setTimeout(() => container.classList.remove('screen-shake-active'), 400);
    }

    endBattle(isVictory) {
        if (this.enemy) {
            this.battleGroup.remove(this.enemy.group);
            this.enemy.dispose();
        }
        this.enemy = null;

        // Restore Player if needed
        if (this.phase === BATTLE_PHASE.LEVEL_UP && this.originalPlayerParent) {
            this.originalPlayerParent.add(this.player.mesh);
            this.player.mesh.position.copy(this.originalPlayerPos);
            this.player.mesh.rotation.y = this.originalPlayerRot;
            if (this.originalPlayerScale) this.player.mesh.scale.copy(this.originalPlayerScale);
            this.player.setAnimationState('Idle');
            this.originalPlayerParent = null;

            // Restore Camera
            if (this.originalCameraPos) {
                this.camera.position.copy(this.originalCameraPos);
            }
        }

        this.hideBattleUI();
        if (this.onBattleEnd) this.onBattleEnd(isVictory);
    }

    updateBattleUI() {
        if (!this.enemy || !this.player) return;

        // 1. 敵のHP更新（これはバトル固有なのでここでやる）
        const ePercent = Math.min(100, Math.max(0, (this.enemy.stats.hp / this.enemy.stats.maxHp) * 100));
        const eBar = document.getElementById('enemy-hp-bar');
        if (eBar) {
            eBar.style.width = `${ePercent}%`;
        }
        const eText = document.getElementById('enemy-hp-text');
        if (eText) {
            eText.textContent = `${Math.floor(this.enemy.stats.hp)} / ${this.enemy.stats.maxHp}`;
        }

        // 2. プレイヤーのHP更新（共通処理を呼び出す）
        if (window.game) {
            window.game.updateAllStatusUI();
        }
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

    showBattleUI() { document.getElementById('battle-ui').style.display = 'block'; }
    hideBattleUI() { document.getElementById('battle-ui').style.display = 'none'; }
    addBattleLog(msg) { document.getElementById('battle-message').textContent = msg; }
    enableButtons() {
        const cmdArea = document.getElementById('battle-commands');
        if (cmdArea) cmdArea.style.display = 'flex';

        document.getElementById('btn-attack').disabled = false;
        document.getElementById('btn-run').disabled = false;
    }
    disableButtons() {
        const cmdArea = document.getElementById('battle-commands');
        if (cmdArea) cmdArea.style.display = 'none';

        document.getElementById('btn-attack').disabled = true;
        document.getElementById('btn-run').disabled = true;
    }


}