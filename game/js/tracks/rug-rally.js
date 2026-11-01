// Floor-level loop around the coffee table, with a ramp jump in front of the sofa.
export default {
  name: 'Rug Rally',
  laps: 3,
  width: 22,
  points: [
    { x: 150, y: 0.6, z: 250 },
    { x: 260, y: 0.6, z: 244 },
    { x: 365, y: 0.6, z: 250 },
    { x: 412, y: 0.6, z: 292, bank: 8 },
    { x: 418, y: 0.6, z: 372, bank: 8 },
    { x: 392, y: 0.6, z: 440 },
    { x: 345, y: 0.6, z: 447, sharp: true },
    { x: 300, y: 12, z: 447, sharp: true, gap: true },
    { x: 263, y: 9, z: 447, sharp: true },
    { x: 222, y: 0.6, z: 447, sharp: true },
    { x: 168, y: 0.6, z: 432 },
    { x: 132, y: 0.6, z: 372, bank: 6 },
    { x: 128, y: 0.6, z: 300, bank: 6 },
  ],
};
