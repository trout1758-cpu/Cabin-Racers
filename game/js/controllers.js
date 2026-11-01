// Controllers: Racer Pad phones (Bluetooth), keyboards and gamepads.
// Every controller has:
//   kind, label, detail, connected
//   read() -> { steer -1..1, throttle 0..1, brakeHeld, presses: { gas, pause } }
//   rumble(ms, strength 0..1), assign(index, rgb), status(...), dispose()
import { PROTO } from './protocol.js';

// ---------------------------------------------------------------------------
// Phones over Web Bluetooth
// ---------------------------------------------------------------------------
export function bluetoothProblem() {
  if (!window.isSecureContext) return 'Open the game with the start script (an http://localhost address) to use Bluetooth.';
  if (!(navigator.bluetooth && navigator.bluetooth.requestDevice)) {
    return 'This browser has no Web Bluetooth. Use Google Chrome or Microsoft Edge.';
  }
  return null;
}

export async function connectPhone() {
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [PROTO.SERVICE_UUID] }] });
  const ctl = new PhoneController(device);
  await ctl.open();
  return ctl;
}

export class PhoneController {
  constructor(device) {
    this.kind = 'phone';
    this.label = 'Racer Pad';
    this.device = device;
    this.detail = device ? device.name || 'Android phone' : 'Phone';
    this.connected = false;
    this.disposed = false;
    this.state = null;
    this.last = null;
    this.pending = { gas: 0, pause: 0, boost: 0 };
    this.queue = [];
    this.writing = false;
    this.onchange = null;
    this.onDisconnected = this.onDisconnected.bind(this);
    this.onNotify = (e) => this.handlePacket(e.target.value);
    if (device) device.addEventListener('gattserverdisconnected', this.onDisconnected);
  }

  async open() {
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(PROTO.SERVICE_UUID);
    this.inputChar = await service.getCharacteristic(PROTO.INPUT_UUID);
    this.feedbackChar = await service.getCharacteristic(PROTO.FEEDBACK_UUID);
    this.inputChar.addEventListener('characteristicvaluechanged', this.onNotify);
    await this.inputChar.startNotifications();
    this.connected = true;
    this.last = null;
    this.lastStatusKey = null;
    if (this.assignMsg) this.send(this.assignMsg);
    if (this.onchange) this.onchange(this);
  }

  handlePacket(dv) {
    const pkt = PROTO.decodeInput(dv);
    if (!pkt) return;
    if (this.last) {
      this.pending.gas += PROTO.counterDelta(this.last.gasCount, pkt.gasCount);
      this.pending.pause += PROTO.counterDelta(this.last.pauseCount, pkt.pauseCount);
      this.pending.boost += PROTO.counterDelta(this.last.boostCount, pkt.boostCount);
    }
    this.last = pkt;
    this.state = pkt;
  }

  read() {
    const s = this.state;
    const out = {
      steer: s && this.connected ? s.steer : 0,
      throttle: s && this.connected ? s.throttle : 0,
      brakeHeld: !!(s && this.connected && s.brakeHeld),
      presses: { ...this.pending },
    };
    this.pending.gas = this.pending.pause = this.pending.boost = 0;
    return out;
  }

  assign(index, rgb) {
    this.assignMsg = new Uint8Array([PROTO.MSG_ASSIGN, index, rgb[0], rgb[1], rgb[2]]);
    this.send(this.assignMsg);
  }

  rumble(ms, strength) {
    this.send(new Uint8Array([PROTO.MSG_RUMBLE, Math.min(255, Math.round(ms / 10)), Math.max(1, Math.min(255, Math.round(strength * 255)))]));
  }

  status(state, position, lap, laps, players, ready, place) {
    const msg = new Uint8Array([PROTO.MSG_STATUS, state, position, lap, laps, players, ready ? 1 : 0, place]);
    const key = msg.join();
    if (key === this.lastStatusKey) return;
    this.lastStatusKey = key;
    this.queue = this.queue.filter((m) => m[0] !== PROTO.MSG_STATUS);
    this.send(msg);
  }

  send(bytes) {
    if (!this.connected || !this.feedbackChar) return;
    if (this.queue.length > 12) this.queue.shift();
    this.queue.push(bytes);
    this.pump();
  }

