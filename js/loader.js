import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- シーン基本設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 2000);
camera.position.set(3, 2, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// 床と環境
scene.add(new THREE.GridHelper(20, 20, 0x888888, 0x444444));
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 7.5);
dirLight.castShadow = true;
scene.add(dirLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 変数管理 ---
let currentModel = null;
let mixer = null;
const clock = new THREE.Clock();
const loader = new GLTFLoader();

/**
 * モデルを破棄してメモリを解放
 */
function disposeModel(model) {
    if (!model) return;
    model.traverse((node) => {
        if (node.isMesh) {
            node.geometry.dispose();
            if (Array.isArray(node.material)) {
                node.material.forEach(m => m.dispose());
            } else {
                node.material.dispose();
            }
        }
    });
    scene.remove(model);
}

/**
 * モデルのサイズに合わせてカメラを調整
 */
function fitCameraToModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    camera.position.set(center.x + cameraZ, center.y + (maxDim / 2), center.z + cameraZ);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.update();
}

/**
 * キャラクターとアニメーションをロードして統合
 */
async function loadCombinedPlayer(charFile, animFile) {
    // 既存モデルの削除
    disposeModel(currentModel);
    mixer = null;

    // Blob URLの生成
    const charUrl = URL.createObjectURL(charFile);
    const animUrl = URL.createObjectURL(animFile);

    try {
        // 並列ロード
        const [charGltf, animGltf] = await Promise.all([
            loader.loadAsync(charUrl),
            loader.loadAsync(animUrl)
        ]);

        // 1. キャラクターのセットアップ
        currentModel = charGltf.scene;
        currentModel.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // 2. アニメーションの適用
        // キャラクターモデルを対象にMixerを作成
        mixer = new THREE.AnimationMixer(currentModel);

        if (animGltf.animations && animGltf.animations.length > 0) {
            animGltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                action.play();
                console.log(`Applied Animation: ${clip.name}`);
            });
        } else {
            console.warn("アニメーションファイルにクリップが含まれていません");
        }

        scene.add(currentModel);
        fitCameraToModel(currentModel);

    } catch (error) {
        console.error("読み込みエラー:", error);
        alert("モデルの読み込みに失敗しました。");
    } finally {
        URL.revokeObjectURL(charUrl);
        URL.revokeObjectURL(animUrl);
    }
}

// --- イベント登録 ---
document.getElementById('loadBtn').addEventListener('click', () => {
    const charFile = document.getElementById('charInput').files[0];
    const animFile = document.getElementById('animInput').files[0];

    if (charFile && animFile) {
        loadCombinedPlayer(charFile, animFile);
    } else {
        alert("両方のファイルを選択してください。");
    }
});

// リサイズ対応
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (mixer) mixer.update(delta);

    controls.update();
    renderer.render(scene, camera);
}

animate();