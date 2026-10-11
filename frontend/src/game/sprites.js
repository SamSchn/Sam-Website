// Sprite catalog — every object that can be placed in a map.
//
// Coordinates are in source-sheet pixels. A placed object's (x, y) is the
// sprite's top-left corner in world pixels.
//
//   sortY   y offset (from the sprite's top) where the object meets the ground.
//           Entities are depth-sorted on this, so the player walks behind tall
//           things like trees and houses. Defaults to the sprite height.
//   solid   collision rects relative to the sprite's top-left.
//   layer   'entity' (default, depth-sorted) or 'ground' (flat things and
//           wall-mounted decor drawn under every entity).
//   anim    { frames, dx = w, dy = 0, speed = ms per frame }
//   light   { x, y, r, color } glow drawn at night (relative to top-left)
//   windows [{ x, y }] window centres that glow warm at night
//   chimney { x, y } where chimney smoke is drawn (outdoors)
//   door    rect (relative) that warps the player when walked into
//   hit     interaction rect (relative); defaults to the sprite bounds

const B = '/sprites/buildings/';
const T = '/sprites/trees/';
const D = '/sprites/decor/';
const I = '/sprites/interior/';
const CU = '/sprites/custom/';
const TL = '/sprites/tiles/';
const AD = '/animations/decor/';

