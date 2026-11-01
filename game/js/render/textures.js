// Cartoon textures drawn on canvases: flat colours and bold lines, no image
// files needed. Each function caches its texture.
import * as THREE from '../vendor/three.module.min.js';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const cache = new Map();
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

// Wide planks with dark seams and a few knots. One tile = 1 world unit of UV.
export const planks = (base = '#d79b5e', seam = '#8a5530', boards = 6, seed = 7) => cached(`planks${base}${seam}${boards}${seed}`, () => {
  const [c, ctx] = canvas(512, 512);
  const r = rng(seed);
  const bh = 512 / boards;
  for (let row = 0; row < boards; row++) {
    let x = -r() * 300;
    while (x < 512) {
      const len = 220 + r() * 260;
      ctx.fillStyle = shade(base, (r() - 0.5) * 0.12);
      ctx.fillRect(x, row * bh, len, bh);
      ctx.fillStyle = shade(base, 0.08);
      ctx.fillRect(x, row * bh + 3, len, 3);
      if (r() < 0.5) {
        ctx.strokeStyle = shade(seam, 0.25);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x + r() * len, row * bh + bh * (0.3 + r() * 0.4), 7 + r() * 5, 3 + r() * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = seam;
      ctx.fillRect(x - 2, row * bh, 4, bh);
      x += len;
    }
    ctx.fillStyle = seam;
    ctx.fillRect(0, row * bh - 2, 512, 4);
  }
  return finish(c);
});

// Horizontal logs for cabin walls.
export const logs = () => cached('logs', () => {
  const [c, ctx] = canvas(256, 256);
  const n = 4, h = 256 / n;
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(0, i * h, 0, (i + 1) * h);
    g.addColorStop(0, '#9c5f34');
    g.addColorStop(0.35, '#c88550');
    g.addColorStop(0.65, '#b97540');
    g.addColorStop(1, '#7a4423');
    ctx.fillStyle = g;
    ctx.fillRect(0, i * h, 256, h);
    ctx.strokeStyle = 'rgba(90,50,25,0.45)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const y = i * h + h * (0.3 + k * 0.18);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y - 3, 170, y + 3, 256, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#4e2a14';
    ctx.fillRect(0, (i + 1) * h - 4, 256, 4);
  }
  return finish(c);
});

// Kitchen floor: cream and terracotta checker with grout lines.
export const tiles = () => cached('tiles', () => {
  const [c, ctx] = canvas(256, 256);
  const n = 4, s = 256 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#f1e3c4' : '#d9744a';
    ctx.fillRect(i * s, j * s, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(i * s + 6, j * s + 6, s * 0.4, 5);
  }
  ctx.strokeStyle = '#8f6b52';
  ctx.lineWidth = 4;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(256, i * s); ctx.stroke();
  }
  return finish(c);
});

// A rug: bold border, zig-zags and a diamond in the middle (not tiled).
export const rug = (colors = ['#c8402e', '#f3c843', '#2f6b9a']) => cached('rug' + colors.join(), () => {
  const [c, ctx] = canvas(512, 384);
  const [a, b, d] = colors;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = b;
  ctx.fillRect(22, 22, 468, 340);
  ctx.fillStyle = a;
  ctx.fillRect(34, 34, 444, 316);
  ctx.strokeStyle = b;
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let x = 60; x <= 452; x += 28) ctx.lineTo(x, (x / 28) % 2 < 1 ? 60 : 80);
  ctx.stroke();
  ctx.beginPath();
  for (let x = 60; x <= 452; x += 28) ctx.lineTo(x, (x / 28) % 2 < 1 ? 324 : 304);
  ctx.stroke();
  ctx.fillStyle = d;
  ctx.beginPath();
  ctx.moveTo(256, 110); ctx.lineTo(380, 192); ctx.lineTo(256, 274); ctx.lineTo(132, 192);
  ctx.fill();
  ctx.fillStyle = b;
  ctx.beginPath();
  ctx.moveTo(256, 150); ctx.lineTo(320, 192); ctx.lineTo(256, 234); ctx.lineTo(192, 192);
  ctx.fill();
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// Lawn: mown stripes with darker tufts.
export const grass = () => cached('grass', () => {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#6cc04a';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#62b543';
  ctx.fillRect(0, 0, 128, 256);
  const r = rng(11);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256, y = r() * 256;
    ctx.strokeStyle = r() < 0.5 ? '#4f9a35' : '#86d464';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 3); ctx.lineTo(x, y - 3); ctx.lineTo(x + 3, y + 3);
    ctx.stroke();
  }
  return finish(c);
});

// Sand (sandbox, beach): warm beige with speckles.
export const sand = (base = '#f2d38b') => cached('sand' + base, () => {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  const r = rng(3);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = r() < 0.5 ? shade(base, -0.12) : shade(base, 0.1);
    ctx.fillRect(r() * 128, r() * 128, 2, 2);
  }
  return finish(c);
});

