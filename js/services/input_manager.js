export class InputManager {
    constructor() {
        this.keys = {};
        this.setupListeners();
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

    // イベントフック用（Gameクラスから上書きまたはバインドする）
    onKeyDown(e) { }

    isKeyPressed(key) {
        return !!this.keys[key];
    }
}
