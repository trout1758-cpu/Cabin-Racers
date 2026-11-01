// Cartoon scenery pieces ("props") built from simple shapes. Each builder
// takes the prop's settings from the world file and returns an Object3D in
// world coordinates. Anything animated registers itself in ctx.anim.
import * as THREE from '../vendor/three.module.min.js';
import * as TX from './textures.js';
import { addOutline, flat, mesh, roundedBox, toon } from './toon.js';

const RAD = Math.PI / 180;

// ---- primitives -------------------------------------------------------------
export function B(w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
  const geo = o.r ? roundedBox(w, h, d, o.r) : new THREE.BoxGeometry(w, h, d);
  const m = mesh(geo, typeof color === 'string' ? toon(color, o.mat) : color, o);
  m.position.set(x, y, z);
  return m;
}
export function C(rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) {
  const m = mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 16), typeof color === 'string' ? toon(color, o.mat) : color, o);
  m.position.set(x, y, z);
  return m;
}
export function S(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o = {}) {
  const m = mesh(new THREE.SphereGeometry(r, o.seg || 16, o.rings || 12), typeof color === 'string' ? toon(color, o.mat) : color, o);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
export function K(r, h, color, x = 0, y = 0, z = 0, o = {}) {
  const m = mesh(new THREE.ConeGeometry(r, h, o.seg || 16), typeof color === 'string' ? toon(color, o.mat) : color, o);
  m.position.set(x, y, z);
  return m;
}
export function T(r, tube, color, x = 0, y = 0, z = 0, o = {}) {
  const m = mesh(new THREE.TorusGeometry(r, tube, o.rs || 10, o.ts || 24, o.arc || Math.PI * 2), typeof color === 'string' ? toon(color, o.mat) : color, o);
  m.position.set(x, y, z);
  return m;
}
const group = (...kids) => {
  const g = new THREE.Group();
  for (const k of kids.flat()) if (k) g.add(k);
  return g;
};
const at = (obj, x, y, z, rotDeg = 0) => {
  obj.position.set(x, y, z);
  obj.rotation.y = -rotDeg * RAD;
  return obj;
};
const flatPlane = (w, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  m.userData.outline = false;
  return m;
};
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Instanced scatter of one geometry. items: [{ x, y, z, s, sy?, rot?, color? }]
function scatter(geo, mat, items, { cast = false, outline = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const o = new THREE.Object3D();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z);
    o.rotation.set(it.rx || 0, it.rot || 0, it.rz || 0);
    o.scale.set(it.s, it.sy ?? it.s, it.sz ?? it.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (it.color) m.setColorAt(i, new THREE.Color(it.color));
  });
  m.castShadow = cast;
  m.receiveShadow = true;
  if (outline) addOutline(m);
  return m;
}

const PALETTE = {
  wood: '#c98a4b', darkwood: '#8a5530', cream: '#fff3dc', ink: '#2b1c18',
  leaf: '#4caf50', leafDark: '#2e8b3e', leafLight: '#7fd36b', pine: '#2f7a4a', pineDark: '#1f5c38',
  terracotta: '#d0673a', steel: '#b8c2cc', red: '#e8473b', white: '#ffffff',
};

