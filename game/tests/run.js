#!/usr/bin/env node
// Headless tests for the race simulation. Run: node game/tests/run.js
import { Car, autopilot, respawnSpot, stepCar } from '../js/car.js';
import { CFG } from '../js/config.js';
import { Race } from '../js/race.js';
import { Track } from '../js/track.js';
import { loop } from '../js/trackKit.js';
import { TRACKS, WORLDS } from '../js/worlds/index.js';
import { cross, dot, len, norm, sub } from '../js/vec.js';

let passes = 0, failures = 0;
function test(name, fn) {
  try {
    fn();
    passes++;
    console.log('  ok  ' + name);
  } catch (err) {
    failures++;
    console.log('FAIL  ' + name + '\n      ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n      ') : err));
  }
}
function assert(c, msg) {
  if (!c) throw new Error(msg || 'assertion failed');
}

const DT = 1 / CFG.SIM_HZ;
const idle = { throttle: 0, brake: 0, steer: 0, drift: false };

function drive(car, track, seconds, input) {
  const evs = [];
  for (let t = 0; t < seconds; t += DT) {
    const inp = typeof input === 'function' ? input(car) : input;
    evs.push(...stepCar(car, inp, track, DT));
  }
  return evs;
}

// Runs a race where every car uses the autopilot; returns events.
function autoRace(def, players = 1, maxSeconds = 400, speed = 1) {
  const track = new Track(def);
  const race = new Race(track, players, { laps: def.laps, speed });
  const evs = [];
  for (let t = 0; t < maxSeconds && race.state !== 'done'; t += DT) {
    evs.push(...race.step(DT, race.cars.map((c) => autopilot(c, track))));
  }
  return { race, track, evs };
}

console.log('Track');
for (const def of TRACKS) {
  test(`${def.name}: builds orthonormal frames`, () => {
    const t = new Track(def);
    assert(t.length > 500, 'length ' + t.length);
    for (const s of t.samples) {
      assert(Math.abs(len(s.t) - 1) < 1e-6 && Math.abs(len(s.r) - 1) < 1e-6 && Math.abs(len(s.n) - 1) < 1e-6, 'unit');
      assert(Math.abs(dot(s.t, s.r)) < 1e-6 && Math.abs(dot(s.t, s.n)) < 1e-6 && Math.abs(dot(s.r, s.n)) < 1e-6, 'orthogonal');
      assert(s.loop || s.n.y > 0.3, 'surface faces up');
    }
  });
  test(`${def.name}: stays inside its world`, () => {
    const t = new Track(def);
    const S = t.world.size;
    for (const s of t.samples) {
      for (const side of [-1, 1]) {
        const x = s.p.x + s.r.x * side * s.w / 2, z = s.p.z + s.r.z * side * s.w / 2;
        assert(x > 2 && z > 2 && x < S.x - 2 && z < S.z - 2, `edge outside the world at s=${s.s.toFixed(0)}`);
      }
    }
  });
  test(`${def.name}: clear of furniture and scenery`, () => {
    const t = new Track(def);
    for (const s of t.samples) {
      if (s.gap) continue;
      for (const d of [-s.w / 2 - 1, -s.w / 4, 0, s.w / 4, s.w / 2 + 1]) {
        const p = { x: s.p.x + s.r.x * d, y: s.p.y + s.r.y * d, z: s.p.z + s.r.z * d };
        // the solid must not poke up through the track or sit within a car's height above it
        const lo = p.y - 0.7, hi = p.y + 6;
        for (const b of t.world.boxes) {
          if (p.x > b.min[0] && p.x < b.max[0] && p.z > b.min[2] && p.z < b.max[2] && b.max[1] > lo && b.min[1] < hi) {
            throw new Error(`hits ${b.name || b.look} at s=${s.s.toFixed(0)} (${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)})`);
          }
        }
        for (const c of t.world.cyls) {
          if ((p.x - c.x) ** 2 + (p.z - c.z) ** 2 < c.r * c.r && c.y1 > lo && c.y0 < hi) {
            throw new Error(`hits ${c.name || c.look} at s=${s.s.toFixed(0)} (${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)})`);
          }
        }
      }
    }
  });
  test(`${def.name}: never dips into the ground`, () => {
    const t = new Track(def);
    for (const s of t.samples) {
      if (s.gap) continue;
      const g = t.world.groundHeight(s.p.x, s.p.z, s.p.y);
      assert(s.p.y - g > 0.2, `track at y=${s.p.y.toFixed(2)} over ground at ${g} (s=${s.s.toFixed(0)}, x=${s.p.x.toFixed(0)}, z=${s.p.z.toFixed(0)})`);
    }
  });
  test(`${def.name}: never runs into itself`, () => {
    const t = new Track(def);
    const S = t.samples, N = S.length;
    for (let i = 0; i < N; i += 2) {
      for (let j = i + 2; j < N; j += 2) {
        const along = Math.min(Math.abs(S[i].s - S[j].s), t.length - Math.abs(S[i].s - S[j].s));
        if (along < 70) continue;
        const a = S[i].p, b = S[j].p;
        const flat = Math.hypot(a.x - b.x, a.z - b.z);
        if (flat < (S[i].w + S[j].w) / 2 + 3 && Math.abs(a.y - b.y) < 10 && !(S[i].loop || S[j].loop)) {
          throw new Error(`overlaps itself at s=${S[i].s.toFixed(0)} and s=${S[j].s.toFixed(0)}`);
        }
      }
    }
  });
}

