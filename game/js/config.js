// Cabin Racers — tuning. Units: centimetres, seconds. A car is about 7.5 cm
// long (Hot Wheels scale). Speeds and gravity are "cartoon scale": a car at
// top speed covers about 14 car lengths a second, and jumps hang in the air
// like they would for a full-size car rather than a toy.

export const CFG = {
  SIM_HZ: 120,
  GRAVITY: 130,             // cartoon gravity: floaty jumps (real gravity is 980)

  CAR_LENGTH: 7.5,
  CAR_WIDTH: 3.6,
  CAR_RADIUS: 2.9,          // car-to-car and furniture collisions

  MAX_SPEED: 105,
  ACCEL: 150,
  BRAKE: 260,
  REVERSE_ACCEL: 100,
  REVERSE_MAX: 35,
  DRAG: 0.3,                // per second, proportional to speed
  ROLLING: 10,              // cm/s² when coasting
  STEER_RATE: 2.6,          // rad/s at full lock
  STEER_FULL_AT: 30,        // cm/s: below this, steering fades out
  GRIP: 16,                 // how fast sideways sliding dies away
  DRIFT_GRIP: 2.2,
  DRIFT_STEER: 1.4,         // drifting turns tighter
  DRIFT_MIN_SPEED: 45,
  AIR_STEER: 1.0,
  SLOPE_GRAVITY: 0.75,      // share of gravity felt along ramps
  LOOP_GRAVITY: 0.4,        // ...and in loop-the-loops (the track "holds on")

  // Speed settings picked in the lobby: multiply top speed and acceleration.
  SPEEDS: [
    { id: 'chill', name: 'Chill', scale: 0.8 },
    { id: 'normal', name: 'Normal', scale: 1 },
    { id: 'zoom', name: 'Zoom', scale: 1.25 },
  ],

  OFFROAD_MAX: 40,          // off the track: carpet and grass slow you down
  OFFROAD_DRAG: 2.0,

  RAIL_HEIGHT: 1.6,
  SNAP: 0.9,                // stay glued to the surface within this distance
  LAUNCH_SPEED: 9,          // leave the ground if moving away from it faster than this
  LOOP_MIN_SPEED: 30,       // slower than this on a wall or upside down and you fall off
  RESPAWN_OFFTRACK: 2.4,    // seconds off the track before being put back
  RESPAWN_DELAY: 0.8,

  COUNTDOWN: 3.6,
  FINISH_WAIT: 20,          // seconds after the winner before the race ends anyway

  PLAYERS: [
    { name: 'Red', body: '#e23b2e', dark: '#8f1d14', light: '#ff7a6b', rgb: [226, 59, 46] },
    { name: 'Blue', body: '#2f6fe0', dark: '#173e8f', light: '#7aa6ff', rgb: [47, 111, 224] },
    { name: 'Green', body: '#3fae3a', dark: '#1f6b1c', light: '#86de7f', rgb: [63, 174, 58] },
    { name: 'Yellow', body: '#f2b416', dark: '#9a6f00', light: '#ffd76a', rgb: [242, 180, 22] },
  ],
};
