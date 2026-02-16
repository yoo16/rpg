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

    // バトル開始
    async startBattle(possibleEnemyIds) {
        this.phase = BATTLE_PHASE.PLAYER_TURN;
        try {
            // 敵のフィルタリング（レベル制限）
            const validEnemies = possibleEnemyIds.filter(id => {
                const data = this.enemyMasterData[id];
                const enemyLevel = data.level ? Number(data.level) : 1;
                return enemyLevel <= this.player.stats.level;
            });

            // 敵がいない場合はバトル終了
            if (validEnemies.length === 0) {
                console.log("No valid enemies for current level.");
                this.endBattle(true);
                return;
            }

            // ランダムに敵を決定
            const randomEnemyId = validEnemies[Math.floor(Math.random() * validEnemies.length)];
            const enemyData = this.enemyMasterData[randomEnemyId];

            // 敵モデルの初期化
            this.enemy = new Enemy(randomEnemyId, enemyData);
            await this.enemy.load();
            this.battleGroup.add(this.enemy.group);

            // カメラ設定
            this.camera.position.set(this.battleCameraPos.x, this.battleCameraPos.y, this.battleCameraPos.z);
            this.camera.lookAt(this.battleCameraTarget.x, this.battleCameraTarget.y, this.battleCameraTarget.z);

            // UI表示
            this.showBattleUI();
            this.updateBattleUI();

            // ダイアログ表示
            setTimeout(() => {
                this.addBattleLog(`${this.enemy.name} (Lv.${this.enemy.level}) があらわれた！`);
                this.enableButtons();
            }, 500);
        } catch (error) {
            console.error("Battle Start Error:", error);
            this.endBattle(false);
        }
    }

    // 敵の攻撃
    onEnemyAttack() {
        if (this.phase !== BATTLE_PHASE.ENEMY_TURN) return;

        // 敵の攻撃アニメーション
        const animDuration = this.enemy.play('attack');
        const hitTiming = animDuration * 0.6;
        const waitAfterAttack = 800;

        // ダメージ計算
        setTimeout(() => {
            const damage = Math.max(this.enemy.stats.attack - this.player.stats.defense, 1);
            this.player.stats.hp -= damage;

            const message = `${this.enemy.name} の攻撃！ ${this.player.name} に ${damage} のダメージ！`;
            this.addBattleLog(message);
            this.shakeScreen();
            this.updateBattleUI();

        }, hitTiming);

        // 攻撃終了後の処理
        setTimeout(() => {
            this.enemy.play('idle');

            if (this.player.stats.hp <= 0) {
                this.phase = BATTLE_PHASE.DEFEAT;
                const message = `${this.player.name} は倒れた...`;
                this.addBattleLog(message);
                setTimeout(() => this.endBattle(false), 1500);
            } else {
                this.phase = BATTLE_PHASE.PLAYER_TURN;
                const message = `${this.player.name} のターン！`;
                this.addBattleLog(message);
                this.enableButtons();
            }
        }, animDuration + waitAfterAttack);
    }

    onPlayerAttack() {
        if (this.phase !== BATTLE_PHASE.PLAYER_TURN) return;
        this.disableButtons();

        // ダメージ計算
        const damage = Math.max(this.player.stats.attack - this.enemy.stats.defense, 1);
        // 敵のHPを減らす
        this.enemy.stats.hp -= damage;
        // メッセージ追加
        const message = `${this.player.name} が ${this.enemy.name} に ${damage} のダメージを与えた！`
        this.addBattleLog(message);
        // 敵のアニメーション
        this.enemy.play('damage');
        // カメラシェイク
        this.shakeCamera();
        // UI更新
        this.updateBattleUI();

        // 敵のHPが0以下の場合
        if (this.enemy.stats.hp <= 0) {
            // 勝利
            this.phase = BATTLE_PHASE.VICTORY;
            // 勝利後の処理
            setTimeout(async () => {
                // 敵のアニメーション
                const deathDuration = this.enemy.play('death');
                // 経験値計算
                const xpReward = (this.enemy.exp !== undefined) ? this.enemy.exp : 1;
                // メッセージ追加
                const message = `${this.enemy.name}を倒した！${xpReward} 経験値を得た！`;
                this.addBattleLog(message);

                // 敵のアニメーション終了待ち
                await new Promise(r => setTimeout(r, Math.min(deathDuration, 1000)));
                // 敵をフェードアウト
                await this.enemy.fadeOut(1000);

                // 経験値獲得
                const leveledUp = this.player.gainXp(xpReward);

                if (leveledUp) {
                    // レベルアップ
                    this.startLevelUpSequence(xpReward);
                } else {
                    // バトル終了
                    this.endBattle(true);
                }
            }, 500);
        } else {
            // 敵のターン
            this.phase = BATTLE_PHASE.ENEMY_TURN;
            // 敵のアニメーション
            setTimeout(() => {
                this.enemy.play('idle');
                setTimeout(() => this.onEnemyAttack(), 500);
            }, 1000);
        }
    }

    async startLevelUpSequence(xpReward) {
        // レベルアップ
        this.phase = BATTLE_PHASE.LEVEL_UP;

        // 1. 敵を消す
        await this.enemy.fadeOut(1000);

        // 2. レベルアップメッセージ
        const message = `${this.player.name}が ${this.player.stats.level} にレベルアップ！`;
        this.addBattleLog(message);

        // 3. プレイヤーをバトルシーン中央へ移動
        this.originalPlayerParent = this.player.mesh.parent;
        this.originalPlayerPos = this.player.mesh.position.clone();
        this.originalPlayerRot = this.player.mesh.rotation.y;
        this.originalPlayerScale = this.player.mesh.scale.clone(); // Store scale

        this.battleGroup.add(this.player.mesh);
        this.player.mesh.position.set(0, 0, 0);
        this.player.mesh.rotation.y = Math.PI;
        this.player.mesh.scale.set(1.5, 1.5, 1.5);
        this.player.mesh.visible = true;

        // Camera Zoom
        this.originalCameraPos = this.camera.position.clone();
        this.camera.position.set(0, 1.5, 4); // Zoom in
        this.camera.lookAt(0, 0.5, 0);

        // 4. PlayerのVictory Animationを再生
        this.player.playVictory();
    }

    // キー入力
    onKeyDown(key) {
        if (this.phase === BATTLE_PHASE.LEVEL_UP && key === 'Enter') {
            this.endBattle(true);
        }
    }

    // 更新
    update(delta) {
        if (this.enemy) {
            this.enemy.update(delta);
        }
        if (this.phase === BATTLE_PHASE.LEVEL_UP && this.player) {
            this.player.updateMixers(delta);
        }
    }

    // カメラシェイク
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

    // 画面シェイク
    shakeScreen() {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.classList.remove('screen-shake-active');
        void container.offsetWidth;
        container.classList.add('screen-shake-active');
        setTimeout(() => container.classList.remove('screen-shake-active'), 400);
    }

    // バトル終了
    endBattle(isVictory) {
        if (this.enemy) {
            this.battleGroup.remove(this.enemy.group);
            this.enemy.dispose();
        }
        // 敵を消滅
        this.enemy = null;

        // レベルアップ後の処理
        if (this.phase === BATTLE_PHASE.LEVEL_UP && this.originalPlayerParent) {
            this.originalPlayerParent.add(this.player.mesh);
            this.player.mesh.position.copy(this.originalPlayerPos);
            this.player.mesh.rotation.y = this.originalPlayerRot;
            if (this.originalPlayerScale) this.player.mesh.scale.copy(this.originalPlayerScale);
            this.player.setAnimationState('Idle');
            this.originalPlayerParent = null;

            // カメラを元に戻す
            if (this.originalCameraPos) {
                this.camera.position.copy(this.originalCameraPos);
            }
        }

        // UIを非表示
        this.hideBattleUI();
        // バトル終了イベント
        if (this.onBattleEnd) this.onBattleEnd(isVictory);
    }

    // バトルUI更新
    updateBattleUI() {
        if (!this.enemy || !this.player) return;

        // 敵のHP更新
        const ePercent = Math.min(100, Math.max(0, (this.enemy.stats.hp / this.enemy.stats.maxHp) * 100));
        const eBar = document.getElementById('enemy-hp-bar');
        if (eBar) {
            eBar.style.width = `${ePercent}%`;
        }
        const eText = document.getElementById('enemy-hp-text');
        if (eText) {
            eText.textContent = `${Math.floor(this.enemy.stats.hp)} / ${this.enemy.stats.maxHp}`;
        }

        // プレイヤーのHP更新
        if (window.game) {
            window.game.updateAllStatusUI();
        }
    }

    // UIセットアップ
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

    // UI表示
    // UI表示
    showBattleUI() { document.getElementById('battle-ui').style.display = 'block'; }
    // UI非表示
    hideBattleUI() { document.getElementById('battle-ui').style.display = 'none'; }
    // メッセージ追加
    addBattleLog(msg) { document.getElementById('battle-message').textContent = msg; }
    // ボタン有効化
    enableButtons() {
        const cmdArea = document.getElementById('battle-commands');
        if (cmdArea) cmdArea.style.display = 'flex';

        document.getElementById('btn-attack').disabled = false;
        document.getElementById('btn-run').disabled = false;
    }
    // ボタン無効化
    disableButtons() {
        const cmdArea = document.getElementById('battle-commands');
        if (cmdArea) cmdArea.style.display = 'none';

        document.getElementById('btn-attack').disabled = true;
        document.getElementById('btn-run').disabled = true;
    }


}