// ---- props --------------------------------------------------------------------
export const PROPS = {
  rug(q) {
    const m = flatPlane(q.x1 - q.x0, q.z1 - q.z0, toon(null, { map: TX.rug(q.colors) }), (q.x0 + q.x1) / 2, 0.15, (q.z0 + q.z1) / 2);
    return m;
  },

  tiles(q) {
    const t = TX.tiles().clone();
    t.needsUpdate = true;
    t.repeat.set((q.x1 - q.x0) / 120, (q.z1 - q.z0) / 120);
    return flatPlane(q.x1 - q.x0, q.z1 - q.z0, toon(null, { map: t }), (q.x0 + q.x1) / 2, 0.08, (q.z0 + q.z1) / 2);
  },

  cushions(q) {
    const g = group();
    const n = 3, w = (q.x1 - q.x0) / n;
    for (let i = 0; i < n; i++) {
      g.add(B(w - 3, 9, 54, '#e86a58', q.x0 + w * (i + 0.5), q.y + 4.5, q.z, { r: 3.5 }));
      const back = B(w - 4, 30, 11, '#e86a58', q.x0 + w * (i + 0.5), q.y + 26, q.z + 22, { r: 4 });
      back.rotation.x = -0.15;
      g.add(back);
    }
    return g;
  },

  fire(q, ctx) {
    const g = group();
    const y = q.y || 0, w = q.w;
    if (q.opening) g.add(B(w, q.opening.h, 1, '#2a1612', q.x, q.opening.h / 2, q.opening.z, { outline: false }));
    for (const a of [-25, 25, 90]) {
      const log = C(w * 0.07, w * 0.07, w * 0.75, '#7a4423', 0, 0, 0, { seg: 10 });
      log.rotation.z = Math.PI / 2;
      log.rotation.y = a * RAD;
      log.position.set(q.x, y + w * 0.07, q.z);
      g.add(log);
    }
    const flames = group();
    flames.userData.dynamic = true;
    const cols = ['#ff5a1f', '#ffa21f', '#ffe066'];
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const f = K(w * (0.2 - i * 0.05), w * (0.55 - i * 0.12), null, 0, 0, 0, { seg: 7, cast: false, outline: false });
      f.material = flat(cols[i]);
      f.geometry.translate(0, w * (0.275 - i * 0.06), 0);
      f.position.set(q.x + (i - 1) * w * 0.04, y + w * 0.08, q.z + 0.5 * i);
      flames.add(f);
      parts.push(f);
    }
    g.add(flames);
    const light = new THREE.PointLight('#ffae5a', 2.5, w * 6, 1.6);
    light.position.set(q.x, y + w * 0.5, q.z + w * 0.3);
    flames.add(light);
    ctx.anim.push((t) => {
      parts.forEach((p, i) => {
        p.scale.set(1 + Math.sin(t * 9 + i * 2) * 0.08, 1 + Math.sin(t * 11 + i) * 0.14, 1);
      });
      light.intensity = 2.2 + Math.sin(t * 13) * 0.4;
    });
    return g;
  },

  chimney(q) {
    const t = TX.stone().clone();
    t.needsUpdate = true;
    t.repeat.set(q.w / 60, (ctxH(q) - q.y0) / 60);
    return group(
      B(q.w, ctxH(q) - q.y0, q.d, toon(null, { map: t }), q.x, (ctxH(q) + q.y0) / 2, q.z),
      B(q.w + 90, 6, q.d + 34, '#8a5530', q.x, q.y0 + 3, q.z + 8, { r: 1.5 }),
    );
  },

  lamp(q) {
    const shade = C(14, 22, 26, '#ffe3a3', q.x, q.y + 6, q.z, { seg: 20, mat: { emissive: '#ffcf70', emissiveIntensity: 0.35 } });
    const bulb = S(5, null, q.x, q.y - 4, q.z, 1, 1, 1, { outline: false, cast: false });
    bulb.material = flat('#fff6d0');
    const base = C(18, 20, 4, PALETTE.ink, q.x, 2, q.z, { seg: 20 });
    return group(shade, bulb, base);
  },

  plant(q) {
    const s = q.s || 1;
    const g = group(C(16 * s, 12 * s, 30 * s, PALETTE.terracotta, q.x, 15 * s, q.z), C(17 * s, 17 * s, 4 * s, '#b4542c', q.x, 29 * s, q.z));
    const r = rng(q.x * 7 + q.z);
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2, d = 6 + r() * 10;
      g.add(S((12 + r() * 6) * s, i % 2 ? PALETTE.leaf : PALETTE.leafDark, q.x + Math.cos(a) * d * s, (44 + r() * 30) * s, q.z + Math.sin(a) * d * s));
    }
    return g;
  },

  window(q, ctx) {
    const S2 = ctx.world.size;
    const g = group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(q.w, q.h), flat('#ffffff', { map: TX.windowView(), fog: false }));
    pane.userData.outline = false;
    g.add(pane);
    const fr = '#fff3dc';
    g.add(B(q.w + 12, 7, 5, fr, 0, q.h / 2 + 3.5, 1), B(q.w + 12, 7, 5, fr, 0, -q.h / 2 - 3.5, 1));
    g.add(B(7, q.h, 5, fr, -q.w / 2 - 3.5, 0, 1), B(7, q.h, 5, fr, q.w / 2 + 3.5, 0, 1));
    g.add(B(4, q.h, 3, fr, 0, 0, 1), B(q.w, 4, 3, fr, 0, 0, 1));
    g.add(B(q.w + 20, 4, 10, PALETTE.darkwood, 0, -q.h / 2 - 9, 4));
    const y = q.y + q.h / 2;
    if (q.wall === 'n') at(g, q.at, y, 0.3, 0);
    if (q.wall === 's') at(g, q.at, y, S2.z - 0.3, 180);
    if (q.wall === 'w') at(g, 0.3, y, q.at, -90);
    if (q.wall === 'e') at(g, S2.x - 0.3, y, q.at, 90);
    return g;
  },

  frame(q, ctx) {
    const g = group(B(q.w + 8, q.h + 8, 3, PALETTE.darkwood, 0, 0, 1.5), B(q.w, q.h, 1, q.color, 0, 0, 3.2, { outline: false }));
    g.add(K(q.w * 0.22, q.h * 0.5, '#ffffff', -q.w * 0.12, -q.h * 0.05, 3.5, { seg: 4, outline: false }));
    g.add(S(q.h * 0.12, '#ffd34d', q.w * 0.28, q.h * 0.22, 3.8, 1, 1, 0.3, { outline: false }));
    return placeOnWall(g, q, ctx);
  },

  antlers(q, ctx) {
    const g = group(B(36, 26, 4, PALETTE.darkwood, 0, 0, 2, { r: 1.5 }));
    for (const side of [-1, 1]) {
      const main = C(1.8, 2.4, 34, '#f0e2c4', side * 10, 14, 6, { seg: 8 });
      main.rotation.z = -side * 0.7;
      g.add(main);
      for (let k = 0; k < 3; k++) {
        const tine = C(1.2, 1.6, 12, '#f0e2c4', side * (14 + k * 6), 20 + k * 6, 6, { seg: 6 });
        tine.rotation.z = side * 0.3;
        g.add(tine);
      }
    }
    return placeOnWall(g, q, ctx);
  },

  bowl(q) {
    const bowl = S(16, '#3c8fd6', q.x, q.y, q.z, 1, 0.5, 1, { mat: {} });
    const g = group(bowl);
    [['#ff8c1a', -5, 4], ['#e8473b', 6, 2], ['#ffd34d', 0, -6]].forEach(([c, dx, dz]) => g.add(S(5.5, c, q.x + dx, q.y + 7, q.z + dz)));
    return g;
  },

  kettle(q) {
    const g = group(S(11, '#e8473b', q.x, q.y + 10, q.z, 1, 0.9, 1), C(4, 6, 3, PALETTE.ink, q.x, q.y + 20, q.z, { seg: 12 }));
    const spout = C(1.6, 2.6, 12, '#e8473b', q.x + 12, q.y + 13, q.z, { seg: 8 });
    spout.rotation.z = -0.9;
    const handle = T(7, 1.5, PALETTE.ink, q.x, q.y + 20, q.z, { arc: Math.PI });
    return group(g, spout, handle);
  },

  pots(q) {
    return group(
      C(13, 13, 14, '#4a9de0', q.x, q.y + 7, q.z), C(13.5, 13.5, 2, '#2d6fae', q.x, q.y + 15, q.z), S(2.5, PALETTE.ink, q.x, q.y + 17, q.z),
      C(10, 10, 10, '#ffd34d', q.x + 34, q.y + 5, q.z + 4), C(10.5, 10.5, 2, '#d9a520', q.x + 34, q.y + 11, q.z + 4),
    );
  },

  pole(q) {
    return group(C(5, 6, q.h, '#2f86c9', q.x, q.h / 2, q.z, { seg: 14 }), C(14, 16, 3, '#2f86c9', q.x, 1.5, q.z, { seg: 18 }), S(7, '#ffd34d', q.x, q.h + 3, q.z));
  },

  mug(q) {
    return group(C(3.5, 3.2, 8, '#ffffff', q.x, q.y + 4, q.z, { seg: 14 }), T(2.4, 0.7, '#ffffff', q.x + 4, q.y + 4.5, q.z, { arc: Math.PI * 1.2 }));
  },

  chair(q) {
    const col = q.color || PALETTE.wood;
    const y = q.y || 0;
    const g = group(B(42, 4, 40, col, 0, 44, 0, { r: 1.5 }), B(42, 44, 4, col, 0, 68, -19, { r: 1.5 }));
    for (const [x, z] of [[-18, -17], [18, -17], [-18, 17], [18, 17]]) g.add(B(4, 44, 4, col, x, 22, z));
    g.add(B(32, 4, 2, PALETTE.cream, 0, 74, -21));
    return at(g, q.x, y, q.z, q.rot || 0);
  },

  beams(q, ctx) {
    const S2 = ctx.world.size, H = ctx.world.look.wallHeight;
    const g = group();
    for (let x = q.every; x < S2.x; x += q.every) g.add(B(16, 16, S2.z, '#8a5530', x, H - 8, S2.z / 2));
    g.add(B(S2.x, 14, 14, '#7a4423', S2.x / 2, H - 7, S2.z / 2));
    return g;
  },

  // --- outdoors ---
  cabinWall(q, ctx) {
    const W = ctx.world.size.x;
    const t = TX.logs().clone();
    t.needsUpdate = true;
    t.repeat.set(W / 150, q.h / 90);
    const g = group(B(W + 400, q.h, 30, toon(null, { map: t }), W / 2, q.h / 2, -15));
    // roof eave and porch posts
    const eave = B(W + 440, 14, 140, '#9b3b2b', W / 2, q.h + 20, 30, { r: 3 });
    eave.rotation.x = 0.35;
    g.add(eave);
    for (const x of [360, 600, 840]) g.add(C(6, 6, q.h - 20, PALETTE.darkwood, x, (q.h - 20) / 2, 104, { seg: 10 }));
    g.add(B(500, 10, 10, PALETTE.darkwood, 600, q.h - 25, 104));
    // door and windows
    g.add(B(90, 200, 4, '#6d3b1f', 600, 114, 1, { r: 2 }), S(4, '#ffd34d', 630, 110, 4));
    for (const x of [200, 1000]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(130, 100), flat('#ffffff', { map: TX.windowView(), fog: false }));
      pane.position.set(x, 170, 0.6);
      pane.userData.outline = false;
      g.add(pane, B(144, 8, 6, PALETTE.cream, x, 224, 2), B(144, 8, 6, PALETTE.cream, x, 116, 2), B(8, 100, 6, PALETTE.cream, x - 68, 170, 2), B(8, 100, 6, PALETTE.cream, x + 68, 170, 2));
      g.add(B(4, 100, 4, PALETTE.cream, x, 170, 2), B(144, 22, 26, '#e8473b', x, 100, 12, { r: 3 }));
      for (let k = 0; k < 6; k++) g.add(S(6, ['#ff6fae', '#ffd34d', '#ffffff'][k % 3], x - 55 + k * 22, 114, 12));
    }
    return g;
  },

  fence(q, ctx) {
    const { x: W, z: D } = ctx.world.size;
    const items = [];
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 16);
      const rot = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i <= n; i++) items.push({ x: x0 + ((x1 - x0) * i) / n, y: 0, z: z0 + ((z1 - z0) * i) / n, s: 1, rot });
    };
    run(-4, 30, -4, D + 4);
    run(-4, D + 4, W + 4, D + 4);
    run(W + 4, D + 4, W + 4, 30);
    const shape = new THREE.Shape();
    shape.moveTo(-4, 0); shape.lineTo(4, 0); shape.lineTo(4, q.h - 8); shape.lineTo(0, q.h); shape.lineTo(-4, q.h - 8); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: false });
    geo.translate(0, 0, -1.25);
    const pickets = scatter(geo, toon('#fffaf0'), items, { cast: true, outline: true });
    const g = group(pickets);
    for (const y of [q.h * 0.25, q.h * 0.7]) {
      g.add(B(8, 6, D, '#f3eadb', -8, y, D / 2), B(W + 16, 6, 8, '#f3eadb', W / 2, y, D + 8), B(8, 6, D, '#f3eadb', W + 8, y, D / 2));
    }
    return g;
  },

  canopy(q) {
    const g = group();
    const r = rng(q.x + q.z);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, d = i === 0 ? 0 : q.r * (0.45 + r() * 0.2);
      const rr = q.r * (0.42 + r() * 0.15);
      g.add(S(rr, [PALETTE.leaf, PALETTE.leafDark, PALETTE.leafLight][i % 3], q.x + Math.cos(a) * d, q.y + rr * 0.5 + r() * 60 + (i === 0 ? 80 : 0), q.z + Math.sin(a) * d, 1, 0.8, 1, { seg: 14, rings: 10 }));
    }
    for (const a of [30, 150, 260]) {
      const br = C(8, 14, q.r * 0.8, '#7a4b2a', q.x + Math.cos(a * RAD) * q.r * 0.25, q.y - 40, q.z + Math.sin(a * RAD) * q.r * 0.25, { seg: 8 });
      br.rotation.z = Math.cos(a * RAD) * 0.8;
      br.rotation.x = -Math.sin(a * RAD) * 0.8;
      g.add(br);
    }
    return g;
  },

  tireSwing(q) {
    const rope = C(0.8, 0.8, q.top - q.y - 20, '#d9c08c', q.x, (q.top + q.y + 20) / 2, q.z, { seg: 6, outline: false });
    const tire = T(18, 7, '#2a2a33', q.x, q.y, q.z, { rs: 10, ts: 20 });
    return group(rope, tire);
  },

  puddle(q, ctx) {
    const water = new THREE.Mesh(new THREE.CircleGeometry(q.r, 40), toon(null, { map: waterTex(ctx, q.r * 2 / 120) }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(q.x, 0.3, q.z);
    water.receiveShadow = true;
    water.userData.outline = false;
    const rim = new THREE.Mesh(new THREE.RingGeometry(q.r, q.r + 8, 40), toon('#8a6a45'));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(q.x, 0.25, q.z);
    rim.userData.outline = false;
    return group(water, rim);
  },

  flowerBed(q) {
    const g = group();
    const r = rng(q.x0 + q.z1);
    for (let x = q.x0 + 30; x < q.x1 - 10; x += 55) {
      for (let z = q.z0 + 30; z < q.z1 - 10; z += 55) {
        const h = 60 + r() * 70, fx = x + (r() - 0.5) * 20, fz = z + (r() - 0.5) * 20;
        g.add(C(1.6, 2, h, PALETTE.leafDark, fx, q.y + h / 2, fz, { seg: 6 }));
        const leaf = S(8, PALETTE.leaf, fx + 6, q.y + h * 0.4, fz, 1, 0.3, 0.6);
        leaf.rotation.z = 0.5;
        g.add(leaf);
        if (r() < 0.45) {
          // sunflower
          const head = group(C(14, 14, 3, '#ffd23f', 0, 0, 0, { seg: 12 }), C(7, 7, 4, '#6b3d1f', 0, 0.6, 0, { seg: 12 }));
          head.position.set(fx, q.y + h, fz);
          head.rotation.x = -1.1;
          head.rotation.z = (r() - 0.5) * 0.6;
          g.add(head);
        } else {
          const col = ['#ff5fa2', '#e8473b', '#b06cff', '#ff9a3c'][Math.floor(r() * 4)];
          g.add(S(7, col, fx, q.y + h + 3, fz, 1, 1.25, 1), K(5, 6, col, fx, q.y + h + 10, fz, { seg: 5 }));
        }
      }
    }
    return g;
  },

  wheelbarrow(q) {
    const g = group(B(70, 22, 46, '#e8473b', 0, 34, 0, { r: 5 }), B(60, 4, 38, '#a8261c', 0, 45, 0, { outline: false }));
    const wheel = T(11, 4, '#2a2a33', 44, 12, 0);
    g.add(wheel, C(3, 3, 8, '#cccccc', 44, 12, 0, { seg: 8 }));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    for (const z of [-17, 17]) {
      const h = B(70, 3, 3, '#8a5530', -40, 36, z);
      h.rotation.z = 0.25;
      g.add(h, B(3, 26, 3, '#666b73', -18, 13, z));
    }
    return at(g, q.x, 0, q.z, q.rot || 0);
  },

  hose(q) {
    const g = group();
    for (let i = 0; i < 3; i++) {
      const t = T(q.r - i * 6, 2.2, '#3fae3a', q.x, 2.2 + i * 0.2, q.z, { rs: 8, ts: 36 });
      t.rotation.x = Math.PI / 2;
      g.add(t);
    }
    g.add(C(3, 3, 8, '#ffd34d', q.x + q.r, 3, q.z, { seg: 8 }));
    return g;
  },

  bucket(q) {
    const g = group(C(13, 10, 22, '#2f86c9', q.x, q.y + 11, q.z), T(12, 0.8, '#dddddd', q.x, q.y + 22, q.z, { arc: Math.PI }));
    const spade = group(B(3, 30, 3, '#ffd34d', 0, 15, 0), B(12, 14, 1.5, '#e8473b', 0, -2, 0, { r: 0.7 }));
    spade.position.set(q.x + 30, q.y + 16, q.z + 10);
    spade.rotation.z = 0.5;
    return group(g, spade);
  },

  potFlowers(q) {
    const g = group();
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3, d = i ? 8 : 0;
      g.add(C(1, 1, 22, PALETTE.leafDark, q.x + Math.cos(a) * d, q.y + 11, q.z + Math.sin(a) * d, { seg: 5, outline: false }));
      g.add(S(5, ['#ff5fa2', '#ffd34d', '#ffffff', '#b06cff', '#e8473b'][i], q.x + Math.cos(a) * d, q.y + 23, q.z + Math.sin(a) * d));
    }
    return g;
  },

  wateringCan(q) {
    const g = group(C(10, 11, 20, '#3fae8c', q.x, q.y + 10, q.z), T(7, 1.4, '#3fae8c', q.x - 2, q.y + 22, q.z, { arc: Math.PI }));
    const spout = C(1.5, 2.5, 24, '#3fae8c', q.x + 15, q.y + 16, q.z, { seg: 8 });
    spout.rotation.z = -1;
    return group(g, spout);
  },

  flowers(q, ctx) {
    const r = rng(q.seed || 1);
    const heads = [], stems = [];
    const cols = ['#ffffff', '#ffd34d', '#ff6fae', '#b06cff', '#ff9a3c'];
    for (let i = 0; i < q.n * 3 && heads.length < q.n; i++) {
      const x = q.x0 + r() * (q.x1 - q.x0), z = q.z0 + r() * (q.z1 - q.z0);
      if (ctx.blocked(x, z, 8)) continue;
      const h = 5 + r() * 6;
      stems.push({ x, y: h / 2, z, s: 1, sy: h });
      heads.push({ x, y: h, z, s: 1, color: cols[Math.floor(r() * cols.length)] });
    }
    return group(
      scatter(new THREE.CylinderGeometry(0.35, 0.35, 1, 5), toon('#3c8d2f'), stems),
      scatter(new THREE.IcosahedronGeometry(1.8, 0), toon('#ffffff'), heads),
    );
  },

  grass(q, ctx) {
    const r = rng(q.seed || 1);
    const items = [];
    for (let i = 0; i < q.n * 3 && items.length < q.n; i++) {
      const x = q.x0 + r() * (q.x1 - q.x0), z = q.z0 + r() * (q.z1 - q.z0);
      if (ctx.blocked(x, z, 6)) continue;
      items.push({ x, y: 0, z, s: 0.8 + r() * 0.8, rot: r() * Math.PI, color: ['#58a83b', '#6fc24e', '#4b9634'][Math.floor(r() * 3)] });
    }
    // a tuft: three thin blades
    const blade = new THREE.ConeGeometry(0.9, 7, 3);
    blade.translate(0, 3.5, 0);
    const parts = [];
    for (const [dx, rz] of [[-1.2, 0.3], [0, 0], [1.2, -0.3]]) {
      const b = blade.clone();
      b.rotateZ(rz);
      b.translate(dx, 0, 0);
      parts.push(b.toNonIndexed());
    }
    return scatter(mergeGeos(parts), toon('#ffffff'), items);
  },

  mushrooms(q) {
    const g = group();
    const r = rng(q.x + q.z);
    for (let i = 0; i < q.n; i++) {
      const x = q.x + (r() - 0.5) * 60, z = q.z + (r() - 0.5) * 60, s = 0.7 + r() * 0.6;
      g.add(C(2 * s, 2.5 * s, 7 * s, PALETTE.cream, x, 3.5 * s, z, { seg: 8 }));
      g.add(S(6 * s, '#e8473b', x, 7 * s, z, 1, 0.6, 1));
      g.add(S(1.2 * s, '#ffffff', x + 2 * s, 10 * s, z + 1 * s, 1, 0.5, 1, { outline: false }));
    }
    return g;
  },

  clouds(q, ctx) {
    const g = group();
    const r = rng(77);
    const S2 = ctx.world.size;
    for (let i = 0; i < q.n; i++) {
      const a = (i / q.n) * Math.PI * 2 + r() * 0.4, d = 2200 + r() * 900;
      const cx = S2.x / 2 + Math.cos(a) * d, cz = S2.z / 2 + Math.sin(a) * d, cy = 900 + r() * 600;
      for (let k = 0; k < 5; k++) {
        const rr = 90 + r() * 70;
        g.add(S(rr, '#ffffff', cx + (k - 2) * 110 + r() * 30, cy + (k % 2) * 40, cz + r() * 60, 1, 0.7, 1, { cast: false, mat: { emissive: '#ffffff', emissiveIntensity: 0.25 } }));
      }
    }
    g.userData.cloudLayer = true;
    return g;
  },

  bush(q) {
    const g = group();
    const r = rng(q.x * 3 + q.z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(S(q.r * (0.5 + r() * 0.2), i % 2 ? PALETTE.leaf : PALETTE.leafDark, q.x + Math.cos(a) * q.r * 0.4, q.r * 0.45, q.z + Math.sin(a) * q.r * 0.4, 1, 0.85, 1));
    }
    return g;
  },

  pine(q) {
    return pineTree(q.x, q.z, 500 * q.s, 14 * q.s);
  },

  lake(q, ctx) {
    const w = q.x1 - q.x0, d = q.z1 - q.z0;
    const m = flatPlane(w, d, toon(null, { map: waterTex(ctx, w / 140, d / 140) }), (q.x0 + q.x1) / 2, 0.3, (q.z0 + q.z1) / 2);
    const foam = flatPlane(10, 4000, toon('#e9f8ff'), q.x0 + 2, 0.35, 450);
    return group(m, foam);
  },

  dockPosts(q) {
    const g = group();
    for (let x = q.x0 + 10; x <= q.x1 - 5; x += 60) {
      if (q.gapX0 != null && x > q.gapX0 - 5 && x < q.gapX1 + 5) continue;
      for (const z of [q.z0 + 4, q.z1 - 4]) g.add(C(5, 5, 32, '#7a4b2a', x, 0, z, { seg: 10 }));
    }
    if (q.gapX0 == null) for (let z = q.z0 + 10; z <= q.z1; z += 60) for (const x of [q.x0 + 4, q.x1 - 4]) g.add(C(5, 5, 32, '#7a4b2a', x, 0, z, { seg: 10 }));
    return g;
  },

  logSeat(q) {
    const log = C(10, 10, 70, '#8a5530', 0, 10, 0, { seg: 14 });
    log.rotation.z = Math.PI / 2;
    const g = group(log, C(8, 8, 70.5, '#e3b679', 0, 10, 0, { seg: 14, outline: false }));
    g.children[1].rotation.z = Math.PI / 2;
    g.children[1].scale.set(1, 1.001, 1);
    return at(g, q.x, 0, q.z, q.rot || 0);
  },

  canoe(q) {
    const hull = S(14, '#e8473b', 0, 4, 0, 6, 0.8, 1);
    const rim = S(12.5, '#ffe6c2', 0, 7.5, 0, 6, 0.25, 0.9, { outline: false });
    const paddle = group(B(70, 1.5, 4, PALETTE.wood, 0, 0, 0), B(16, 1.6, 9, PALETTE.wood, 36, 0, 0, { r: 0.7 }));
    paddle.position.set(5, 10, 0);
    paddle.rotation.y = 0.3;
    const g = group(hull, rim, paddle);
    g.userData.bob = true;
    return at(g, q.x, 0, q.z, q.rot || 0);
  },

  lilies(q, ctx) {
    const r = rng(q.seed || 1);
    const pads = [], blossoms = [];
    for (let i = 0; i < q.n * 4 && pads.length < q.n; i++) {
      const x = q.x0 + r() * (q.x1 - q.x0), z = q.z0 + r() * (q.z1 - q.z0);
      if (ctx.blocked(x, z, 14)) continue;
      pads.push({ x, y: 0.5, z, s: 7 + r() * 6, sy: 1, rot: r() * 6.3 });
      if (r() < 0.35) blossoms.push({ x: x + 2, y: 2, z, s: 2.5, color: r() < 0.5 ? '#ff8fc2' : '#ffffff' });
    }
    const pad = new THREE.CylinderGeometry(1, 1, 0.6, 14, 1, false, 0.4, Math.PI * 2 - 0.4);
    return group(scatter(pad, toon('#48a84a'), pads), scatter(new THREE.IcosahedronGeometry(1, 0), toon('#ffffff'), blossoms));
  },

  cattails(q) {
    const r = rng(q.z0 + q.n);
    const stems = [], tops = [];
    for (let i = 0; i < q.n; i++) {
      const z = q.z0 + r() * (q.z1 - q.z0), x = q.x + (r() - 0.3) * 30, h = 30 + r() * 30;
      stems.push({ x, y: h / 2, z, s: 1, sy: h });
      tops.push({ x, y: h, z, s: 1 });
    }
    return group(scatter(new THREE.CylinderGeometry(0.6, 0.6, 1, 5), toon('#5c8a3a'), stems), scatter(new THREE.CapsuleGeometry(1.8, 7, 3, 6), toon('#7a4423'), tops));
  },

  pebbles(q, ctx) {
    const r = rng(q.seed || 1);
    const items = [];
    for (let i = 0; i < q.n * 3 && items.length < q.n; i++) {
      const x = q.x0 + r() * (q.x1 - q.x0), z = q.z0 + r() * (q.z1 - q.z0);
      if (ctx.blocked(x, z, 5)) continue;
      items.push({ x, y: 0.5, z, s: 1.5 + r() * 2.5, sy: 0.8 + r(), rot: r() * 6, color: ['#b9b2aa', '#9a948c', '#d8d0c4'][Math.floor(r() * 3)] });
    }
    return scatter(new THREE.IcosahedronGeometry(1, 0), toon('#ffffff'), items);
  },

  fishingRod(q) {
    const rod = C(0.6, 1.2, 120, '#3a3a3a', 0, 50, 0, { seg: 6 });
    rod.rotation.z = -0.7;
    const box = B(24, 12, 14, '#3fae8c', -20, 6, 10, { r: 2 });
    return at(group(rod, box, C(3, 3, 3, '#cccccc', -28, 18, 0, { seg: 10 })), q.x, q.y, q.z, 30);
  },

  buoy(q) {
    const g = group(S(9, '#e8473b', 0, 4, 0), C(9.2, 9.2, 4, '#ffffff', 0, 4, 0, { seg: 16 }), C(1, 1, 12, PALETTE.ink, 0, 14, 0, { seg: 6 }));
    g.userData.bob = true;
    return at(g, q.x, 0, q.z);
  },

  mountains(q, ctx) {
    const S2 = ctx.world.size;
    const g = group();
    const r = rng(31);
    for (let i = 0; i < 9; i++) {
      const a = (-60 + i * 15) * RAD, d = 4200 + r() * 600;
      const h = 900 + r() * 700, w = 900 + r() * 500;
      const x = S2.x / 2 + Math.cos(a) * d, z = S2.z / 2 + Math.sin(a) * d;
      g.add(K(w, h, i % 2 ? '#5f8f7a' : '#4f7f6a', x, h / 2 - 50, z, { seg: 7, cast: false, outline: false }));
      g.add(K(w * 0.3, h * 0.3, '#ffffff', x, h - 50 - h * 0.15, z, { seg: 7, cast: false, outline: false }));
    }
    return g;
  },
};

