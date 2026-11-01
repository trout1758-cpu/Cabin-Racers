// Cabin Racers — game flow: title, lobby, race, results.
import * as THREE from './vendor/three.module.min.js';
import { Audio } from './audio.js';
import { autopilot } from './car.js';
import { CFG } from './config.js';
import { GamepadController, KeyboardController, bluetoothProblem, connectPhone, gamepads, onKey } from './controllers.js';
import { HOUSE } from './house.js';
import { PROTO } from './protocol.js';
import { Race } from './race.js';
import { makeCarMesh, updateCarMesh } from './render/carMesh.js';
import { addLights, buildHouse } from './render/house3d.js';
import { buildTrack } from './render/trackMesh.js';
import { Views, layoutFor } from './render/views.js';
import { Track } from './track.js';
import { TRACKS } from './tracks/index.js';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------------------
// Renderer and scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfd8dc');
scene.add(buildHouse());
addLights(scene);
const views = new Views(renderer, scene);
const audio = new Audio();

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  layoutHud();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const settings = (() => {
  try { return Object.assign({ track: 0, laps: 3 }, JSON.parse(localStorage.getItem('cabin-racers') || '{}')); } catch (e) { return { track: 0, laps: 3 }; }
})();
const save = () => { try { localStorage.setItem('cabin-racers', JSON.stringify(settings)); } catch (e) { /* private mode */ } };

const slots = CFG.PLAYERS.map((color, i) => ({ index: i, color, controller: null, ready: false }));
const game = {
  state: 'title', // title | lobby | race | results
  track: null,
  trackMesh: null,
  race: null,
  players: [],      // slots taking part, in race order
  meshes: [],
  acc: 0,
  paused: false,
  lobbyCountdown: 0,
  gamepadWait: null,
  resultsAt: 0,
  goFlash: 0,
  flashes: [],      // per-player HUD messages { text, until, cls }
};

function toast(msg, color, ms = 3200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  if (color) el.style.setProperty('--tc', color);
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function show(id, on) {
  $(id).classList.toggle('hidden', !on);
}

// ---------------------------------------------------------------------------
// Tracks, cars
// ---------------------------------------------------------------------------
function loadTrack(index) {
  if (game.trackMesh) scene.remove(game.trackMesh);
  game.track = new Track(TRACKS[index]);
  game.trackMesh = buildTrack(game.track);
  scene.add(game.trackMesh);
  const S = game.track.samples;
  let cx = 0, cz = 0;
  for (const s of S) { cx += s.p.x; cz += s.p.z; }
  game.trackCenter = { x: cx / S.length, z: cz / S.length };
}

function setCars(n, colorsFrom) {
  for (const m of game.meshes) scene.remove(m.root);
  game.meshes = [];
  for (let i = 0; i < n; i++) {
    const m = makeCarMesh(colorsFrom[i]);
    scene.add(m.root);
    game.meshes.push(m);
  }
}

// A race with every car on autopilot, shown behind the title and lobby.
function startDemo() {
  loadTrack(settings.track);
  game.race = new Race(game.track, 4, { laps: 999 });
  game.race.timer = 0.01;
  game.players = [];
  setCars(4, CFG.PLAYERS);
  views.setPlayers(0);
}

// ---------------------------------------------------------------------------
// Title & lobby
// ---------------------------------------------------------------------------
function goTitle() {
  game.state = 'title';
  show('#screen-title', true);
  show('#screen-lobby', false);
  startDemo();
}

function goLobby() {
  audio.stopEngines();
  game.state = 'lobby';
  game.paused = false;
  game.lobbyCountdown = 0;
  slots.forEach((s) => { s.ready = false; });
  show('#screen-title', false);
  show('#screen-lobby', true);
  show('#screen-pause', false);
  show('#screen-results', false);
  $('#hud').innerHTML = '';
  show('#minimap', false);
  startDemo();
  refreshLobby();
}

$('#btn-play').addEventListener('click', () => { audio.unlock(); audio.click(); goLobby(); });

function buildLobby() {
  const sel = $('#set-track');
  TRACKS.forEach((t, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = t.name;
    sel.appendChild(o);
  });
  sel.value = settings.track;
  sel.addEventListener('change', () => {
    settings.track = Number(sel.value);
    save();
    startDemo();
    refreshLobby();
  });
  const laps = $('#set-laps');
  for (let n = 1; n <= 5; n++) {
    const b = document.createElement('button');
    b.textContent = n;
    b.addEventListener('click', () => { settings.laps = n; save(); audio.click(); refreshLobby(); });
    laps.appendChild(b);
  }
  const wrap = $('#slots');
  slots.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'slot panel';
    el.style.setProperty('--pc', s.color.body);
    el.innerHTML = `
      <h3>P${i + 1} <span class="ready">Not ready</span></h3>
      <div class="ctl"><b>No controller</b><span>Pick one below</span></div>
      <div class="buttons">
        <button class="btn small" data-src="phone">Phone (Bluetooth)</button>
        <button class="btn small" data-src="gamepad">Gamepad</button>
        <button class="btn small" data-src="wasd">Keys: WASD</button>
        <button class="btn small" data-src="arrows">Keys: arrows</button>
      </div>
      <button class="btn small ghost remove hidden" style="margin-top:8px">Remove</button>`;
    el.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => {
      audio.unlock();
      b.blur();
      choose(i, b.dataset.src);
    }));
    $('.remove', el).addEventListener('click', () => removeController(i));
    wrap.appendChild(el);
    s.el = el;
  });
  $('#btn-start').addEventListener('click', () => startRace());
  const problem = bluetoothProblem();
  $('#ble-note').textContent = problem ? 'Phones unavailable: ' + problem : '';
}

