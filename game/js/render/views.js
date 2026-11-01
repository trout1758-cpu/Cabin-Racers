// Split-screen: one chase camera per player, laid out for 1-4 players.
// With 3 players the spare quarter shows a slowly orbiting overview.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from '../config.js';

const BACK = 19;      // cm behind the car
const HEIGHT = 7.5;   // cm above it
const AHEAD = 12;     // look-at point ahead of the car

// Viewport rectangles as fractions of the screen [x, y, w, h] with y from the top.
export function layoutFor(n) {
  if (n <= 1) return [[0, 0, 1, 1]];
  if (n === 2) return [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]];
  return [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
}

export class Views {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.cams = [];
    this.overview = new THREE.PerspectiveCamera(50, 1, 1, 20000);
    this.world = null;
    this.time = 0;
  }

  setPlayers(n) {
    this.n = n;
    this.rects = layoutFor(n);
    this.cams = [];
    for (let i = 0; i < Math.max(n, 1); i++) {
      const cam = new THREE.PerspectiveCamera(68, 1, 0.4, 20000);
      cam.userData.ready = false;
      cam.userData.up = new THREE.Vector3(0, 1, 0);
      this.cams.push(cam);
    }
  }

  // Chase camera for player i following `car`. Works in the car's own frame
  // (smoothed) so it follows the car round loops and up ramps.
  follow(i, car, dt) {
    const cam = this.cams[i];
    if (!cam) return;
    const up = cam.userData.up;
    const target = new THREE.Vector3(car.up.x, car.up.y, car.up.z);
    // level out in the air; otherwise follow the surface
    if (!car.grounded) target.lerp(new THREE.Vector3(0, 1, 0), 0.6);
    up.lerp(target, 1 - Math.exp(-5 * dt)).normalize();
    const fwd = new THREE.Vector3(car.fwd.x, car.fwd.y, car.fwd.z);
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0);
    fwd.normalize();
    const pos = new THREE.Vector3(car.pos.x, car.pos.y, car.pos.z);
    const want = pos.clone().addScaledVector(fwd, -BACK).addScaledVector(up, HEIGHT);
    // pull in toward the car if scenery is in the way
    const near = pos.clone().addScaledVector(up, 3);
    for (let k = 0; k < 8 && this.world && this.world.inside(want, 1); k++) want.lerp(near, 0.3);
    if (up.y > 0.7) want.y = Math.max(want.y, 2);
    if (!cam.userData.ready) {
      cam.position.copy(want);
      cam.userData.ready = true;
    } else {
      cam.position.lerp(want, 1 - Math.exp(-13 * dt));
    }
    cam.up.copy(up);
    const look = pos.clone().addScaledVector(fwd, AHEAD).addScaledVector(up, 2);
    cam.lookAt(look);
    const fov = 62 + Math.min(1, Math.max(0, car.speed / CFG.MAX_SPEED)) * 14;
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-3 * dt));
  }

  // Slowly circling view over the track (title screen, spare split-screen slot).
  orbit(center, radius, dt, height = 0.75) {
    this.time += dt;
    const a = this.time * 0.12;
    this.overview.position.set(center.x + Math.cos(a) * radius, radius * height, center.z + Math.sin(a) * radius);
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
