// Orange toy-track mesh: surface, edges, side rails, start line and the
// support posts under raised sections.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from '../config.js';
import { groundHeight } from '../house.js';
import * as TX from './textures.js';

const THICK = 0.6;
const RAIL_W = 0.5;

export function buildTrack(track) {
  const g = new THREE.Group();
  const S = track.samples;
  const N = S.length;
  const L = track.length;

  // Ribbon builder: emits quads between consecutive samples, skipping gaps.
  function ribbon(offsetFn, uvFn, include) {
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= N; k++) {
      const s = S[k % N];
      const [a, b] = offsetFn(s);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const v = k === N ? L : s.s;
      const [u0, u1] = uvFn ? uvFn(s) : [0, 1];
      uv.push(u0, v / 30, u1, v / 30);
    }
    for (let k = 0; k < N; k++) {
      if (!include(S[k])) continue;
      const i = k * 2;
      idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
  const at = (s, d, h) => ({
    x: s.p.x + s.r.x * d + s.n.x * h,
    y: s.p.y + s.r.y * d + s.n.y * h,
    z: s.p.z + s.r.z * d + s.n.z * h,
  });
  const surface = (s) => !s.gap;
  const railed = (s) => s.rail && !s.gap;

  const plastic = new THREE.MeshStandardMaterial({ map: TX.trackPlastic(), roughness: 0.32, metalness: 0, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: '#e86400', roughness: 0.4, side: THREE.DoubleSide });

  const top = new THREE.Mesh(ribbon((s) => [at(s, -s.w / 2, 0), at(s, s.w / 2, 0)], null, surface), plastic);
  const bottom = new THREE.Mesh(ribbon((s) => [at(s, s.w / 2, -THICK), at(s, -s.w / 2, -THICK)], null, surface), edge);
  const sideL = new THREE.Mesh(ribbon((s) => [at(s, -s.w / 2, -THICK), at(s, -s.w / 2, 0)], null, surface), edge);
  const sideR = new THREE.Mesh(ribbon((s) => [at(s, s.w / 2, 0), at(s, s.w / 2, -THICK)], null, surface), edge);
  for (const m of [top, bottom, sideL, sideR]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  // Rails: inner face, top and outer face on each side.
  const railMat = new THREE.MeshStandardMaterial({ color: '#ff8c1a', roughness: 0.35, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const inner = (s) => side * s.w / 2, outer = (s) => side * (s.w / 2 + RAIL_W);
    const faces = [
      (s) => [at(s, inner(s), 0), at(s, inner(s), CFG.RAIL_HEIGHT)],
      (s) => [at(s, inner(s), CFG.RAIL_HEIGHT), at(s, outer(s), CFG.RAIL_HEIGHT)],
      (s) => [at(s, outer(s), CFG.RAIL_HEIGHT), at(s, outer(s), -THICK)],
    ];
    for (const f of faces) {
      const m = new THREE.Mesh(ribbon(f, null, railed), railMat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  }

  // Checkered start/finish line
  const f0 = track.frameAt(0);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(f0.w, 3), new THREE.MeshStandardMaterial({ map: TX.checker(), roughness: 0.5 }));
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(f0.r.x, f0.r.y, f0.r.z),
    new THREE.Vector3(f0.t.x, f0.t.y, f0.t.z),
    new THREE.Vector3(f0.n.x, f0.n.y, f0.n.z),
  );
  line.quaternion.setFromRotationMatrix(m);
  line.position.set(f0.p.x + f0.n.x * 0.03, f0.p.y + f0.n.y * 0.03, f0.p.z + f0.n.z * 0.03);
  line.receiveShadow = true;
  g.add(line);
  // finish arch
  const archMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.5 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 18, 10), archMat);
    const p = at(f0, side * (f0.w / 2 + 2), 9);
    post.position.set(p.x, p.y, p.z);
    post.castShadow = true;
    g.add(post);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(1, 4, f0.w + 6), new THREE.MeshStandardMaterial({ map: TX.checker(), roughness: 0.6 }));
  const bp = at(f0, 0, 17);
  banner.position.set(bp.x, bp.y, bp.z);
  banner.rotation.y = Math.atan2(f0.t.x, f0.t.z) + Math.PI / 2;
  banner.castShadow = true;
  g.add(banner);

  // Support posts under raised track (instanced).
  const posts = [];
  for (let s = 0; s < L; s += 32) {
    const f = track.frameAt(s);
    if (f.gap) continue;
    for (const side of [-0.32, 0.32]) {
      const p = at(f, side * f.w, -THICK);
      const ground = groundHeight(p.x, p.z, p.y - 1);
      const h = p.y - ground;
      if (h > 3) posts.push({ x: p.x, z: p.z, y0: ground, h });
    }
  }
  if (posts.length) {
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.9, 1, 10), new THREE.MeshStandardMaterial({ color: '#8d939b', roughness: 0.5, metalness: 0.3 }), posts.length);
    const mtx = new THREE.Matrix4();
    posts.forEach((p, i) => {
      mtx.makeScale(1, p.h, 1);
      mtx.setPosition(p.x, p.y0 + p.h / 2, p.z);
      inst.setMatrixAt(i, mtx);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    g.add(inst);
  }
  return g;
}
