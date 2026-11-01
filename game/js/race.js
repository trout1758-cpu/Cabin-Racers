// Race rules: starting grid, countdown, lap counting, positions, finishing.
import { Car, autopilot, stepCar } from './car.js';
import { CFG } from './config.js';
import { addScaled, dot, norm, sub } from './vec.js';

const NO_INPUT = Object.freeze({ throttle: 0, brake: 0, steer: 0, drift: false });

export class Race {
  // opts: { laps }
  constructor(track, playerCount, opts = {}) {
    this.track = track;
    this.laps = opts.laps || track.laps;
    this.cars = [];
    for (let i = 0; i < playerCount; i++) {
      // two-wide grid behind the start line
      const row = Math.floor(i / 2), col = i % 2;
      const s = -10 - row * 15 - col * 5;
      const car = new Car(i, track, s, (col ? 1 : -1) * track.width * 0.22);
      car.progress = s; // distance raced, cm (negative = behind the line)
      car.lastS = car.loc.s;
      car.lap = 1;
      car.position = i + 1;
      car.finished = false;
      car.place = 0;
      car.finishTime = 0;
      car.wrongWay = 0;
      car.bestLap = Infinity;
      car.lapStart = 0;
      this.cars.push(car);
    }
    this.state = 'countdown'; // countdown -> racing -> done
    this.timer = CFG.COUNTDOWN;
    this.time = 0;
    this.finishers = 0;
    this.firstFinishAt = null;
  }

  // inputs[i] for each player; returns events tagged with player index.
  step(dt, inputs) {
    const events = [];
    const T = this.track;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.timer);
      this.timer -= dt;
      if (Math.ceil(this.timer) !== before && this.timer > 0) events.push({ type: 'count', n: Math.ceil(this.timer) });
      if (this.timer <= 0) {
        this.state = 'racing';
        this.time = 0;
        events.push({ type: 'go' });
      }
      return events;
    }
    if (this.state === 'done') return events;
    this.time += dt;

    for (const car of this.cars) {
      const inp = car.finished ? autopilot(car, T) : inputs[car.index] || NO_INPUT;
      if (car.finished) inp.throttle = 0.45;
      const wasRespawning = car.respawnTimer > 0;
      for (const e of stepCar(car, inp, T, dt)) events.push(Object.assign(e, { player: car.index }));
      // distance raced: only counts small steps along the track, so cutting
      // across the room gains nothing
      const loc = car.loc;
      const near = Math.abs(loc.d) < loc.w / 2 + 4 && Math.abs(loc.h) < 40;
      if (wasRespawning && car.respawnTimer <= 0) {
        car.progress += T.delta(car.lastS, loc.s);
        car.lastS = loc.s;
      } else if (near && car.respawnTimer <= 0) {
        const d = T.delta(car.lastS, loc.s);
        if (Math.abs(d) < 60) car.progress += d;
        car.lastS = loc.s;
      }
      if (!car.finished) {
        const lap = Math.min(this.laps, Math.max(1, Math.floor(car.progress / T.length) + 1));
        if (lap > car.lap) {
          const lapTime = this.time - car.lapStart;
          car.bestLap = Math.min(car.bestLap, lapTime);
          car.lapStart = this.time;
          events.push({ type: 'lap', player: car.index, lap, lapTime, final: lap === this.laps });
        }
        car.lap = lap;
        if (car.progress >= this.laps * T.length) {
          car.finished = true;
          car.place = ++this.finishers;
          car.finishTime = this.time;
          car.bestLap = Math.min(car.bestLap, this.time - car.lapStart);
          if (this.firstFinishAt === null) this.firstFinishAt = this.time;
          events.push({ type: 'finish', player: car.index, place: car.place, time: this.time });
        }
      }
      // wrong way?
      const backwards = dot(car.fwd, loc.t) < -0.4 && car.speed > 25 && near;
      car.wrongWay = backwards ? car.wrongWay + dt : 0;
    }
    this.collideCars(events);

    // positions: finishers by place, then by distance raced
    const order = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.place - b.place;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
    order.forEach((c, k) => { c.position = k + 1; });

    const allDone = this.cars.every((c) => c.finished);
    const timeUp = this.firstFinishAt !== null && this.time - this.firstFinishAt > CFG.FINISH_WAIT;
    if (allDone || timeUp) {
      // anyone still racing is placed by how far they got
      for (const c of order) {
        if (!c.finished) {
          c.finished = true;
          c.dnf = true;
          c.place = ++this.finishers;
        }
      }
      this.state = 'done';
      events.push({ type: 'raceOver' });
    }
    return events;
  }

  collideCars(events) {
    const R = CFG.CAR_RADIUS;
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i], b = this.cars[j];
        if (a.respawnTimer > 0 || b.respawnTimer > 0) continue;
        const d = sub(b.pos, a.pos);
        const dd = Math.hypot(d.x, d.y, d.z);
        if (dd >= 2 * R || dd < 1e-6) continue;
        const n = norm(d);
        const push = (2 * R - dd) / 2;
        a.pos = addScaled(a.pos, n, -push);
        b.pos = addScaled(b.pos, n, push);
        const rel = dot(sub(b.vel, a.vel), n);
        if (rel < 0) {
          // equal masses, a bit bouncy
          const j2 = -rel * 0.75;
          a.vel = addScaled(a.vel, n, -j2);
          b.vel = addScaled(b.vel, n, j2);
          if (-rel > 30) events.push({ type: 'bump', a: i, b: j, impact: -rel });
        }
      }
    }
  }
}
