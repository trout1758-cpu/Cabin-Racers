// Cabin Racers — tuning. Units: centimetres, seconds. A car is about 7.5 cm
// long (Hot Wheels scale), so 260 cm/s is a scale speed of roughly 250 km/h.

export const CFG = {
  SIM_HZ: 120,
  GRAVITY: 980,

  CAR_LENGTH: 7.5,
  CAR_WIDTH: 3.6,
  CAR_RADIUS: 2.9,          // car-to-car and furniture collisions

  MAX_SPEED: 260,
  ACCEL: 420,
  BRAKE: 650,
  REVERSE_ACCEL: 220,
  REVERSE_MAX: 70,
  DRAG: 0.35,               // per second, proportional to speed
  ROLLING: 18,              // cm/s² when coasting
  STEER_RATE: 2.7,          // rad/s at full lock
  GRIP: 10,                 // how fast sideways sliding dies away
  DRIFT_GRIP: 2.0,
  DRIFT_STEER: 1.45,        // drifting turns tighter
  DRIFT_MIN_SPEED: 110,
  AIR_STEER: 1.2,
  SLOPE_GRAVITY: 0.35,      // share of gravity felt along ramps (toy-car physics)

  OFFROAD_MAX: 85,          // off the track: carpet and floorboards slow you down
  OFFROAD_DRAG: 2.2,

  RAIL_HEIGHT: 1.6,
  SNAP: 0.9,                // stay glued to the surface within this distance
  LAUNCH_SPEED: 22,         // leave the ground if moving away from it faster than this
  LOOP_MIN_SPEED: 70,       // slower than this on a wall or upside down and you fall off
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
