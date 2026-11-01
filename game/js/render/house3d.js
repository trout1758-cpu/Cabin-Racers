// Builds the (placeholder) house in 3D from the same furniture boxes the
// physics uses, plus decorations that cars never touch.
import * as THREE from '../vendor/three.module.min.js';
import { HOUSE } from '../house.js';
import * as TX from './textures.js';

function box(w, h, d, mat, x, y, z, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function boxFromMinMax(min, max, mat, opts) {
  return box(max[0] - min[0], max[1] - min[1], max[2] - min[2], mat,
    (min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2, opts);
}

export function buildHouse() {
  const g = new THREE.Group();
  const S = HOUSE.size;

  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: TX.woodFloor(), roughness: 0.55, metalness: 0 }),
    tiles: new THREE.MeshStandardMaterial({ map: TX.tiles(), roughness: 0.35 }),
    rug: new THREE.MeshStandardMaterial({ map: TX.rug(), roughness: 0.95 }),
    wall: new THREE.MeshStandardMaterial({ map: TX.plaster('#e9e2d6'), roughness: 0.95 }),
    kitchenWall: new THREE.MeshStandardMaterial({ map: TX.plaster('#dfe7ea'), roughness: 0.9 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ map: TX.darkWood(), roughness: 0.45 }),
    sofa: new THREE.MeshStandardMaterial({ map: TX.fabric('#4f6f8f', 5), roughness: 0.95 }),
    armchair: new THREE.MeshStandardMaterial({ map: TX.fabric('#b5713d', 6), roughness: 0.95 }),
    cabinet: new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.45 }),
    granite: new THREE.MeshStandardMaterial({ map: TX.granite(), roughness: 0.25, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.3, metalness: 0.85 }),
    black: new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.3, metalness: 0.2 }),
    glass: new THREE.MeshBasicMaterial({ map: TX.sky() }),
  };

  // Floor: oak boards, kitchen tiles, a rug
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(S.x, S.z), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(S.x / 2, 0, S.z / 2);
  floor.receiveShadow = true;
  g.add(floor);
  const kf = HOUSE.kitchenFloor;
  const kitchen = new THREE.Mesh(new THREE.PlaneGeometry(kf.max[0] - kf.min[0], kf.max[1] - kf.min[1]), mats.tiles);
  kitchen.rotation.x = -Math.PI / 2;
  kitchen.position.set((kf.min[0] + kf.max[0]) / 2, 0.05, (kf.min[1] + kf.max[1]) / 2);
  kitchen.receiveShadow = true;
  g.add(kitchen);
  for (const r of HOUSE.rugs) {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(r.max[0] - r.min[0], r.max[1] - r.min[1]), mats.rug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set((r.min[0] + r.max[0]) / 2, 0.2, (r.min[1] + r.max[1]) / 2);
    rug.receiveShadow = true;
    g.add(rug);
  }

  // Walls, skirting boards, ceiling, windows
  const H = S.wallHeight;
  const wall = (w, x, z, ry, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat);
    m.position.set(x, H / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    g.add(m);
  };
  wall(S.x, S.x / 2, 0, 0, mats.wall);
  wall(S.x, S.x / 2, S.z, Math.PI, mats.wall);
  wall(S.z, 0, S.z / 2, Math.PI / 2, mats.wall);
  wall(S.z, S.x, S.z / 2, -Math.PI / 2, mats.kitchenWall);
  g.add(box(S.x, 10, 1.5, mats.trim, S.x / 2, 5, 0.75, { cast: false }));
  g.add(box(S.x, 10, 1.5, mats.trim, S.x / 2, 5, S.z - 0.75, { cast: false }));
  g.add(box(1.5, 10, S.z, mats.trim, 0.75, 5, S.z / 2, { cast: false }));
  g.add(box(1.5, 10, S.z, mats.trim, S.x - 0.75, 5, S.z / 2, { cast: false }));
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(S.x, S.z), mats.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(S.x / 2, H, S.z / 2);
  g.add(ceiling);
  const windowAt = (x, z, w, h, ry) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.glass);
    pane.position.set(x, 90 + h / 2, z);
    pane.rotation.y = ry;
    g.add(pane);
    const nx = Math.round(Math.sin(ry)), nz = Math.round(Math.cos(ry));
    const frame = (fw, fh, ox, oy) => {
      const f = box(nz ? fw : 3, fh, nx ? fw : 3, mats.trim, x + ox * Math.abs(nz) + nx * 1.5, 90 + oy, z + ox * Math.abs(nx) + nz * 1.5, { cast: false });
      g.add(f);
    };
    frame(w + 8, 6, 0, 0);
    frame(w + 8, 6, 0, h);
    frame(6, h, -w / 2, h / 2);
    frame(6, h, w / 2, h / 2);
    frame(4, h, 0, h / 2);
  };
  windowAt(450, 0.2, 140, 120, 0);
  windowAt(S.x - 0.2, 330, 160, 110, -Math.PI / 2);
  windowAt(260, S.z - 0.2, 180, 110, Math.PI);

  // Furniture from the collision boxes
  for (const b of HOUSE.boxes) {
    let mat = mats.wood;
    if (b.kind === 'fabric') mat = b.name.startsWith('armchair') ? mats.armchair : mats.sofa;
    if (b.kind === 'appliance') mat = mats.steel;
    if (b.kind === 'counter') {
      // white cabinets with a granite worktop
      const top = [b.min[0] - 1, b.max[1] - 3, b.min[2] - 1], topMax = [b.max[0] + 1, b.max[1], b.max[2] + 1];
      g.add(boxFromMinMax(top, topMax, mats.granite));
      g.add(boxFromMinMax(b.min, [b.max[0], b.max[1] - 3, b.max[2]], mats.cabinet));
      // cabinet door lines
      for (let x = b.min[0] + 45; x < b.max[0]; x += 45) {
        const front = b.name === 'island' ? b.max[2] : b.max[2];
        g.add(box(0.6, b.max[1] - 14, 0.6, mats.trim, x, (b.max[1] - 3) / 2 + 4, front + 0.3, { cast: false }));
        g.add(box(8, 1.2, 1.2, mats.steel, x - 6, b.max[1] - 18, front + 0.6, { cast: false }));
      }
      continue;
    }
    g.add(boxFromMinMax(b.min, b.max, mat));
  }

  // Decorations (no collision; kept away from the tracks)
  // sofa cushions
  for (let i = 0; i < 3; i++) {
    const c = box(70, 9, 52, mats.sofa, 200 + i * 80, 46, 507);
    g.add(c);
    const back = box(70, 30, 10, mats.sofa, 200 + i * 80, 64, 528);
    back.rotation.x = -0.12;
    g.add(back);
  }
  // TV
  g.add(box(150, 85, 4, mats.black, 270, 55 + 50, 28));
  // books on the bookshelf
  const bookColors = ['#a33', '#246', '#d92', '#2a6', '#639', '#eee', '#333'];
  for (let shelf = 0; shelf < 5; shelf++) {
    g.add(box(30, 2, 188, mats.wood, 16, 20 + shelf * 36, 205, { cast: false }));
    let z = 115;
    let k = shelf * 3;
    while (z < 290) {
      const w = 3 + (k % 3);
      const h = 18 + (k * 7) % 12;
      g.add(box(20, h, w, new THREE.MeshStandardMaterial({ color: bookColors[k % bookColors.length], roughness: 0.7 }), 18, 21 + shelf * 36 + h / 2, z + w / 2, { cast: false }));
      z += w + 0.4;
      k++;
    }
  }
  // potted plant in the corner
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(16, 12, 30, 20), new THREE.MeshStandardMaterial({ color: '#b5583a', roughness: 0.8 }));
  pot.position.set(60, 15, 560);
  pot.castShadow = true;
  g.add(pot);
  const leaves = new THREE.MeshStandardMaterial({ color: '#3f8a3a', roughness: 0.8 });
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(14 + (i % 3) * 3, 12, 10), leaves);
    l.position.set(60 + Math.cos(i * 1.7) * 14, 50 + (i % 4) * 14, 560 + Math.sin(i * 1.7) * 14);
    l.castShadow = true;
    g.add(l);
  }
  // fridge handle, kitchen stools
  g.add(box(2, 80, 3, mats.steel, 829, 110, 140));
  for (let i = 0; i < 3; i++) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 4, 20), mats.wood);
    stool.position.set(660 + i * 60, 65, 370);
    stool.castShadow = true;
    g.add(stool);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 63, 10), mats.steel);
    leg.position.set(660 + i * 60, 31.5, 370);
    g.add(leg);
  }
  return g;
}

// Lights: soft sky light plus sunlight through the windows.
export function addLights(scene) {
  scene.add(new THREE.HemisphereLight('#fff6e8', '#6b5a48', 1.1));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.position.set(700, 420, -260);
  sun.target.position.set(380, 0, 320);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -560; c.right = 560; c.top = 420; c.bottom = -420; c.near = 100; c.far = 1600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#dfe9ff', 0.5);
  fill.position.set(-200, 300, 900);
  scene.add(fill);
  return sun;
}
