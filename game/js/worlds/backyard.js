// Backyard: the lawn behind the cabin — porch, puddle, picnic table,
// sandbox, garden bed and a huge old oak.
import { jump, loop } from '../trackKit.js';
import { box, cyl, pond } from '../world.js';

// Picnic table: top, two benches and A-frame legs at each end.
function picnicTable(x0, z0, x1, z1) {
  const out = [box(x0, 70, z0, x1, 75, z1, 'deck', { name: 'picnic table' })];
  out.push(box(x0, 40, z0 - 35, x1, 44, z0 - 15, 'deck'), box(x0, 40, z1 + 15, x1, 44, z1 + 35, 'deck'));
  for (const x of [x0 + 6, x1 - 16]) out.push(box(x, 0, z0 - 35, x + 10, 70, z1 + 35, 'deck', { name: 'table legs' }));
  return out;
}

const world = {
  id: 'backyard',
  name: 'Backyard',
  size: { x: 1200, z: 900 },
  look: {
    outdoor: true,
    ground: 'grass',
    sky: ['#5ec4ff', '#d9f3ff'],
    sun: { pos: [300, 900, -500], target: [600, 0, 450], color: '#fff6dc', power: 2.4 },
    hemi: ['#e8f6ff', '#5c8a3a', 1.25],
    fog: ['#cfefff', 1800, 5200],
    orbit: { arc: [35, 145], radius: 820, height: 430 },
  },
  solids: [
    box(350, 0, 0, 850, 14, 110, 'deck', { name: 'porch' }),
    box(560, 0, 110, 640, 7, 135, 'deck', { name: 'porch step' }),
    ...picnicTable(560, 420, 760, 500),
    box(130, 0, 600, 340, 14, 612, 'plank', { name: 'sandbox' }),
    box(130, 0, 778, 340, 14, 790, 'plank'),
    box(130, 0, 612, 142, 14, 778, 'plank'),
    box(328, 0, 612, 340, 14, 778, 'plank'),
    box(142, 0, 612, 328, 8, 778, 'sand'),
    cyl(240, 690, 22, 8, 30, 'sandcastle', { name: 'sandcastle' }),
    box(1040, 0, 120, 1180, 24, 380, 'planter', { name: 'garden bed' }),
    cyl(1060, 700, 34, 0, 420, 'bark', { name: 'oak' }),
    cyl(260, 420, 20, 0, 16, 'rock'),
    cyl(820, 560, 26, 0, 20, 'rock'),
    cyl(1130, 860, 30, 0, 24, 'rock'),
    cyl(540, 640, 14, 0, 12, 'rock'),
    cyl(830, 660, 9, 0, 44, 'gnome', { name: 'gnome' }),
    cyl(200, 360, 16, 0, 26, 'pot', { name: 'flower pot' }),
  ],
  water: [pond(490, 205, 42)],
  props: [
    { p: 'cabinWall', h: 320 },
    { p: 'fence', h: 90 },
    { p: 'canopy', x: 1060, z: 700, y: 330, r: 230 },
    { p: 'tireSwing', x: 960, z: 640, y: 40, top: 360 },
    { p: 'puddle', x: 490, z: 205, r: 42 },
    { p: 'flowerBed', x0: 1048, z0: 128, x1: 1172, z1: 372, y: 24 },
    { p: 'wheelbarrow', x: 230, z: 520, rot: 30 },
    { p: 'hose', x: 870, z: 470, r: 34 },
    { p: 'bucket', x: 290, z: 740, y: 8 },
    { p: 'potFlowers', x: 200, z: 360, y: 26 },
    { p: 'wateringCan', x: 780, z: 60, y: 14 },
    { p: 'chair', x: 470, z: 55, rot: 160, y: 14, color: '#2f86c9' },
    { p: 'chair', x: 720, z: 55, rot: 200, y: 14, color: '#e05a3c' },
    { p: 'flowers', x0: 20, z0: 20, x1: 1180, z1: 880, n: 220, seed: 3 },
    { p: 'grass', x0: 10, z0: 10, x1: 1190, z1: 890, n: 1400, seed: 5 },
    { p: 'mushrooms', x: 1000, z: 790, n: 6 },
    { p: 'clouds', n: 9 },
    { p: 'bush', x: 30, z: 150, r: 50 },
    { p: 'bush', x: 1170, z: 520, r: 60 },
    { p: 'bush', x: 560, z: 880, r: 55 },
    { p: 'pine', x: -260, z: 300, s: 2.4 },
    { p: 'pine', x: -200, z: 760, s: 2.0 },
    { p: 'pine', x: 1700, z: 200, s: 2.6 },
    { p: 'pine', x: 1750, z: 900, s: 2.2 },
    { p: 'pine', x: 150, z: 1750, s: 2.5 },
    { p: 'pine', x: 1050, z: 1800, s: 2.2 },
  ],
};

