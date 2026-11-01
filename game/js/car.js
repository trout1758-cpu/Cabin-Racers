// Arcade car physics (kart-racer style, not a rigid-body simulation).
// Cars stick to whatever they are driving on (the toy track or a piece of
// furniture), launch off ramp lips, drift, scrape along the rails and get
// put back on the track if they fall off or stay off it too long, or if
// they land in water. Loop-the-loops work as long as you keep your speed up.
import { CFG } from './config.js';
import { UP, add, addScaled, clamp, copy, cross, dot, lerp, norm, reject, rotate, scale, sub, v3 } from './vec.js';

const DOWN = { x: 0, y: -1, z: 0 };

export class Car {
  constructor(index, track, s, lateral = 0) {
    this.index = index;
    this.respawnTimer = 0;
    this.steer = 0;
    this.drifting = false;
    this.driftDir = 0;
    this.placeOnTrack(track, s, lateral);
  }

  placeOnTrack(track, s, lateral = 0) {
    const f = track.frameAt(s);
    this.pos = add(addScaled(f.p, f.r, lateral), scale(f.n, 0.02));
    this.vel = v3();
    this.fwd = copy(f.t);
    this.up = copy(f.n);
    this.grounded = true;
    this.surface = 'track';
    this.hint = f.i;
    this.loc = track.locate(this.pos, f.i);
    this.offTrack = 0;
    this.airTime = 0;
    this.safeS = f.s;
    this.speed = 0;
    this.drifting = false;
  }
}

