// Chassis modeling
// Use a full-width, closed 2D profile so ExtrudeGeometry generates a watertight body
// without relying on mirrored duplication.
const shapePoints = [
  new THREE.Vector2(-1.25, -0.55), // left-bottom
  new THREE.Vector2(-1.05, 0.15),  // left-mid
  new THREE.Vector2(-0.55, 0.62),  // left-top shoulder
  new THREE.Vector2(0.0, 0.74),    // center-top crown
  new THREE.Vector2(0.55, 0.62),   // right-top shoulder
  new THREE.Vector2(1.05, 0.15),   // right-mid
  new THREE.Vector2(1.25, -0.55),  // right-bottom
  new THREE.Vector2(0.0, -0.62),   // center-bottom
];

// Points are ordered counter-clockwise around the profile perimeter.
// THREE.Shape(shapePoints) will close the loop automatically between the last and first points.
const chassisShape = new THREE.Shape(shapePoints);

// Validation tip (wireframe):
// renderer or material should show one continuous full-width silhouette on X- (left)
// and X+ (right), with no center seam and no mirrored clone required.
// Example temporary debug material:
// const chassisMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, wireframe: true });

// Animation / rendering workflow:
// - Interactive mode (raster): smooth OrbitControls movement + full wheel animation.
// - Converge mode (path tracing): wheel animation is frozen (or heavily damped) so samples can accumulate.
let usePathTracing = true;
let isUserInteracting = false;
let lastInteractionTime = 0;

const INTERACTION_SETTLE_MS = 200;
const WHEEL_SPIN_SPEED = 2.0;
const WHEEL_SPIN_DAMPING_IN_CONVERGE = 0.02;

function resetPathTracingAccumulation() {
  pathTracingRenderer?.reset();
}

function setInteractiveRasterMode() {
  usePathTracing = false;
}

function setConvergePathTracingMode() {
  usePathTracing = true;
  resetPathTracingAccumulation();
}

controls.addEventListener('start', () => {
  isUserInteracting = true;
  setInteractiveRasterMode();
  resetPathTracingAccumulation();
});

controls.addEventListener('change', () => {
  lastInteractionTime = performance.now();
  resetPathTracingAccumulation();
});

controls.addEventListener('end', () => {
  isUserInteracting = false;
  lastInteractionTime = performance.now();
  // Keep raster for a short settle period; path tracing resumes in animate().
});

function animate(nowMs) {
  requestAnimationFrame(animate);

  const elapsedSinceInteraction = nowMs - lastInteractionTime;
  const shouldConverge = !isUserInteracting && elapsedSinceInteraction > INTERACTION_SETTLE_MS;
  if (shouldConverge) {
    setConvergePathTracingMode();
  }

  const inInteractiveMode = !usePathTracing;
  const wheelSpinFactor = inInteractiveMode ? 1.0 : WHEEL_SPIN_DAMPING_IN_CONVERGE;

  // Wheel rotation code should run at full speed while interacting.
  // During path-tracing convergence, freeze it (0.0) or damp it heavily (e.g. 0.02).
  const wheelSpinDelta = deltaTime * WHEEL_SPIN_SPEED * wheelSpinFactor;
  for (const wheel of wheels) {
    wheel.rotation.x -= wheelSpinDelta;
  }

  controls.update();

  if (usePathTracing) {
    // Converge mode: no camera motion + minimal scene animation = clean accumulation.
    pathTracingRenderer.update();
    renderer.copyTextureToTexture(pathTracingRenderer.target.texture, screenTexture);
  } else {
    // Interactive mode: render immediately for smooth camera movement.
    renderer.render(scene, camera);
  }
}