function refreshLobby() {
  $('#set-track').value = settings.track;
  [...$('#set-laps').children].forEach((b, k) => b.setAttribute('aria-pressed', String(k + 1 === settings.laps)));
  drawTrackPreview($('#track-preview'), game.track);
  for (const s of slots) {
    const c = s.controller;
    const ctl = $('.ctl', s.el);
    if (game.gamepadWait && game.gamepadWait.slot === s.index) {
      ctl.innerHTML = '<b>Press a button…</b><span>on the gamepad to use</span>';
    } else if (c) {
      ctl.innerHTML = `<b>${c.label}</b><span>${c.connected ? c.detail : c.detail + ' — reconnecting…'}</span>`;
    } else {
      ctl.innerHTML = '<b>No controller</b><span>Pick one below</span>';
    }
    $('.remove', s.el).classList.toggle('hidden', !c);
    const r = $('.ready', s.el);
    r.classList.toggle('on', s.ready);
    r.textContent = s.ready ? 'Ready!' : c ? 'Press gas when ready' : 'Empty';
  }
  const active = slots.filter((s) => s.controller);
  $('#btn-start').disabled = active.length === 0;
  $('#start-hint').textContent = active.length === 0 ? 'Give at least one player a controller.'
    : game.lobbyCountdown > 0 ? `Starting in ${Math.ceil(game.lobbyCountdown)}…` : 'Everyone presses gas to ready up, or click Start race.';
}

function drawTrackPreview(cv, track) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sx = W / HOUSE.size.x, sz = H / HOUSE.size.z, k = Math.min(sx, sz);
  const ox = (W - HOUSE.size.x * k) / 2, oz = (H - HOUSE.size.z * k) / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#e7d7bd';
  ctx.fillRect(ox, oz, HOUSE.size.x * k, HOUSE.size.z * k);
  ctx.fillStyle = 'rgba(80,60,40,0.35)';
  for (const b of HOUSE.boxes) ctx.fillRect(ox + b.min[0] * k, oz + b.min[2] * k, (b.max[0] - b.min[0]) * k, (b.max[2] - b.min[2]) * k);
  ctx.lineWidth = track.width * k;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ff7a00';
  ctx.beginPath();
  track.samples.forEach((s, i) => (i ? ctx.lineTo(ox + s.p.x * k, oz + s.p.z * k) : ctx.moveTo(ox + s.p.x * k, oz + s.p.z * k)));
  ctx.closePath();
  ctx.stroke();
  const f = track.frameAt(0);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(ox + f.p.x * k, oz + f.p.z * k, 4, 0, Math.PI * 2);
  ctx.fill();
}

