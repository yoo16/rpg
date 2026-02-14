import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'; // FBX用
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- シーン構築 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 2000);
camera.position.set(2, 2, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.GridHelper(10, 10, 0x555555, 0x333333));
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(5, 10, 5);
light.castShadow = true;
scene.add(light);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 変数管理 ---
let currentFBX = null;
let mixer = null;
const clock = new THREE.Clock();
const loader = new FBXLoader(); // FBXLoader インスタンス

/**
 * カメラ位置の自動調整
 */
function fitCamera(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    camera.position.set(center.x + dist, center.y + (maxDim / 2), center.z + dist);
    controls.target.copy(center);
    controls.update();
}

// --- イベントリスナー ---
document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 前のモデルを削除
    if (currentFBX) scene.remove(currentFBX);
    mixer = null;

    const url = URL.createObjectURL(file);

    // FBXのロード
    loader.load(url, (object) => {
        currentFBX = object;

        // 影の設定とスケーリング調整
        // FBXはサイズ単位が違うことが多いので、必要なら scale.set(0.01, 0.01, 0.01) などにします
        currentFBX.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // FBXのアニメーション再生
        // glTFと違い、object.animations に直接配列が入っています
        if (object.animations && object.animations.length > 0) {
            mixer = new THREE.AnimationMixer(object);
            const action = mixer.clipAction(object.animations[0]);
            action.play();
        }

        scene.add(currentFBX);
        fitCamera(currentFBX);
        URL.revokeObjectURL(url);
    },
        (xhr) => console.log((xhr.loaded / xhr.total * 100) + '% loaded'),
        (err) => console.error('FBX読込エラー:', err));
});

// リサイズ・アニメーション
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
}
animate();