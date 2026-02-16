import { Game } from './controllers/game.js';

// DOMが読み込まれてから開始
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    window.game = game;
});