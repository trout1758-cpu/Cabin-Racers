// The toy track: a U-shaped cross-section (surface + side rails) swept along
// the track, with an ink outline, a start arch and support posts under
// raised sections.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from '../config.js';
import * as TX from './textures.js';
import { OUTLINE, addOutline, mesh, toon } from './toon.js';

const THICK = 0.7;
const RAIL_W = 0.8;

// Cross-section (d across, h up) for a sample; rails collapse to nothing
// where there are none so every ring has the same number of points.
function profile(s) {
  const w = s.w / 2, rw = s.rail ? RAIL_W : 0, rh = s.rail ? CFG.RAIL_HEIGHT : 0;
  return [
    [-w - rw, -THICK], [-w - rw, rh], [-w, rh], [-w, 0],
    [w, 0], [w, rh], [w + rw, rh], [w + rw, -THICK],
  ];
}
const TOP_EDGE = 3; // profile edge 3 -> 4 is the driving surface

export function buildTrack(track) {
  const g = new THREE.Group();
  const S = track.samples, N = S.length, L = track.length;
  const at = (s, d, h) => new THREE.Vector3(
    s.p.x + s.r.x * d + s.n.x * h,
    s.p.y + s.r.y * d + s.n.y * h,
    s.p.z + s.r.z * d + s.n.z * h,
  );
  const rings = S.map((s) => profile(s).map(([d, h]) => at(s, d, h)));
  const P = 8;

  // ---- main body: flat-shaded faces, surface textured -------------------------
  const top = { pos: [], uv: [], idx: [] }, body = { pos: [], idx: [] };
  for (let k = 0; k < N; k++) {
    if (S[k].gap) continue;
    const a = rings[k], b = rings[(k + 1) % N];
    const v0 = S[k].s / 32, v1 = (k + 1 === N ? L : S[k + 1].s) / 32;
    for (let e = 0; e < P; e++) {
      const e2 = (e + 1) % P;
      const quad = [a[e], a[e2], b[e2], b[e]];
      if (e === TOP_EDGE) {
        const base = top.pos.length / 3;
        for (const q of quad) top.pos.push(q.x, q.y, q.z);
        top.uv.push(0, v0, 1, v0, 1, v1, 0, v1);
        top.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      } else {
        const base = body.pos.length / 3;
        for (const q of quad) body.pos.push(q.x, q.y, q.z);
        body.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  // end caps where the track stops at a jump
  for (let k = 0; k < N; k++) {
    const startGap = S[k].gap && !S[(k - 1 + N) % N].gap;
    const endGap = !S[k].gap && S[(k - 1 + N) % N].gap;
    if (!startGap && !endGap) continue;
    const r = rings[k];
    const base = body.pos.length / 3;
    for (const q of r) body.pos.push(q.x, q.y, q.z);
    // base slab + the two rails, as triangles of the U shape
    const tris = [[0, 7, 3], [3, 7, 4], [0, 3, 1], [1, 3, 2], [4, 7, 5], [5, 7, 6]];
    for (const [i, j, l] of tris) {
      if (startGap) body.idx.push(base + i, base + l, base + j);
      else body.idx.push(base + i, base + j, base + l);
    }
  }
  const geo = (d) => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
    if (d.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
    gg.setIndex(d.idx);
    const flatGeo = gg.toNonIndexed();
    flatGeo.computeVertexNormals();
    return flatGeo;
  };
  const surface = mesh(geo(top), toon(null, { map: TX.trackTop(track.color), side: THREE.DoubleSide }), { outline: false });
  const sides = mesh(geo(body), toon(TX.shade(track.color, -0.18), { side: THREE.DoubleSide }), { outline: false });
  g.add(surface, sides);

  // ---- outline: the outer box of the cross-section with corner normals --------
  const opos = [], onrm = [], oidx = [];
  const corner = (s) => {
    const w = s.w / 2 + (s.rail ? RAIL_W : 0), h = s.rail ? CFG.RAIL_HEIGHT : 0;
    return [[-w, -THICK, -1, -1], [-w, h, -1, 1], [w, h, 1, 1], [w, -THICK, 1, -1]];
  };
  for (let k = 0; k < N; k++) {
    for (const [d, h, nd, nh] of corner(S[k])) {
      const p = at(S[k], d, h);
      opos.push(p.x, p.y, p.z);
      const n = new THREE.Vector3(S[k].r.x * nd + S[k].n.x * nh, S[k].r.y * nd + S[k].n.y * nh, S[k].r.z * nd + S[k].n.z * nh).normalize();
      onrm.push(n.x, n.y, n.z);
    }
  }
  for (let k = 0; k < N; k++) {
    if (S[k].gap) continue;
    const a = k * 4, b = ((k + 1) % N) * 4;
    for (let e = 0; e < 4; e++) {
      const e2 = (e + 1) % 4;
      oidx.push(a + e, a + e2, b + e2, a + e, b + e2, b + e);
    }
  }
  const og = new THREE.BufferGeometry();
  og.setAttribute('position', new THREE.Float32BufferAttribute(opos, 3));
  og.setAttribute('normal', new THREE.Float32BufferAttribute(onrm, 3));
  og.setIndex(oidx);
  const outline = new THREE.Mesh(og, OUTLINE);
  g.add(outline);

  for (const m of [surface, sides]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  // ---- start line and arch ----------------------------------------------------
  const f0 = track.frameAt(0);
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(f0.r.x, f0.r.y, f0.r.z),
    new THREE.Vector3(f0.n.x, f0.n.y, f0.n.z),
    new THREE.Vector3(-f0.t.x, -f0.t.y, -f0.t.z),
  );
  const arch = new THREE.Group();
  arch.quaternion.setFromRotationMatrix(basis);
  arch.position.set(f0.p.x, f0.p.y, f0.p.z);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(f0.w, 3), toon(null, { map: TX.checker() }));
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.04;
  line.receiveShadow = true;
  arch.add(line);
  const postMat = toon('#ffffff');
  for (const side of [-1, 1]) {
    const post = mesh(new THREE.CylinderGeometry(0.9, 1.1, 24, 12), postMat);
    post.position.set(side * (f0.w / 2 + 3), 12, 0);
    addOutline(post);
    arch.add(post);
    const ball = mesh(new THREE.SphereGeometry(1.8, 12, 8), toon('#e8473b'));
    ball.position.set(side * (f0.w / 2 + 3), 24.5, 0);
    addOutline(ball);
    arch.add(ball);
  }
  const bannerTex = TX.checker().clone();
  bannerTex.needsUpdate = true;
  bannerTex.repeat.set(2, 1);
  const banner = mesh(new THREE.BoxGeometry(f0.w + 9, 5, 0.8), [toon('#e8473b'), toon('#e8473b'), toon('#e8473b'), toon('#e8473b'), toon(null, { map: bannerTex }), toon(null, { map: bannerTex })]);
  banner.position.set(0, 20, 0);
  addOutline(banner);
  arch.add(banner);
  g.add(arch);

  // ---- support posts under raised track ---------------------------------------
  const posts = [];
  const W = track.world;
  for (let s = 0; s < L; s += 30) {
    const f = track.frameAt(s);
    if (f.gap || f.loop || f.n.y < 0.85) continue;
    for (const side of [-0.32, 0.32]) {
      const p = at(f, side * f.w, -THICK);
      const ground = W.groundHeight(p.x, p.z, p.y - 1);
      const h = p.y - ground;
      if (h > 3) posts.push({ x: p.x, z: p.z, y0: W.waterAt(p.x, p.z) && ground < 0.5 ? -10 : ground, h: h + (W.waterAt(p.x, p.z) && ground < 0.5 ? 10 : 0) });
    }
  }
  if (posts.length) {
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.1, 1, 10), toon('#ffd34d'), posts.length);
    const mtx = new THREE.Matrix4();
    posts.forEach((p, i) => {
      mtx.makeScale(1, p.h, 1);
      mtx.setPosition(p.x, p.y0 + p.h / 2, p.z);
      inst.setMatrixAt(i, mtx);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    addOutline(inst);
    g.add(inst);
  }

  // ---- loop bases: a clamp under the bottom of each loop ----------------------
  for (let k = 1; k < N; k++) {
    if (S[k].loop && !S[k - 1].loop) {
      const f = S[k];
      const base = mesh(new THREE.BoxGeometry(f.w + 8, 1.5, 40), toon('#2f86c9'));
      base.position.set(f.p.x, f.p.y - THICK - 0.75, f.p.z);
      base.rotation.y = Math.atan2(-f.t.z, f.t.x) + Math.PI / 2;
      addOutline(base);
      g.add(base);
    }
  }
  return g;
}
