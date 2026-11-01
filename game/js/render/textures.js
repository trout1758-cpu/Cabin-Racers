// Procedural textures drawn on canvases (no image files needed).
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

function finish(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function noise(ctx, w, h, amount, seed, light = 'rgba(255,255,255,', dark = 'rgba(0,0,0,') {
  const r = rng(seed);
  for (let i = 0; i < w * h * 0.04; i++) {
    const a = r() * amount;
    ctx.fillStyle = (r() < 0.5 ? light : dark) + a + ')';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

// Oak floorboards. One tile covers 120 x 120 cm (8 boards).
export function woodFloor() {
  const [c, ctx] = canvas(1024, 1024);
  const r = rng(7);
  const boardH = 1024 / 8;
  for (let row = 0; row < 8; row++) {
    let x = -r() * 400;
    while (x < 1024) {
      const len = 300 + r() * 500;
      const tone = 0.85 + r() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(128 * tone)},${Math.round(82 * tone)})`;
      ctx.fillRect(x, row * boardH, len, boardH);
      // grain
      ctx.strokeStyle = `rgba(90,55,25,${0.12 + r() * 0.12})`;
      ctx.lineWidth = 1.5;
      for (let g = 0; g < 9; g++) {
        const y = row * boardH + r() * boardH;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < len; k += 40) ctx.lineTo(x + k, y + Math.sin((k + g * 50) * 0.02) * 3 + (r() - 0.5) * 2);
        ctx.stroke();
      }
      if (r() < 0.25) {
        ctx.fillStyle = 'rgba(80,45,20,0.35)';
        ctx.beginPath();
        ctx.ellipse(x + r() * len, row * boardH + boardH / 2, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(40,22,10,0.55)';
      ctx.fillRect(x, row * boardH, 3, boardH);
      x += len;
    }
    ctx.fillStyle = 'rgba(40,22,10,0.6)';
    ctx.fillRect(0, row * boardH, 1024, 3);
  }
  return finish(c, [7.5, 5]);
}

export function rug() {
  const [c, ctx] = canvas(1024, 1024);
  ctx.fillStyle = '#7d2b2b';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = '#e8d3a8';
  ctx.lineWidth = 26;
  ctx.strokeRect(40, 40, 944, 944);
  ctx.strokeStyle = '#2a3f6b';
  ctx.lineWidth = 18;
  ctx.strokeRect(90, 90, 844, 844);
  ctx.fillStyle = '#2a3f6b';
  ctx.save();
  ctx.translate(512, 512);
  for (let k = 0; k < 8; k++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, 150, 50, 140, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e8d3a8';
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#d9a441';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(512 + Math.cos(a) * 360, 512 + Math.sin(a) * 360, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  noise(ctx, 1024, 1024, 0.25, 3);
  return finish(c);
}

export function tiles() {
  const [c, ctx] = canvas(512, 512);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#d9dcdf' : '#f2f2ef';
      ctx.fillRect(x * 128, y * 128, 128, 128);
    }
  }
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(512, i * 128); ctx.stroke();
  }
  noise(ctx, 512, 512, 0.08, 9);
  return finish(c, [4.5, 7.5]);
}

export function fabric(base, seed = 5) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 256; i += 3) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  noise(ctx, 256, 256, 0.12, seed);
  return finish(c, [4, 4]);
}

export function plaster(base) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 0.05, 11);
  return finish(c, [6, 2]);
}

export function granite() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#3c3f44';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(13);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = ['#5d6168', '#202226', '#8b8f96', '#2d3035'][i % 4];
    ctx.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
  }
  return finish(c, [4, 2]);
}

export function darkWood() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(21);
  ctx.strokeStyle = 'rgba(30,15,5,0.3)';
  for (let i = 0; i < 40; i++) {
    const y = r() * 256;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + (r() - 0.5) * 10, 170, y + (r() - 0.5) * 10, 256, y);
    ctx.stroke();
  }
  return finish(c, [2, 2]);
}

// Orange toy-track plastic: a centre groove and a joint every tile.
// u runs across the track, v along it (one tile per 30 cm).
export function trackPlastic() {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#ff8a1c');
  g.addColorStop(0.5, '#ff7a00');
  g.addColorStop(1, '#ff8a1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  // centre groove and lane lines
  ctx.fillStyle = 'rgba(160,60,0,0.35)';
  ctx.fillRect(124, 0, 8, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 0; y < 256; y += 64) {
    ctx.fillRect(60, y + 8, 4, 30);
    ctx.fillRect(192, y + 8, 4, 30);
  }
  // joint between pieces
  ctx.fillStyle = 'rgba(120,40,0,0.55)';
  ctx.fillRect(0, 0, 256, 5);
  ctx.fillStyle = '#2f6fe0';
  ctx.fillRect(100, 0, 56, 14);
  noise(ctx, 256, 256, 0.06, 17);
  return finish(c);
}

export function checker() {
  const [c, ctx] = canvas(128, 32);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const t = finish(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function sky() {
  const [c, ctx] = canvas(64, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#8fc4ff');
  g.addColorStop(0.7, '#d9ecff');
  g.addColorStop(1, '#bfe0a8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  return finish(c);
}