const grandPrix = {
  name: 'Garden Grand Prix',
  blurb: 'Loop-the-loop, a jump over the puddle and a dash under the picnic table.',
  laps: 3,
  width: 24,
  points: [
    // west side, heading north (start)
    { x: 70, y: 0.6, z: 640 },
    { x: 70, y: 0.6, z: 420 },
    { x: 78, y: 0.6, z: 270, bank: 6 },
    { x: 125, y: 0.6, z: 185, bank: 10 },
    { x: 210, y: 0.6, z: 160 },
    // north side, heading east
    ...loop(300, 0.6, 160, 0, { r: 28, shift: 42 }),
    { x: 370, y: 0.6, z: 203 },
    ...jump(420, 0.6, 205, 0, { ramp: 45, rise: 16, gap: 30, drop: 8, land: 55, w: 24 }),
    { x: 640, y: 0.6, z: 207 },
    { x: 770, y: 0.6, z: 200 },
    { x: 880, y: 0.6, z: 212, bank: 8 },
    { x: 942, y: 0.6, z: 268, bank: 10 },
    // east side, heading south
    { x: 962, y: 0.6, z: 360 },
    { x: 966, y: 0.6, z: 480, bank: -4 },
    { x: 948, y: 0.6, z: 580, bank: 4 },
    { x: 956, y: 0.6, z: 690 },
    { x: 946, y: 0.6, z: 770, bank: 10 },
    { x: 895, y: 0.6, z: 822, bank: 10 },
    // south side, heading west, then north under the picnic table
    { x: 810, y: 0.6, z: 834 },
    { x: 735, y: 0.6, z: 826, bank: 10 },
    { x: 678, y: 0.6, z: 782, bank: 10 },
    { x: 662, y: 0.6, z: 700 },
    { x: 660, y: 0.6, z: 580 },
    { x: 660, y: 0.6, z: 460 },
    { x: 660, y: 0.6, z: 350, bank: -8 },
    { x: 630, y: 0.6, z: 298, bank: -10 },
    // middle, heading west, then south past the sandbox
    { x: 555, y: 0.6, z: 286 },
    { x: 470, y: 0.6, z: 296, bank: -10 },
    { x: 418, y: 0.6, z: 345, bank: -10 },
    { x: 402, y: 0.6, z: 430 },
    { x: 400, y: 0.6, z: 560 },
    { x: 402, y: 0.6, z: 700, bank: 6 },
    { x: 388, y: 0.6, z: 800, bank: 10 },
    { x: 330, y: 0.6, z: 842, bank: 6 },
    // south-west, heading west and back north
    { x: 220, y: 0.6, z: 848 },
    { x: 140, y: 0.6, z: 842, bank: 10 },
    { x: 86, y: 0.6, z: 800, bank: 10 },
    { x: 70, y: 0.6, z: 730 },
  ],
};

export default { ...world, tracks: [grandPrix] };
