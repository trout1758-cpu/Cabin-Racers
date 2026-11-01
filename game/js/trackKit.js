// Helpers for writing track files: headings, loop-the-loops and jumps.
// Headings are angles in the ground plane: 0 = east (+x), 90 = south (+z),
// 180 = west, 270 = north. "Right" is 90 degrees clockwise seen from above.

const RAD = Math.PI / 180;
export const fwdOf = (deg) => ({ x: Math.cos(deg * RAD), z: Math.sin(deg * RAD) });
export const rightOf = (deg) => ({ x: -Math.sin(deg * RAD), z: Math.cos(deg * RAD) });

// Point `ahead` cm along heading `deg` and `right` cm to its right, from (x, z).
export function along(x, y, z, deg, ahead, right = 0, extra = {}) {
  const f = fwdOf(deg), r = rightOf(deg);
  return { x: x + f.x * ahead + r.x * right, y, z: z + f.z * ahead + r.z * right, ...extra };
}

// A loop-the-loop starting at its bottom (x, y, z) heading `deg`. The track
// comes out `shift` cm to the side (to the right if positive) so it doesn't
// run into itself. Lead in on the same line; lead out `shift` to the side.
export function loop(x, y, z, deg, { r = 26, shift = 34, steps = 24 } = {}) {
  const pts = [];
  // the track's "up" points at the loop's axis (a horizontal line through
  // its centre, across the direction of travel)
  const ax = rightOf(deg);
  const axis = { cx: x, cy: y + r, cz: z, ax: ax.x, az: ax.z };
  for (let k = 0; k <= steps; k++) {
    const u = k / steps, phi = u * Math.PI * 2;
    const side = shift * u * u * (3 - 2 * u);
    // creases at the bottom keep the flat track either side from dipping
    const extra = k < steps ? { loop: axis } : {};
    if (k === 0 || k === steps) extra.sharp = true;
    pts.push(along(x, y + r * (1 - Math.cos(phi)), z, deg, r * Math.sin(phi), side, extra));
  }
  return pts;
}

// A ramp jump: take-off ramp starting at (x, y, z) heading `deg`, rising
// `rise` cm over `ramp` cm, a `gap` with no track, and a landing ramp that
// comes back down to `y + end` over `land` cm.
export function jump(x, y, z, deg, { ramp = 45, rise = 11, gap = 36, drop = 3, land = 40, end = 0, w } = {}) {
  const P = (d, h, extra) => along(x, y + h, z, deg, d, 0, { sharp: true, ...(w ? { w } : {}), ...extra });
  return [
    P(0, 0),
    P(ramp, rise, { gap: true }),
    P(ramp + gap, rise - drop),
    P(ramp + gap + land, end),
  ];
}

// Points along a circular arc around (cx, cz) from angle a0 to a1 (degrees,
// measured like headings: 0 = east of the centre, 90 = south). Increasing
// angles go clockwise seen from above (a right-hand turn). Height goes from
// y0 to y1, so a1 - a0 beyond 360 makes a spiral. `bank` is applied in the
// direction of the turn.
export function arc(cx, cz, r, a0, a1, { y0 = 0.6, y1 = y0, step = 20, bank = 0, w } = {}) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  const turn = Math.sign(a1 - a0);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * RAD;
    const p = { x: cx + r * Math.cos(a), y: y0 + ((y1 - y0) * i) / n, z: cz + r * Math.sin(a) };
    if (bank) p.bank = bank * turn;
    if (w) p.w = w;
    pts.push(p);
  }
  return pts;
}
