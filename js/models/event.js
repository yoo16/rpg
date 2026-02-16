export class GameEvent {
    constructor(data) {
        this.id = data.id;
        this.type = data.type; // 'heal', 'dialogue', 'item', 'set_flag', 'warp'
        this.x = data.x;
        this.z = data.z;
        this.message = data.message;
        this.message_fail = data.message_fail; // Message when condition fails

        // Trigger type: 'touch' (step on), 'action' (press button), 'auto'
        this.trigger = data.trigger || 'touch';

        // Conditions (e.g., { flag: 'has_key', value: true })
        this.condition = data.condition || null;

        // Actions (e.g., { type: 'set_flag', key: 'door_open', value: true })
        this.action = data.action || null;

        // One-time event?
        this.once = data.once || false;
        this.executed = false;
    }

    checkCondition(player) {
        if (!this.condition) return true;

        if (this.condition.flag) {
            const flagVal = player.getFlag(this.condition.flag);
            return flagVal === this.condition.value;
        }

        // Add more conditions as needed (e.g. item check, level check)
        return true;
    }

    execute(player, game) {
        if (this.once && this.executed) return { success: false, message: null };
        if (!this.checkCondition(player)) {
            return { success: false, message: this.message_fail };
        }

        let resultMessage = this.message;
        let success = true;

        // Execute specific logic based on type
        switch (this.type) {
            case 'heal':
                player.healFull();
                break;
            case 'set_flag':
                if (this.action && this.action.key) {
                    player.setFlag(this.action.key, this.action.value);
                }
                break;
            case 'dialogue':
                // Dialogue is handled by Game controller usually, but we can return the message
                break;
            case 'open_door':
                if (game && game.mapManager) {
                    game.mapManager.openDoor(this.x, this.z);
                }
                break;
            default:
                break;
        }

        if (this.once) this.executed = true;

        return { success, message: resultMessage, type: this.type };
    }
}
