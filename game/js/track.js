// Track model: a closed, smooth centre line through control points, sampled
// every ~1.5 cm into frames (position, tangent, right, normal) with a width,
// banking, side rails and optional gaps (jumps).
//
// Track definition:
//   { name, laps, width, points: [{ x, y, z, w?, bank?, gap?, rails? }, ...] }
//   - y is the height of the track surface (cm above the floor)
//   - bank: degrees; positive raises the LEFT edge (use it on right-hand turns)
//   - gap: the segment from this point to the next has no surface (a jump)
//   - rails: false removes the side rails on the segment after this point
//   - sharp: true makes a crease at this point (ramp lips, landings)
//   - loop: true lets the segment after this point turn upside down
//     (loop-the-loops); see trackKit.js for helpers that build loops and jumps
import { UP, add, cross, dist, dot, lerp, norm, reject, rotate, scale, sub } from './vec.js';
import { World } from './world.js';

const FLAT_WORLD = { id: 'flat', name: 'Flat', size: { x: 1e5, z: 1e5 } };

const STEP = 1.5;

function catmull(p0, p1, p2, p3, t) {
  // centripetal Catmull–Rom (no cusps or self-loops on uneven spacing)
  const k = (a, b) => Math.max(1e-4, Math.sqrt(dist(a, b)));
  const t1 = k(p0, p1), t2 = t1 + k(p1, p2), t3 = t2 + k(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => lerp(a, b, (u - ta) / (tb - ta));
  const a1 = L(p0, p1, 0, t1), a2 = L(p1, p2, t1, t2), a3 = L(p2, p3, t2, t3);
  const b1 = L(a1, a2, 0, t2), b2 = L(a2, a3, t1, t3);
  return L(b1, b2, t1, t2);
}

export class Track {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.laps = def.laps || 3;
    this.width = def.width || 22;
    this.color = def.color || '#ff7a00';
    this.world = new World(def.world || FLAT_WORLD);
    this.build();
  }

  build() {
    const P = this.def.points;
    const n = P.length;
    const S = [];
    const smooth = (t) => t * t * (3 - 2 * t);
    for (let i = 0; i < n; i++) {
      const p1 = P[i], p2 = P[(i + 1) % n];
      // `sharp` points (ramp lips, landings) get a crease instead of a curve
      const p0 = p1.sharp ? sub(p1, sub(p2, p1)) : P[(i - 1 + n) % n];
      const p3 = p2.sharp ? add(p2, sub(p2, p1)) : P[(i + 2) % n];
      const steps = Math.max(4, Math.ceil(dist(p1, p2) / STEP));
      const w1 = p1.w || this.width, w2 = p2.w || this.width;
      const b1 = p1.bank || 0, b2 = p2.bank || 0;
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        S.push({
          p: catmull(p0, p1, p2, p3, t),
          w: w1 + (w2 - w1) * smooth(t),
          bank: b1 + (b2 - b1) * smooth(t),
          gap: !!p1.gap,
          rail: p1.rails !== false && !p1.gap,
          loop: p1.loop || null,
          ctrl: k === 0 ? i : -1,
        });
      }
    }
    // arc length
    let s = 0;
    for (let k = 0; k < S.length; k++) {
      S[k].s = s;
      s += dist(S[k].p, S[(k + 1) % S.length].p);
    }
    this.length = s;
    // frames: `right` follows the horizontal (so the track stays level unless
    // banked), except in loops where it is carried along by parallel
    // transport so the track can go upside down without flipping.
    let prevR = null;
    for (let k = 0; k < S.length; k++) {
      const a = S[(k - 1 + S.length) % S.length].p, b = S[(k + 1) % S.length].p;
      const t = norm(sub(b, a));
      const hint = cross(t, UP);
      const hl = Math.hypot(hint.x, hint.y, hint.z);
      let r;
      if (S[k].loop && typeof S[k].loop === 'object') {
        // loop-the-loop: "up" points at the loop's axis
        const L = S[k].loop, p = S[k].p;
        const toAxis = reject({ x: L.cx - p.x, y: L.cy - p.y, z: L.cz - p.z }, { x: L.ax, y: 0, z: L.az });
        r = norm(cross(t, norm(toAxis)));
      } else if (!prevR) r = norm(hint);
      else {
        const carried = norm(reject(prevR, t));
        if (S[k].loop || hl < 0.25) r = carried;
        else {
          const h = scale(hint, 1 / hl);
          r = dot(h, carried) > 0 ? norm(lerp(carried, h, 0.15)) : carried;
        }
      }
      prevR = r;
      let rr = r;
      let nrm = cross(r, t);
      const bank = (S[k].bank * Math.PI) / 180;
      if (bank) {
        rr = rotate(r, t, bank);
        nrm = rotate(nrm, t, bank);
      }
      Object.assign(S[k], { t, r: norm(rr), n: norm(nrm) });
    }
    this.samples = S;
  }

  // Frame at arc length s (wraps around the loop).
  frameAt(s) {
    const L = this.length;
    s = ((s % L) + L) % L;
    const S = this.samples;
    let lo = 0, hi = S.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (S[mid].s <= s) lo = mid; else hi = mid - 1;
    }
    const a = S[lo], b = S[(lo + 1) % S.length];
    const segLen = (b.s || L) - a.s;
    const u = segLen > 0 ? (s - a.s) / segLen : 0;
    return { i: lo, s, p: lerp(a.p, b.p, u), t: a.t, r: a.r, n: a.n, w: a.w, gap: a.gap, rail: a.rail, loop: a.loop };
  }

  // Where is point p relative to the track? Searches near `hint` (a sample
  // index) when given. Returns the nearest centre-line point, lateral offset
  // d (positive = right), height h above the surface, and the local frame.
  locate(p, hint) {
    const S = this.samples, N = S.length;
    let best = 0, bestD = Infinity;
    const scan = (from, to) => {
      for (let k = from; k <= to; k++) {
        const i = ((k % N) + N) % N;
        const q = S[i].p;
        const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2;
        if (d2 < bestD) { bestD = d2; best = i; }
      }
    };
    if (hint == null) scan(0, N - 1);
    else scan(hint - 90, hint + 90);
    // refine along the neighbouring segments
    let i0 = best, u = 0;
    let bestSeg = Infinity;
    for (const [ia, ib] of [[(best - 1 + N) % N, best], [best, (best + 1) % N]]) {
      const a = S[ia].p, b = S[ib].p;
      const ab = sub(b, a);
      const l2 = dot(ab, ab) || 1;
      const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
      const c = add(a, scale(ab, t));
      const d2 = (c.x - p.x) ** 2 + (c.y - p.y) ** 2 + (c.z - p.z) ** 2;
      if (d2 < bestSeg) { bestSeg = d2; i0 = ia; u = t; }
    }
    const A = S[i0], B = S[(i0 + 1) % N];
    const segLen = (B.s || this.length) - A.s;
    const c = lerp(A.p, B.p, u);
    const rel = sub(p, c);
    return {
      i: best,
      s: A.s + segLen * u,
      p: c,
      t: A.t, r: A.r, n: A.n,
      w: A.w,
      gap: A.gap,
      rail: A.rail,
      loop: A.loop,
      d: dot(rel, A.r),
      h: dot(rel, A.n),
    };
  }

  // Signed distance along the loop from s1 to s2, in (-L/2, L/2].
  delta(s1, s2) {
    const L = this.length;
    let d = (s2 - s1) % L;
    if (d > L / 2) d -= L;
    if (d <= -L / 2) d += L;
    return d;
  }
}
