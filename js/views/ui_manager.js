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
            this.elPlayerHpBar.style.backgroundColor = pPercent < 20 ? 'var(--danger-color)' :
                pPercent < 50 ? 'var(--caution-color)' : 'var(--safe-color)';
        }
        if (this.elPlayerHpText) {
            this.elPlayerHpText.textContent = `${Math.floor(player.stats.hp)} / ${player.stats.maxHp}`;
        }

        // Update Level and XP (assuming elements exist or adding them dynamically if needed, 
        // but for now let's assume we might need to add them to HTML or just log/display elsewhere)
        // ideally checking for element existence first
        const elLevel = document.getElementById('player-level');
        const elXp = document.getElementById('player-xp');
        if (elLevel) elLevel.textContent = `Lv.${player.stats.level}`;
        if (elXp) elXp.textContent = `XP: ${player.stats.xp} / ${player.stats.nextXp}`;
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

    toggleBattleButtons(enabled) {
        const btnAttack = document.getElementById('btn-attack');
        const btnRun = document.getElementById('btn-run');
        if (btnAttack) btnAttack.disabled = !enabled;
        if (btnRun) btnRun.disabled = !enabled;
    }

    updateBattleStatus(player, enemy) {
        // Player HP (Battle UI)
        // Note: ID duplicates might exist if not careful, assuming IDs are unique in HTML
        // If battle UI has separate HP bars from main UI, we handle them here.
        // For now, reuse updatePlayerStatus for player, handle enemy here.

        if (enemy) {
            const eHP = Math.max(0, (enemy.stats.hp / enemy.stats.maxHp) * 100);
            const eBar = document.getElementById('enemy-hp-bar');
            const eText = document.getElementById('enemy-hp-text');
            if (eBar) eBar.style.width = `${eHP}%`;
            if (eText) eText.textContent = `${Math.floor(Math.max(0, enemy.stats.hp))}/${enemy.stats.maxHp}`;
        }
    }
}
