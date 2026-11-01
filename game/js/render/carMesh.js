// Toy car model (about 7.5 cm long) built from simple shapes.
// The model faces +X with +Y up and +Z to its right.
import * as THREE from '../vendor/three.module.min.js';

const WHEEL_R = 0.75;

function extrude(points, depth, mat, bevel = 0.25) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function makeCarMesh(color) {
  const root = new THREE.Group();   // placed at the contact point, oriented to the car
  const body = new THREE.Group();   // leans and bounces
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({ color: color.body, metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1a2533', metalness: 0.2, roughness: 0.05, clearcoat: 1 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202024', roughness: 0.6 });

  // lower body (side profile, extruded across the width)
  body.add(extrude([
    [-3.65, 0.55], [-3.7, 1.55], [-2.3, 1.85], [1.4, 1.8], [3.4, 1.35], [3.75, 0.9], [3.6, 0.5],
  ], 2.9, paint));
  // cabin glass + roof
  body.add(extrude([[-2.0, 1.75], [-1.05, 2.55], [0.45, 2.55], [1.35, 1.75]], 2.5, glass, 0.18));
  const roof = extrude([[-1.0, 2.5], [0.4, 2.5], [0.3, 2.62], [-0.9, 2.62]], 2.3, paint, 0.15);
  body.add(roof);
  // spoiler
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 3.4), paint);
  wing.position.set(-3.3, 2.3, 0);
  wing.castShadow = true;
  body.add(wing);
  for (const z of [-1.1, 1.1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.18), dark);
    strut.position.set(-3.2, 2.0, z);
    body.add(strut);
  }
  // lights
  const head = new THREE.MeshStandardMaterial({ color: '#fff7d0', emissive: '#fff2b0', emissiveIntensity: 0.8 });
  const tail = new THREE.MeshStandardMaterial({ color: '#ff3a2a', emissive: '#ff2010', emissiveIntensity: 0.6 });
  for (const z of [-1.05, 1.05]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.6), head);
    h.position.set(3.72, 1.05, z);
    body.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.7), tail);
    t.position.set(-3.82, 1.25, z);
    body.add(t);
  }
  // racing stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
  stripe.position.set(0, 2.66, 0);
  body.add(stripe);

  // wheels (outside the leaning body)
  const wheels = [];
  const front = [];
  const tyre = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.65, 18);
  tyre.rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.42, 0.42, 0.68, 12);
  hub.rotateX(Math.PI / 2);
  for (const [x, z] of [[2.3, -1.6], [2.3, 1.6], [-2.3, -1.6], [-2.3, 1.6]]) {
    const steerer = new THREE.Group();
    steerer.position.set(x, WHEEL_R, z);
    const spin = new THREE.Group();
    const t = new THREE.Mesh(tyre, rubber);
    t.castShadow = true;
    spin.add(t, new THREE.Mesh(hub, chrome));
    steerer.add(spin);
    root.add(steerer);
    wheels.push(spin);
    if (x > 0) front.push(steerer);
  }
  return { root, body, wheels, front, roll: 0 };
}

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

// Moves a car mesh to match the simulation (with a little visual smoothing).
export function updateCarMesh(mesh, car, dt) {
  // smooth the up vector so landings and bumps don't snap the body
  mesh.up = mesh.up || new THREE.Vector3(car.up.x, car.up.y, car.up.z);
  mesh.up.lerp(_y.set(car.up.x, car.up.y, car.up.z), 1 - Math.exp(-14 * dt)).normalize();
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
  for (const f of mesh.front) f.rotation.y = -car.steer * 0.45;
  // body leans into corners/drifts
  const lean = (car.drifting ? 0.12 : 0.05) * car.steer * Math.min(1, Math.abs(car.speed) / 150);
  mesh.roll += (lean - mesh.roll) * (1 - Math.exp(-8 * dt));
  mesh.body.rotation.x = mesh.roll;
}