// Advance one car by dt. input: { throttle 0..1, brake 0..1, steer -1..1 (right +), drift bool }.
// Returns events: land, wall, fell, splash, respawned, driftStart, driftEnd.
export function stepCar(car, inp, track, dt) {
  const ev = [];
  const world = track.world;
  if (car.respawnTimer > 0) {
    car.respawnTimer -= dt;
    if (car.respawnTimer <= 0) {
      // back a little from the last safe spot, but never into a gap or a loop
      let s = car.safeS - 25;
      for (let k = 0; k < 60; k++) {
        const f = track.frameAt(s);
        if (!f.gap && !f.loop && f.n.y > 0.8) break;
        s -= 10;
      }
      car.placeOnTrack(track, s, 0);
      ev.push({ type: 'respawned' });
    }
    return ev;
  }
  car.steer += clamp(inp.steer - car.steer, -7 * dt, 7 * dt);

  // ---- what are we standing on? --------------------------------------------------
  const loc = track.locate(car.pos, car.hint);
  car.hint = loc.i;
  car.loc = loc;
  const snap = car.grounded ? CFG.SNAP : 0.15;
  let sup = null;
  if (!loc.gap && Math.abs(loc.d) <= loc.w / 2 + 0.3 && loc.h > -2.5 && loc.h < snap) {
    sup = { kind: 'track', n: loc.n, h: loc.h };
  } else {
    const g = world.groundHeight(car.pos.x, car.pos.z, car.pos.y);
    const h = car.pos.y - g;
    if (h > -2.5 && h < snap) sup = { kind: g > 0.5 ? 'solid' : 'ground', n: UP, h };
  }
  let grounded = false;
  if (sup) {
    const vn = dot(car.vel, sup.n);
    // stay glued unless we're flying off a ramp lip; land when we reach the surface
    grounded = car.grounded ? !(vn > CFG.LAUNCH_SPEED && sup.h > 0.02) : sup.h <= 0.15 && vn <= 5;
    // too slow on a wall or upside down in a loop: let go
    if (grounded && sup.n.y < 0.25 && dot(car.vel, car.fwd) < CFG.LOOP_MIN_SPEED) grounded = false;
    if (grounded && !car.grounded) ev.push({ type: 'land', impact: Math.max(0, -vn), air: car.airTime });
  }
  if (grounded && sup.kind === 'ground' && world.waterAt(car.pos.x, car.pos.z)) {
    // splash! sink and get put back on the track
    car.respawnTimer = CFG.RESPAWN_DELAY;
    car.grounded = false;
    car.vel = v3();
    ev.push({ type: 'splash', pos: copy(car.pos) });
    return ev;
  }

  if (grounded) {
    const n = sup.n;
    car.surface = sup.kind;
    car.pos = addScaled(car.pos, n, -sup.h);
    car.up = n;
    let f = norm(reject(car.fwd, n));
    let side = norm(cross(f, n)); // points to the car's right
    const v0 = reject(car.vel, n);
    let vf = dot(v0, f), vs = dot(v0, side);
    const offroad = sup.kind !== 'track';
    const maxS = offroad ? CFG.OFFROAD_MAX : CFG.MAX_SPEED;

    // Drift: hold drift while turning at speed; slides with less grip but turns tighter.
    if (inp.drift && vf > CFG.DRIFT_MIN_SPEED && !offroad) {
      if (!car.drifting && Math.abs(car.steer) > 0.25) {
        car.drifting = true;
        car.driftDir = Math.sign(car.steer);
        ev.push({ type: 'driftStart' });
      }
    } else if (car.drifting) {
      car.drifting = false;
      ev.push({ type: 'driftEnd' });
    }

    // Steering: little effect when crawling, a bit less at top speed.
    const speedK = clamp(Math.abs(vf) / 70, 0, 1) * (1 - 0.3 * clamp(Math.abs(vf) / CFG.MAX_SPEED, 0, 1));
    let steer = car.steer;
    if (car.drifting) steer = clamp(car.driftDir * 0.55 + steer * 0.6, -1.2, 1.2);
    const yaw = steer * CFG.STEER_RATE * speedK * (car.drifting ? CFG.DRIFT_STEER : 1) * (vf < -1 ? -1 : 1);
    f = norm(rotate(f, n, -yaw * dt));
    side = norm(cross(f, n));

    // Engine, brakes (brake past zero = reverse), drag.
    if (inp.throttle > 0 && vf < maxS) vf += CFG.ACCEL * inp.throttle * (1 - Math.max(0, vf) / maxS) * dt;
    if (inp.brake > 0 && !car.drifting) {
      if (vf > 2) vf = Math.max(0, vf - CFG.BRAKE * inp.brake * dt);
      else vf = Math.max(-CFG.REVERSE_MAX, vf - CFG.REVERSE_ACCEL * inp.brake * dt);
    }
    vf -= vf * (CFG.DRAG + (offroad ? CFG.OFFROAD_DRAG : 0)) * dt;
    if (!(inp.throttle > 0) && !(inp.brake > 0)) {
      const r = CFG.ROLLING * dt;
      vf = Math.abs(vf) <= r ? 0 : vf - Math.sign(vf) * r;
    }
    if (vf > maxS) vf -= (vf - maxS) * 3 * dt;

    // Grip kills sideways sliding (less of it while drifting).
    const grip = car.drifting ? CFG.DRIFT_GRIP : offroad ? CFG.GRIP * 0.6 : CFG.GRIP;
    vs *= Math.exp(-grip * dt);

    let vel = add(scale(f, vf), scale(side, vs));
    // Slopes: toy-car gravity (gentler than real, or nobody could climb the table ramp).
    vel = addScaled(vel, reject(scale(DOWN, CFG.GRAVITY), n), CFG.SLOPE_GRAVITY * dt);
    car.fwd = f;
    car.vel = vel;
    car.pos = addScaled(car.pos, vel, dt);
    car.airTime = 0;

    // Side rails keep you on the track.
    if (sup.kind === 'track') {
      const l2 = track.locate(car.pos, car.hint);
      const lim = l2.w / 2 - CFG.CAR_WIDTH / 2;
      if (l2.rail && Math.abs(l2.d) > lim) {
        const out = Math.sign(l2.d);
        car.pos = addScaled(car.pos, l2.r, -(Math.abs(l2.d) - lim) * out);
        const vOut = dot(car.vel, l2.r) * out;
        if (vOut > 0) {
          car.vel = addScaled(car.vel, l2.r, -vOut * out * 1.25);
          car.vel = scale(car.vel, 1 - Math.min(0.25, vOut / 500));
          if (vOut > 18) ev.push({ type: 'wall', impact: vOut });
        }
      }
    }
  } else {
    // Airborne: ballistic, a little steering, the car levels out.
    car.surface = null;
    car.vel = addScaled(car.vel, DOWN, CFG.GRAVITY * dt);
    car.fwd = norm(rotate(car.fwd, UP, -car.steer * CFG.AIR_STEER * dt));
    car.up = norm(lerp(car.up, UP, Math.min(1, 2.5 * dt)));
    car.pos = addScaled(car.pos, car.vel, dt);
    car.airTime += dt;
    if (car.drifting) car.drifting = false;
  }
  car.grounded = grounded;

  // Can't drive through the rails from the outside, either.
  if (car.surface !== 'track') {
    const l3 = track.locate(car.pos, car.hint);
    const half = l3.w / 2, edge = half + CFG.CAR_WIDTH / 2;
    if (l3.rail && !l3.gap && Math.abs(l3.d) > half - 0.5 && Math.abs(l3.d) < edge && l3.h > -1.5 && l3.h < CFG.RAIL_HEIGHT) {
      const out = Math.sign(l3.d);
      car.pos = addScaled(car.pos, l3.r, (edge - Math.abs(l3.d)) * out);
      const vIn = -dot(car.vel, l3.r) * out;
      if (vIn > 0) car.vel = addScaled(car.vel, l3.r, vIn * out);
    }
  }

  // Furniture sides and the room walls.
  const hit = world.pushOut(car.pos, CFG.CAR_RADIUS);
  if (hit) {
    const into = car.vel.x * hit.x + car.vel.z * hit.z;
    if (into < 0) {
      car.vel.x -= hit.x * into * 1.2;
      car.vel.z -= hit.z * into * 1.2;
      if (-into > 25) ev.push({ type: 'wall', impact: -into });
    }
  }

  car.speed = dot(car.vel, car.fwd);

  // Off the track too long (or fallen somewhere silly)? Put it back.
  if (grounded && car.surface === 'track') {
    car.offTrack = 0;
    if (Math.abs(loc.d) < loc.w / 2 - 2 && !loc.gap && !loc.loop && loc.n.y > 0.8) car.safeS = loc.s;
  } else {
    car.offTrack += dt;
  }
  if (car.offTrack > CFG.RESPAWN_OFFTRACK || car.pos.y < -40) {
    car.respawnTimer = CFG.RESPAWN_DELAY;
    car.vel = v3();
    ev.push({ type: 'fell' });
  }
  return ev;
}

// Steering that follows the track: used by finished cars, the title-screen
// demo and the tests. (Not an opponent AI.)
export function autopilot(car, track, lookahead = 34) {
  const s = car.loc ? car.loc.s : 0;
  // look less far ahead in loops, where the track bends sharply upward
  const look = car.loc && car.loc.loop ? 14 : lookahead;
  const target = track.frameAt(s + look).p;
  // work in the plane the car is driving on
  const to = norm(reject(sub(target, car.pos), car.up));
  const side = norm(cross(car.fwd, car.up));
  const err = dot(to, side);
  const ahead = dot(to, car.fwd);
  return {
    throttle: ahead > 0.3 ? 1 : 0.4,
    brake: 0,
    steer: clamp(err * 3.2 + (ahead < 0 ? Math.sign(err || 1) : 0), -1, 1),
    drift: false,
  };
}