// Water: blue with white cartoon ripples.
export const water = () => cached('water', () => {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#3aa6dd';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(21);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = r() * 256, y = r() * 256, w = 14 + r() * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 4, y - 5, x + w / 2, y);
    ctx.quadraticCurveTo(x + (3 * w) / 4, y + 5, x + w, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,120,180,0.5)';
  for (let i = 0; i < 10; i++) ctx.fillRect(r() * 256, r() * 256, 16 + r() * 20, 3);
  return finish(c);
});

// Cobbled stone (fireplace).
export const stone = () => cached('stone', () => {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#6f6a66';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(5);
  const rows = 6, h = 256 / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 40;
    while (x < 256) {
      const w = 34 + r() * 34;
      ctx.fillStyle = ['#b9b2aa', '#a39b93', '#c9c1b6', '#9a948c'][Math.floor(r() * 4)];
      ctx.beginPath();
      ctx.roundRect(x + 3, row * h + 3, w - 6, h - 6, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 10, row * h + 8, w * 0.4, 4);
      x += w;
    }
  }
  return finish(c);
});

// Tree bark: vertical ridges.
export const bark = () => cached('bark', () => {
  const [c, ctx] = canvas(128, 256);
  ctx.fillStyle = '#7a4b2a';
  ctx.fillRect(0, 0, 128, 256);
  const r = rng(13);
  for (let i = 0; i < 16; i++) {
    const x = r() * 128;
    ctx.strokeStyle = r() < 0.5 ? '#5a3418' : '#8f5c36';
    ctx.lineWidth = 3 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 8, 80, x - 8, 170, x + 4, 256);
    ctx.stroke();
  }
  return finish(c);
});

// The toy track's driving surface: orange with lane lines and chevrons that
// point the way round. u runs across the track, v along it.
export const trackTop = (color = '#ff7a00') => cached('track' + color, () => {
  const [c, ctx] = canvas(128, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = shade(color, -0.12);
  ctx.fillRect(14, 0, 6, 256);
  ctx.fillRect(108, 0, 6, 256);
  ctx.fillStyle = shade(color, 0.16);
  for (const y of [40, 168]) {
    ctx.beginPath();
    ctx.moveTo(40, y + 36); ctx.lineTo(64, y); ctx.lineTo(88, y + 36);
    ctx.lineTo(88, y + 52); ctx.lineTo(64, y + 16); ctx.lineTo(40, y + 52);
    ctx.fill();
  }
  const t = finish(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
});

// Chequered flag pattern.
export const checker = () => cached('checker', () => {
  const [c, ctx] = canvas(64, 16);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
    ctx.fillRect(i * 8, j * 8, 8, 8);
  }
  const t = finish(c);
  t.magFilter = THREE.NearestFilter;
  return t;
});

// Big round racing-number roundel for the cars.
export const roundel = (n, color) => cached(`roundel${n}${color}`, () => {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2b1c18';
  ctx.stroke();
  ctx.fillStyle = '#2b1c18';
  ctx.font = '900 84px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 70);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// Cabin window view: blue sky, snowy hills and pines.
export const windowView = () => cached('window', () => {
  const [c, ctx] = canvas(256, 192);
  const g = ctx.createLinearGradient(0, 0, 0, 192);
  g.addColorStop(0, '#5fb6f0');
  g.addColorStop(1, '#cfeeff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = '#ffffff';
  for (const [x, y, s] of [[50, 40, 1], [180, 60, 0.8]]) {
    ctx.beginPath();
    ctx.arc(x, y, 16 * s, 0, Math.PI * 2); ctx.arc(x + 18 * s, y - 6 * s, 20 * s, 0, Math.PI * 2); ctx.arc(x + 38 * s, y, 15 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f4fbff';
  ctx.beginPath();
  ctx.moveTo(0, 150); ctx.quadraticCurveTo(90, 110, 256, 140); ctx.lineTo(256, 192); ctx.lineTo(0, 192);
  ctx.fill();
  const r = rng(4);
  for (let i = 0; i < 9; i++) {
    const x = r() * 256, y = 125 + r() * 40, h = 40 + r() * 30;
    ctx.fillStyle = '#2f7a4a';
    ctx.beginPath();
    ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.32, y); ctx.lineTo(x - h * 0.32, y);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.1, y - h * 0.7); ctx.lineTo(x - h * 0.1, y - h * 0.7);
    ctx.fill();
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// Soil for the flower bed.
export const soil = () => cached('soil', () => {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(0, 0, 128, 128);
  const r = rng(17);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = r() < 0.5 ? '#553219' : '#80553a';
    ctx.beginPath();
    ctx.arc(r() * 128, r() * 128, 2 + r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c);
});

// Lighten (amount > 0) or darken a hex colour.
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
