export class InputManager {
    constructor() {
        this.keys = {};
        this.setupListeners();
        console.log("InputManager initialized");
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            this.onKeyDown(e);
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    // Event hook (overwritten by Game)
    onKeyDown(e) { }

    isKeyPressed(key) {
        return !!this.keys[key];
    }

    isActionPressed() {
        return this.keys[' '] || this.keys['Enter'];
    }
}
