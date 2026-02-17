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
        // 一度きりのイベントで、すでに実行済みの場合
        if (this.once && this.executed) return { success: false, message: null };
        // 条件チェック
        if (!this.checkCondition(player)) {
            return { success: false, message: this.message_fail };
        }

        // イベント実行
        switch (this.type) {
            case 'heal':
                player.healFull();
                break;
            case 'set_flag':
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

        return { success: true, message: this.message, type: this.type };
    }
}
