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