async function choose(i, src) {
  game.gamepadWait = null;
  if (src === 'wasd' || src === 'arrows') {
    for (const s of slots) if (s.controller && s.controller.kind === 'keys-' + src) removeController(s.index, true);
    assign(i, new KeyboardController(src));
  } else if (src === 'gamepad') {
    game.gamepadWait = { slot: i, until: performance.now() + 12000 };
    if (!gamepads().length) toast('Connect a gamepad, then press one of its buttons.');
    refreshLobby();
  } else if (src === 'phone') {
    const problem = bluetoothProblem();
    if (problem) { toast(problem, '#e23b2e', 6000); return; }
    try {
      toast('Pick the phone in the Bluetooth list (open Racer Pad on it first).', slots[i].color.body, 5000);
      const ctl = await connectPhone();
      for (const s of slots) {
        if (s.controller && s.controller.kind === 'phone' && s.controller.device && s.controller.device.id === ctl.device.id) removeController(s.index, true);
      }
      assign(i, ctl);
    } catch (err) {
      if (err && err.name === 'NotFoundError') return;
      toast('Could not connect: ' + (err && err.message ? err.message : err), '#e23b2e', 6000);
    }
  }
}

function assign(i, ctl) {
  const s = slots[i];
  if (s.controller && s.controller !== ctl) s.controller.dispose();
  s.controller = ctl;
  s.ready = false;
  s.wasConnected = true;
  ctl.onchange = () => {
    if (s.controller !== ctl) return;
    toast(`P${i + 1}: phone ${ctl.connected ? 'reconnected' : 'disconnected — reconnecting…'}`, ctl.connected ? s.color.body : '#e23b2e');
    if (game.state === 'lobby') refreshLobby();
  };
  ctl.assign(i, s.color.rgb);
  ctl.rumble(150, 0.7);
  audio.click();
  toast(`P${i + 1}: ${ctl.label}${ctl.kind === 'phone' ? ' (' + ctl.detail + ')' : ''}`, s.color.body);
  refreshLobby();
}

function removeController(i, silent) {
  const s = slots[i];
  if (!s.controller) return;
  s.controller.dispose();
  s.controller = null;
  s.ready = false;
  if (!silent) audio.click();
  refreshLobby();
}

function updateLobby(dt, reads) {
  if (game.gamepadWait) {
    if (performance.now() > game.gamepadWait.until) {
      game.gamepadWait = null;
      refreshLobby();
    } else {
      const used = new Set(slots.filter((s) => s.controller && s.controller.kind === 'gamepad').map((s) => s.controller.index));
      for (const pad of gamepads()) {
        if (!used.has(pad.index) && pad.buttons.some((b) => b.pressed)) {
          const i = game.gamepadWait.slot;
          game.gamepadWait = null;
          assign(i, new GamepadController(pad));
          break;
        }
      }
    }
  }
  slots.forEach((s, i) => {
    if (reads[i] && reads[i].presses.gas > 0) {
      s.ready = !s.ready;
      s.controller.rumble(s.ready ? 120 : 40, 0.6);
      audio.click();
      const active = slots.filter((x) => x.controller);
      game.lobbyCountdown = active.length && active.every((x) => x.ready) ? 2.99 : 0;
      refreshLobby();
    }
  });
  if (game.lobbyCountdown > 0) {
    const before = Math.ceil(game.lobbyCountdown);
    game.lobbyCountdown -= dt;
    if (Math.ceil(game.lobbyCountdown) !== before) { refreshLobby(); audio.beep(); }
    if (game.lobbyCountdown <= 0) startRace();
  }
}

