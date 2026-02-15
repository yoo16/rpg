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

let currentModel = null;
const clock = new THREE.Clock();

// --- 肝となる LoadingManager の設定 ---
const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

// ファイル名と実際の File オブジェクトを紐付けるマップ
const fileMap = new Map();

manager.setURLModifier((url) => {
    // 1. パスからファイル名だけを抽出 (例: "textures/chara_diffuse.png" -> "chara_diffuse.png")
    const fileName = url.split('/').pop();

    // 2. 選択されたファイルの中に一致するものがあれば、その Blob URL を返す
    const file = fileMap.get(fileName);
    if (file) {
        console.log(`🔗 マッピング成功: ${fileName}`);
        return URL.createObjectURL(file);
    }
    return url;
});

// カメラ調整用
function fitCamera(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    camera.position.set(center.x + dist, center.y + (maxDim / 2), center.z + dist);
    controls.target.copy(center);
    controls.update();
}

// --- メインイベント ---
document.getElementById('fileInput').addEventListener('change', (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // 前のモデルを削除
    if (currentModel) scene.remove(currentModel);
    fileMap.clear();

    // 1. 選択されたすべてのファイルをマップに登録
    files.forEach(file => {
        fileMap.set(file.name, file);
    });

    // 2. メインの .glb ファイルを特定
    const glbFile = files.find(f => f.name.endsWith('.glb'));
    if (!glbFile) {
        alert('.glb ファイルが含まれていません');
        return;
    }

    const rootUrl = URL.createObjectURL(glbFile);

    // 3. ロード開始 (managerが裏でテクスチャのパスを解決してくれる)
    loader.load(rootUrl, (gltf) => {
        currentModel = gltf.scene;

        currentModel.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;

                // テクスチャの向き（反転）問題が起きた場合の補正
                if (node.material.map) node.material.map.flipY = false;
            }
        });

        scene.add(currentModel);
        fitCamera(currentModel);
        URL.revokeObjectURL(rootUrl);
    });
});

// ループとリサイズ
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();