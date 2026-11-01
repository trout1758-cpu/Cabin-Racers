// Split-screen: one chase camera per player, laid out for 1-4 players.
// With 3 players the spare quarter shows a slowly orbiting overview.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from '../config.js';
import { HOUSE } from '../house.js';

const BACK = 19;      // cm behind the car
const HEIGHT = 7.5;   // cm above it
const AHEAD = 12;     // look-at point ahead of the car

// Viewport rectangles as fractions of the screen [x, y, w, h] with y from the top.
export function layoutFor(n) {
  if (n <= 1) return [[0, 0, 1, 1]];
  if (n === 2) return [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]];
  return [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
}

function insideFurniture(p) {
  for (const b of HOUSE.boxes) {
    if (p.x > b.min[0] - 1 && p.x < b.max[0] + 1 && p.y > b.min[1] - 1 && p.y < b.max[1] + 1 && p.z > b.min[2] - 1 && p.z < b.max[2] + 1) return true;
  }
  return false;
}

export class Views {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.cams = [];
    this.overview = new THREE.PerspectiveCamera(50, 1, 1, 4000);
    this.time = 0;
  }

  setPlayers(n) {
    this.n = n;
    this.rects = layoutFor(n);
    this.cams = [];
    for (let i = 0; i < Math.max(n, 1); i++) {
      const cam = new THREE.PerspectiveCamera(68, 1, 0.4, 4000);
      cam.userData.ready = false;
      this.cams.push(cam);
    }
  }

  // Chase camera for player i following `car`.
  follow(i, car, dt) {
    const cam = this.cams[i];
    if (!cam) return;
    const fx = car.fwd.x, fz = car.fwd.z;
    const fl = Math.hypot(fx, fz) || 1;
    const want = new THREE.Vector3(car.pos.x - (fx / fl) * BACK, car.pos.y + HEIGHT, car.pos.z - (fz / fl) * BACK);
    // pull in toward the car if furniture is in the way
    const carV = new THREE.Vector3(car.pos.x, car.pos.y + 3, car.pos.z);
    for (let k = 0; k < 8 && insideFurniture(want); k++) want.lerp(carV, 0.3);
    want.y = Math.max(want.y, 2);
    if (!cam.userData.ready) {
      cam.position.copy(want);
      cam.userData.ready = true;
    } else {
      cam.position.lerp(want, 1 - Math.exp(-7 * dt));
    }
    const look = new THREE.Vector3(car.pos.x + (fx / fl) * AHEAD, car.pos.y + 2, car.pos.z + (fz / fl) * AHEAD);
    cam.lookAt(look);
    const fov = 62 + Math.min(1, Math.max(0, car.speed / CFG.MAX_SPEED)) * 14;
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-3 * dt));
  }

  // Slowly circling view over the track (title screen, spare split-screen slot).
  orbit(center, radius, dt) {
    this.time += dt;
    const a = this.time * 0.12;
    this.overview.position.set(center.x + Math.cos(a) * radius, radius * 0.75, center.z + Math.sin(a) * radius);
    this.overview.lookAt(center.x, 0, center.z);
  }

  render(onlyOverview = false) {
    const r = this.renderer;
    const W = r.domElement.clientWidth, H = r.domElement.clientHeight;
    r.shadowMap.needsUpdate = true; // shadows once per frame, shared by all views
    r.setScissorTest(true);
    const rects = onlyOverview ? [[0, 0, 1, 1]] : this.rects;
    rects.forEach((rc, i) => {
      const x = Math.round(rc[0] * W), w = Math.round(rc[2] * W);
      const h = Math.round(rc[3] * H), y = H - Math.round(rc[1] * H) - h;
      r.setViewport(x, y, w, h);
      r.setScissor(x, y, w, h);
      const cam = onlyOverview || i >= this.cams.length || i >= this.n ? this.overview : this.cams[i];
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      r.render(this.scene, cam);
    });
    r.setScissorTest(false);
  }
}
