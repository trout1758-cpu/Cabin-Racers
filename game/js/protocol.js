// Bluetooth LE protocol shared with the Racer Pad Android app.
// Keep in sync with controller-android/.../Protocol.kt and docs/PROTOCOL.md.

export const PROTO = {
  SERVICE_UUID: '49fa860a-95dd-48a7-b575-f424d3f9852e',
  INPUT_UUID: '49fa860b-95dd-48a7-b575-f424d3f9852e',    // phone -> game, notify
  FEEDBACK_UUID: '49fa860c-95dd-48a7-b575-f424d3f9852e', // game -> phone, write

  VERSION: 1,

  // Input packet (phone -> game), 12 bytes
  //  0 version     1 seq
  //  2 steer int8 (-127..127, right +)
  //  3 throttle uint8 (0..255)
  //  4 brake uint8 (0..255)
  //  5 held bits: 1 gas, 2 brake/drift, 4 boost, 8 item
  //  6 gas presses   7 boost presses   8 item presses   9 pause presses (wrapping counters)
  // 10 flags: 1 tilt steering, 2 auto-accelerate
  // 11 reserved
  INPUT_LEN: 12,
  HELD_GAS: 1,
  HELD_BRAKE: 2,
  HELD_BOOST: 4,
  HELD_ITEM: 8,

  // Feedback (game -> phone)
  MSG_ASSIGN: 1, // [1, playerIndex, r, g, b]
  MSG_RUMBLE: 2, // [2, duration/10ms, amplitude 1..255]
  MSG_STATUS: 3, // [3, state, position, lap, laps, players, ready, place]

  STATE: { LOBBY: 0, COUNTDOWN: 1, RACING: 2, FINISHED: 3, RESULTS: 4, PAUSED: 5 },

  decodeInput(dv) {
    if (dv.byteLength < PROTO.INPUT_LEN || dv.getUint8(0) !== PROTO.VERSION) return null;
    const held = dv.getUint8(5);
    return {
      seq: dv.getUint8(1),
      steer: dv.getInt8(2) / 127,
      throttle: dv.getUint8(3) / 255,
      brake: dv.getUint8(4) / 255,
      gasHeld: (held & PROTO.HELD_GAS) !== 0,
      brakeHeld: (held & PROTO.HELD_BRAKE) !== 0,
      boostHeld: (held & PROTO.HELD_BOOST) !== 0,
      gasCount: dv.getUint8(6),
      boostCount: dv.getUint8(7),
      itemCount: dv.getUint8(8),
      pauseCount: dv.getUint8(9),
      tilt: (dv.getUint8(10) & 1) !== 0,
    };
  },

  counterDelta(prev, next) {
    return (next - prev + 256) & 0xff;
  },
};
