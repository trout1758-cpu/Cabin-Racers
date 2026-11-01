// Cartoon toy car (about 7.5 cm long): chunky rounded body, bubble cabin,
// big wheels and a racing number. Faces +X with +Y up and +Z to its right.
import * as THREE from '../vendor/three.module.min.js';
import * as TX from './textures.js';
import { addOutline, flat, mergeStatic, roundedBox, toon } from './toon.js';

const WHEEL_R = 1.08;
const RIDE = WHEEL_R; // wheel centre height

let bodyGeo = null;
function bodyGeometry() {
  if (bodyGeo) return bodyGeo;
  const shape = new THREE.Shape();
  const pts = [[-3.25, 0.95], [3.2, 0.95], [3.45, 1.45], [3.1, 1.95], [1.0, 2.1], [-2.8, 2.2], [-3.35, 1.85]];
  shape.moveTo(...pts[0]);
  for (const p of pts.slice(1)) shape.lineTo(...p);
  shape.closePath();
  bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.7, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.42, bevelSegments: 4, curveSegments: 4 });
  bodyGeo.translate(0, 0, -1.35);
  bodyGeo.computeVertexNormals();
  return bodyGeo;
}

// Body parts get merged (one mesh per material plus one outline), so they
// only mark whether they want an outline; wheels get their own.
function part(geo, mat, x, y, z, outline = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.outline = outline;
  return m;
}

export function makeCarMesh(color, number = 1) {
  const root = new THREE.Group();   // at the contact point, oriented to the car
  const body = new THREE.Group();   // leans, bounces and squashes

  const paint = toon(color.body);
  const dark = toon(color.dark);
  const glass = toon('#9fe3ff', { emissive: '#3aa6dd', emissiveIntensity: 0.15 });
  const tyre = toon('#2a2a33');
  const hubMat = toon('#ffffff');
  const black = toon('#2b1c18');

  body.add(part(bodyGeometry(), paint, 0, 0, 0));
  // bubble cabin and roof
  body.add(part(roundedBox(3.3, 1.35, 3.0, 0.62), glass, -0.55, 2.75, 0));
  body.add(part(roundedBox(2.5, 0.42, 3.2, 0.2), paint, -0.8, 3.5, 0));
  const shine = part(new THREE.BoxGeometry(0.12, 0.9, 0.35), flat('#ffffff'), 0, 0, 0, false);
  shine.position.set(1.1, 2.75, -0.7);
  shine.rotation.z = 0.5;
  body.add(shine);
  // bumpers
  body.add(part(roundedBox(0.6, 0.7, 3.9, 0.3), black, 3.75, 1.15, 0));
  body.add(part(roundedBox(0.6, 0.7, 3.9, 0.3), black, -3.7, 1.2, 0));
  // headlights and tail lights
  const head = flat('#fff8c8');
  const tail = flat('#ff3b2e');
  for (const z of [-1.15, 1.15]) {
    const h = part(new THREE.SphereGeometry(0.42, 12, 8), head, 0, 0, 0, false);
    h.scale.set(0.5, 1, 1);
    h.position.set(3.55, 1.75, z);
    body.add(h);
    const t = part(new THREE.BoxGeometry(0.15, 0.35, 0.7), tail, 0, 0, 0, false);
    t.position.set(-3.82, 1.85, z);
    body.add(t);
  }
  // spoiler
  body.add(part(roundedBox(0.9, 0.22, 4.0, 0.1), dark, -3.15, 3.05, 0));
  for (const z of [-1.2, 1.2]) body.add(part(new THREE.BoxGeometry(0.3, 0.75, 0.2), dark, -3.0, 2.6, z, false));
  // stripe and numbers
  const stripe = part(new THREE.BoxGeometry(2.4, 0.03, 0.9), toon('#ffffff'), 0, 0, 0, false);
  stripe.position.set(2.0, 2.18, 0);
  stripe.rotation.z = -0.04;
  body.add(stripe);
  const numMat = new THREE.MeshToonMaterial({ map: TX.roundel(number, color.body), transparent: true, alphaTest: 0.5 });
  for (const side of [-1, 1]) {
    const n = part(new THREE.CircleGeometry(0.72, 20), numMat, 0, 0, 0, false);
    n.position.set(-0.4, 1.6, side * 1.82);
    n.rotation.y = side > 0 ? 0 : Math.PI;
    body.add(n);
  }
  const roofNum = part(new THREE.CircleGeometry(0.75, 20), numMat, 0, 0, 0, false);
  roofNum.rotation.x = -Math.PI / 2;
  roofNum.rotation.z = -Math.PI / 2;
  roofNum.position.set(-0.8, 3.72, 0);
  body.add(roofNum);
  // exhaust
  const pipe = part(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 10), toon('#b8c2cc'), 0, 0, 0, false);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(-3.9, 0.95, 0.9);
  body.add(pipe);
  const merged = mergeStatic(body);
  const bodyMerged = new THREE.Group();
  for (const c of [...merged.children]) bodyMerged.add(c);
  root.add(bodyMerged);

  // wheels (outside the leaning body)
  const wheels = [];
  const front = [];
  const tyreGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.95, 20);
  tyreGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.0, 14);
  hubGeo.rotateX(Math.PI / 2);
  const boltGeo = new THREE.BoxGeometry(0.5, 0.12, 1.02);
  for (const [x, z] of [[2.25, -1.75], [2.25, 1.75], [-2.2, -1.75], [-2.2, 1.75]]) {
    const steerer = new THREE.Group();
    steerer.position.set(x, RIDE, z);
    const spin = new THREE.Group();
    const tyreMesh = part(tyreGeo, tyre, 0, 0, 0);
    addOutline(tyreMesh);
    spin.add(tyreMesh);
    spin.add(part(hubGeo, hubMat, 0, 0, 0, false));
    const bolt = new THREE.Mesh(boltGeo, toon(color.body));
    spin.add(bolt);
    steerer.add(spin);
    root.add(steerer);
    wheels.push(spin);
    if (x > 0) front.push(steerer);
  }
  return { root, body: bodyMerged, wheels, front, roll: 0, pitch: 0, squash: 0, squashV: 0 };
}

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