// ---------------------------------------------------------------------------
// Race
// ---------------------------------------------------------------------------
function startRace() {
  const players = slots.filter((s) => s.controller);
  if (!players.length) return;
  audio.unlock();
  game.players = players;
  loadTrack(settings.track);
  game.race = new Race(game.track, players.length, { laps: settings.laps });
  setCars(players.length, players.map((p) => p.color));
  views.setPlayers(players.length);
  game.acc = 0;
  game.paused = false;
  game.flashes = players.map(() => null);
  game.state = 'race';
  show('#screen-title', false);
  show('#screen-lobby', false);
  show('#screen-results', false);
  show('#screen-pause', false);
  buildHud();
  audio.startEngines(players.length);
}

function raceInput(r) {
  // one button does brake and drift: drift while on the gas, brake/reverse otherwise
  const gas = r.throttle > 0.1;
  return { steer: r.steer, throttle: r.throttle, brake: r.brakeHeld && !gas ? 1 : 0, drift: r.brakeHeld && gas };
}

function flash(i, text, ms = 1500, cls = '') {
  game.flashes[i] = { text, until: performance.now() + ms, cls };
}

function rumble(i, ms, strength) {
  const c = game.players[i] && game.players[i].controller;
  if (c) c.rumble(ms, strength);
}

function handleRaceEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'count': audio.beep(); game.players.forEach((_, i) => rumble(i, 40, 0.4)); break;
      case 'go': audio.go(); game.goFlash = 0.9; game.players.forEach((_, i) => rumble(i, 150, 0.8)); break;
      case 'land': if (e.impact > 60) { audio.land(e.impact); rumble(e.player, 40 + e.impact * 0.15, Math.min(1, e.impact / 300)); } break;
      case 'wall': audio.wall(e.impact); rumble(e.player, 35, Math.min(1, e.impact / 250)); break;
      case 'bump': audio.bump(); rumble(e.a, 60, 0.6); rumble(e.b, 60, 0.6); break;
      case 'fell': audio.fall(); rumble(e.player, 300, 1); flash(e.player, 'Oops!', 1200, 'small'); break;
      case 'lap':
        audio.lap(e.final);
        flash(e.player, e.final ? 'Final lap!' : `Lap ${e.lap}`, 1400, 'small');
        rumble(e.player, 80, 0.5);
        break;
      case 'finish':
        audio.finish(e.place);
        flash(e.player, `Finished ${ordinal(e.place)}!`, 99999, 'small');
        rumble(e.player, e.place === 1 ? 600 : 250, 1);
        break;
      case 'raceOver':
        game.resultsAt = performance.now() + 1800;
        break;
    }
  }
}

function updateRace(dt, reads) {
  if (reads.some((r) => r && r.presses.pause > 0) || game.pausePressed) togglePause();
  game.pausePressed = false;
  // pause if a phone drops out
  game.players.forEach((p) => {
    const ok = !!(p.controller && p.controller.connected);
    if (p.wasConnected && !ok && !game.paused) togglePause(`P${p.index + 1}'s controller disconnected.`);
    p.wasConnected = ok;
  });
  if (game.paused) return;
  const step = 1 / CFG.SIM_HZ;
  game.acc = Math.min(game.acc + dt, 0.25);
  const inputs = game.players.map((p) => raceInput(reads[p.index] || { steer: 0, throttle: 0, brakeHeld: false }));
  while (game.acc >= step) {
    handleRaceEvents(game.race.step(step, inputs));
    game.acc -= step;
  }
  game.goFlash = Math.max(0, game.goFlash - dt);
  if (game.race.state === 'done' && performance.now() > game.resultsAt && game.state === 'race') showResults();
}

function showResults() {
  game.state = 'results';
  game.resultsShownAt = performance.now();
  const rows = [...game.race.cars].sort((a, b) => a.place - b.place).map((c) => {
    const p = game.players[c.index];
    const t = c.dnf ? 'DNF' : fmtTime(c.finishTime);
    const best = isFinite(c.bestLap) ? fmtTime(c.bestLap) : '—';
    return `<tr><td>${ordinal(c.place)}</td><td><span class="sw" style="background:${p.color.body}"></span>P${p.index + 1}</td><td>${t}</td><td>best lap ${best}</td></tr>`;
  });
  $('#results-table').innerHTML = rows.join('');
  show('#screen-results', true);
}

