// The house the tracks run through: furniture as boxes the cars can drive on
// top of or bump into. This is a hand-made placeholder living room + kitchen
// until the real house is modelled from the walkthrough video.
// Units: cm. x runs east, z runs south, y is up; the floor is y = 0.

export const HOUSE = {
  size: { x: 900, z: 600, wallHeight: 260 },
  // Solid boxes: { name, min: [x, y, z], max: [x, y, z], kind }
  boxes: [
    // living room
    { name: 'coffee table top', min: [210, 38, 280], max: [330, 42, 360], kind: 'wood' },
    { name: 'coffee table leg', min: [212, 0, 282], max: [218, 38, 288], kind: 'wood' },
    { name: 'coffee table leg', min: [322, 0, 282], max: [328, 38, 288], kind: 'wood' },
    { name: 'coffee table leg', min: [212, 0, 352], max: [218, 38, 358], kind: 'wood' },
    { name: 'coffee table leg', min: [322, 0, 352], max: [328, 38, 358], kind: 'wood' },
    { name: 'sofa base', min: [140, 0, 478], max: [400, 42, 560], kind: 'fabric' },
    { name: 'sofa back', min: [140, 42, 535], max: [400, 88, 560], kind: 'fabric' },
    { name: 'sofa arm', min: [140, 42, 478], max: [162, 62, 535], kind: 'fabric' },
    { name: 'sofa arm', min: [378, 42, 478], max: [400, 62, 535], kind: 'fabric' },
    { name: 'tv stand', min: [180, 0, 8], max: [360, 55, 48], kind: 'wood' },
    { name: 'bookshelf', min: [0, 0, 110], max: [32, 185, 300], kind: 'wood' },
    { name: 'armchair', min: [440, 0, 300], max: [510, 40, 380], kind: 'fabric' },
    { name: 'armchair back', min: [490, 40, 300], max: [510, 85, 380], kind: 'fabric' },
    // kitchen
    { name: 'counter', min: [560, 0, 0], max: [900, 90, 62], kind: 'counter' },
    { name: 'fridge', min: [830, 0, 80], max: [900, 180, 160], kind: 'appliance' },
    { name: 'island', min: [620, 0, 240], max: [800, 90, 340], kind: 'counter' },
    { name: 'dining table top', min: [600, 71, 420], max: [770, 75, 520], kind: 'wood' },
    { name: 'dining table leg', min: [604, 0, 424], max: [610, 71, 430], kind: 'wood' },
    { name: 'dining table leg', min: [760, 0, 424], max: [766, 71, 430], kind: 'wood' },
    { name: 'dining table leg', min: [604, 0, 510], max: [610, 71, 516], kind: 'wood' },
    { name: 'dining table leg', min: [760, 0, 510], max: [766, 71, 516], kind: 'wood' },
  ],
  // Flat decorations with no collision (drawn by the renderer)
  rugs: [{ min: [110, 200], max: [430, 470], pattern: 'rug' }],
  kitchenFloor: { min: [540, 0], max: [900, 600] },
};

const STEP_UP = 1.2; // a car can drive up a ledge this tall

// Height of the highest surface under (x, z) that is at or below `fromY`
// (plus a small step), i.e. what a car at that height would rest on.
export function groundHeight(x, z, fromY) {
  let best = 0;
  for (const b of HOUSE.boxes) {
    if (x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2]) continue;
    const top = b.max[1];
    if (top <= fromY + STEP_UP && top > best) best = top;
  }
  return best;
}

// Push a car (circle of radius r at height y) out of furniture sides and the
// walls. Returns the push normal (x, z) if it hit something, else null.
export function pushOut(pos, r) {
  let hit = null;
  for (const b of HOUSE.boxes) {
    if (pos.y >= b.max[1] - STEP_UP || pos.y + 2 < b.min[1]) continue;
    const nx = Math.max(b.min[0], Math.min(pos.x, b.max[0]));
    const nz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
    let dx = pos.x - nx, dz = pos.z - nz;
    const d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 1e-6) {
      // centre inside the box footprint: leave by the nearest side
      const opts = [
        [pos.x - b.min[0], -1, 0], [b.max[0] - pos.x, 1, 0],
        [pos.z - b.min[2], 0, -1], [b.max[2] - pos.z, 0, 1],
      ].sort((a, c) => a[0] - c[0]);
      dx = opts[0][1]; dz = opts[0][2];
      pos.x += dx * (opts[0][0] + r);
      pos.z += dz * (opts[0][0] + r);
    } else {
      dx /= d; dz /= d;
      pos.x += dx * (r - d);
      pos.z += dz * (r - d);
    }
    hit = { x: dx, z: dz };
  }
  const S = HOUSE.size;
  if (pos.x < r) { pos.x = r; hit = { x: 1, z: 0 }; }
  if (pos.x > S.x - r) { pos.x = S.x - r; hit = { x: -1, z: 0 }; }
  if (pos.z < r) { pos.z = r; hit = { x: 0, z: 1 }; }
  if (pos.z > S.z - r) { pos.z = S.z - r; hit = { x: 0, z: -1 }; }
  return hit;
}
