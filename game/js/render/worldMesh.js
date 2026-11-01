// Builds a world in 3D: room or sky, ground, the solid furniture/scenery
// (drawn from the same boxes and cylinders the physics uses), props, lights.
import * as THREE from '../vendor/three.module.min.js';
import { B, C, K, PROPS, S, pineTree } from './props.js';
import * as TX from './textures.js';
import { flat, mergeStatic, toon } from './toon.js';

const RAD = Math.PI / 180;

const tex = (t, ru, rv) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.repeat.set(ru, rv);
  return c;
};

// ---- solids ---------------------------------------------------------------------
function boxDims(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  return { w: x1 - x0, h: y1 - y0, d: z1 - z0, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, x0, y0, z0, x1, y1, z1 };
}

const SOLID = {
  wood: (b) => { const q = boxDims(b); return B(q.w, q.h, q.d, '#c98a4b', q.x, q.y, q.z, { r: Math.min(1.5, q.h / 3) }); },
  darkwood: (b) => { const q = boxDims(b); return B(q.w, q.h, q.d, '#8a5530', q.x, q.y, q.z, { r: 1.5 }); },
  sofa: (b) => { const q = boxDims(b); return B(q.w, q.h, q.d, '#d9534f', q.x, q.y, q.z, { r: Math.min(6, q.h / 2.5) }); },
  armchair: (b) => { const q = boxDims(b); return B(q.w, q.h, q.d, '#4f9fd9', q.x, q.y, q.z, { r: Math.min(6, q.h / 2.5) }); },
  stone: (b) => { const q = boxDims(b); return B(q.w, q.h, q.d, toon(null, { map: tex(TX.stone(), q.w / 60, q.h / 60) }), q.x, q.y, q.z); },
  steel: (b) => { const q = boxDims(b); return B(q.w, q.h, q.d, '#b8c2cc', q.x, q.y, q.z); },
  bookshelf: (b) => bookshelf(boxDims(b)),
  counter: (b) => counter(boxDims(b)),
  fridge: (b) => {
    const q = boxDims(b);
    const g = new THREE.Group();
    g.add(B(q.w, q.h, q.d, '#bfe8e0', q.x, q.y, q.z, { r: 6 }));
    g.add(B(q.w + 0.5, 1.2, q.d * 0.96, '#8fc7bc', q.x, q.y0 + q.h * 0.62, q.z, { outline: false }));
    g.add(B(3, 30, 3, '#e6e6e6', q.x0 - 2, q.y0 + q.h * 0.78, q.z1 - 12), B(3, 40, 3, '#e6e6e6', q.x0 - 2, q.y0 + q.h * 0.4, q.z1 - 12));
    g.add(S(5, '#ff6fae', q.x0 - 1, q.y0 + q.h * 0.88, q.z0 + 30, 0.3, 1, 1), S(4, '#ffd34d', q.x0 - 1, q.y0 + q.h * 0.82, q.z0 + 48, 0.3, 1, 1));
    return g;
  },
  stool: (c) => {
    const g = new THREE.Group();
    g.add(C(c.r, c.r * 1.4, c.y1 - c.y0, '#8a8f96', c.x, (c.y0 + c.y1) / 2, c.z, { seg: 10 }));
    g.add(C(14, 13, 6, '#e8473b', c.x, c.y1 + 3, c.z, { seg: 20 }));
    g.add(C(12, 12, 1.5, '#8a8f96', c.x, c.y0 + 1, c.z, { seg: 20 }));
    return g;
  },
  lampPole: (c) => C(1.6, 1.6, c.y1 - c.y0, '#2b1c18', c.x, (c.y0 + c.y1) / 2, c.z, { seg: 8 }),
  deck: (b) => planked(boxDims(b), '#d39b62', '#8a5530'),
  plank: (b) => planked(boxDims(b), '#e0b07a', '#9a6438'),
  dock: (b) => {
    const q = boxDims(b);
    const g = new THREE.Group();
    const top = planked({ ...q, y0: q.y1 - 4, h: 4, y: q.y1 - 2 }, '#c9a06a', '#7a5532', true);
    g.add(top);
    g.add(B(q.w, 6, 4, '#8a5f3a', q.x, q.y1 - 7, q.z0 + 2), B(q.w, 6, 4, '#8a5f3a', q.x, q.y1 - 7, q.z1 - 2));
    return g;
  },
  sand: (b) => { const q = boxDims(b); return B(q.w, q.h, q.d, toon(null, { map: tex(TX.sand(), q.w / 60, q.d / 60) }), q.x, q.y, q.z, { outline: false }); },
  planter: (b) => {
    const q = boxDims(b);
    const g = planked(q, '#b8763f', '#7a4423');
    g.add(B(q.w - 8, 1, q.d - 8, toon(null, { map: tex(TX.soil(), q.w / 60, q.d / 60) }), q.x, q.y1 + 0.3, q.z, { outline: false }));
    return g;
  },
  bark: (c) => {
    const g = new THREE.Group();
    g.add(C(c.r * 0.82, c.r, c.y1 - c.y0, toon(null, { map: tex(TX.bark(), 3, (c.y1 - c.y0) / 120) }), c.x, (c.y0 + c.y1) / 2, c.z, { seg: 14 }));
    for (let k = 0; k < 5; k++) {
      const a = k * 1.26;
      const root = S(c.r * 0.45, '#7a4b2a', c.x + Math.cos(a) * c.r * 0.85, 2, c.z + Math.sin(a) * c.r * 0.85, 1.4, 0.5, 1);
      root.rotation.y = -a;
      g.add(root);
    }
    return g;
  },
  pine: (c) => pineTree(c.x, c.z, c.y1, c.r),
  rock: (c) => {
    const m = S(1, '#9aa0a6', c.x, c.y0 + (c.y1 - c.y0) * 0.35, c.z, c.r * 1.08, (c.y1 - c.y0) * 0.75, c.r * 0.95, { seg: 7, rings: 5 });
    m.material = toon('#9aa0a6');
    m.geometry = new THREE.DodecahedronGeometry(1, 0);
    m.rotation.y = c.x;
    return m;
  },
  gnome: (c) => {
    const g = new THREE.Group();
    const s = (c.y1 - c.y0) / 44;
    g.add(C(8 * s, 10 * s, 18 * s, '#2f86c9', c.x, 9 * s, c.z));
    g.add(S(6 * s, '#ffd2b0', c.x, 22 * s, c.z));
    g.add(K(8 * s, 12 * s, '#ffffff', c.x, 17 * s, c.z + 4 * s, { seg: 10 }));
    g.add(K(7 * s, 18 * s, '#e8473b', c.x, 34 * s, c.z));
    g.add(S(2 * s, '#ff9a8a', c.x, 22 * s, c.z + 6 * s));
    return g;
  },
  pot: (c) => {
    const g = new THREE.Group();
    g.add(C(c.r, c.r * 0.75, c.y1 - c.y0, '#d0673a', c.x, (c.y0 + c.y1) / 2, c.z));
    g.add(C(c.r * 1.08, c.r * 1.08, 4, '#b4542c', c.x, c.y1 - 2, c.z));
    g.add(C(c.r * 0.9, c.r * 0.9, 0.6, '#6b4226', c.x, c.y1 - 1, c.z, { outline: false }));
    return g;
  },
  sandcastle: (c) => {
    const g = new THREE.Group();
    const h = c.y1 - c.y0, col = '#e9c47a';
    g.add(C(c.r, c.r * 1.1, h * 0.55, col, c.x, c.y0 + h * 0.275, c.z, { seg: 12 }));
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      g.add(C(c.r * 0.3, c.r * 0.35, h * 0.85, col, c.x + Math.cos(a) * c.r * 0.75, c.y0 + h * 0.42, c.z + Math.sin(a) * c.r * 0.75, { seg: 8 }));
      g.add(K(c.r * 0.34, h * 0.3, col, c.x + Math.cos(a) * c.r * 0.75, c.y0 + h * 0.98, c.z + Math.sin(a) * c.r * 0.75, { seg: 8 }));
    }
    g.add(B(1, 8, 5, '#e8473b', c.x + 0.5, c.y1 + 10, c.z + 3, { outline: false }), C(0.4, 0.4, 16, '#555', c.x, c.y1 + 6, c.z, { seg: 4 }));
    return g;
  },
  campfire: (c) => {
    const g = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const m = S(1, '#8f8a84', c.x + Math.cos(a) * c.r * 0.85, 3, c.z + Math.sin(a) * c.r * 0.85, 5, 4, 5);
      m.geometry = new THREE.DodecahedronGeometry(1, 0);
      g.add(m);
    }
    return g;
  },
};