  async pump() {
    if (this.writing) return;
    this.writing = true;
    try {
      while (this.queue.length && this.connected) {
        const msg = this.queue.shift();
        try {
          await this.feedbackChar.writeValueWithoutResponse(msg);
        } catch (err) {
          console.warn('feedback write failed', err);
        }
      }
    } finally {
      this.writing = false;
    }
  }

  onDisconnected() {
    if (!this.connected) return;
    this.connected = false;
    this.state = null;
    this.queue = [];
    if (this.onchange) this.onchange(this);
    if (!this.disposed) this.reconnect();
  }

  async reconnect() {
    let delay = 1000;
    while (!this.disposed && !this.connected) {
      try {
        await this.open();
        return;
      } catch (err) {
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(5000, delay * 1.5);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.connected = false;
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.onDisconnected);
      try { if (this.device.gatt.connected) this.device.gatt.disconnect(); } catch (e) { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Keyboard (two schemes) and gamepads
// ---------------------------------------------------------------------------
const keys = new Set();
const keyListeners = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (!e.repeat) keyListeners.forEach((l) => l(e.code));
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const SCHEMES = {
  wasd: { label: 'Keys: WASD', detail: 'W gas · S brake/drift · A D steer', gas: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD' },
  arrows: { label: 'Keys: arrows', detail: '↑ gas · ↓ brake/drift · ← → steer', gas: 'ArrowUp', brake: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
};

export class KeyboardController {
  constructor(scheme) {
    const s = SCHEMES[scheme];
    this.kind = 'keys-' + scheme;
    this.label = s.label;
    this.detail = s.detail;
    this.scheme = s;
    this.connected = true;
    this.pending = { gas: 0, pause: 0, boost: 0 };
    this.listener = (code) => { if (code === s.gas) this.pending.gas++; };
    keyListeners.add(this.listener);
  }

  read() {
    const s = this.scheme;
    const out = {
      steer: (keys.has(s.right) ? 1 : 0) - (keys.has(s.left) ? 1 : 0),
      throttle: keys.has(s.gas) ? 1 : 0,
      brakeHeld: keys.has(s.brake),
      presses: { ...this.pending },
    };
    this.pending.gas = this.pending.pause = this.pending.boost = 0;
    return out;
  }

  rumble() {}
  assign() {}
  status() {}
  dispose() { keyListeners.delete(this.listener); }
}

export class GamepadController {
  constructor(pad) {
    this.kind = 'gamepad';
    this.index = pad.index;
    this.label = 'Gamepad ' + (pad.index + 1);
    this.detail = 'stick steer · RT/A gas · LT/B brake';
    this.prev = pad.buttons.map((b) => b.pressed);
  }

  get pad() {
    return (navigator.getGamepads ? navigator.getGamepads() : [])[this.index] || null;
  }

  get connected() {
    return !!(this.pad && this.pad.connected);
  }

  read() {
    const p = this.pad;
    if (!p) return { steer: 0, throttle: 0, brakeHeld: false, presses: { gas: 0, pause: 0, boost: 0 } };
    const b = (i) => (p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0);
    const pressed = p.buttons.map((x) => x.pressed);
    const edge = (i) => (pressed[i] && !this.prev[i] ? 1 : 0);
    this.prev = pressed;
    let steer = p.axes[0] || 0;
    if (Math.abs(steer) < 0.12) steer = 0;
    steer += b(15) - b(14);
    return {
      steer: Math.max(-1, Math.min(1, steer)),
      throttle: Math.max(b(7), b(0)),
      brakeHeld: b(6) > 0.3 || b(1) > 0.5 || b(2) > 0.5,
      presses: { gas: edge(7) + edge(0), pause: edge(9), boost: 0 },
    };
  }

  rumble(ms, strength) {
    const a = this.pad && this.pad.vibrationActuator;
    if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => {});
  }

  assign() {}
  status() {}
  dispose() {}
}

export function gamepads() {
  return navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
}

export const isKeyDown = (code) => keys.has(code);
export const onKey = (fn) => keyListeners.add(fn);