test('positive bank raises the left edge', () => {
  const t = new Track({ name: 'b', width: 20, points: [{ x: 100, y: 1, z: 100, bank: 15 }, { x: 300, y: 1, z: 100, bank: 15 }, { x: 300, y: 1, z: 300, bank: 15 }, { x: 100, y: 1, z: 300, bank: 15 }] });
  const s = t.samples[5];
  const right = s.p.y + s.r.y * 10, left = s.p.y - s.r.y * 10;
  assert(left > right + 1, `left ${left} right ${right}`);
});

test('locate finds lateral offset and height', () => {
  const t = new Track(TRACKS[0]);
  const f = t.frameAt(100);
  const p = { x: f.p.x + f.r.x * 5 + f.n.x * 2, y: f.p.y + f.r.y * 5 + f.n.y * 2, z: f.p.z + f.r.z * 5 + f.n.z * 2 };
  const l = t.locate(p);
  assert(Math.abs(l.d - 5) < 0.3 && Math.abs(l.h - 2) < 0.3 && Math.abs(l.s - 100) < 1.5, JSON.stringify({ d: l.d, h: l.h, s: l.s }));
});

console.log('Car');
const track0 = new Track(TRACKS[0]);

test('accelerates toward top speed, brakes, then reverses', () => {
  const car = new Car(0, track0, 20);
  const steerOnly = (throttle, brake) => (c) => ({ throttle, brake, steer: autopilot(c, track0).steer, drift: false });
  drive(car, track0, 1.0, steerOnly(1, 0));
  assert(car.speed > 65, 'speed after 1s ' + car.speed);
  drive(car, track0, 1.4, steerOnly(0, 1));
  assert(car.speed < 0, 'should be reversing: ' + car.speed);
  assert(car.speed >= -CFG.REVERSE_MAX - 1, 'reverse capped');
});

test('steering right turns right', () => {
  const car = new Car(0, track0, 20);
  drive(car, track0, 0.4, { throttle: 1, brake: 0, steer: 0, drift: false });
  const right = norm(cross(car.fwd, car.up));
  const before = car.fwd;
  drive(car, track0, 0.15, { throttle: 1, brake: 0, steer: 1, drift: false });
  assert(dot(sub(car.fwd, before), right) > 0.05, 'heading should swing to the right');
});

test('drifting slides more than normal cornering', () => {
  const slide = (drift) => {
    const car = new Car(0, track0, 20);
    drive(car, track0, 0.8, { throttle: 1, brake: 0, steer: 0, drift: false });
    drive(car, track0, 0.25, { throttle: 1, brake: 0, steer: 1, drift });
    return { drifting: car.drifting, side: Math.abs(dot(car.vel, norm(cross(car.fwd, car.up)))) };
  };
  const d = slide(true), n = slide(false);
  assert(d.drifting && !n.drifting, 'drift state');
  assert(d.side > n.side * 1.5, `sideways ${d.side.toFixed(1)} vs ${n.side.toFixed(1)}`);
});

test('rails keep a car on the track', () => {
  const car = new Car(0, track0, 20);
  const evs = drive(car, track0, 1.5, { throttle: 1, brake: 0, steer: 1, drift: false });
  assert(car.surface === 'track' && car.offTrack === 0, 'still on track');
  assert(evs.some((e) => e.type === 'wall'), 'scraped the rail');
});

test('a car left on the floor is put back on the track', () => {
  const car = new Car(0, track0, 20);
  car.pos = { x: 600, y: 0, z: 180 }; // middle of the kitchen floor
  car.grounded = false;
  car.hint = null;
  const evs = drive(car, track0, CFG.RESPAWN_OFFTRACK + CFG.RESPAWN_DELAY + 0.3, idle);
  assert(evs.some((e) => e.type === 'fell') && evs.some((e) => e.type === 'respawned'), 'respawned');
  assert(car.surface === 'track' && car.loc && Math.abs(car.loc.d) < 2, 'back on the track');
});

