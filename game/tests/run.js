#!/usr/bin/env node
// Headless tests for the race simulation. Run: node game/tests/run.js
import { Car, autopilot, stepCar } from '../js/car.js';
import { CFG } from '../js/config.js';
import { HOUSE } from '../js/house.js';
import { Race } from '../js/race.js';
import { Track } from '../js/track.js';
import { TRACKS } from '../js/tracks/index.js';
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
function autoRace(def, players = 1, maxSeconds = 120) {
  const track = new Track(def);
  const race = new Race(track, players, { laps: def.laps });
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
      assert(s.n.y > 0.3, 'surface faces up');
    }
  });
  test(`${def.name}: stays inside the room`, () => {
    const t = new Track(def);
    for (const s of t.samples) {
      for (const side of [-1, 1]) {
        const x = s.p.x + s.r.x * side * s.w / 2, z = s.p.z + s.r.z * side * s.w / 2;
        assert(x > 2 && z > 2 && x < HOUSE.size.x - 2 && z < HOUSE.size.z - 2, `edge outside room at s=${s.s.toFixed(0)}`);
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
  assert(car.speed > 170, 'speed after 1s ' + car.speed);
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
  car.pos = { x: 600, y: 0, z: 150 }; // middle of the kitchen floor
  car.grounded = false;
  car.hint = null;
  const evs = drive(car, track0, CFG.RESPAWN_OFFTRACK + CFG.RESPAWN_DELAY + 0.3, idle);
  assert(evs.some((e) => e.type === 'fell') && evs.some((e) => e.type === 'respawned'), 'respawned');
  assert(car.surface === 'track' && car.loc && Math.abs(car.loc.d) < 2, 'back on the track');
});

console.log('Race');
for (const def of TRACKS) {
  test(`${def.name}: autopilot finishes ${def.laps} laps cleanly, jumps included`, () => {
    const { race, evs, track } = autoRace(def, 1);
    const car = race.cars[0];
    assert(race.state === 'done' && car.finished && !car.dnf, `state ${race.state} progress ${car.progress.toFixed(0)}/${(race.laps * track.length).toFixed(0)}`);
    const falls = evs.filter((e) => e.type === 'fell');
    assert(falls.length === 0, `fell ${falls.length} time(s)`);
    const jumps = evs.filter((e) => e.type === 'land' && e.air > 0.08);
    assert(jumps.length >= def.laps, `expected a jump per lap, got ${jumps.length}`);
    console.log(`      lap ${(car.bestLap).toFixed(2)} s, track ${track.length.toFixed(0)} cm, ${jumps.length} jumps`);
  });
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
