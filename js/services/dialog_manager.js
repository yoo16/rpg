export class DialogManager {
    constructor(game) {
        this.game = game; // We need game context for onEnd.execute(player, game)
        this.uiManager = game.uiManager;
        this.player = game.player;
        this.cameraManager = game.cameraManager;
        this.mapManager = game.mapManager;

        this.isActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;

        // This is kept here for reference, but Game.js also tracks currentNPCId for proximity.
        // We sync it or just use it to look at player.
        this.currentNPCId = null;
    }

    // Start a dialog with an NPC
    start(npc) {
        this.currentDialog = {
            name: npc.name,
            dialogues: npc.dialogues || [],
            onEnd: npc.onTalk // Expecting GameEvent or similar object with execute()
        };
        this.currentNPCId = npc.id;
        this.dialogIndex = 0;
        this.isActive = true;

        // Turn player to NPC
        if (this.player) {
            const dx = npc.x - this.player.gridX;
            const dz = npc.z - this.player.gridZ;
            this.player.rotationTarget = Math.atan2(-dx, -dz);
            this.player.isRotating = true;
        }

        // Turn NPC to player
        if (this.mapManager) {
            npc.lookAtPlayer(this.player);
        }

        // Camera focus
        if (this.cameraManager) {
            this.cameraManager.setZoom(true);
        }

        // Player transparency for camera view
        if (this.player && this.player.setOpacity) {
            this.player.setOpacity(0.3);
        }

        this.show();
    }

    // Show generic title/message or current dialog state
    show(title = null, message = null) {
        let displayTitle = title;
        let displayText = message;

        if (!message && this.currentDialog) {
            displayTitle = `${this.currentDialog.name}`;
            displayText = this.currentDialog.dialogues[this.dialogIndex];
        } else if (!title && message) {
            displayTitle = "";
        }

        this.isActive = true;
        this.uiManager.showDialog(displayTitle, displayText);
    }

    // Advance to next dialog line
    advance() {
        this.dialogIndex++;
        // Check if reached end of dialogues
        if (!this.currentDialog || this.dialogIndex >= this.currentDialog.dialogues.length) {
            this.hide();
        } else {
            this.show();
        }
    }

    // Close dialog
    hide() {
        // Check for post-dialogue event
        if (this.currentDialog && this.currentDialog.onEnd) {
            // execute(player, game) - we pass this.game
            const result = this.currentDialog.onEnd.execute(this.player, this.game);

            if (result.success && result.message) {
                // Clear the current dialog context so we don't return to it
                this.currentDialog = null;
                this.dialogIndex = 0;

                // Show the event result message
                this.show(null, result.message);
                return;
            }
        }

        this.uiManager.hideDialog();
        this.isActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.currentNPCId = null;

        // Reset Camera
        if (this.cameraManager) {
            this.cameraManager.setZoom(false);
        }

        // Reset Player Opacity
        if (this.player && this.player.setOpacity) {
            this.player.setOpacity(1.0);
        }
    }
}
