# f1-3d-car

## Setup (ES modules, recommended)

Use one ES module-based integration path so `three`, `three-gpu-pathtracer`, and `three-mesh-bvh` stay API-compatible.

```bash
npm install three@0.160.0 three-gpu-pathtracer@0.0.17 three-mesh-bvh@0.7.6
```

Import classes directly from `three-gpu-pathtracer` (instead of `THREE.PathTracingRenderer` / `THREE.PhysicalPathTracingMaterial`) and initialize `three-mesh-bvh` prototype hooks before generating path tracing data:

```js
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
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
```

## Path tracer initialization

Use imported classes directly:

```js
const pathTracingRenderer = new PathTracingRenderer(renderer);
const pathTracingMaterial = new PhysicalPathTracingMaterial();
const sceneGenerator = new PathTracingSceneGenerator();

const { bvh, textures, materials, lights } = sceneGenerator.generate(scene);

pathTracingMaterial.bvh.updateFrom(bvh);
pathTracingMaterial.textures.setTextures(renderer, 2048, 2048, textures);
pathTracingMaterial.materials.updateFrom(materials, textures);
pathTracingMaterial.lights.updateFrom(lights);

pathTracingRenderer.material = pathTracingMaterial;
```

## HDR environment + PMREM

Keep the PMREM pipeline unchanged and instantiate `RGBELoader` from the ES module import:

```js
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader()
  .setDataType(THREE.FloatType)
  .load('textures/studio.hdr', (hdrTexture) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

    scene.environment = envMap;
    scene.background = envMap;

    hdrTexture.dispose();
    pmremGenerator.dispose();
  });
```

## Compatibility note

To avoid API drift between examples and runtime behavior, keep these versions pinned together:

- `three@0.160.0`
- `three-gpu-pathtracer@0.0.17`
- `three-mesh-bvh@0.7.6`

## Recommended interaction workflow (raster + path tracing)

For responsive camera controls and clean final convergence, run in two modes:

- **Interactive mode (raster)** while OrbitControls is active (`start` / `change`):
  keep camera movement and wheel animation enabled, and render with rasterization.
- **Converge mode (path tracing)** after interaction ends (`end` + short settle delay):
  freeze or heavily damp wheel animation, switch back to path tracing, and accumulate samples.

```js
let usePathTracing = true;
let isUserInteracting = false;
let lastInteractionTime = 0;

const INTERACTION_SETTLE_MS = 200;

controls.addEventListener('start', () => {
  isUserInteracting = true;
  usePathTracing = false;      // fallback to raster during active movement
  pathTracingRenderer.reset(); // reset accumulation when camera changes
});

controls.addEventListener('change', () => {
  lastInteractionTime = performance.now();
  pathTracingRenderer.reset();
});

controls.addEventListener('end', () => {
  isUserInteracting = false;
  lastInteractionTime = performance.now();
});

function animate(nowMs) {
  requestAnimationFrame(animate);

  const shouldConverge =
    !isUserInteracting &&
    nowMs - lastInteractionTime > INTERACTION_SETTLE_MS;

  if (shouldConverge && !usePathTracing) {
    usePathTracing = true;
    pathTracingRenderer.reset();
  }

  const wheelSpinFactor = usePathTracing ? 0.02 : 1.0;
  // ... wheel rotation *= wheelSpinFactor

  if (usePathTracing) {
    pathTracingRenderer.update();
  } else {
    renderer.render(scene, camera);
  }
}
```

This pattern gives users smooth interaction while moving the camera and a stable, low-noise path-traced image once input stops.