console.log('Loops & water');
const loopDef = {
  name: 'loop test', width: 22,
  points: [
    { x: 100, y: 0.6, z: 100 }, { x: 300, y: 0.6, z: 100 }, ...loop(400, 0.6, 100, 0, { r: 26, shift: 36 }),
    { x: 520, y: 0.6, z: 136 }, { x: 700, y: 0.6, z: 140 }, { x: 760, y: 0.6, z: 300 }, { x: 600, y: 0.6, z: 420 },
    { x: 200, y: 0.6, z: 420 }, { x: 40, y: 0.6, z: 300 },
  ],
};
const loopTrack = new Track(loopDef);

test('loop: the track turns upside down and comes out level, offset sideways', () => {
  let minNy = 1;
  for (const s of loopTrack.samples) minNy = Math.min(minNy, s.n.y);
  assert(minNy < -0.95, 'upside down at the top: ' + minNy.toFixed(2));
  const out = loopTrack.locate({ x: 520, y: 0.6, z: 136 });
  assert(out.n.y > 0.99 && Math.abs(out.r.y) < 0.02, 'level after the loop');
});

test('loop: at speed the car goes all the way round', () => {
  const car = new Car(0, loopTrack, 30);
  let minUp = 1, fell = false;
  for (let t = 0; t < 9; t += DT) {
    const evs = stepCar(car, autopilot(car, loopTrack), loopTrack, DT);
    if (evs.some((e) => e.type === 'fell')) fell = true;
    minUp = Math.min(minUp, car.up.y);
    if (car.pos.x > 520) break;
  }
  assert(!fell, 'fell off');
  assert(minUp < -0.9, 'should have been upside down: ' + minUp.toFixed(2));
  assert(car.pos.x > 520 && Math.abs(car.pos.z - 136) < 8 && car.grounded, `came out at ${car.pos.x.toFixed(0)}, ${car.pos.z.toFixed(0)}`);
});

test('loop: too slow and the car drops off', () => {
  const car = new Car(0, loopTrack, 290);
  car.vel = { x: 72, y: 0, z: 0 };
  let dropped = false;
  for (let t = 0; t < 2; t += DT) {
    stepCar(car, { throttle: 0, brake: 0, steer: 0, drift: false }, loopTrack, DT);
    if (!car.grounded && car.up.y < 0.5) dropped = true;
  }
  assert(dropped, 'should have dropped off the loop');
  assert(car.pos.x < 500, 'should not have made it round');
});

test('loop: too slow to reach the wall and the car rolls back', () => {
  const car = new Car(0, loopTrack, 290);
  car.vel = { x: 40, y: 0, z: 0 };
  let maxY = 0, detached = false;
  for (let t = 0; t < 5; t += DT) {
    stepCar(car, { throttle: 0, brake: 0, steer: 0, drift: false }, loopTrack, DT);
    maxY = Math.max(maxY, car.pos.y);
    if (!car.grounded) detached = true;
  }
  assert(!detached && maxY > 5 && maxY < 26, `climbed to ${maxY.toFixed(0)} cm`);
  assert(car.grounded && car.pos.y < 3, 'rolled back to the bottom: y=' + car.pos.y.toFixed(1));
});

test('water: landing in it is a splash and a respawn', () => {
  const def = TRACKS.find((t) => t.world.id === 'lakeside');
  const track = new Track(def);
  const car = new Car(0, track, 20);
  car.pos = { x: 700, y: 3, z: 700 }; // open water
  car.hint = null;
  car.grounded = false;
  const evs = drive(car, track, 1.4, idle);
  assert(evs.some((e) => e.type === 'splash'), 'splash');
  assert(evs.some((e) => e.type === 'respawned') && car.surface === 'track', 'back on the track');
});

test('respawning just before a jump puts you past it', () => {
  const def = TRACKS.find((t) => t.name === 'Garden Grand Prix');
  const track = new Track(def);
  let gapAt = -1;
  for (const s of track.samples) if (s.gap) { gapAt = s.s; break; }
  const spot = respawnSpot(track, gapAt - 40);
  const f = track.frameAt(spot);
  assert(spot > gapAt && !f.gap && !f.loop, `respawned at ${spot.toFixed(0)}, gap at ${gapAt.toFixed(0)}`);
  const rug = new Track(TRACKS.find((t) => t.name === 'Rug Rally'));
  let rugGap = -1;
  for (const s of rug.samples) if (s.gap) { rugGap = s.s; break; }
  assert(respawnSpot(rug, rugGap - 300) === rugGap - 300, 'a spot well before the jump is left alone');
});