function planked(q, base, seam, along = false) {
  const t = TX.planks(base, seam, 6, 9).clone();
  t.needsUpdate = true;
  // boards run the long way
  const longX = q.w >= q.d;
  t.repeat.set(longX ? q.w / 120 : q.d / 120, longX ? q.d / 60 : q.w / 60);
  if (!longX) t.rotation = Math.PI / 2;
  const g = new THREE.Group();
  g.add(B(q.w, q.h, q.d, toon(null, { map: t }), q.x, q.y, q.z));
  return g;
}

function bookshelf(q) {
  const g = new THREE.Group();
  const col = '#8a5530';
  // back, sides, top and shelves (open at the front, which faces +x)
  g.add(B(3, q.h, q.d, col, q.x0 + 1.5, q.y, q.z));
  g.add(B(q.w, q.h, 3, col, q.x, q.y, q.z0 + 1.5), B(q.w, q.h, 3, col, q.x, q.y, q.z1 - 1.5));
  g.add(B(q.w, 3, q.d, col, q.x, q.y1 - 1.5, q.z));
  const shelves = 5, gap = (q.h - 6) / shelves;
  const colors = ['#e8473b', '#2f86c9', '#ffd34d', '#3fae3a', '#b06cff', '#ff9a3c', '#ffffff'];
  let k = 0;
  for (let i = 0; i < shelves; i++) {
    const y = q.y0 + i * gap;
    g.add(B(q.w, 3, q.d - 6, col, q.x, y + 1.5, q.z));
    let z = q.z0 + 5;
    while (z < q.z1 - 12) {
      const w = 4 + (k % 3) * 1.5, h = gap * (0.55 + ((k * 7) % 5) * 0.07);
      if ((k * 5) % 11 !== 3) g.add(B(q.w - 8, h, w, colors[k % colors.length], q.x0 + 3 + (q.w - 8) / 2, y + 3 + h / 2, z + w / 2, { r: 0.6 }));
      z += w + 0.6;
      k++;
    }
  }
  return g;
}