$('#btn-again').addEventListener('click', () => startRace());
$('#btn-lobby').addEventListener('click', () => goLobby());
$('#btn-resume').addEventListener('click', () => togglePause());
$('#btn-quit').addEventListener('click', () => goLobby());
onKey((code) => {
  if (code === 'Escape' && game.state === 'race') game.pausePressed = true;
  if ((code === 'Enter' || code === 'Space') && game.state === 'title') { audio.unlock(); goLobby(); }
});

function togglePause(reason) {
  game.paused = !game.paused;
  $('.pause-reason').textContent = reason || '';
  show('#screen-pause', game.paused);
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function buildHud() {
  const hud = $('#hud');
  hud.innerHTML = '';
  const rects = layoutFor(game.players.length);
  game.players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'vhud';
    el.style.setProperty('--pc', p.color.body);
    el.innerHTML = `<div class="tag">P${p.index + 1}</div><div class="lap"></div><div class="pos"></div><div class="time"></div><div class="msg"></div>`;
    el.dataset.rect = JSON.stringify(rects[i]);
    hud.appendChild(el);
  });
  layoutHud();
  show('#minimap', game.players.length !== 3);
}

function layoutHud() {
  for (const el of document.querySelectorAll('.vhud')) {
    const [x, y, w, h] = JSON.parse(el.dataset.rect);
    Object.assign(el.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%' });
  }
  const mm = $('#minimap');
  const n = game.players.length;
  if (n === 4) Object.assign(mm.style, { left: `calc(50% - ${mm.width / 2}px)`, top: `calc(50% - ${mm.height / 2}px)`, right: '', bottom: '' });
  else if (n === 2) Object.assign(mm.style, { left: '', top: `calc(50% - ${mm.height / 2}px)`, right: '12px', bottom: '' });
  else Object.assign(mm.style, { left: '', top: '52px', right: '12px', bottom: '' });
}

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

function updateHud() {
  const race = game.race;
  const now = performance.now();
  document.querySelectorAll('.vhud').forEach((el, i) => {
    const car = race.cars[i];
    const set = (sel, html) => { const e = $(sel, el); if (e.innerHTML !== html) e.innerHTML = html; };
    set('.lap', `Lap ${car.lap}/${race.laps}`);
    const o = ordinal(car.position);
    set('.pos', `${car.position}<sup>${o.slice(-2)}</sup>`);
    set('.time', race.state === 'countdown' ? '' : fmtTime(car.finished && !car.dnf ? car.finishTime : race.time));
    let msg = '', cls = '';
    const f = game.flashes[i];
    if (race.state === 'countdown') msg = race.timer <= 3 ? String(Math.ceil(race.timer)) : '';
    else if (game.goFlash > 0) msg = 'GO!';
    else if (f && f.until > now) { msg = f.text; cls = f.cls; }
    else if (car.wrongWay > 0.8) { msg = 'WRONG WAY'; cls = 'small warn'; }
    else if (car.respawnTimer > 0) { msg = 'Back on track…'; cls = 'small'; }
    const m = $('.msg', el);
    if (m.textContent !== msg) m.textContent = msg;
    m.className = 'msg ' + cls;
  });
  drawMinimap();
}

function drawMinimap() {
  const cv = $('#minimap');
  if (cv.classList.contains('hidden')) return;
  const ctx = cv.getContext('2d');
  const T = game.track;
  if (!game.minimapBox || game.minimapBox.track !== T) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const s of T.samples) { x0 = Math.min(x0, s.p.x); x1 = Math.max(x1, s.p.x); z0 = Math.min(z0, s.p.z); z1 = Math.max(z1, s.p.z); }
    game.minimapBox = { track: T, x0, x1, z0, z1 };
  }
  const B = game.minimapBox;
  const k = Math.min((cv.width - 24) / (B.x1 - B.x0), (cv.height - 24) / (B.z1 - B.z0));
  const ox = (cv.width - (B.x1 - B.x0) * k) / 2, oz = (cv.height - (B.z1 - B.z0) * k) / 2;
  const X = (x) => ox + (x - B.x0) * k, Z = (z) => oz + (z - B.z0) * k;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(0, 0, cv.width, cv.height, 12);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ff9a3c';
  ctx.beginPath();
  T.samples.forEach((s, i) => (i ? ctx.lineTo(X(s.p.x), Z(s.p.z)) : ctx.moveTo(X(s.p.x), Z(s.p.z))));
  ctx.closePath();
  ctx.stroke();
  game.race.cars.forEach((c, i) => {
    ctx.fillStyle = game.players[i] ? game.players[i].color.body : '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(c.pos.x), Z(c.pos.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

// Keep the phones' screens up to date.
function syncPhones() {
  slots.forEach((s) => {
    const c = s.controller;
    if (!c || !c.connected) return;
    const k = game.players.indexOf(s);
    const car = game.race && k >= 0 && game.state !== 'lobby' && game.state !== 'title' ? game.race.cars[k] : null;
    let state = PROTO.STATE.LOBBY;
    if (game.state === 'race') {
      if (game.paused) state = PROTO.STATE.PAUSED;
      else if (game.race.state === 'countdown') state = PROTO.STATE.COUNTDOWN;
      else if (car && car.finished) state = PROTO.STATE.FINISHED;
      else state = PROTO.STATE.RACING;
    } else if (game.state === 'results') state = PROTO.STATE.RESULTS;
    c.status(state, car ? car.position : 0, car ? car.lap : 0, game.race ? game.race.laps : settings.laps,
      game.state === 'race' || game.state === 'results' ? game.players.length : slots.filter((x) => x.controller).length,
      s.ready, car ? car.place : 0);
  });
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
let fpsAcc = 0, fpsN = 0;

function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const reads = slots.map((s) => (s.controller ? s.controller.read() : null));
  const step = 1 / CFG.SIM_HZ;

  if (game.state === 'title' || game.state === 'lobby') {
    // demo race in the background
    game.acc = Math.min(game.acc + dt, 0.25);
    while (game.acc >= step) {
      game.race.step(step, game.race.cars.map((c) => autopilot(c, game.track)));
      game.acc -= step;
    }
    if (game.state === 'lobby') updateLobby(dt, reads);
    views.orbit({ x: game.trackCenter.x, z: game.trackCenter.z }, 420, dt);
  } else if (game.state === 'race') {
    updateRace(dt, reads);
  } else if (game.state === 'results') {
    game.acc = Math.min(game.acc + dt, 0.25);
    while (game.acc >= step) { game.race.step(step, []); game.acc -= step; }
    if (performance.now() - game.resultsShownAt > 2000 && reads.some((r) => r && r.presses.gas > 0)) startRace();
  }

  game.race.cars.forEach((c, i) => game.meshes[i] && updateCarMesh(game.meshes[i], c, game.paused ? 0 : dt));
  if (game.state === 'race' || game.state === 'results') {
    game.race.cars.forEach((c, i) => {
      views.follow(i, c, dt);
      audio.engine(i, c.speed, game.state === 'race' && reads[game.players[i].index] ? reads[game.players[i].index].throttle : 0);
    });
    if (game.players.length === 3) views.orbit({ x: game.trackCenter.x, z: game.trackCenter.z }, 380, dt);
    views.render();
    updateHud();
  } else {
    views.render(true);
  }
  syncPhones();

  if (params.has('debug')) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { $('#fps').textContent = `${Math.round(fpsN / fpsAcc)} fps · ${renderer.info.render.calls} calls`; fpsAcc = 0; fpsN = 0; }
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildLobby();
resize();
goTitle();
if (params.has('debug')) show('#fps', true);
// ?autotest=N starts an N-player race straight away (keyboard players) for testing.
if (params.has('autotest')) {
  const n = Math.max(1, Math.min(4, Number(params.get('autotest')) || 2));
  for (let i = 0; i < n; i++) slots[i].controller = new KeyboardController(i % 2 ? 'arrows' : 'wasd');
  startRace();
}
requestAnimationFrame(frame);
window.CR = { game, slots, startRace, goLobby, views, renderer, settings };
