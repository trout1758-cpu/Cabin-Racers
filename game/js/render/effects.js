// Cartoon particles: drift smoke, landing dust, splashes, sparks. One
// instanced mesh for everything.
import * as THREE from '../vendor/three.module.min.js';
import { toon } from './toon.js';

const MAX = 600;

export class Effects {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.15 }), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color('#ffffff'));
    scene.add(this.mesh);
    this.p = [];
    this.o = new THREE.Object3D();
    this.c = new THREE.Color();
  }

  clear() {
    this.p.length = 0;
    this.mesh.count = 0;
  }

  // pos, vel: {x,y,z}; size: cm; life: s; gravity: 0..1
  add(pos, vel, size, life, color, gravity = 0, grow = 1.6) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push({ x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, size, life, age: 0, color, gravity, grow, spin: Math.random() * 6 });
  }

  puff(pos, color = '#f2efe8', size = 1, spread = 12, up = 14) {
    const r = () => (Math.random() - 0.5) * 2;
    this.add(pos, { x: r() * spread, y: up + Math.random() * up * 0.5, z: r() * spread }, size * (0.7 + Math.random() * 0.5), 0.45 + Math.random() * 0.3, color, -0.02);
  }

  landing(pos, strength = 1) {
    const n = Math.round(5 + strength * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add(pos, { x: Math.cos(a) * 30 * strength, y: 6, z: Math.sin(a) * 30 * strength }, 0.6 + strength * 0.5, 0.4, '#f4ead8', 0, 1.4);
    }
  }

  splash(pos) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 50;
      this.add({ x: pos.x, y: Math.max(1, pos.y), z: pos.z }, { x: Math.cos(a) * s, y: 90 + Math.random() * 120, z: Math.sin(a) * s }, 0.8 + Math.random() * 1.2, 0.9, Math.random() < 0.5 ? '#ffffff' : '#8fd6ff', 1, 0.6);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.add({ x: pos.x, y: 0.8, z: pos.z }, { x: Math.cos(a) * 35, y: 2, z: Math.sin(a) * 35 }, 2, 0.6, '#d9f3ff', 0, 1.2);
    }
  }

  sparks(pos, color = '#ffd34d', n = 6) {
    for (let i = 0; i < n; i++) {
      const r = () => (Math.random() - 0.5) * 2;
      this.add(pos, { x: r() * 60, y: 30 + Math.random() * 50, z: r() * 60 }, 0.45, 0.35, color, 0.6, 0.3);
    }
  }

  update(dt) {
    const { o, c } = this;
    let n = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.age += dt;
      if (q.age >= q.life) { this.p.splice(i, 1); continue; }
    }
    for (const q of this.p) {
      q.vy -= 420 * q.gravity * dt;
      const drag = Math.exp(-2.5 * dt * (q.gravity ? 0.3 : 1));
      q.vx *= drag; q.vz *= drag;
      if (!q.gravity) q.vy *= drag;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const t = q.age / q.life;
      const s = q.size * (1 + (q.grow - 1) * t) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
      o.position.set(q.x, q.y, q.z);
      o.rotation.set(q.spin + t * 3, q.spin, 0);
      o.scale.setScalar(Math.max(0.001, s));
      o.updateMatrix();
      this.mesh.setMatrixAt(n, o.matrix);
      this.mesh.setColorAt(n, c.set(q.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