export const SPRITES = {
  // ---------------------------------------------------------------- buildings
  house_sam: {
    label: "Sam's House",
    sheet: `${B}Buildings_Houses_Wood_House_2_Wood_Base_Red.png`, x: 0, y: 0, w: 144, h: 128,
    sortY: 112,
    solid: [
      { x: 14, y: 70, w: 18, h: 42 },
      { x: 47, y: 70, w: 35, h: 42 },
      { x: 32, y: 70, w: 15, h: 34 },   // above the door recess
      { x: 82, y: 64, w: 48, h: 36 },
    ],
    door: { x: 32, y: 103, w: 15, h: 10 },
    light: { x: 39, y: 98, r: 34, color: 0xffc070 },
    windows: [{ x: 47, y: 61 }, { x: 80, y: 94 }, { x: 102, y: 79 }, { x: 118, y: 79 }],
    chimney: { x: 55, y: 0 },
  },
  house_stone: {
    label: 'Town Hall',
    sheet: `${B}Buildings_Houses_Stone_House_5_Stone_Base_Blue.png`, x: 0, y: 0, w: 192, h: 128,
    sortY: 110,
    solid: [
      { x: 14, y: 64, w: 50, h: 40 },
      { x: 120, y: 64, w: 58, h: 40 },
      { x: 64, y: 64, w: 56, h: 46 },
    ],
    door: { x: 80, y: 100, w: 16, h: 10 },
    light: { x: 88, y: 96, r: 34, color: 0xffc070 },
    windows: [{ x: 38, y: 79 }, { x: 54, y: 79 }, { x: 102, y: 92 }, { x: 140, y: 79 }, { x: 156, y: 79 }],
  },
  house_lime: {
    label: 'Workshop',
    sheet: `${B}Buildings_Houses_Limestone_House_2_Limestone_Base_Red.png`, x: 0, y: 0, w: 144, h: 128,
    sortY: 112,
    solid: [
      { x: 14, y: 70, w: 68, h: 42 },
      { x: 82, y: 64, w: 48, h: 36 },
    ],
    door: { x: 32, y: 103, w: 15, h: 10 },
  },

  // ---------------------------------------------------------------- trees
  oak: {
    sheet: `${T}Big_Oak_Tree.png`, x: 64, y: 0, w: 64, h: 80,
    sortY: 68, solid: [{ x: 26, y: 62, w: 12, h: 7 }], fade: true,
  },
  spruce: {
    sheet: `${T}Big_Spruce_tree.png`, x: 64, y: 0, w: 64, h: 80,
    sortY: 68, solid: [{ x: 27, y: 62, w: 10, h: 7 }], fade: true,
  },
  birch: {
    sheet: `${T}Big_Birch_Tree.png`, x: 32, y: 0, w: 32, h: 80,
    sortY: 68, solid: [{ x: 11, y: 62, w: 10, h: 6 }], fade: true,
  },
  fruit_tree: {
    sheet: `${T}Big_Fruit_Tree.png`, x: 32, y: 0, w: 32, h: 64,
    sortY: 52, solid: [{ x: 11, y: 46, w: 10, h: 6 }], fade: true,
  },
  oak_small: {
    sheet: `${T}Medium_Oak_Tree.png`, x: 32, y: 0, w: 32, h: 48,
    sortY: 37, solid: [{ x: 12, y: 32, w: 8, h: 5 }], fade: true,
  },
  stump: {
    sheet: `${T}Big_Oak_Tree.png`, x: 16, y: 48, w: 32, h: 24,
    sortY: 18, solid: [{ x: 8, y: 8, w: 16, h: 9 }],
  },

  // ---------------------------------------------------------------- nature decor
  bush: { sheet: `${D}Outdoor_Decor.png`, x: 80, y: 80, w: 16, h: 16, sortY: 14, solid: [{ x: 2, y: 8, w: 12, h: 6 }] },
  bush_small: { sheet: `${D}Outdoor_Decor.png`, x: 48, y: 144, w: 16, h: 16, sortY: 15, solid: [{ x: 3, y: 9, w: 10, h: 6 }] },
  leafy: { sheet: `${D}Outdoor_Decor.png`, x: 80, y: 144, w: 16, h: 16, layer: 'ground' },
  rock: { sheet: `${D}Outdoor_Decor.png`, x: 64, y: 144, w: 16, h: 16, sortY: 14, solid: [{ x: 2, y: 8, w: 12, h: 6 }] },
  rock_small: { sheet: `${D}Outdoor_Decor.png`, x: 0, y: 80, w: 16, h: 16, layer: 'ground' },
  log: { sheet: `${D}Outdoor_Decor.png`, x: 0, y: 112, w: 32, h: 16, sortY: 14, solid: [{ x: 2, y: 6, w: 28, h: 8 }] },
  mushroom_red: { sheet: `${D}Outdoor_Decor.png`, x: 0, y: 48, w: 16, h: 16, layer: 'ground' },
  mushroom_blue: { sheet: `${D}Outdoor_Decor.png`, x: 32, y: 48, w: 16, h: 16, layer: 'ground' },
  flowers_white: { sheet: `${D}Outdoor_Decor.png`, x: 0, y: 0, w: 16, h: 16, layer: 'ground' },
  flowers_pink: { sheet: `${D}Outdoor_Decor.png`, x: 64, y: 0, w: 16, h: 16, layer: 'ground' },
  flowers_yellow: { sheet: `${D}Outdoor_Decor.png`, x: 64, y: 32, w: 16, h: 16, layer: 'ground' },
  flowers_mixed: { sheet: `${D}Outdoor_Decor.png`, x: 80, y: 16, w: 16, h: 16, layer: 'ground' },
  sprout: { sheet: `${D}Outdoor_Decor.png`, x: 32, y: 32, w: 16, h: 16, layer: 'ground' },
  tall_grass: { sheet: `${D}Outdoor_Decor.png`, x: 96, y: 48, w: 16, h: 16, sortY: 13 },
  cattail: { sheet: `${D}Outdoor_Decor.png`, x: 128, y: 112, w: 16, h: 16, sortY: 14 },
  lily_green: { sheet: `${D}Outdoor_Decor.png`, x: 48, y: 48, w: 16, h: 16, layer: 'ground' },
  lily_flower: { sheet: `${D}Outdoor_Decor.png`, x: 64, y: 48, w: 16, h: 16, layer: 'ground' },
  water_rock: { sheet: `${D}Outdoor_Decor.png`, x: 96, y: 64, w: 16, h: 16, layer: 'ground' },
  flower_grass_1: { sheet: `${AD}Flower_Grass_1_Anim.png`, x: 0, y: 0, w: 16, h: 16, layer: 'ground', anim: { frames: 8, speed: 140 } },
  flower_grass_5: { sheet: `${AD}Flower_Grass_5_Anim.png`, x: 0, y: 0, w: 16, h: 16, layer: 'ground', anim: { frames: 8, speed: 150 } },
  flower_grass_6: { sheet: `${AD}Flower_Grass_6_Anim.png`, x: 0, y: 0, w: 16, h: 16, layer: 'ground', anim: { frames: 8, speed: 130 } },
  flower_grass_8: { sheet: `${AD}Flower_Grass_8_Anim.png`, x: 0, y: 0, w: 16, h: 16, layer: 'ground', anim: { frames: 8, speed: 160 } },
  grass_tuft: { sheet: `${TL}Grass_Grass_Tiles_1.png`, x: 80, y: 144, w: 16, h: 16, layer: 'ground' },
  grass_tuft_2: { sheet: `${TL}Grass_Grass_Tiles_1.png`, x: 96, y: 144, w: 16, h: 16, layer: 'ground' },
  picnic_blanket: { sheet: `${TL}Picnic_Blankets.png`, x: 0, y: 0, w: 32, h: 32, layer: 'ground' },

  // ---------------------------------------------------------------- town props
  fountain: {
    sheet: `${AD}Outdoor_Decor_Animations_Other_Animations_Fountain_Anim.png`, x: 0, y: 0, w: 32, h: 48,
    anim: { frames: 8, speed: 120 }, sortY: 44, solid: [{ x: 1, y: 24, w: 30, h: 20 }],
  },
  lamp_post: {
    sheet: `${D}Lanter_Posts.png`, x: 0, y: 0, w: 16, h: 48,
    anim: { frames: 6, speed: 180 }, sortY: 47, solid: [{ x: 5, y: 42, w: 6, h: 5 }],
    light: { x: 8, y: 12, r: 46, color: 0xffb347 },
  },
  bench: { sheet: `${D}Benches.png`, x: 32, y: 0, w: 32, h: 32, sortY: 27, solid: [{ x: 2, y: 16, w: 28, h: 10 }] },
  sign: { sheet: `${D}Signs.png`, x: 0, y: 16, w: 16, h: 32, sortY: 31, solid: [{ x: 6, y: 26, w: 4, h: 5 }] },
  signpost: { sheet: `${D}Signs.png`, x: 48, y: 48, w: 16, h: 32, sortY: 31, solid: [{ x: 6, y: 26, w: 4, h: 5 }] },
  hanging_sign: { sheet: `${D}Signs.png`, x: 0, y: 148, w: 32, h: 44, sortY: 43, solid: [{ x: 18, y: 38, w: 8, h: 5 }] },
  mailbox: { sheet: `${CU}mailbox.png`, x: 0, y: 0, w: 16, h: 24, sortY: 23, solid: [{ x: 5, y: 19, w: 6, h: 5 }] },
  barrel: { sheet: `${D}barrels.png`, x: 0, y: 0, w: 16, h: 32, sortY: 30, solid: [{ x: 2, y: 20, w: 12, h: 10 }] },
  barrel_water: { sheet: `${D}barrels.png`, x: 16, y: 0, w: 16, h: 32, sortY: 30, solid: [{ x: 2, y: 20, w: 12, h: 10 }] },
  flowers_barrel_pink: { sheet: `${D}barrels.png`, x: 48, y: 32, w: 16, h: 32, sortY: 31, solid: [{ x: 2, y: 22, w: 12, h: 9 }] },
  flowers_barrel_purple: { sheet: `${D}barrels.png`, x: 16, y: 32, w: 16, h: 32, sortY: 31, solid: [{ x: 2, y: 22, w: 12, h: 9 }] },
  flowers_barrel_blue: { sheet: `${D}barrels.png`, x: 80, y: 32, w: 16, h: 32, sortY: 31, solid: [{ x: 2, y: 22, w: 12, h: 9 }] },
  flowers_barrel_red: { sheet: `${D}barrels.png`, x: 32, y: 32, w: 16, h: 32, sortY: 31, solid: [{ x: 2, y: 22, w: 12, h: 9 }] },
  fence_l: { sheet: '/sprites/fence/White_Fence.png', x: 16, y: 0, w: 16, h: 16, sortY: 14, solid: [{ x: 4, y: 8, w: 12, h: 6 }] },
  fence_m: { sheet: '/sprites/fence/White_Fence.png', x: 32, y: 0, w: 16, h: 16, sortY: 14, solid: [{ x: 0, y: 8, w: 16, h: 6 }] },
  fence_r: { sheet: '/sprites/fence/White_Fence.png', x: 48, y: 0, w: 16, h: 16, sortY: 14, solid: [{ x: 0, y: 8, w: 12, h: 6 }] },

  // ---------------------------------------------------------------- villagers
  // NPC sheets share the player's layout (idle/walk rows, 6 frames of 64x64).
  // In the editor these show as their idle frame; in the game they walk around.
  npc_bob: { label: 'Bob (farmer)', sheet: '/sprites/npcs/Farmer_Bob.png', x: 0, y: 0, w: 64, h: 64, sortY: 40, npc: true },
  npc_chloe: { label: 'Chloe (chef)', sheet: '/sprites/npcs/Chef_Chloe.png', x: 0, y: 0, w: 64, h: 64, sortY: 40, npc: true },
  npc_fin: { label: 'Fin (fisherman)', sheet: '/sprites/npcs/Fisherman_Fin.png', x: 0, y: 0, w: 64, h: 64, sortY: 40, npc: true },
  npc_jack: { label: 'Jack (lumberjack)', sheet: '/sprites/npcs/Lumberjack_Jack.png', x: 0, y: 0, w: 64, h: 64, sortY: 40, npc: true },

  // ---------------------------------------------------------------- interior
  window: { sheet: `${I}Windows_Single.png`, x: 8, y: 6, w: 14, h: 20, layer: 'ground' },
  window_curtains: { sheet: `${I}Windows_Single.png`, x: 96, y: 6, w: 32, h: 20, layer: 'ground' },
  portrait: { sheet: `${CU}portrait.png`, x: 0, y: 0, w: 16, h: 18, layer: 'ground' },
  bulletin_board: { sheet: `${CU}bulletin_board.png`, x: 0, y: 0, w: 32, h: 26, layer: 'ground' },
  fireplace: {
    sheet: `${CU}fireplace_anim.png`, x: 0, y: 0, w: 32, h: 48,
    anim: { frames: 3, speed: 160 }, sortY: 47, solid: [{ x: 0, y: 40, w: 32, h: 8 }],
    light: { x: 16, y: 38, r: 60, color: 0xff9a3c },
  },
  tv: {
    sheet: `${CU}tv_anim.png`, x: 0, y: 0, w: 24, h: 26,
    anim: { frames: 2, speed: 450, start: 1 }, sortY: 25, solid: [{ x: 0, y: 17, w: 24, h: 8 }],
  },
  bookshelf: { sheet: `${I}BookShelves.png`, x: 16, y: 0, w: 32, h: 32, sortY: 31, solid: [{ x: 1, y: 20, w: 30, h: 11 }] },
  bookshelf_small: { sheet: `${I}BookShelves.png`, x: 0, y: 0, w: 16, h: 32, sortY: 31, solid: [{ x: 1, y: 20, w: 14, h: 11 }] },
  table: { sheet: `${I}Tables.png`, x: 0, y: 8, w: 32, h: 24, sortY: 23, solid: [{ x: 1, y: 8, w: 30, h: 14 }] },
  table_round: { sheet: `${I}Tables.png`, x: 32, y: 6, w: 32, h: 26, sortY: 25, solid: [{ x: 6, y: 10, w: 20, h: 14 }] },
  chair: { sheet: `${I}Chairs.png`, x: 16, y: 40, w: 16, h: 24, sortY: 23, solid: [{ x: 3, y: 14, w: 10, h: 8 }] },
  chair_back: { sheet: `${I}Chairs.png`, x: 16, y: 4, w: 16, h: 28, sortY: 27, solid: [{ x: 3, y: 18, w: 10, h: 8 }] },
  sofa: { sheet: `${I}Chairs.png`, x: 80, y: 40, w: 32, h: 24, sortY: 23, solid: [{ x: 1, y: 10, w: 30, h: 12 }] },
  bed: { sheet: `${I}Beds.png`, x: 0, y: 160, w: 27, h: 32, sortY: 31, solid: [{ x: 1, y: 6, w: 25, h: 25 }] },
  lamp: {
    sheet: `${I}Standing_Lamps.png`, x: 0, y: 0, w: 16, h: 32, sortY: 31, solid: [{ x: 4, y: 26, w: 8, h: 5 }],
    light: { x: 8, y: 8, r: 40, color: 0xffd08a },
  },
  plant_tree: { sheet: '/sprites/interior/Indoor_Decor.png', x: 32, y: 100, w: 16, h: 28, sortY: 27, solid: [{ x: 3, y: 20, w: 10, h: 7 }] },
  plant_leafy: { sheet: '/sprites/interior/Indoor_Decor.png', x: 64, y: 112, w: 16, h: 16, sortY: 15, solid: [{ x: 3, y: 8, w: 10, h: 7 }] },
  plant_small: { sheet: '/sprites/interior/Indoor_Decor.png', x: 48, y: 106, w: 16, h: 22, sortY: 21, solid: [{ x: 4, y: 15, w: 8, h: 6 }] },
  drawers: { sheet: `${I}Drawers.png`, x: 0, y: 48, w: 32, h: 16, sortY: 15, solid: [{ x: 0, y: 4, w: 32, h: 11 }] },
  chest: { sheet: `${I}Chest_Anim.png`, x: 0, y: 0, w: 16, h: 16, sortY: 15, solid: [{ x: 1, y: 6, w: 14, h: 9 }] },
  rug: { sheet: `${CU}rug_big.png`, x: 0, y: 0, w: 48, h: 32, layer: 'ground' },
  doormat: { sheet: `${CU}doormat.png`, x: 0, y: 0, w: 32, h: 16, layer: 'ground' },
  papers: { sheet: `${CU}papers.png`, x: 0, y: 0, w: 16, h: 14, sortY: 30 },
  book_open: { sheet: `${I}Placeable_Decoration.png`, x: 80, y: 48, w: 16, h: 16, sortY: 30 },
  letters: { sheet: `${I}Placeable_Decoration.png`, x: 0, y: 48, w: 16, h: 16, sortY: 30 },
  candle: {
    sheet: `${I}Placeable_Decoration.png`, x: 0, y: 96, w: 16, h: 16, sortY: 30,
    light: { x: 8, y: 4, r: 22, color: 0xffc070 },
  },
};

export function getSprite(name) {
  return SPRITES[name] || null;
}

/** Every sheet path a map needs (for preloading). */
export function sheetsForMap(map) {
  const out = new Set();
  for (const o of map.objects || []) {
    const s = SPRITES[o.sprite];
    if (s) out.add(s.sheet);
  }
  return out;
}
