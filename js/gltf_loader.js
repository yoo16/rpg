import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- シーン構築 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 2000);
camera.position.set(2, 2, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.GridHelper(10, 10, 0x555555, 0x333333));
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(5, 10, 5);
light.castShadow = true;
scene.add(light);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 変数管理 ---
let currentWrapper = null;
let mixer = null;
const clock = new THREE.Clock();
const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

// --- 補助関数 ---
function setupResourceMapping(files) {
    const fileMap = new Map();
    files.forEach(file => fileMap.set(file.name, file));
    manager.setURLModifier((url) => {
        const fileName = url.split('/').pop();
        const file = fileMap.get(fileName);
        if (file) return URL.createObjectURL(file);
        return url;
    });
}

function fitCamera(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    camera.position.set(center.x + cameraDistance, center.y + (maxDim / 2), center.z + cameraDistance);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

// --- イベントリスナー ---
document.getElementById('fileInput').addEventListener('change', (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (currentWrapper) scene.remove(currentWrapper);
    mixer = null;

    setupResourceMapping(files);

    const rootFile = files.find(f => f.name.endsWith('.gltf') || f.name.endsWith('.glb'));
    if (!rootFile) {
        alert('.gltf または .glb ファイルが見つかりません');
        return;
    }

    const rootUrl = URL.createObjectURL(rootFile);
    loader.load(rootUrl, (gltf) => {
        const model = gltf.scene;

        // 影の設定
        model.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        currentWrapper = new THREE.Group();
        currentWrapper.add(model);

        // Z-up対策の回転
        currentWrapper.rotation.x = -Math.PI / 2;

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            mixer.clipAction(gltf.animations[0]).play();
        }

        scene.add(currentWrapper);
        fitCamera(currentWrapper);
        URL.revokeObjectURL(rootUrl);
    });
});

// --- リサイズ・アニメーション（イベントの外に出す） ---
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