function counter(q) {
  const g = new THREE.Group();
  g.add(B(q.w, q.h - 5, q.d, '#fff3dc', q.x, q.y0 + (q.h - 5) / 2, q.z, { r: 1.5 }));
  g.add(B(q.w + 4, 5, q.d + 4, '#c98a4b', q.x, q.y1 - 2.5, q.z, { r: 1.5 }));
  g.add(B(q.w + 0.5, 8, q.d + 0.5, '#5a3418', q.x, q.y0 + 4, q.z, { outline: false }));
  // cabinet doors with round knobs on the long faces
  const faces = q.w >= q.d ? [[q.z1, 1], [q.z0, -1]] : [];
  for (const [zf, s] of faces) {
    for (let x = q.x0 + 30; x < q.x1 - 10; x += 45) {
      g.add(B(1.2, q.h - 22, 1, '#d8c9ad', x + 15, q.y0 + (q.h - 5) / 2 + 2, zf + s * 0.6, { outline: false }));
      g.add(S(2.2, '#ffd34d', x + 8, q.y1 - 22, zf + s * 1.5));
    }
  }
  return g;
}

// ---- ground, room and sky ----------------------------------------------------
function room(world, g) {
  const L = world.look, S2 = world.size, H = L.wallHeight;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(S2.x, S2.z), toon(null, { map: tex(TX.planks('#d79b5e', '#8a5530'), S2.x / 160, S2.z / 160) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(S2.x / 2, 0, S2.z / 2);
  floor.receiveShadow = true;
  floor.userData.outline = false;
  g.add(floor);
  const wallMat = (w) => toon(null, { map: tex(TX.logs(), w / 160, H / 95) });
  const wall = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat(w));
    m.position.set(x, H / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    m.userData.outline = false;
    g.add(m);
  };
  wall(S2.x, S2.x / 2, 0, 0);
  wall(S2.x, S2.x / 2, S2.z, Math.PI);
  wall(S2.z, 0, S2.z / 2, Math.PI / 2);
  wall(S2.z, S2.x, S2.z / 2, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(S2.x, S2.z), toon(null, { map: tex(TX.planks('#e9c08e', '#a8774a'), S2.x / 200, S2.z / 200) }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(S2.x / 2, H, S2.z / 2);
  ceil.userData.outline = false;
  g.add(ceil);
  for (const [x, z] of [[0, 0], [S2.x, 0], [0, S2.z], [S2.x, S2.z]]) g.add(C(14, 14, H, '#9c5f34', x, H / 2, z, { seg: 12 }));
}

function outdoors(world, g, scene) {
  const L = world.look, S2 = world.size;
  const R = 9000;
  // sky dome: gradient from top colour to horizon colour
  const sky = new THREE.SphereGeometry(R, 32, 16);
  const top = new THREE.Color(L.sky[0]), hor = new THREE.Color(L.sky[1]);
  const cols = [];
  const p = sky.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, p.getY(i) / (R * 0.5)));
    const c = hor.clone().lerp(top, Math.pow(t, 0.7));
    cols.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const dome = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.position.set(S2.x / 2, 0, S2.z / 2);
  dome.userData.dynamic = true;
  dome.renderOrder = -1;
  g.add(dome);
  // cartoon sun
  const sunDir = new THREE.Vector3(...L.sun.pos).sub(new THREE.Vector3(...L.sun.target)).normalize();
  const sun = new THREE.Mesh(new THREE.CircleGeometry(380, 32), new THREE.MeshBasicMaterial({ color: '#fff3b0', fog: false }));
  sun.position.copy(sunDir.clone().multiplyScalar(R * 0.9)).add(new THREE.Vector3(S2.x / 2, 0, S2.z / 2));
  sun.lookAt(S2.x / 2, 0, S2.z / 2);
  sun.userData.dynamic = true;
  g.add(sun);

  // ground
  const groundSize = 16000;
  if (L.ground === 'shore') {
    const land = new THREE.Mesh(new THREE.PlaneGeometry(groundSize / 2, groundSize), toon(null, { map: tex(TX.grass(), groundSize / 2 / 160, groundSize / 160) }));
    land.rotation.x = -Math.PI / 2;
    land.position.set(L.shoreX - 90 - groundSize / 4, 0, S2.z / 2);
    land.receiveShadow = true;
    land.userData.outline = false;
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(110, groundSize), toon(null, { map: tex(TX.sand('#f0d9a0'), 110 / 80, groundSize / 80) }));
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(L.shoreX - 35, 0.05, S2.z / 2);
    beach.receiveShadow = true;
    beach.userData.outline = false;
    g.add(land, beach);
  } else {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), toon(null, { map: tex(TX.grass(), groundSize / 160, groundSize / 160) }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(S2.x / 2, 0, S2.z / 2);
    grass.receiveShadow = true;
    grass.userData.outline = false;
    g.add(grass);
  }
  scene.fog = L.fog ? new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]) : null;
}

