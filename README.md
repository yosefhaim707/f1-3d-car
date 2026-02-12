# f1-3d-car

## Setup

Choose one build style and include `RGBELoader` accordingly.

### Option A: Script tags (non-module)

Make sure the loader script is included **before** `main.js`:

```html
<script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
<script src="https://unpkg.com/three@0.160.0/examples/js/loaders/RGBELoader.js"></script>
<script src="./main.js"></script>
```

### Option B: ES modules

Import `RGBELoader` from examples/addons (path depends on Three.js version):

```js
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
// or: import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
```

## HDR environment + PMREM

Keep the PMREM pipeline unchanged and instantiate the loader using the imported symbol in module builds:

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

> If you are using non-module script tags, use `new THREE.RGBELoader()` in that variant.
