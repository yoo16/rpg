export class UIManager {
    constructor() {
        this.dialogUI = document.getElementById('dialog-ui');
        this.dialogText = document.getElementById('dialog-text');
        this.dialogTitle = document.getElementById('dialog-title');
        this.loadingUI = document.getElementById('loading-ui');
        this.battleUI = document.getElementById('battle-ui');
        this.battleMessage = document.getElementById('battle-message');

        // Status elements
        this.elPlayerName = document.getElementById('player-name');
        this.elPlayerHpBar = document.getElementById('player-hp-bar');
        this.elPlayerHpText = document.getElementById('player-hp-text');
        this.elPosX = document.getElementById('pos-x');
        this.elPosZ = document.getElementById('pos-z');
    }

    showLoading() {
        if (this.loadingUI) this.loadingUI.style.display = 'flex';
    }

    hideLoading() {
        if (this.loadingUI) this.loadingUI.style.display = 'none';
    }

    showLoadingError(msg) {
        if (this.loadingUI) {
            this.loadingUI.innerHTML = `<div style="color:red"><p>エラー</p><p>${msg}</p></div>`;
        }
    }

    // --- Dialog Methods ---
    showDialog(title, message) {
        if (!this.dialogUI) return;
        this.dialogTitle.textContent = title;
        this.dialogText.textContent = message;
        this.dialogUI.style.display = 'block';
    }

    hideDialog() {
        if (this.dialogUI) this.dialogUI.style.display = 'none';
    }

    // --- Status UI Methods ---
    updatePlayerStatus(player) {
        if (!player || !player.stats) return;

        if (this.elPlayerName) this.elPlayerName.textContent = player.name;
        if (this.elPosX) this.elPosX.textContent = player.gridX.toFixed(0);
        if (this.elPosZ) this.elPosZ.textContent = player.gridZ.toFixed(0);

        const pPercent = player.hpPercent;
        if (this.elPlayerHpBar) {
            this.elPlayerHpBar.style.width = `${pPercent}%`;
            // Tailwind colors: safe=#1931ec, danger=#ff6666, caution (yellow-500)=#eab308
            const color = pPercent < 20 ? '#ff6666' : pPercent < 50 ? '#eab308' : '#1931ec';
            this.elPlayerHpBar.style.backgroundColor = color;
        }
        if (this.elPlayerHpText) {
            this.elPlayerHpText.textContent = `${Math.floor(player.stats.hp)} / ${player.stats.maxHp}`;
        }

        const elLevel = document.getElementById('player-level');
        const elExp = document.getElementById('player-exp');
        const elNextExp = document.getElementById('player-next-exp');
        if (elLevel) elLevel.textContent = `${player.stats.level}`;
        if (elExp) elExp.textContent = `${player.stats.xp}`;
        if (elNextExp) elNextExp.textContent = `${player.stats.nextXp}`;
    }

    // --- Battle UI Methods ---
    showBattleUI() {
        if (this.battleUI) this.battleUI.style.display = 'block';
    }

    hideBattleUI() {
        if (this.battleUI) this.battleUI.style.display = 'none';
    }

    setBattleMessage(msg) {
        if (this.battleMessage) this.battleMessage.textContent = msg;
    }

    setBattleCommandVisibility(visible) {
        const cmdArea = document.getElementById('battle-commands');
        if (cmdArea) cmdArea.style.display = visible ? 'flex' : 'none';
    }

    toggleBattleButtons(enabled) {
        // Deprecated or can be kept for enabling/disabling if needed, 
        // but new requirement prefers hiding.
        // For backwards compatibility or if we want to just disable without hiding:
        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');
        if (btnAttack) btnAttack.disabled = !enabled;
        if (btnRun) btnRun.disabled = !enabled;
    }

    updateBattleStatus(player, enemy) {
        if (enemy) {
            const eHP = Math.max(0, (enemy.stats.hp / enemy.stats.maxHp) * 100);
            const eBar = document.getElementById('enemy-hp-bar');
            const eText = document.getElementById('enemy-hp-text');
            if (eBar) eBar.style.width = `${eHP}%`;
            if (eText) eText.textContent = `${Math.floor(Math.max(0, enemy.stats.hp))}/${enemy.stats.maxHp}`;
        }
    }
}
