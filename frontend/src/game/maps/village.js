// The village — the site's home page. Built in code; the editor can load this
// as the default and save an edited copy to the database.
import { SPRITES } from '../sprites';
import { T, makeGrid, fill, spans, toRows, seeded, objectList } from './builder';

const W = 40;
const H = 30;

function buildVillage() {
  const g = makeGrid(W, H, '.');

  // Dense forest around the edge (walkable-looking grass you can't enter)
  fill(g, 0, 0, W - 1, 1, 'x');
  fill(g, 0, H - 2, W - 1, H - 1, 'x');
  fill(g, 0, 0, 1, H - 1, 'x');
  fill(g, W - 2, 0, W - 1, H - 1, 'x');

  // Paths from the two front doors down to the main road
  fill(g, 6, 9, 8, 12, 'd');
  fill(g, 28, 9, 30, 12, 'd');
  // Main road, running off the east edge toward the garden
  fill(g, 3, 13, W - 1, 15, 'd');
  // Town square: cobbles inside a ring of dirt
  fill(g, 13, 16, 26, 24, 'd');
  fill(g, 14, 17, 25, 23, 'c');
  // Pond
  spans(g, [
    [19, 31, 34], [20, 30, 35], [21, 29, 35], [22, 29, 35],
    [23, 29, 35], [24, 30, 34], [25, 31, 33],
  ], 'w');

  const { list: objects, add } = objectList();
  const rand = seeded(1234);

  // Place a sprite by its ground point (centre x, base y) instead of its top-left
  const plant = (sprite, cx, baseY, extra) => {
    const s = SPRITES[sprite];
    return add(sprite, cx - s.w / 2, baseY - (s.sortY ?? s.h), extra);
  };
  const treeTypes = ['oak', 'oak', 'spruce', 'birch', 'oak', 'spruce'];
  const randomTree = (cx, base) => plant(treeTypes[Math.floor(rand() * treeTypes.length)], cx, base);

  // ---------------------------------------------------------------- buildings
  add('house_sam', 5 * T, 3 * T, {
    id: 'sam_house',
    warp: { to: 'house' },
    interact: { type: 'warp', to: 'house', label: "Enter Sam's house" },
    hit: { x: 26, y: 88, w: 27, h: 30 },
  });
  add('house_stone', 24 * T, 3 * T, {
    id: 'town_hall',
    interact: {
      type: 'dialog', label: 'Town Hall',
      speaker: 'Town Hall',
      lines: [
        'The door is locked. A note is pinned to it:',
        '"Under construction! New rooms of the village open soon."',
      ],
    },
    hit: { x: 74, y: 86, w: 28, h: 30 },
  });

  // ---------------------------------------------------------------- Sam's yard
  add('mailbox', 136, 150, {
    id: 'mailbox',
    interact: { type: 'panel', panel: 'contact', label: 'Mailbox' },
  });
  add('hanging_sign', 64, 136, {
    id: 'house_sign',
    interact: {
      type: 'dialog', label: 'Sign',
      lines: ["SAM'S HOUSE", 'Come on in — the door is always open.'],
    },
  });
  for (const x of [82, 96]) add('flower_grass_5', x, 162);
  for (const x of [154, 170, 186, 202]) add(rand() < 0.5 ? 'flower_grass_1' : 'flower_grass_8', x, 150);
  add('bush', 214, 156);
  add('bush_small', 56, 176);

  // ---------------------------------------------------------------- orchard between the houses
  plant('fruit_tree', 254, 110);
  plant('fruit_tree', 306, 142);
  plant('fruit_tree', 356, 104);
  add('bush_small', 268, 160);
  add('bush', 336, 168);
  add('flower_grass_6', 236, 170);
  add('flower_grass_1', 290, 120);

  // ---------------------------------------------------------------- Town Hall front
  add('sign', 520, 150, {
    id: 'town_hall_sign',
    interact: { type: 'dialog', label: 'Sign', lines: ['TOWN HALL', 'Opening soon. Check back later!'] },
  });
  add('barrel', 432, 140);
  add('barrel_water', 448, 146);

  // ---------------------------------------------------------------- road side
  for (const x of [176, 368, 560]) add('lamp_post', x, 159);
  add('signpost', 584, 168, {
    id: 'signpost',
    interact: {
      type: 'dialog', label: 'Signpost',
      lines: ['EAST → Sam\'s Garden', 'Plant an idea, water it, and watch it grow.'],
    },
  });

  // ---------------------------------------------------------------- town square
  add('fountain', 304, 296, {
    id: 'fountain',
    interact: {
      type: 'dialog', label: 'Fountain',
      lines: ['You toss a coin into the fountain and make a wish.', '...Maybe it will come true.'],
    },
  });
  for (const [x, y] of [[224, 241], [400, 241], [224, 337], [400, 337]]) add('lamp_post', x, y);
  add('bench', 262, 352);
  add('bench', 346, 352);
  // flower barrels around the square
  add('flowers_barrel_pink', 262, 262);
  add('flowers_barrel_purple', 346, 262);
  add('flowers_barrel_blue', 230, 318);
  add('flowers_barrel_red', 378, 318);
  add('flowers_barrel_pink', 392, 262);
  add('flowers_barrel_purple', 216, 262);

  // ---------------------------------------------------------------- villagers
  add('npc_bob', 284, 266, {
    id: 'bob',
    npc: { wander: 56 },
    interact: {
      type: 'dialog', speaker: 'Bob', label: 'Talk to Bob',
      lines: [
        'Howdy! Welcome to the valley. Sam built every bit of this place himself, y\'know.',
        "Lookin' for Sam's projects? Try the bookshelf in his house, just up the path.",
        "I hear the Town Hall's getting fixed up soon. Wonder what'll be inside...",
        "That garden east of here? Sam plants his ideas in it. Some of 'em even bloom!",
        'Lovely day for a stroll, ain\'t it?',
      ],
    },
  });
  add('npc_fin', 404, 318, {
    id: 'fin',
    npc: { wander: 20 },
    interact: {
      type: 'dialog', speaker: 'Fin', label: 'Talk to Fin',
      lines: [
        "Shh... I think something's biting.",
        'Caught a sardine this morning. Then I let it go. Seemed like the right thing to do.',
        "Come back after dark — the fireflies over this pond are the prettiest thing in the valley.",
        'Sam? Good fella. Talks about JavaScript an awful lot, though.',
      ],
    },
  });

  // ---------------------------------------------------------------- meadow (south-west)
  add('picnic_blanket', 88, 344);
  plant('birch', 52, 326);
  plant('oak', 166, 420);
  plant('oak_small', 112, 300);
  add('log', 60, 400);
  add('mushroom_red', 150, 300);
  add('mushroom_blue', 44, 412);
  add('rock', 194, 296);

  // ---------------------------------------------------------------- pond (south-east)
  add('lily_green', 31 * T, 21 * T);
  add('lily_flower', 33 * T, 22 * T + 4);
  add('lily_green', 32 * T + 6, 23 * T + 2);
  add('water_rock', 30 * T + 4, 23 * T);
  add('cattail', 29 * T - 4, 20 * T + 6);
  add('cattail', 35 * T + 10, 21 * T);
  add('cattail', 33 * T + 6, 25 * T + 8);
  add('tall_grass', 30 * T, 25 * T + 2);
  plant('fruit_tree', 37 * T, 18 * T);
  plant('oak', 28 * T, 27 * T);
  add('stump', 34 * T, 17 * T);
  add('rock_small', 36 * T, 26 * T);

  // ---------------------------------------------------------------- forest border
  for (let i = 0, x = -6; x < W * T + 20; i++, x += 26) {
    randomTree(x + rand() * 6, i % 2 ? 22 : 42);          // north
    randomTree(x + 13 + rand() * 6, i % 2 ? 462 : 482);  // south
  }
  for (let i = 0, y = 60; y < H * T - 30; i++, y += 24) {
    randomTree(i % 2 ? 6 : 24, y + rand() * 6);         // west
    if (y < 196 || y > 270) randomTree(i % 2 ? 634 : 616, y + rand() * 6);  // east (gap for the road)
  }

  // ---------------------------------------------------------------- scattered ground detail
  const blocked = (tx, ty) => {
    const c = g[ty]?.[tx];
    return c !== '.';
  };
  const nearPath = (tx, ty) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[ty + dy]?.[tx + dx] !== '.' && g[ty + dy]?.[tx + dx] !== 'x') return true;
    return false;
  };
  for (let ty = 2; ty < H - 2; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      if (blocked(tx, ty) || nearPath(tx, ty)) continue;
      // keep the space in front of houses tidy
      if (ty >= 3 && ty <= 11 && ((tx >= 5 && tx <= 14) || (tx >= 24 && tx <= 36))) continue;
      const r = rand();
      const ox = Math.floor(rand() * 4), oy = Math.floor(rand() * 4);
      if (r < 0.07) add(rand() < 0.5 ? 'grass_tuft' : 'grass_tuft_2', tx * T + ox, ty * T + oy);
      else if (r < 0.095) add(['flower_grass_1', 'flower_grass_5', 'flower_grass_6', 'flower_grass_8'][Math.floor(rand() * 4)], tx * T + ox, ty * T + oy);
      else if (r < 0.105) add(['flowers_white', 'flowers_pink', 'flowers_yellow', 'flowers_mixed'][Math.floor(rand() * 4)], tx * T + ox, ty * T + oy);
    }
  }

  return {
    id: 'village',
    name: "Sam's Village",
    route: '/',
    outdoor: true,
    width: W,
    height: H,
    terrain: toRows(g),
    objects,
    warps: [
      { id: 'to_garden', x: W * T - 6, y: 13 * T, w: 6, h: 3 * T, to: 'garden' },
    ],
    spawns: {
      default: { x: 7 * T + 8, y: 12 * T + 8, facing: 'down' },
      house: { x: 7 * T + 8, y: 10 * T + 12, facing: 'down' },
      garden: { x: (W - 2) * T, y: 14 * T + 8, facing: 'left' },
    },
  };
}

export default buildVillage();
