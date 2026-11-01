// Cartoon look: cel-shaded materials, ink outlines and merging of static
// scenery into a few big meshes (so four split-screen views stay fast).
import * as THREE from '../vendor/three.module.min.js';

let gradient = null;
function gradientMap() {
  if (gradient) return gradient;
  // three flat bands of light: shadow, mid, lit
  const data = new Uint8Array([110, 185, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map();

// A cel-shaded material. Materials with the same settings are shared, which
// lets the scenery merge into fewer meshes.
export function toon(color, opts = {}) {
  const key = [color, opts.map && opts.map.uuid, opts.emissive, opts.emissiveIntensity, opts.side, opts.transparent, opts.opacity, opts.flat].join('|');
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: opts.map && !color ? '#ffffff' : color || '#ffffff',
      map: opts.map || null,
      gradientMap: gradientMap(),
      emissive: opts.emissive || '#000000',
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      side: opts.side ?? THREE.FrontSide,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

// Flat (unlit) material for glowing things and the sky.
export function flat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, fog: opts.fog ?? true, ...opts });
}

// Ink outline: draws the back faces pushed out along smoothed normals by a
// roughly constant number of pixels (thinner far away).
export const OUTLINE = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    thickness: { value: 0.0045 },
    near: { value: 140 },
    color: { value: new THREE.Color('#2b1c18') },
  }]),
  vertexShader: /* glsl */ `
    uniform float thickness;
    uniform float near;
    #include <fog_pars_vertex>
    void main() {
      vec4 local = vec4(position, 1.0);
      vec3 nrm = normal;
      #ifdef USE_INSTANCING
        local = instanceMatrix * local;
        nrm = mat3(instanceMatrix) * nrm;
      #endif
      vec4 mvPosition = modelViewMatrix * local;
      vec4 clip = projectionMatrix * mvPosition;
      vec2 dir = (projectionMatrix * vec4(normalize(normalMatrix * nrm), 0.0)).xy;
      float l = length(dir);
      if (l > 1e-5) dir /= l;
      dir.x *= projectionMatrix[0][0] / projectionMatrix[1][1];
      float w = max(clip.w, 0.001);
      clip.xy += dir * thickness * min(1.0, near / w) * w;
      gl_Position = clip;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    #include <fog_pars_fragment>
    void main() {
      gl_FragColor = vec4(color, 1.0);
      #include <fog_fragment>
    }`,
  side: THREE.BackSide,
  fog: true,
});

// Copy of a geometry with only positions and normals averaged across
// vertices that share a position, so pushed-out outlines have no cracks.
export function outlineGeometry(geo) {
  const pos = geo.attributes.position;
  const index = geo.index;
  const keys = new Map();
  const out = [];
  const remap = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)}`;
    let j = keys.get(key);
    if (j === undefined) {
      j = out.length / 3;
      keys.set(key, j);
      out.push(x, y, z);
    }
    remap[i] = j;
  }
  const idx = [];
  if (index) for (let i = 0; i < index.count; i++) idx.push(remap[index.getX(i)]);
  else for (let i = 0; i < pos.count; i++) idx.push(remap[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Give a (moving) mesh its own outline child.
export function addOutline(mesh) {
  if (!mesh.geometry.userData.outline) mesh.geometry.userData.outline = outlineGeometry(mesh.geometry);
  const o = mesh.isInstancedMesh
    ? new THREE.InstancedMesh(mesh.geometry.userData.outline, OUTLINE, mesh.count)
    : new THREE.Mesh(mesh.geometry.userData.outline, OUTLINE);
  if (mesh.isInstancedMesh) o.instanceMatrix = mesh.instanceMatrix;
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.isOutline = true;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

// Mesh from a geometry and material, with shadows on.
export function mesh(geo, mat, { cast = true, receive = true, outline = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.userData.outline = outline;
  return m;
}

// A box with rounded edges (cartoon furniture). Centred on the origin.
const roundedCache = new Map();
export function roundedBox(w, h, d, r = 2, segments = 3) {
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  const key = [w, h, d, r, segments].map((v) => v.toFixed(2)).join();
  if (roundedCache.has(key)) return roundedCache.get(key);
  // inner rectangle with tiny rounded corners; the bevel grows it by r on
  // every side, which rounds all twelve edges
  const shape = new THREE.Shape();
  const e = Math.max(0.02, r * 0.08);
  const x0 = -w / 2 + r + e, x1 = w / 2 - r - e, y0 = -h / 2 + r + e, y1 = h / 2 - r - e;
  shape.moveTo(x0, y0 - e);
  shape.lineTo(x1, y0 - e);
  shape.absarc(x1, y0, e, -Math.PI / 2, 0, false);
  shape.lineTo(x1 + e, y1);
  shape.absarc(x1, y1, e, 0, Math.PI / 2, false);
  shape.lineTo(x0, y1 + e);
  shape.absarc(x0, y1, e, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0 - e, y0);
  shape.absarc(x0, y0, e, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: segments, curveSegments: 4,
  });
  geo.translate(0, 0, -(d - 2 * r) / 2);
  geo.computeVertexNormals();
  roundedCache.set(key, geo);
  return geo;
}

// Merge every static mesh under `root` into one mesh per material, plus one
// mesh holding all their outlines. Instanced meshes and anything marked
// `userData.dynamic` are kept as they are.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const out = new THREE.Group();
  const byMat = new Map();
  const outlines = [];
  const keep = [];
  const visit = (o) => {
    if (o.userData.dynamic || o.isInstancedMesh || o.isLight || o.isPoints || o.isSprite) {
      if (o !== root) { keep.push(o); return; }
    }
    if (o.isMesh && !o.userData.isOutline) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      if (!byMat.has(key)) byMat.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
      byMat.get(key).geos.push(g);
      if (o.userData.outline !== false) {
        if (!o.geometry.userData.outline) o.geometry.userData.outline = outlineGeometry(o.geometry);
        const og = o.geometry.userData.outline.clone();
        og.applyMatrix4(o.matrixWorld);
        outlines.push(og);
      }
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);
  for (const { mat, cast, receive, geos } of byMat.values()) {
    const m = new THREE.Mesh(concat(geos, ['position', 'normal', 'uv']), mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.matrixAutoUpdate = false;
    out.add(m);
  }
  if (outlines.length) {
    const o = new THREE.Mesh(concatIndexed(outlines), OUTLINE);
    o.matrixAutoUpdate = false;
    out.add(o);
  }
  for (const k of keep) out.attach(k);
  return out;
}

function concat(geos, names) {
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const g = new THREE.BufferGeometry();
  for (const name of names) {
    const size = geos[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const s of geos) {
      arr.set(s.attributes[name].array, off);
      off += s.attributes[name].count * size;
    }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  g.computeBoundingSphere();
  return g;
}

function concatIndexed(geos) {
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3);
  const idx = [];
  let base = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, base * 3);
    nrm.set(g.attributes.normal.array, base * 3);
    const ix = g.index;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(total > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
