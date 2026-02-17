export class GameEvent {
    constructor(data) {
        this.id = data.id;
        // 'heal', 'set_flag',  'dialogue', 'open_door', 'warp'
        this.type = data.type;
        this.x = data.x;
        this.z = data.z;
        this.message = data.message;
        this.message_fail = data.message_fail; // Message when condition fails

        this.trigger = data.trigger || 'touch';
        this.condition = data.condition || null;
        this.action = data.action || null;

        // One-time event?
        this.once = data.once || false;
        this.executed = false;

        // Warp properties
        this.warp_to_map = data.warp_to_map;
        this.warp_to_x = data.warp_to_x;
        this.warp_to_z = data.warp_to_z;
    }

    checkCondition(player) {
        if (!this.condition) return true;

        if (this.condition.flag) {
            const flagVal = player.getFlag(this.condition.flag);
            return flagVal === this.condition.value;
        }
        return true;
    }

    execute(player, game) {
        if (this.once && this.executed) return { success: false, message: null };
        if (!this.checkCondition(player)) {
            return { success: false, message: this.message_fail };
        }

        let resultMessage = this.message;
        let success = true;

        switch (this.type) {
            case 'heal':
                player.healFull();
                break;
            case 'set_flag':
                console.log("Setting Flag:", this.action);
                player.setFlag(this.action?.key, this.action?.value);
                break;
            case 'dialogue':
                break;
            case 'open_door':
                game?.mapManager?.openDoor(this.x, this.z);
                break;
            case 'warp':
                game?.mapManager?.warp(this.warp_to_map, this.warp_to_x, this.warp_to_z);
            default:
                break;
        }

        if (this.once) this.executed = true;

        return { success, message: resultMessage, type: this.type };
    }
}
