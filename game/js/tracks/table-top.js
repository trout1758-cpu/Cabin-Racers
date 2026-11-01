// Climbs a long ramp onto the coffee table, jumps off the far edge and
// sweeps back down to the floor.
export default {
  name: 'Table Top Run',
  laps: 3,
  width: 22,
  points: [
    { x: 300, y: 0.6, z: 452 },
    { x: 200, y: 0.6, z: 455 },
    { x: 118, y: 0.6, z: 432, bank: 8 },
    { x: 88, y: 0.6, z: 362, bank: 8 },
    { x: 100, y: 2, z: 300 },
    { x: 150, y: 16, z: 288 },
    { x: 206, y: 42.6, z: 300, sharp: true },
    { x: 268, y: 42.6, z: 310 },
    { x: 322, y: 42.6, z: 318, sharp: true, gap: true },
    { x: 352, y: 37, z: 332, sharp: true },
    { x: 392, y: 22, z: 362 },
    { x: 418, y: 6, z: 410, bank: 6 },
    { x: 395, y: 0.6, z: 446 },
  ],
};