// Bounce a car on landing (strength 0..1).
export function squashCar(mesh, strength) {
  mesh.squashV -= 6 * strength;
}

// Moves a car mesh to match the simulation (with a little visual smoothing).
export function updateCarMesh(mesh, car, dt) {
  mesh.up = mesh.up || new THREE.Vector3(car.up.x, car.up.y, car.up.z);
  mesh.up.lerp(_y.set(car.up.x, car.up.y, car.up.z), 1 - Math.exp(-16 * dt)).normalize();
  _x.set(car.fwd.x, car.fwd.y, car.fwd.z);
  _z.crossVectors(_x, mesh.up).normalize();
  _x.crossVectors(mesh.up, _z).normalize();
  _m.makeBasis(_x, mesh.up, _z);
  mesh.root.quaternion.setFromRotationMatrix(_m);
  mesh.root.position.set(car.pos.x, car.pos.y, car.pos.z);
  mesh.root.visible = !(car.respawnTimer > 0 && Math.floor(car.respawnTimer * 12) % 2 === 0);

  // wheels spin with speed; front wheels steer
  const spin = (car.speed * dt) / WHEEL_R;
  for (const w of mesh.wheels) w.rotation.z -= spin;
  for (const f of mesh.front) f.rotation.y = -car.steer * 0.5;
  // body leans into corners and drifts, tips back when accelerating
  const lean = (car.drifting ? 0.16 : 0.07) * car.steer * Math.min(1, Math.abs(car.speed) / 150);
  mesh.roll += (lean - mesh.roll) * (1 - Math.exp(-8 * dt));
  mesh.body.rotation.x = mesh.roll;
  // springy squash and stretch
  if (dt > 0) {
    mesh.squashV += (-mesh.squash * 120 - mesh.squashV * 9) * dt;
    mesh.squash += mesh.squashV * dt;
    mesh.squash = Math.max(-0.35, Math.min(0.35, mesh.squash));
  }
  const sq = mesh.squash;
  mesh.body.scale.set(1 - sq * 0.4, 1 + sq, 1 - sq * 0.4);
}
