// A world is the scenery a track runs through, as far as the physics is
// concerned: solid boxes and cylinders the cars can drive on top of or bump
// into, water that sinks them, and the edges of the play area.
// Units: cm. x runs east, z runs south, y is up; the ground is y = 0.
//
// World definition (see js/worlds/*.js):
//   { id, name, size: { x, z }, solids: [box(...) | cyl(...)], water: [...],
//     props: [...] (visual only), look: {...} (visual only), tracks: [...] }

const STEP_UP = 1.2; // a car can drive up a ledge this tall

// Helpers for world files.
export const box = (x0, y0, z0, x1, y1, z1, look = 'wood', extra = {}) => ({
  type: 'box', min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], look, ...extra,
});
export const cyl = (x, z, r, y0, y1, look = 'wood', extra = {}) => ({ type: 'cyl', x, z, r, y0, y1, look, ...extra });
// Water: rectangle { min: [x, z], max: [x, z] } or circle { x, z, r }.
export const pool = (x0, z0, x1, z1) => ({ min: [Math.min(x0, x1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(z0, z1)] });
export const pond = (x, z, r) => ({ x, z, r });

export class World {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.size = def.size;
    this.solids = def.solids || [];
    this.boxes = this.solids.filter((s) => s.type === 'box');
    this.cyls = this.solids.filter((s) => s.type === 'cyl');
    this.water = def.water || [];
  }

  // Height of the highest surface under (x, z) that is at or below `fromY`
  // (plus a small step), i.e. what a car at that height would rest on.
  groundHeight(x, z, fromY) {
    let best = 0;
    for (const b of this.boxes) {
      if (x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2]) continue;
      const top = b.max[1];
      if (top <= fromY + STEP_UP && top > best) best = top;
    }
    for (const c of this.cyls) {
      if ((x - c.x) ** 2 + (z - c.z) ** 2 > c.r * c.r) continue;
      if (c.y1 <= fromY + STEP_UP && c.y1 > best) best = c.y1;
    }
    return best;
  }

  waterAt(x, z) {
    for (const w of this.water) {
      if (w.r != null ? (x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r : x > w.min[0] && x < w.max[0] && z > w.min[1] && z < w.max[1]) return true;
    }
    return false;
  }

  // Push a car (circle of radius r at height y) out of the sides of solids
  // and the edges of the world. Returns the push normal (x, z) or null.
  pushOut(pos, r) {
    let hit = null;
    for (const b of this.boxes) {
      if (pos.y >= b.max[1] - STEP_UP || pos.y + 2 < b.min[1]) continue;
      const nx = Math.max(b.min[0], Math.min(pos.x, b.max[0]));
      const nz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
      let dx = pos.x - nx, dz = pos.z - nz;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-6) {
        // centre inside the footprint: leave by the nearest side
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
    for (const c of this.cyls) {
      if (pos.y >= c.y1 - STEP_UP || pos.y + 2 < c.y0) continue;
      let dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), need = c.r + r;
      if (d >= need) continue;
      if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      pos.x = c.x + dx * need;
      pos.z = c.z + dz * need;
      hit = { x: dx, z: dz };
    }
    const S = this.size;
    if (pos.x < r) { pos.x = r; hit = { x: 1, z: 0 }; }
    if (pos.x > S.x - r) { pos.x = S.x - r; hit = { x: -1, z: 0 }; }
    if (pos.z < r) { pos.z = r; hit = { x: 0, z: 1 }; }
    if (pos.z > S.z - r) { pos.z = S.z - r; hit = { x: 0, z: -1 }; }
    return hit;
  }

  // Is point p inside a solid (with a margin)? Used to keep cameras out of furniture.
  inside(p, m = 1) {
    for (const b of this.boxes) {
      if (p.x > b.min[0] - m && p.x < b.max[0] + m && p.y > b.min[1] - m && p.y < b.max[1] + m && p.z > b.min[2] - m && p.z < b.max[2] + m) return true;
    }
    for (const c of this.cyls) {
      if (p.y > c.y0 - m && p.y < c.y1 + m && (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < (c.r + m) ** 2) return true;
    }
    return false;
  }
}