function ctxH(q) { return q.top || 260; }

function placeOnWall(g, q, ctx) {
  const S2 = ctx.world.size;
  if (q.wall === 'n') return at(g, q.at, q.y, 0.2, 0);
  if (q.wall === 's') return at(g, q.at, q.y, S2.z - 0.2, 180);
  if (q.wall === 'w') return at(g, 0.2, q.y, q.at, -90);
  return at(g, S2.x - 0.2, q.y, q.at, 90);
}

// Water texture (animated by scrolling) shared by everything in a world.
function waterTex(ctx, ru, rv = ru) {
  const t = TX.water().clone();
  t.needsUpdate = true;
  t.repeat.set(ru, rv);
  ctx.anim.push((time) => { t.offset.set(time * 0.01, time * 0.006); });
  return t;
}

// A cartoon pine tree: trunk plus stacked cones.
export function pineTree(x, z, h, trunkR) {
  const g = group(C(trunkR * 0.7, trunkR, h * 0.35, '#6b3d1f', x, h * 0.175, z, { seg: 10 }));
  for (let i = 0; i < 4; i++) {
    const cr = h * (0.3 - i * 0.055), ch = h * (0.34 - i * 0.04);
    g.add(K(cr, ch, i % 2 ? PALETTE.pine : PALETTE.pineDark, x, h * (0.3 + i * 0.17) + ch / 2, z, { seg: 9 }));
  }
  return g;
}

function mergeGeos(geos) {
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3);
  let off = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, off * 3);
    nrm.set(g.attributes.normal.array, off * 3);
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}
