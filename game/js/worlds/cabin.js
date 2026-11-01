// Cozy Cabin: an open-plan log-cabin living room and kitchen.
import { jump, loop } from '../trackKit.js';
import { box, cyl } from '../world.js';

const legs = (x0, z0, x1, z1, top, t = 6, look = 'wood') => [
  box(x0, 0, z0, x0 + t, top, z0 + t, look), box(x1 - t, 0, z0, x1, top, z0 + t, look),
  box(x0, 0, z1 - t, x0 + t, top, z1, look), box(x1 - t, 0, z1 - t, x1, top, z1, look),
];

const world = {
  id: 'cabin',
  name: 'Cozy Cabin',
  size: { x: 900, z: 600 },
  look: {
    indoor: true,
    wallHeight: 260,
    floor: 'planks',
    sky: '#ffd9a8',
    sun: { pos: [700, 520, -200], target: [420, 0, 320], color: '#fff0d0', power: 2.2 },
    hemi: ['#fff4e0', '#8a5a3a', 1.35],
  },
  solids: [
    // living room
    box(210, 38, 280, 330, 42, 360, 'wood', { name: 'coffee table' }),
    ...legs(210, 280, 330, 360, 38),
    box(140, 0, 478, 400, 42, 560, 'sofa', { name: 'sofa' }),
    box(140, 42, 535, 400, 88, 560, 'sofa'),
    box(140, 42, 478, 162, 62, 535, 'sofa'),
    box(378, 42, 478, 400, 62, 535, 'sofa'),
    box(0, 0, 110, 32, 185, 300, 'bookshelf', { name: 'bookshelf' }),
    box(440, 0, 300, 510, 40, 380, 'armchair', { name: 'armchair' }),
    box(490, 40, 300, 510, 85, 380, 'armchair'),
    box(165, 0, 0, 375, 120, 46, 'stone', { name: 'fireplace' }),
    box(150, 0, 46, 390, 4, 78, 'stone', { name: 'hearth' }),
    cyl(470, 520, 9, 0, 150, 'lampPole', { name: 'floor lamp' }),
    // kitchen
    box(560, 0, 0, 900, 90, 62, 'counter', { name: 'counter' }),
    box(830, 0, 62, 900, 180, 160, 'fridge', { name: 'fridge' }),
    box(620, 0, 240, 800, 90, 340, 'counter', { name: 'island' }),
    box(600, 71, 420, 770, 75, 520, 'wood', { name: 'dining table' }),
    ...legs(600, 420, 770, 520, 71),
    ...[660, 720, 780].map((x) => cyl(x, 370, 3, 0, 63, 'stool', { name: 'stool' })),
  ],
  props: [
    { p: 'rug', x0: 110, z0: 200, x1: 430, z1: 470, colors: ['#c8402e', '#f3c843', '#2f6b9a'] },
    { p: 'tiles', x0: 540, z0: 0, x1: 900, z1: 600 },
    { p: 'cushions', x0: 162, x1: 378, z: 507, y: 42 },
    { p: 'fire', x: 270, z: 58, w: 70, y: 4, opening: { z: 46.3, h: 72 } },
    { p: 'chimney', x: 270, z: 20, w: 150, d: 40, y0: 120 },
    { p: 'lamp', x: 470, z: 520, y: 150 },
    { p: 'plant', x: 60, z: 555, s: 1 },
    { p: 'plant', x: 860, z: 560, s: 0.8 },
    { p: 'window', wall: 'n', at: 470, w: 140, h: 110, y: 95 },
    { p: 'window', wall: 'e', at: 330, w: 150, h: 100, y: 105 },
    { p: 'window', wall: 's', at: 620, w: 170, h: 110, y: 95 },
    { p: 'window', wall: 'w', at: 420, w: 120, h: 100, y: 95 },
    { p: 'frame', wall: 'w', at: 210, y: 210, w: 60, h: 40, color: '#4f8f5a' },
    { p: 'antlers', wall: 's', at: 260, y: 170 },
    { p: 'frame', wall: 'n', at: 700, y: 170, w: 50, h: 36, color: '#d9663b' },
    { p: 'bowl', x: 700, z: 290, y: 90 },
    { p: 'kettle', x: 640, z: 30, y: 90 },
    { p: 'pots', x: 760, z: 30, y: 90 },
    { p: 'chair', x: 645, z: 395, rot: 0 },
    { p: 'chair', x: 725, z: 395, rot: 0 },
    { p: 'chair', x: 645, z: 545, rot: 180 },
    { p: 'chair', x: 725, z: 545, rot: 180 },
    { p: 'beams', every: 150 },
    { p: 'mug', x: 300, z: 300, y: 42 },
  ],
};

const rugRally = {
  name: 'Rug Rally',
  blurb: 'A quick loop around the rug with a ramp in front of the sofa.',
  laps: 4,
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

const tableTop = {
  name: 'Table Top Run',
  blurb: 'Up a long ramp onto the coffee table and off the far edge.',
  laps: 4,
  width: 22,
  points: [
    { x: 300, y: 0.6, z: 452 },
    { x: 200, y: 0.6, z: 455 },
    { x: 118, y: 0.6, z: 432, bank: 8 },
    { x: 88, y: 0.6, z: 362, bank: 8 },
    { x: 100, y: 2, z: 300 },
    { x: 150, y: 16, z: 288 },
    { x: 206, y: 43, z: 300, sharp: true },
    { x: 268, y: 43, z: 310 },
    { x: 322, y: 43, z: 318, sharp: true, gap: true },
    { x: 352, y: 37, z: 332, sharp: true },
    { x: 392, y: 22, z: 362 },
    { x: 418, y: 6, z: 410, bank: 6 },
    { x: 395, y: 1, z: 446 },
  ],
};

const kitchenLoop = {
  name: 'Kitchen Loop',
  blurb: 'Loop-the-loop by the counter, a jump past the fridge, then under the dining table.',
  laps: 3,
  width: 22,
  points: [
    { x: 528, y: 0.6, z: 400 },
    { x: 532, y: 0.6, z: 290 },
    { x: 545, y: 0.6, z: 190, bank: 6 },
    { x: 585, y: 0.6, z: 125, bank: 8 },
    { x: 640, y: 0.6, z: 102 },
    ...loop(700, 0.6, 102, 0, { r: 26, shift: 36 }),
    { x: 760, y: 0.6, z: 138 },
    { x: 815, y: 0.6, z: 175, bank: 10 },
    { x: 852, y: 0.6, z: 225, bank: 6 },
    ...jump(856, 0.6, 250, 90, { ramp: 45, rise: 11, gap: 36, land: 40 }),
    { x: 858, y: 0.6, z: 400 },
    { x: 846, y: 0.6, z: 448, bank: 10 },
    { x: 800, y: 0.6, z: 470 },
    { x: 690, y: 0.6, z: 470 },
    { x: 590, y: 0.6, z: 474 },
    { x: 545, y: 0.6, z: 462, bank: 10 },
  ],
};

export default { ...world, tracks: [rugRally, tableTop, kitchenLoop] };
