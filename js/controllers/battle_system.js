import * as THREE from 'three';
import { Enemy } from '../models/enemy.js';
import { BATTLE_PHASE } from '../constants.js';

export class BattleSystem {
    constructor(player, camera, battleGroup, enemyMasterData, onBattleEnd) {
        this.player = player;
        this.camera = camera;
        this.battleGroup = battleGroup;
        this.enemyMasterData = enemyMasterData;
        this.onBattleEnd = onBattleEnd;

        this.phase = BATTLE_PHASE.PLAYER_TURN;
        this.enemy = null;

        this.battleCameraPos = { x: 0, y: 3, z: 8 };
        this.battleCameraTarget = { x: 0, y: 1.0, z: 0 };

        this.setupUI();
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
            setTimeout(() => {
                this.enemy.play('death');
                const xpReward = (this.enemy.exp !== undefined) ? this.enemy.exp : 50;
                this.addBattleLog(`Victory! ${xpReward} XP gains!`);
                const leveledUp = this.player.gainXp(xpReward);

                setTimeout(() => {
                    if (leveledUp) {
                        this.addBattleLog(`Level Up! Lv ${this.player.stats.level}!`);
                        setTimeout(() => this.endBattle(true), 1500);
                    } else {
                        this.endBattle(true);
                    }
                }, 1000);
            }, 1000);
        } else {
            this.phase = BATTLE_PHASE.ENEMY_TURN;
            setTimeout(() => {
                this.enemy.play('idle'); // Ensure return to idle before attack just in case
                setTimeout(() => this.onEnemyAttack(), 500);
            }, 1000);
        }
    }

    update(delta) {
        if (this.enemy) {
            this.enemy.update(delta);
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
        document.getElementById('btn-attack').disabled = false;
        document.getElementById('btn-run').disabled = false;
    }
    disableButtons() {
        document.getElementById('btn-attack').disabled = true;
        document.getElementById('btn-run').disabled = true;
    }


}