test('every world has at least one track and unique track ids', () => {
  assert(WORLDS.every((w) => w.tracks.length > 0), 'tracks');
  assert(new Set(TRACKS.map((t) => t.id)).size === TRACKS.length, 'ids');
});

console.log('Race');
for (const def of TRACKS) {
  test(`${def.name}: autopilot finishes ${def.laps} laps cleanly, jumps included`, () => {
    const { race, evs, track } = autoRace(def, 1);
    const car = race.cars[0];
    assert(race.state === 'done' && car.finished && !car.dnf, `state ${race.state} progress ${car.progress.toFixed(0)}/${(race.laps * track.length).toFixed(0)}`);
    const falls = evs.filter((e) => e.type === 'fell');
    assert(falls.length === 0, `fell ${falls.length} time(s)`);
    const splashes = evs.filter((e) => e.type === 'splash');
    assert(splashes.length === 0, `splashed ${splashes.length} time(s)`);
    const jumps = evs.filter((e) => e.type === 'land' && e.air > 0.08);
    assert(jumps.length >= def.laps, `expected a jump per lap, got ${jumps.length}`);
    console.log(`      lap ${(car.bestLap).toFixed(2)} s, track ${track.length.toFixed(0)} cm, ${jumps.length} jumps`);
  });
}

for (const sp of CFG.SPEEDS.filter((x) => x.scale !== 1)) {
  for (const def of TRACKS) {
    test(`${def.name} at ${sp.name} speed: autopilot finishes without falling`, () => {
      const { race, evs } = autoRace({ ...def, laps: 1 }, 1, 400, sp.scale);
      const car = race.cars[0];
      assert(race.state === 'done' && car.finished && !car.dnf, 'did not finish');
      const bad = evs.filter((e) => e.type === 'fell' || e.type === 'splash');
      assert(bad.length === 0, bad.map((e) => e.type).join() + ` (s≈${car.loc.s.toFixed(0)})`);
    });
  }
}

test('four cars: grid, no overlaps, positions are a permutation', () => {
  const track = new Track(TRACKS[0]);
  const race = new Race(track, 4, { laps: 1 });
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const d = len(sub(race.cars[i].pos, race.cars[j].pos));
    assert(d > CFG.CAR_RADIUS * 1.5, `grid overlap ${i}-${j}: ${d.toFixed(1)}`);
  }
  for (let t = 0; t < 12; t += DT) race.step(DT, race.cars.map((c) => autopilot(c, track)));
  const pos = race.cars.map((c) => c.position).sort();
  assert(pos.join() === '1,2,3,4', pos.join());
});

test('countdown holds the cars, then GO', () => {
  const track = new Track(TRACKS[0]);
  const race = new Race(track, 2, { laps: 1 });
  const start = { ...race.cars[0].pos };
  const evs = [];
  for (let t = 0; t < CFG.COUNTDOWN - 0.1; t += DT) evs.push(...race.step(DT, [{ throttle: 1, brake: 0, steer: 0, drift: false }, idle]));
  assert(len(sub(race.cars[0].pos, start)) < 0.01, 'moved during countdown');
  assert(evs.filter((e) => e.type === 'count').length >= 2, 'beeps');
  for (let t = 0; t < 0.3; t += DT) evs.push(...race.step(DT, [{ throttle: 1, brake: 0, steer: 0, drift: false }, idle]));
  assert(evs.some((e) => e.type === 'go') && race.state === 'racing', 'go');
});

test('cutting across the room does not count as progress', () => {
  const track = new Track(TRACKS[0]);
  const race = new Race(track, 1, { laps: 3 });
  for (let t = 0; t < CFG.COUNTDOWN + 1; t += DT) race.step(DT, [{ throttle: 1, brake: 0, steer: 0, drift: false }]);
  const car = race.cars[0];
  const before = car.progress;
  const far = track.frameAt(car.loc.s + track.length / 2);
  car.pos = { ...far.p };
  car.hint = null;
  race.step(DT, [idle]);
  assert(car.progress - before < 10, `teleport gained ${(car.progress - before).toFixed(0)} cm`);
});

test('the leader is in first place', () => {
  const track = new Track(TRACKS[0]);
  const race = new Race(track, 2, { laps: 2 });
  for (let t = 0; t < CFG.COUNTDOWN + 4; t += DT) race.step(DT, [autopilot(race.cars[0], track), idle]);
  assert(race.cars[0].position === 1 && race.cars[1].position === 2, 'positions');
});

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
