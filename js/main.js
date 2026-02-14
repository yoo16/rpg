/**
 * Web 3D RPG - Main Entry Point
 * Refactored to use modular architecture
 */
import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
    // Start Game
    window.game = new Game();
});
