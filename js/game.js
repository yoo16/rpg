import * as THREE from 'three';
import GameApi from './api.js';
import { MapManager } from './map_manager.js';
import { Player } from './player.js';
import { BattleSystem } from './battle_system.js';
import { STATE, BATTLE_PHASE } from './constants.js';

export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        this.worldGroup = null;
        this.battleGroup = null;

        this.mapManager = new MapManager();
        this.player = new Player(this.mapManager, () => this.checkEncounter());
        this.battleSystem = null;

        this.currentState = STATE.MAP;
        this.enemyMasterData = null;
        this.keys = {};

        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.currentNPCId = null;
        this.lastDialogTime = 0;

        this.isRunning = true;

        // --- Camera Settings (三人称視点) ---
        this.cameraOffset = { x: 0, y: 2.0, z: 4.5 };
        this.cameraSmoothness = 0.15;

        this.init();
    }

    async init() {
        try {
            this.showLoading();
            await GameApi.initConfig();
            this.setupThreeJS();

            const [pRes, mRes, eRes] = await Promise.all([
                GameApi.getPlayerInitData(),
                GameApi.getMapData(1),
                GameApi.getEnemyData()
            ]);

            this.enemyMasterData = eRes.data.enemies;
            this.mapManager.init(mRes.data.map);
            this.worldGroup.add(this.mapManager.group);

            await this.player.init(pRes.data.player, mRes.data.map);
            this.worldGroup.add(this.player.mesh);

            const playerLight = new THREE.PointLight(0xffaa00, 1.5, 10);
            playerLight.position.set(0, 2, 0);
            this.player.mesh.add(playerLight);

            await this.mapManager.createNPCs();

            this.battleSystem = new BattleSystem(
                this.player, this.camera, this.battleGroup, this.enemyMasterData,
                (win) => this.onBattleEnd(win)
            );

            this.setupInput();
            this.hideLoading();
            this.startGameLoop();
        } catch (e) { console.error(e); }
    }

    setupThreeJS() {
        const container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();

        // --- 修正箇所: FOVを75度に広げる ---
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        this.worldGroup = new THREE.Group();
        this.battleGroup = new THREE.Group();
        this.scene.add(this.worldGroup, this.battleGroup);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 10, 7);
        this.scene.add(dl);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    // --- (setupInput, handleInput, update 等は変更なし) ---
    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if ((e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                if (this.dialogActive) this.advanceDialog();
                else if (this.currentState === STATE.MAP) this.checkInteraction();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
    }

    handleInput() {
        if (this.player.isMoving || this.player.isRotating || this.dialogActive || this.currentState !== STATE.MAP) return;
        if (this.keys['ArrowUp'] || this.keys['w']) {
            this.player.moveForward();
        } else if (this.keys['ArrowDown'] || this.keys['s']) {
            this.player.rotateBy(Math.PI);
            this.keys['ArrowDown'] = false; this.keys['s'] = false;
        } else if (this.keys['ArrowLeft'] || this.keys['a']) {
            this.player.rotateBy(Math.PI / 2);
            this.keys['ArrowLeft'] = false; this.keys['a'] = false;
        } else if (this.keys['ArrowRight'] || this.keys['d']) {
            this.player.rotateBy(-Math.PI / 2);
            this.keys['ArrowRight'] = false; this.keys['d'] = false;
        }
    }

    update(delta) {
        if (this.currentState === STATE.MAP) {
            this.player.updateMovement(delta);
            this.handleInput();
            if (!this.dialogActive) {
                this.checkNPCProximity();
            }
            this.player.updateAnimation(delta);
            this.mapManager.update(delta);
            this.updateCamera();
        } else if (this.currentState === STATE.BATTLE && this.battleSystem) {
            this.battleSystem.update(delta);
        }
        this.updateUI();
    }

    updateCamera() {
        if (!this.player.mesh || this.currentState !== STATE.MAP) return;

        // 1. プレイヤーの頭上付近（注視点）を定義
        const lookTarget = this.player.mesh.position.clone();
        lookTarget.y += 1.5; // 注視点を少し高くする（頭の位置）

        // 2. 本来あるべき理想のカメラ位置を計算
        const playerRotation = this.player.mesh.quaternion.clone();
        const offset = new THREE.Vector3(this.cameraOffset.x, this.cameraOffset.y, this.cameraOffset.z);
        offset.applyQuaternion(playerRotation);
        const idealPos = this.player.mesh.position.clone().add(offset);

        // 3. Raycasterを使って壁コリジョン判定
        const rayDirection = idealPos.clone().sub(lookTarget).normalize();
        const rayDistance = idealPos.distanceTo(lookTarget);
        const raycaster = new THREE.Raycaster(lookTarget, rayDirection, 0, rayDistance);

        // mapManager内の壁・天井メッシュとの衝突をチェック
        // mapMeshes に壁と天井の両方が入っている必要があります
        const intersects = raycaster.intersectObjects(this.mapManager.mapMeshes);

        let finalCameraPos = idealPos;

        if (intersects.length > 0) {
            // 壁に当たった場合、壁の表面から少し手前(0.3)の位置にカメラを置く
            const hitDistance = intersects[0].distance - 0.3;
            finalCameraPos = lookTarget.clone().add(rayDirection.multiplyScalar(hitDistance));
        }

        // 4. 算出した位置に滑らかに追従
        this.camera.position.lerp(finalCameraPos, this.cameraSmoothness);

        // 5. プレイヤーの頭のあたりを注視
        this.camera.lookAt(lookTarget);
    }
    checkEncounter() {
        if (this.currentState !== STATE.MAP) return;
        // JSONから取得したエンカウント率（例: 0.05 = 5%）
        const rate = this.mapManager.mapData.encounter_rate || 0.05;
        console.log(rate)

        // 0.0〜1.0の乱数を生成し、rateより小さければ遭遇
        if (Math.random() < rate) {
            console.log('%c⚔️ ENCOUNTER!', 'color: red; font-weight: bold;');
            this.startBattle();
        }
    }
    onBattleEnd(isVictory) {
        this.currentState = STATE.MAP;
        this.worldGroup.visible = true;
        this.battleGroup.visible = false;
    }
    checkInteraction() {
        if (this.dialogActive) return;
        const { x, z } = this.player.getFacingPosition();
        const npcData = this.mapManager.getNPCAt(x, z);
        if (npcData) { this.startNPCDialog(npcData); return; }
        const event = this.mapManager.getEventAt(x, z);
        if (event && event.type === 'heal') {
            this.executeHeal(event);
            this.showDialog(event.message);
        }
    }
    executeHeal(event) {
        this.player.stats.hp = this.player.stats.maxHp;
        this.updateUI();
    }
    startNPCDialog(npc) {
        this.currentDialog = { name: npc.name, dialogues: npc.dialogues || [] };
        this.currentNPCId = npc.id;
        this.dialogIndex = 0;
        this.showDialog();
    }
    showDialog(message = null) {
        const dialogUI = document.getElementById('dialog-ui');
        const dialogText = document.getElementById('dialog-text');
        const dialogTitle = document.getElementById('dialog-title');
        if (!dialogUI) return;
        if (message) {
            dialogText.textContent = message;
            dialogTitle.textContent = "【案内】";
        } else if (this.currentDialog) {
            dialogTitle.textContent = `【${this.currentDialog.name}】`;
            dialogText.textContent = this.currentDialog.dialogues[this.dialogIndex];
        }
        dialogUI.style.display = 'block';
        this.dialogActive = true;
    }
    advanceDialog() {
        this.dialogIndex++;
        if (!this.currentDialog || this.dialogIndex >= this.currentDialog.dialogues.length) {
            this.hideDialog();
        } else {
            this.showDialog();
        }
    }
    hideDialog() {
        const dialogUI = document.getElementById('dialog-ui');
        if (dialogUI) dialogUI.style.display = 'none';
        this.dialogActive = false;
        this.currentDialog = null;
        this.dialogIndex = 0;
        this.lastDialogTime = performance.now();
    }
    checkNPCProximity() {
        const px = this.player.gridX;
        const pz = this.player.gridZ;
        const result = this.mapManager.checkNPCProximity(px, pz, this.currentNPCId);
        if (result.npc) { this.startNPCDialog(result.npc); }
        else if (!result.adjacent) { this.currentNPCId = null; }
    }
    startGameLoop = () => {
        if (!this.isRunning) return;
        const delta = this.clock.getDelta();
        this.update(delta);
        this.render();
        requestAnimationFrame(this.startGameLoop);
    };
    updateUI() {
        if (this.player.mesh) {
            const nameElem = document.getElementById('player-name');
            if (nameElem) nameElem.textContent = this.player.name;
            const posX = document.getElementById('pos-x');
            const posZ = document.getElementById('pos-z');
            if (posX) posX.textContent = this.player.gridX.toFixed(0);
            if (posZ) posZ.textContent = this.player.gridZ.toFixed(0);
        }
    }
    render() { this.renderer.render(this.scene, this.camera); }
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    showLoading() { document.getElementById('loading-ui').style.display = 'flex'; }
    hideLoading() { document.getElementById('loading-ui').style.display = 'none'; }
    showLoadingError(msg) {
        const el = document.getElementById('loading-ui');
        if (el) el.innerHTML = `<div style="color:red"><p>エラー</p><p>${msg}</p></div>`;
    }
}