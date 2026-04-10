import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import {
  PathTracingRenderer,
  PhysicalPathTracingMaterial,
  PathTracingSceneGenerator,
} from 'three-gpu-pathtracer';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Scene essentials
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 2.2, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  pathTracingRenderer.setSize(window.innerWidth, window.innerHeight);
  pathTracingRenderer.reset();
});

// Controls: create/configure before listeners
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.8, 0);
controls.update();

// Lighting and environment
const hemi = new THREE.HemisphereLight(0xffffff, 0x1f2937, 0.6);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.5);
dir.position.set(4, 8, 2);
scene.add(dir);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().setDataType(THREE.FloatType).load(
  'textures/studio.hdr',
  (hdrTexture) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
    scene.environment = envMap;
    scene.background = envMap;
    hdrTexture.dispose();
    pmremGenerator.dispose();
  },
  undefined,
  () => {
    // Graceful fallback if HDR asset is unavailable.
    pmremGenerator.dispose();
  },
);

// Car body
const body = new THREE.Mesh(
  new THREE.BoxGeometry(2.6, 0.7, 4.6),
  new THREE.MeshStandardMaterial({ color: 0xc1121f, metalness: 0.7, roughness: 0.2 }),
);
body.position.y = 0.9;
scene.add(body);

// Wheels stored locally for animate()
const wheelGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 24);
wheelGeometry.rotateZ(Math.PI * 0.5);
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

const wheelOffsets = [
  [-1.1, 0.45, 1.45],
  [1.1, 0.45, 1.45],
  [-1.1, 0.45, -1.45],
  [1.1, 0.45, -1.45],
];

const wheels = wheelOffsets.map(([x, y, z]) => {
  const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheel.position.set(x, y, z);
  scene.add(wheel);
  return wheel;
});

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.95, metalness: 0.0 }),
);
ground.rotation.x = -Math.PI * 0.5;
ground.position.y = 0;
scene.add(ground);

// Path tracing setup
const pathTracingRenderer = new PathTracingRenderer(renderer);
pathTracingRenderer.setSize(window.innerWidth, window.innerHeight);
pathTracingRenderer.camera = camera;

const pathTracingMaterial = new PhysicalPathTracingMaterial();
const sceneGenerator = new PathTracingSceneGenerator();
const { bvh, textures, materials, lights } = sceneGenerator.generate(scene);
pathTracingMaterial.bvh.updateFrom(bvh);
pathTracingMaterial.textures.setTextures(renderer, 2048, 2048, textures);
pathTracingMaterial.materials.updateFrom(materials, textures);
pathTracingMaterial.lights.updateFrom(lights);
pathTracingRenderer.material = pathTracingMaterial;

// Render path-traced texture directly (no copy-to-texture path)
const fsQuad = new FullScreenQuad(
  new THREE.MeshBasicMaterial({ map: pathTracingRenderer.target.texture }),
);

let usePathTracing = true;
let isUserInteracting = false;
let lastInteractionTime = performance.now();

const INTERACTION_SETTLE_MS = 200;
const WHEEL_SPIN_SPEED = 4.5;
const WHEEL_SPIN_DAMPING_IN_CONVERGE = 0.02;

function resetPathTracingAccumulation() {
  pathTracingRenderer.reset();
}

controls.addEventListener('start', () => {
  isUserInteracting = true;
  usePathTracing = false;
  resetPathTracingAccumulation();
});

controls.addEventListener('change', () => {
  lastInteractionTime = performance.now();
  resetPathTracingAccumulation();
});

controls.addEventListener('end', () => {
  isUserInteracting = false;
  lastInteractionTime = performance.now();
});

let lastFrameTime = performance.now();

function animate(nowMs) {
  requestAnimationFrame(animate);

  const deltaTime = (nowMs - lastFrameTime) / 1000;
  lastFrameTime = nowMs;

  const elapsedSinceInteraction = nowMs - lastInteractionTime;
  const shouldConverge = !isUserInteracting && elapsedSinceInteraction > INTERACTION_SETTLE_MS;

  if (shouldConverge && !usePathTracing) {
    usePathTracing = true;
    resetPathTracingAccumulation();
  }

  const wheelSpinFactor = usePathTracing ? WHEEL_SPIN_DAMPING_IN_CONVERGE : 1.0;
  const wheelSpinDelta = deltaTime * WHEEL_SPIN_SPEED * wheelSpinFactor;

  for (const wheel of wheels) {
    wheel.rotation.x -= wheelSpinDelta;
  }

  controls.update();

  if (usePathTracing) {
    pathTracingRenderer.update();
    fsQuad.render(renderer);
  } else {
    renderer.render(scene, camera);
  }
}

// Invoke once after setup
animate(performance.now());
