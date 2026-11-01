// Lakeside: a wooden dock out into the lake, a pebbly shore with pines and a
// campfire. Miss a jump and it's a splash.
import { jump, loop } from '../trackKit.js';
import { box, cyl, pool } from '../world.js';

const SHORE = 330;

const world = {
  id: 'lakeside',
  name: 'Lakeside',
  size: { x: 1200, z: 900 },
  look: {
    outdoor: true,
    ground: 'shore',
    shoreX: SHORE,
    sky: ['#ff9f6e', '#ffe1a8'],
    sun: { pos: [1400, 520, 200], target: [600, 0, 450], color: '#ffe0b0', power: 2.3 },
    hemi: ['#ffe6cc', '#4a6a5a', 1.2],
    fog: ['#ffd9b0', 1600, 5200],
    orbit: { arc: [-70, 70], radius: 760, height: 420 },
  },
  solids: [
    box(SHORE, 0, 420, 575, 20, 500, 'dock', { name: 'dock' }),
    box(620, 0, 420, 900, 20, 500, 'dock'),
    box(820, 0, 300, 900, 20, 650, 'dock', { name: 'dock end' }),
    cyl(980, 560, 30, 0, 26, 'rock'),
    cyl(560, 640, 22, 0, 18, 'rock'),
    cyl(1060, 260, 40, 0, 34, 'rock'),
    cyl(470, 300, 16, 0, 14, 'rock'),
    cyl(90, 140, 14, 0, 300, 'pine', { name: 'pine' }),
    cyl(60, 380, 12, 0, 260, 'pine'),
    cyl(140, 820, 16, 0, 320, 'pine'),
    cyl(40, 600, 10, 0, 220, 'pine'),
    cyl(120, 600, 22, 0, 10, 'campfire', { name: 'campfire' }),
  ],
  water: [pool(SHORE, -100, 1300, 1000)],
  props: [
    { p: 'lake', x0: SHORE, z0: -2000, x1: 4000, z1: 3000 },
    { p: 'dockPosts', x0: SHORE, x1: 900, z0: 420, z1: 500, gapX0: 575, gapX1: 620 },
    { p: 'dockPosts', x0: 820, x1: 900, z0: 300, z1: 650 },
    { p: 'pine', x: -120, z: 260, s: 1.8 },
    { p: 'pine', x: -90, z: 700, s: 2.1 },
    { p: 'pine', x: -200, z: 480, s: 2.4 },
    { p: 'pine', x: -60, z: 30, s: 1.6 },
    { p: 'fire', x: 120, z: 600, w: 26, y: 10 },
    { p: 'logSeat', x: 120, z: 545, rot: 0 },
    { p: 'logSeat', x: 168, z: 612, rot: 80 },
    { p: 'canoe', x: 760, z: 545, rot: 0 },
    { p: 'lilies', x0: 380, z0: 560, x1: 760, z1: 860, n: 26, seed: 9 },
    { p: 'lilies', x0: 960, z0: 120, x1: 1180, z1: 420, n: 12, seed: 4 },
    { p: 'cattails', x: SHORE, z0: 40, z1: 400, n: 14 },
    { p: 'cattails', x: SHORE, z0: 520, z1: 880, n: 14 },
    { p: 'pebbles', x0: 180, z0: 0, x1: SHORE + 20, z1: 900, n: 160, seed: 2 },
    { p: 'grass', x0: 0, z0: 0, x1: 200, z1: 900, n: 500, seed: 8 },
    { p: 'fishingRod', x: 880, z: 640, y: 20 },
    { p: 'buoy', x: 1000, z: 760 },
    { p: 'buoy', x: 640, z: 140 },
    { p: 'mountains' },
    { p: 'clouds', n: 7 },
  ],
};

const dockDash = {
  name: 'Dock Dash',
  blurb: 'Out along the dock, a leap over open water and a loop above the lake.',
  laps: 3,
  width: 22,
  points: [
    // along the dock, heading east (start)
    { x: 430, y: 21, z: 460 },
    ...jump(505, 21, 460, 0, { ramp: 45, rise: 16, gap: 30, drop: 8, land: 55 }),
    { x: 720, y: 21, z: 460 },
    { x: 800, y: 21, z: 458 },
    { x: 846, y: 21, z: 430 },
    { x: 862, y: 21, z: 370 },
    // off the end of the dock on stilts, out over the water
    { x: 866, y: 23, z: 290 },
    { x: 855, y: 28, z: 190, bank: -10 },
    { x: 805, y: 28, z: 128, bank: -10 },
    { x: 760, y: 28, z: 112 },
    ...loop(700, 28, 112, 180, { r: 28, shift: 40 }),
    { x: 640, y: 28, z: 72 },
    { x: 520, y: 27, z: 70 },
    { x: 420, y: 24, z: 80, bank: -8 },
    { x: 350, y: 16, z: 125, bank: -10 },
    // down onto the shore, heading south
    { x: 280, y: 4, z: 205 },
    { x: 245, y: 1.2, z: 280 },
    { x: 232, y: 1.2, z: 340, bank: -6 },
    // climb back up onto the dock
    { x: 240, y: 6, z: 405, bank: -10 },
    { x: 285, y: 17, z: 452, bank: -6 },
    { x: 325, y: 21, z: 460 },
  ],
};

export default { ...world, tracks: [dockDash] };