// ---- lights -----------------------------------------------------------------------
function lights(world) {
  const L = world.look, S2 = world.size;
  const g = new THREE.Group();
  const [sky, ground, hi] = L.hemi;
  g.add(new THREE.HemisphereLight(sky, ground, hi));
  const sun = new THREE.DirectionalLight(L.sun.color, L.sun.power);
  sun.position.set(...L.sun.pos);
  sun.target.position.set(...L.sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const span = Math.max(S2.x, S2.z) * 0.62;
  const c = sun.shadow.camera;
  c.left = -span; c.right = span; c.top = span; c.bottom = -span;
  c.near = 10;
  c.far = 4000;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.5;
  g.add(sun, sun.target);
  return g;
}

// ---- assembly ---------------------------------------------------------------------
// Builds the world for a track (props avoid the track). Returns
// { group, update(time, dt) }. Sets scene.background / scene.fog.
export function buildWorld(track, scene) {
  const world = track.world;
  const def = world.def;
  const raw = new THREE.Group();
  const ctx = { world: { ...def, size: world.size, look: def.look }, anim: [], blocked: blocker(track) };
  if (def.look.indoor) {
    room(def, raw);
    scene.background = new THREE.Color(def.look.sky || '#ffd9a8');
    scene.fog = null;
  } else {
    outdoors(def, raw, scene);
    scene.background = new THREE.Color(def.look.sky[1]);
  }
  for (const s of world.solids) {
    if (s.hidden) continue;
    const make = SOLID[s.look] || (s.type === 'box' ? SOLID.wood : SOLID.bark);
    raw.add(make(s));
  }
  const clouds = [], bobbers = [];
  for (const q of def.props || []) {
    const make = PROPS[q.p];
    if (!make) { console.warn('unknown prop', q.p); continue; }
    const obj = make(q, ctx);
    if (obj.userData.cloudLayer) { clouds.push(obj); continue; }
    if (obj.userData.bob) { obj.userData.dynamic = true; bobbers.push(obj); }
    raw.add(obj);
  }
  const group = mergeStatic(raw);
  for (const c of clouds) {
    const layer = mergeStatic(c);
    layer.userData.dynamic = true;
    group.add(layer);
    const cx = world.size.x / 2, cz = world.size.z / 2;
    ctx.anim.push((t) => {
      layer.position.set(cx, 0, cz);
      layer.rotation.y = t * 0.004;
      layer.position.sub(new THREE.Vector3(cx, 0, cz).applyAxisAngle(new THREE.Vector3(0, 1, 0), t * 0.004));
    });
  }
  bobbers.forEach((b, i) => {
    const y0 = b.position.y;
    ctx.anim.push((t) => {
      b.position.y = y0 + Math.sin(t * 1.6 + i * 2) * 0.8;
      b.rotation.z = Math.sin(t * 1.1 + i) * 0.04;
    });
  });
  group.add(lights(def));
  return {
    group,
    update(t, dt) { for (const f of ctx.anim) f(t, dt); },
  };
}

// Quick "is (x, z) on or near the track or a solid?" test for scattering
// grass, flowers and pebbles.
function blocker(track) {
  const cell = 10;
  const grid = new Set();
  for (const s of track.samples) {
    const r = s.w / 2 + 4;
    for (let dx = -r; dx <= r; dx += cell / 2) {
      const x = s.p.x + s.r.x * dx, z = s.p.z + s.r.z * dx;
      grid.add(`${Math.floor(x / cell)},${Math.floor(z / cell)}`);
    }
  }
  const W = track.world;
  return (x, z, m = 0) => {
    for (const dx of [-m, 0, m]) for (const dz of [-m, 0, m]) if (grid.has(`${Math.floor((x + dx) / cell)},${Math.floor((z + dz) / cell)}`)) return true;
    if (W.groundHeight(x, z, 1000) > 0.5) return true;
    if (W.waterAt(x, z) && !(W.def.look && W.def.look.ground === 'shore')) return true;
    for (const c of W.cyls) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + m) ** 2) return true;
    return false;
  };
}
