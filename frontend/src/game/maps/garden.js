// Sam's Digital Garden — east of the village. The plots are a 12x6 grid of
// tilled beds; what's planted in them comes from the server (see World.setGarden).
import { SPRITES } from '../sprites';
import { farmCell, farmSize } from '../garden/farm';
import { T, makeGrid, fill, spans, toRows, seeded, objectList } from './builder';

const W = 34;
const H = 24;
const FARM = { x: 13, y: 9, cols: 12, rows: 6, bedW: 4, bedH: 3 };
const GATE = { from: 11, to: 13 }; // rows of the gate in the west fence

function buildGarden() {
  const g = makeGrid(W, H, '.');
  const { w: fw, h: fh } = farmSize(FARM);
  const fence = { x0: FARM.x - 2, y0: FARM.y - 2, x1: FARM.x + fw + 1, y1: FARM.y + fh + 1 };

  // forest edge, with a gap for the path back to the village
  fill(g, 0, 0, W - 1, 1, 'x');
  fill(g, 0, H - 2, W - 1, H - 1, 'x');
  fill(g, 0, 0, 1, H - 1, 'x');
  fill(g, W - 2, 0, W - 1, H - 1, 'x');

  // path from the village, through the gate, and a walkway ring around the beds
  fill(g, 0, GATE.from, fence.x0, GATE.to, 'd');
  fill(g, fence.x0 + 1, fence.y0 + 1, fence.x1 - 1, fence.y1 - 1, 'd');
  // spur up to the greenhouse door
  fill(g, 5, 9, 7, GATE.from, 'd');
  // the beds
  for (let r = 0; r < FARM.rows; r++) {
    for (let c = 0; c < FARM.cols; c++) {
      const { tx, ty } = farmCell(FARM, c, r);
      g[ty][tx] = 'F';
    }
  }
  // little pond in the south-west meadow
  spans(g, [[16, 4, 7], [17, 3, 8], [18, 3, 8], [19, 4, 7]], 'w');

  const { list: objects, add } = objectList();
  const rand = seeded(2026);
  const plant = (sprite, cx, baseY, extra) => {
    const s = SPRITES[sprite];
    return add(sprite, cx - s.w / 2, baseY - (s.sortY ?? s.h), extra);
  };

  // ---------------------------------------------------------------- fence with a west gate
  for (let x = fence.x0; x <= fence.x1; x++) {
    const top = x === fence.x0 ? 'fence_wood_tl' : x === fence.x1 ? 'fence_wood_tr' : 'fence_wood_t';
    const bottom = x === fence.x0 ? 'fence_wood_bl' : x === fence.x1 ? 'fence_wood_br' : 'fence_wood_b';
    add(top, x * T, fence.y0 * T);
    add(bottom, x * T, fence.y1 * T);
  }
  for (let y = fence.y0 + 1; y < fence.y1; y++) {
    add('fence_wood_r', fence.x1 * T, y * T);
    if (y >= GATE.from && y <= GATE.to) continue;
    const left = y === GATE.from - 1 ? 'fence_wood_end_top' : y === GATE.to + 1 ? 'fence_wood_end_bottom' : 'fence_wood_l';
    add(left, fence.x0 * T, y * T);
  }

  // ---------------------------------------------------------------- buildings
  add('greenhouse', 3 * T, 2 * T - 4, {
    id: 'greenhouse',
    interact: {
      type: 'dialog', label: 'Greenhouse', speaker: 'Greenhouse',
      lines: ['The greenhouse door is locked.', 'Through the glass you can see seedlings for ideas that aren\'t ready to plant yet...'],
    },
    hit: { x: 34, y: 80, w: 28, h: 36 },
  });
  add('shed', 17 * T, -4, {
    id: 'seed_shed',
    interact: {
      type: 'dialog', label: 'Seed shed',
      lines: ['Shelves of seed packets, each labelled in Sam\'s handwriting.', '"Ideas I haven\'t planted yet." There are a LOT of them.'],
    },
    hit: { x: 30, y: 60, w: 36, h: 40 },
  });

  // ---------------------------------------------------------------- around the gate
  add('sign', 9 * T, 10 * T - 16, {
    id: 'garden_sign',
    interact: {
      type: 'dialog', label: 'Sign',
      lines: [
        "SAM'S DIGITAL GARDEN",
        'Every plant here is one of Sam\'s ideas. The bigger it grows, the further along the idea is.',
        'Plants only grow when they\'re watered — anyone can water a plant whose soil has dried out. Leave one dry too long and it wilts.',
      ],
    },
  });
  add('lamp_post', 10 * T, GATE.from * T - 47);
  add('lamp_post', 10 * T, (GATE.to + 1) * T + 14 - 47); // just below the path
  add('barrel_water', (fence.x0 + 1) * T, (fence.y0 + 1) * T - 18, {
    id: 'water_barrel',
    interact: { type: 'dialog', label: 'Water barrel', lines: ['Rainwater, collected for the garden. Walk up to a dry plant to water it.'] },
  });
  plant('scarecrow', (FARM.x + 9) * T + 8, (FARM.y + 1) * T + 14, {
    id: 'scarecrow',
    interact: { type: 'dialog', label: 'Scarecrow', lines: ['The scarecrow is wearing one of Sam\'s old hats.', 'It seems to be keeping the crows away from the good ideas.'] },
  });

  // ---------------------------------------------------------------- the gardener
  add('npc_jack', 18 * T, 18 * T, {
    id: 'jack',
    npc: { wander: 60 },
    interact: {
      type: 'dialog', speaker: 'Jack', label: 'Talk to Jack',
      lines: [
        'Plants here only grow while they\'re watered. One drink, one stage.',
        'See that dark soil? Still wet. Come back once it dries and you can water it again.',
        'Leave a plant dry too long and it wilts, then withers. Water brings it back, but it\'ll have lost some growth.',
        'Sam sets how fast each idea grows when he plants it. Some take days. Some take a week.',
        'Fully grown doesn\'t mean done. Even a big sunflower needs looking after.',
      ],
    },
  });

  // ---------------------------------------------------------------- meadow & pond
  add('bench', 14 * T, 18 * T + 2, {
    id: 'bench',
    interact: { type: 'dialog', label: 'Bench', lines: ['You sit for a moment and watch the ideas grow.', '...They grow slowly. That\'s alright.'] },
  });
  add('lily_green', 5 * T, 17 * T + 2);
  add('lily_flower', 6 * T + 6, 18 * T);
  add('cattail', 2 * T + 10, 17 * T);
  add('cattail', 8 * T + 10, 18 * T + 4);
  add('flowers_barrel_pink', 25 * T, 18 * T);
  add('flowers_barrel_blue', 27 * T, 18 * T + 4);
  plant('fruit_tree', 29 * T, 20 * T);
  plant('oak_small', 11 * T, 20 * T);
  plant('birch', 30 * T, 9 * T);
  add('log', 22 * T, 20 * T);
  add('stump', 2 * T + 4, 5 * T);

  // ---------------------------------------------------------------- forest border
  const treeTypes = ['oak', 'spruce', 'oak', 'birch', 'spruce'];
  const tree = (cx, base) => plant(treeTypes[Math.floor(rand() * treeTypes.length)], cx, base);
  for (let i = 0, x = -6; x < W * T + 20; i++, x += 26) {
    if (x < 260 || x > 380) tree(x + rand() * 6, i % 2 ? 22 : 38); // north (gap behind the shed)
    tree(x + 13 + rand() * 6, i % 2 ? 366 : 384);                  // south
  }
  for (let i = 0, y = 60; y < H * T - 30; i++, y += 24) {
    if (y < 160 || y > 236) tree(i % 2 ? 6 : 24, y + rand() * 6);   // west (gap for the path)
    tree(i % 2 ? W * T - 6 : W * T - 24, y + rand() * 6);           // east
  }

  // ---------------------------------------------------------------- flowers and grass
  const busy = (tx, ty) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ch = g[ty + dy]?.[tx + dx];
      if (ch !== '.' && ch !== 'x') return true;
    }
    return tx >= fence.x0 - 1 && tx <= fence.x1 + 1 && ty >= fence.y0 - 1 && ty <= fence.y1 + 1;
  };
  for (let ty = 2; ty < H - 2; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      if (g[ty][tx] !== '.' || busy(tx, ty)) continue;
      if (tx >= 3 && tx <= 8 && ty <= 9) continue; // greenhouse
      const r = rand();
      const ox = Math.floor(rand() * 4), oy = Math.floor(rand() * 4);
      if (r < 0.08) add(rand() < 0.5 ? 'grass_tuft' : 'grass_tuft_2', tx * T + ox, ty * T + oy);
      else if (r < 0.12) add(['flower_grass_1', 'flower_grass_5', 'flower_grass_6', 'flower_grass_8'][Math.floor(rand() * 4)], tx * T + ox, ty * T + oy);
      else if (r < 0.13) add(['flowers_white', 'flowers_pink', 'flowers_yellow'][Math.floor(rand() * 3)], tx * T + ox, ty * T + oy);
    }
  }

  return {
    id: 'garden',
    name: "Sam's Garden",
    route: '/garden',
    outdoor: true,
    width: W,
    height: H,
    terrain: toRows(g),
    objects,
    farm: FARM,
    warps: [
      { id: 'to_village', x: 0, y: GATE.from * T, w: 6, h: (GATE.to - GATE.from + 1) * T, to: 'village' },
    ],
    spawns: {
      default: { x: 3 * T, y: 12 * T + 8, facing: 'right' },
      village: { x: 3 * T, y: 12 * T + 8, facing: 'right' },
    },
  };
}

export default buildGarden();
