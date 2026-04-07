import { useRef, useEffect } from 'react';
import {
  Application, Container, Sprite, TilingSprite, Graphics,
  Text, TextStyle, Texture, Rectangle, Assets,
} from 'pixi.js';
import { TextureStyle } from 'pixi.js';
import { getPlantDef } from './plantData';

const TILE = 48;
const PX = 16;            // native sprite pixel size
const SCALE = TILE / PX;  // 3x
const PAD = 14;            // grass/forest tiles around the garden
const PLAYER_SPEED = 180;
const CAM_LERP = 0.08;

// Player animation config  (64×64 frames, 9 cols × 56 rows)
const PF_W = 64;
const PF_H = 64;
const ANIM = {
  idle_down:  { row: 0, frames: 6 },
  idle_right: { row: 1, frames: 6 },
  idle_up:    { row: 2, frames: 6 },
  walk_down:  { row: 3, frames: 6 },
  walk_right: { row: 4, frames: 6 },
  walk_up:    { row: 5, frames: 6 },
};

// Crop sprite layout (Crops.png: 112×688, 16px tiles, 7 cols × 43 rows)
const CROP_MAP = {
  sunflower: { row: 4, stages: [0, 1, 2, 4, 5] },
  cactus:    { row: 24, stages: [0, 1, 2, 4, 5] },
  bonsai:    { row: 32, stages: [0, 1, 2, 4, 5] },
  herb:      { row: 0, stages: [0, 1, 2, 4, 5] },
  rose:      { row: 8, stages: [0, 1, 2, 4, 5] },
  vine:      { row: 16, stages: [0, 1, 2, 4, 5] },
  mushroom:  { row: 20, stages: [0, 1, 2, 4, 5] },
  fern:      { row: 12, stages: [0, 1, 2, 4, 5] },
};

// Pond shape templates (relative tile offsets — rectangular-ish for clean autotiling)
const POND_SHAPES = [
  // 2×2 puddle (4 tiles)
  [[0,0],[1,0],[0,1],[1,1]],
  // 3×2 pool (6 tiles)
  [[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]],
  // 3×3 square pond (9 tiles)
  [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]],
  // Rounded 4×3 (12 tiles)
  [[0,-1],[1,-1],[-1,0],[0,0],[1,0],[2,0],[-1,1],[0,1],[1,1],[2,1],[0,2],[1,2]],
];

export default function GardenCanvas({
  plants,
  gridWidth,
  gridHeight,
  onInteract,
  interactionOpen,
  isAuthenticated,
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const stateRef = useRef(null);
  const plantsRef = useRef(plants);
  const onInteractRef = useRef(onInteract);
  const interactionOpenRef = useRef(interactionOpen);
  const isAuthRef = useRef(isAuthenticated);

  useEffect(() => { plantsRef.current = plants; }, [plants]);
  useEffect(() => { onInteractRef.current = onInteract; }, [onInteract]);
  useEffect(() => { interactionOpenRef.current = interactionOpen; }, [interactionOpen]);
  useEffect(() => { isAuthRef.current = isAuthenticated; }, [isAuthenticated]);

  // Re-render plants when data changes
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    renderPlants(s.plantsContainer, plants, s.gardenOX, s.gardenOY, s.textures);
  }, [plants]);

  // Main initialisation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    const app = new Application();

    const worldTilesW = gridWidth + PAD * 2;
    const worldTilesH = gridHeight + PAD * 2;
    const worldW = worldTilesW * TILE;
    const worldH = worldTilesH * TILE;
    const gardenOX = PAD * TILE;
    const gardenOY = PAD * TILE;

    const gateStart = Math.floor(gridWidth / 2) - 1;
    const gateEnd = gateStart + 2;

    const initApp = async () => {
      await app.init({
        width: el.clientWidth,
        height: el.clientHeight,
        background: 0x3a6b24,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true); return; }

      el.appendChild(app.canvas);
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      appRef.current = app;

      // ---- Load textures ----
      const textures = await loadTextures();
      if (cancelled) { app.destroy(true); return; }

      const world = new Container();
      app.stage.addChild(world);

      // ---- Grass base (tiling) ----
      const grass = new TilingSprite({
        texture: textures.grass,
        width: worldW,
        height: worldH,
      });
      grass.tileScale.set(SCALE, SCALE);
      world.addChild(grass);

      // ---- Forest decoration on the grass border ----
      const forestContainer = new Container();
      world.addChild(forestContainer);
      generateForest(forestContainer, textures, worldTilesW, worldTilesH, gardenOX, gardenOY, gridWidth, gridHeight, gateStart, gateEnd);

      // ---- Path from gate to south edge ----
      for (let py = PAD + gridHeight; py < worldTilesH; py++) {
        for (let px = PAD + gateStart; px < PAD + gateEnd; px++) {
          const pathSprite = new Sprite(textures.path);
          pathSprite.x = px * TILE;
          pathSprite.y = py * TILE;
          pathSprite.width = TILE;
          pathSprite.height = TILE;
          world.addChild(pathSprite);
        }
      }

      // ---- Soil (farmland) ----
      for (let gy = 0; gy < gridHeight; gy++) {
        for (let gx = 0; gx < gridWidth; gx++) {
          const soilSprite = new Sprite(textures.soil);
          soilSprite.x = gardenOX + gx * TILE;
          soilSprite.y = gardenOY + gy * TILE;
          soilSprite.width = TILE;
          soilSprite.height = TILE;
          world.addChild(soilSprite);
        }
      }

      // ---- Fence ----
      const fenceContainer = new Container();
      world.addChild(fenceContainer);
      buildFence(fenceContainer, textures, gardenOX, gardenOY, gridWidth, gridHeight, gateStart, gateEnd);

      // ---- Dynamic layers ----
      const plantsContainer = new Container();
      world.addChild(plantsContainer);
      renderPlants(plantsContainer, plantsRef.current, gardenOX, gardenOY, textures);

      const highlight = new Graphics();
      world.addChild(highlight);

      const playerContainer = new Container();
      world.addChild(playerContainer);

      const prompt = new Text({
        text: '',
        style: new TextStyle({
          fontSize: 11,
          fill: 0xffffff,
          fontFamily: 'monospace',
          stroke: { color: 0x000000, width: 3 },
          align: 'center',
        }),
      });
      prompt.anchor = { x: 0.5, y: 1 };
      world.addChild(prompt);

      // ---- Game state ----
      const state = {
        player: {
          x: gardenOX + (gridWidth * TILE) / 2,
          y: gardenOY + (gridHeight * TILE) / 2,
          facing: 'down',
          moving: false,
          walkTime: 0,
          animFrame: 0,
          animTimer: 0,
        },
        camera: { x: 0, y: 0 },
        keys: new Set(),
        world,
        plantsContainer,
        highlight,
        playerContainer,
        prompt,
        gardenOX,
        gardenOY,
        textures,
      };

      state.camera.x = state.player.x - app.screen.width / 2;
      state.camera.y = state.player.y - app.screen.height / 2;
      stateRef.current = state;

      // ---- Keyboard ----

      const onKeyDown = (e) => {
        if (interactionOpenRef.current) return;
        const key = e.key.toLowerCase();
        state.keys.add(key);

        if (key === 'e' || key === ' ') {
          e.preventDefault();
          const faced = getFacedTile(state.player);
          const inGarden = faced.gx >= 0 && faced.gx < gridWidth
                        && faced.gy >= 0 && faced.gy < gridHeight;
          if (!inGarden) return;

          const plant = plantsRef.current.find(
            p => p.grid_x === faced.gx && p.grid_y === faced.gy,
          );
          if (plant) {
            onInteractRef.current?.({ type: 'plant', plant });
          } else if (isAuthRef.current) {
            onInteractRef.current?.({ type: 'empty', gridX: faced.gx, gridY: faced.gy });
          }
        }
      };

      const onKeyUp = (e) => {
        state.keys.delete(e.key.toLowerCase());
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      // ---- Game loop ----

      let lastTime = performance.now();

      const tick = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const { player, keys, camera } = state;

        // Freeze input while popup is open
        if (interactionOpenRef.current) {
          keys.clear();
        }

        // Movement
        let dx = 0, dy = 0;
        if (keys.has('w') || keys.has('arrowup'))    { dy = -1; player.facing = 'up'; }
        if (keys.has('s') || keys.has('arrowdown'))  { dy =  1; player.facing = 'down'; }
        if (keys.has('a') || keys.has('arrowleft'))  { dx = -1; player.facing = 'left'; }
        if (keys.has('d') || keys.has('arrowright')) { dx =  1; player.facing = 'right'; }

        player.moving = dx !== 0 || dy !== 0;
        if (player.moving) {
          if (dx !== 0 && dy !== 0) { dx /= Math.SQRT2; dy /= Math.SQRT2; }
          const spd = PLAYER_SPEED * dt;
          player.x = Math.max(TILE * 0.5, Math.min(worldW - TILE * 0.5, player.x + dx * spd));
          player.y = Math.max(TILE * 0.5, Math.min(worldH - TILE * 0.5, player.y + dy * spd));
          player.walkTime += dt * 8;
        }

        // Animation frame update
        player.animTimer += dt;
        if (player.animTimer > 0.12) {
          player.animTimer = 0;
          player.animFrame = (player.animFrame + 1) % 6;
        }

        // Camera
        const tCX = player.x - app.screen.width / 2;
        const tCY = player.y - app.screen.height / 2;
        camera.x += (tCX - camera.x) * CAM_LERP;
        camera.y += (tCY - camera.y) * CAM_LERP;
        world.x = Math.round(-camera.x);
        world.y = Math.round(-camera.y);

        // Player sprite
        drawPlayerSprite(state.playerContainer, player, textures);

        // Interaction highlight + prompt
        highlight.clear();
        prompt.text = '';

        if (!interactionOpenRef.current) {
          const faced = getFacedTile(player);
          const inGarden = faced.gx >= 0 && faced.gx < gridWidth
                        && faced.gy >= 0 && faced.gy < gridHeight;

          if (inGarden) {
            const plant = plantsRef.current.find(
              p => p.grid_x === faced.gx && p.grid_y === faced.gy,
            );

            highlight.rect(faced.wx + 1, faced.wy + 1, TILE - 2, TILE - 2)
              .stroke({ color: plant ? 0xf0b840 : 0x88cc44, width: 2, alpha: 0.8 });

            if (plant) {
              const def = getPlantDef(plant.plant_type);
              prompt.text = `${def.icon} ${plant.title}\n[E] Interact`;
            } else if (isAuthRef.current) {
              prompt.text = '[E] Plant seed';
            }
            prompt.x = faced.wx + TILE / 2;
            prompt.y = faced.wy - 4;
          }
        }
      };

      app.ticker.add(tick);

      // Resize
      const onResize = () => {
        if (appRef.current && containerRef.current) {
          appRef.current.renderer.resize(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight,
          );
        }
      };
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', onResize);
      };
    };

    let cleanup;
    initApp().then((c) => { cleanup = c; });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      stateRef.current = null;
    };
  }, [gridWidth, gridHeight]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// ---- Pure helpers ----

function getFacedTile(player) {
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);
  let ftx = ptx, fty = pty;
  if (player.facing === 'up')    fty -= 1;
  if (player.facing === 'down')  fty += 1;
  if (player.facing === 'left')  ftx -= 1;
  if (player.facing === 'right') ftx += 1;
  return { wx: ftx * TILE, wy: fty * TILE, gx: ftx - PAD, gy: fty - PAD };
}

function rgbToHex(r, g, b) {
  return (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
}

// ===== Texture Loading =====

async function loadTextures() {
  // Set nearest-neighbor scaling for crisp pixel art
  TextureStyle.defaultOptions.scaleMode = 'nearest';

  const [grassTex, pathTex, farmlandTex, cropsSheet, flowersSheet,
         decorSheet, fenceSheet,
         playerBase, playerShirt, playerPants, playerHair, playerShoes,
         oakSmall, oakMed, oakBig, spruceSmall, spruceBig, birchSmall,
         waterTileSheet, waterMiddle, waterDecor,
         flowerGrass1, flowerGrass5, flowerGrass6, flowerGrass8,
         mushroom1, mushroom2,
         rock1, rock2,
         lilypadGreen, lilypadPurple,
         frogSheet] = await Promise.all([
    Assets.load('/sprites/tiles/Grass_1_Middle.png'),
    Assets.load('/sprites/tiles/Path_Middle.png'),
    Assets.load('/sprites/tiles/FarmLand_Tile.png'),
    Assets.load('/sprites/crops/Crops.png'),
    Assets.load('/sprites/decor/Flowers.png'),
    Assets.load('/sprites/decor/Outdoor_Decor.png'),
    Assets.load('/sprites/fence/Fences.png'),
    Assets.load('/sprites/player/Player_Base_animations.png'),
    Assets.load('/sprites/player/Farmer_Shirt_1_Blue.png'),
    Assets.load('/sprites/player/Farmer_Pants_1_Blue.png'),
    Assets.load('/sprites/player/Hair_1_Brown.png'),
    Assets.load('/sprites/player/Shoes_1_Brown.png'),
    Assets.load('/sprites/trees/Small_Oak_Tree.png'),
    Assets.load('/sprites/trees/Medium_Oak_Tree.png'),
    Assets.load('/sprites/trees/Big_Oak_Tree.png'),
    Assets.load('/sprites/trees/Small_Spruce_tree.png'),
    Assets.load('/sprites/trees/Big_Spruce_tree.png'),
    Assets.load('/sprites/trees/Small_Birch_Tree.png'),
    Assets.load('/sprites/tiles/Water_Tile_1.png'),
    Assets.load('/sprites/tiles/Water_Middle.png'),
    Assets.load('/sprites/tiles/Water_Decoration.png'),
    Assets.load('/sprites/decor/Flower_Grass_1_Anim.png'),
    Assets.load('/sprites/decor/Flower_Grass_5_Anim.png'),
    Assets.load('/sprites/decor/Flower_Grass_6_Anim.png'),
    Assets.load('/sprites/decor/Flower_Grass_8_Anim.png'),
    Assets.load('/sprites/decor/muschroom_1_Anim.png'),
    Assets.load('/sprites/decor/muschroom_2_Anim.png'),
    Assets.load('/sprites/decor/Rock_1_Anim.png'),
    Assets.load('/sprites/decor/Rock_2_Anim.png'),
    Assets.load('/sprites/decor/Lillypad_Green_1_Anim.png'),
    Assets.load('/sprites/decor/Lillypad_Purple_1_Anim.png'),
    Assets.load('/sprites/animals/Frog_01.png'),
  ]);

  // Extract farmland "fill" tile from tilemap
  const soil = extractFrame(farmlandTex, 32, 32, 16, 16);

  // Extract fence tiles from Fences.png (64×64, 4×4 grid at 16px)
  const fence = {
    tl: extractFrame(fenceSheet, 16, 0, 16, 16),
    tH: extractFrame(fenceSheet, 32, 0, 16, 16),
    tr: extractFrame(fenceSheet, 48, 0, 16, 16),
    lV1: extractFrame(fenceSheet, 16, 16, 16, 16),
    lV2: extractFrame(fenceSheet, 16, 32, 16, 16),
    rV1: extractFrame(fenceSheet, 48, 16, 16, 16),
    rV2: extractFrame(fenceSheet, 48, 32, 16, 16),
    bl: extractFrame(fenceSheet, 16, 48, 16, 16),
    bH: extractFrame(fenceSheet, 32, 48, 16, 16),
    br: extractFrame(fenceSheet, 48, 48, 16, 16),
  };

  // Build player animation frame sets
  const playerLayers = [playerBase, playerShoes, playerPants, playerShirt, playerHair];
  const playerAnims = {};
  for (const [name, cfg] of Object.entries(ANIM)) {
    playerAnims[name] = [];
    for (let f = 0; f < cfg.frames; f++) {
      const layerFrames = playerLayers.map(sheet =>
        extractFrame(sheet, f * PF_W, cfg.row * PF_H, PF_W, PF_H)
      );
      playerAnims[name].push(layerFrames);
    }
  }

  // Extract tree sprites - Big_Oak_Tree.png and Big_Spruce_tree.png: 192x80 (3 sections of 64x80)
  // Section 0: stump, Section 1: medium, Section 2: big
  const trees = {
    oakSmall: extractFrame(oakSmall, 32, 0, 32, 64),
    oakBig: extractFrame(oakSmall, 64, 0, 32, 64),
    oakMed: extractFrame(oakMed, 32, 0, 32, 48),
    oakHuge: extractFrame(oakBig, 128, 0, 64, 80),
    spruceSmall: extractFrame(spruceSmall, 32, 0, 32, 64),
    spruceBig: extractFrame(spruceSmall, 64, 0, 32, 64),
    spruceHuge: extractFrame(spruceBig, 128, 0, 64, 80),
    birchSmall: extractFrame(birchSmall, 32, 0, 32, 64),
  };

  // Water edge tiles from Water_Tile_1.png (48x80: 3 cols × 5 rows at 16px)
  // Row 0-2: standard 3×3 border (TL, T, TR / L, M, R / BL, B, BR)
  // Row 3-4: inner corners
  const water = {
    tl: extractFrame(waterTileSheet, 0, 0, 16, 16),
    t:  extractFrame(waterTileSheet, 16, 0, 16, 16),
    tr: extractFrame(waterTileSheet, 32, 0, 16, 16),
    l:  extractFrame(waterTileSheet, 0, 16, 16, 16),
    m:  extractFrame(waterTileSheet, 16, 16, 16, 16),
    r:  extractFrame(waterTileSheet, 32, 16, 16, 16),
    bl: extractFrame(waterTileSheet, 0, 32, 16, 16),
    b:  extractFrame(waterTileSheet, 16, 32, 16, 16),
    br: extractFrame(waterTileSheet, 32, 32, 16, 16),
    iTL: extractFrame(waterTileSheet, 0, 48, 16, 16),
    iTR: extractFrame(waterTileSheet, 16, 48, 16, 16),
    iBL: extractFrame(waterTileSheet, 0, 64, 16, 16),
    iBR: extractFrame(waterTileSheet, 16, 64, 16, 16),
    middle: waterMiddle,
  };

  // Flower grass (first frame of animation strips, each 128x16 = 8 frames of 16x16)
  const flowerGrassTextures = [
    extractFrame(flowerGrass1, 0, 0, 16, 16),
    extractFrame(flowerGrass5, 0, 0, 16, 16),
    extractFrame(flowerGrass6, 0, 0, 16, 16),
    extractFrame(flowerGrass8, 0, 0, 16, 16),
  ];

  // Mushrooms (first frame, 96x16 = 6 frames of 16x16)
  const mushroomTextures = [
    extractFrame(mushroom1, 0, 0, 16, 16),
    extractFrame(mushroom2, 0, 0, 16, 16),
  ];

  // Rocks (first frame, 128x16 = 8 frames of 16x16)
  const rockTextures = [
    extractFrame(rock1, 0, 0, 16, 16),
    extractFrame(rock2, 0, 0, 16, 16),
  ];

  // Lily pads (first frame, 128x16 = 8 frames of 16x16)
  const lilypadTextures = [
    extractFrame(lilypadGreen, 0, 0, 16, 16),
    extractFrame(lilypadPurple, 0, 0, 16, 16),
  ];

  // Water decorations (rocks in water: 48x16 = 3 items of 16x16)
  const waterDecorations = [
    extractFrame(waterDecor, 0, 0, 16, 16),
    extractFrame(waterDecor, 16, 0, 16, 16),
    extractFrame(waterDecor, 32, 0, 16, 16),
  ];

  // Frog (first idle frame from Frog_01.png: 320x128, 32x32 frames, 10 cols × 4 rows)
  const frogTex = extractFrame(frogSheet, 0, 0, 32, 32);

  return {
    grass: grassTex,
    path: pathTex,
    soil,
    cropsSheet,
    flowersSheet,
    decorSheet,
    fence,
    playerAnims,
    trees,
    water,
    flowerGrassTextures,
    mushroomTextures,
    rockTextures,
    lilypadTextures,
    waterDecorations,
    frogTex,
  };
}

function extractFrame(texture, x, y, w, h) {
  return new Texture({
    source: texture.source,
    frame: new Rectangle(x, y, w, h),
  });
}

// ===== Player Rendering =====

function drawPlayerSprite(container, player, textures) {
  container.removeChildren();

  const { facing, moving, animFrame } = player;

  let animName;
  if (moving) {
    if (facing === 'up') animName = 'walk_up';
    else if (facing === 'left' || facing === 'right') animName = 'walk_right';
    else animName = 'walk_down';
  } else {
    if (facing === 'up') animName = 'idle_up';
    else if (facing === 'left' || facing === 'right') animName = 'idle_right';
    else animName = 'idle_down';
  }

  const frameIdx = animFrame % textures.playerAnims[animName].length;
  const layerTextures = textures.playerAnims[animName][frameIdx];

  for (const tex of layerTextures) {
    const s = new Sprite(tex);
    s.anchor.set(0.484, 0.625);
    s.x = player.x;
    s.y = player.y;
    s.scale.set(SCALE, SCALE);
    if (facing === 'left') {
      s.scale.x = -SCALE;
    }
    container.addChild(s);
  }
}

// ===== Fence Building =====

function buildFence(container, textures, ox, oy, gw, gh, gateStart, gateEnd) {
  const f = textures.fence;
  const add = (tex, x, y) => {
    const s = new Sprite(tex);
    s.x = x;
    s.y = y;
    s.width = TILE;
    s.height = TILE;
    container.addChild(s);
  };

  // Top row: TL corner, horizontal rails, TR corner
  add(f.tl, ox - TILE, oy - TILE);
  for (let x = 0; x < gw; x++) add(f.tH, ox + x * TILE, oy - TILE);
  add(f.tr, ox + gw * TILE, oy - TILE);

  // Bottom row: BL corner, horizontal rails (skip gate), BR corner
  add(f.bl, ox - TILE, oy + gh * TILE);
  for (let x = 0; x < gw; x++) {
    if (x >= gateStart && x < gateEnd) continue;
    add(f.bH, ox + x * TILE, oy + gh * TILE);
  }
  add(f.br, ox + gw * TILE, oy + gh * TILE);

  // Left column: alternate upper/lower rail tiles for two-rail look
  for (let y = 0; y < gh; y++) add(y % 2 === 0 ? f.lV1 : f.lV2, ox - TILE, oy + y * TILE);
  // Right column: alternate upper/lower rail tiles
  for (let y = 0; y < gh; y++) add(y % 2 === 0 ? f.rV1 : f.rV2, ox + gw * TILE, oy + y * TILE);
}

// ===== Forest Generation (Zoned) =====

function generateForest(container, textures, worldTilesW, worldTilesH, gardenOX, gardenOY, gw, gh, gateStart, gateEnd) {
  let seed = 42;
  const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };

  const gardenLeft = gardenOX / TILE - 1;
  const gardenRight = gardenOX / TILE + gw;
  const gardenTop = gardenOY / TILE - 1;
  const gardenBottom = gardenOY / TILE + gh;

  const isInGarden = (tx, ty) =>
    tx >= gardenLeft && tx <= gardenRight &&
    ty >= gardenTop && ty <= gardenBottom;

  const isOnPath = (tx, ty) =>
    tx >= (gardenOX / TILE + gateStart) && tx < (gardenOX / TILE + gateEnd) &&
    ty > gardenBottom;

  // Track occupied tiles (water, trees, etc.)
  const occupied = new Set();
  const waterTiles = new Set();

  const tileKey = (tx, ty) => `${tx},${ty}`;

  const isBlocked = (tx, ty) =>
    isInGarden(tx, ty) || isOnPath(tx, ty) || occupied.has(tileKey(tx, ty));

  // ---- 1. Place Ponds ----
  const pondCount = 1 + Math.floor(rng() * 2); // 1-2 ponds
  const pondCenters = [];

  for (let p = 0; p < pondCount; p++) {
    let cx, cy, attempts = 0;
    const shapeIdx = Math.floor(rng() * POND_SHAPES.length);
    const shape = POND_SHAPES[shapeIdx];

    do {
      cx = 2 + Math.floor(rng() * (worldTilesW - 4));
      cy = 2 + Math.floor(rng() * (worldTilesH - 4));
      attempts++;
    } while (attempts < 80 && (
      isInGarden(cx, cy) || isOnPath(cx, cy) ||
      pondCenters.some(pc => Math.abs(pc.x - cx) < 8 && Math.abs(pc.y - cy) < 8) ||
      shape.some(([dx, dy]) => isInGarden(cx + dx, cy + dy) || isOnPath(cx + dx, cy + dy))
    ));

    if (attempts >= 80) continue;

    pondCenters.push({ x: cx, y: cy });

    // Mark water tiles
    for (const [dx, dy] of shape) {
      const tx = cx + dx, ty = cy + dy;
      if (tx >= 0 && tx < worldTilesW && ty >= 0 && ty < worldTilesH) {
        waterTiles.add(tileKey(tx, ty));
        occupied.add(tileKey(tx, ty));
        // Also reserve the surrounding ring for no-tree zone
        for (let ry = -1; ry <= 1; ry++) {
          for (let rx = -1; rx <= 1; rx++) {
            occupied.add(tileKey(tx + rx, ty + ry));
          }
        }
      }
    }
  }

  // Render water tiles with proper edge selection
  for (const key of waterTiles) {
    const [tx, ty] = key.split(',').map(Number);
    const hasN = waterTiles.has(tileKey(tx, ty - 1));
    const hasS = waterTiles.has(tileKey(tx, ty + 1));
    const hasE = waterTiles.has(tileKey(tx + 1, ty));
    const hasW = waterTiles.has(tileKey(tx - 1, ty));
    const hasNE = waterTiles.has(tileKey(tx + 1, ty - 1));
    const hasNW = waterTiles.has(tileKey(tx - 1, ty - 1));
    const hasSE = waterTiles.has(tileKey(tx + 1, ty + 1));
    const hasSW = waterTiles.has(tileKey(tx - 1, ty + 1));

    let tex;
    const w = textures.water;
    if (!hasN && !hasW) tex = w.tl;
    else if (!hasN && !hasE) tex = w.tr;
    else if (!hasS && !hasW) tex = w.bl;
    else if (!hasS && !hasE) tex = w.br;
    else if (!hasN) tex = w.t;
    else if (!hasS) tex = w.b;
    else if (!hasW) tex = w.l;
    else if (!hasE) tex = w.r;
    else if (!hasNW) tex = w.iTL;
    else if (!hasNE) tex = w.iTR;
    else if (!hasSW) tex = w.iBL;
    else if (!hasSE) tex = w.iBR;
    else tex = w.middle;

    const waterSprite = new Sprite(tex);
    waterSprite.x = tx * TILE;
    waterSprite.y = ty * TILE;
    waterSprite.width = TILE;
    waterSprite.height = TILE;
    container.addChild(waterSprite);
  }

  // Add pond decorations (lily pads, rocks, frogs)
  for (const pc of pondCenters) {
    const innerTiles = [];
    for (const key of waterTiles) {
      const [tx, ty] = key.split(',').map(Number);
      // Check if surrounded by water on all 4 sides (inner tile)
      if (waterTiles.has(tileKey(tx, ty - 1)) && waterTiles.has(tileKey(tx, ty + 1)) &&
          waterTiles.has(tileKey(tx - 1, ty)) && waterTiles.has(tileKey(tx + 1, ty)) &&
          Math.abs(tx - pc.x) <= 3 && Math.abs(ty - pc.y) <= 3) {
        innerTiles.push([tx, ty]);
      }
    }

    // Lily pads on inner water tiles
    for (const [tx, ty] of innerTiles) {
      if (rng() < 0.45) {
        const lilyTex = textures.lilypadTextures[Math.floor(rng() * textures.lilypadTextures.length)];
        const lily = new Sprite(lilyTex);
        lily.anchor.set(0.5, 0.5);
        lily.x = tx * TILE + TILE / 2 + (rng() - 0.5) * 16;
        lily.y = ty * TILE + TILE / 2 + (rng() - 0.5) * 16;
        lily.scale.set(SCALE * (0.8 + rng() * 0.4));
        container.addChild(lily);
      }
    }

    // Rock in/near pond
    if (innerTiles.length > 0 && rng() < 0.7) {
      const [rx, ry] = innerTiles[Math.floor(rng() * innerTiles.length)];
      const rockTex = textures.waterDecorations[Math.floor(rng() * textures.waterDecorations.length)];
      const rock = new Sprite(rockTex);
      rock.anchor.set(0.5, 0.5);
      rock.x = rx * TILE + TILE / 2 + (rng() - 0.5) * 10;
      rock.y = ry * TILE + TILE / 2 + (rng() - 0.5) * 10;
      rock.scale.set(SCALE);
      container.addChild(rock);
    }

    // Frog near pond
    if (innerTiles.length > 0 && rng() < 0.6) {
      const [fx, fy] = innerTiles[Math.floor(rng() * innerTiles.length)];
      const frog = new Sprite(textures.frogTex);
      frog.anchor.set(0.5, 0.5);
      frog.x = fx * TILE + TILE / 2 + (rng() - 0.5) * 12;
      frog.y = fy * TILE + TILE / 2 + (rng() - 0.5) * 12;
      frog.scale.set(SCALE * 0.8);
      container.addChild(frog);
    }
  }

  // ---- 2. Place Tree Clusters ----
  // Generate cluster centers spread across the border area
  const treesToRender = [];
  const clusterCount = 8 + Math.floor(rng() * 6);
  const hugeTrees = [textures.trees.oakHuge, textures.trees.spruceHuge];
  const medTrees = [textures.trees.oakBig, textures.trees.spruceBig, textures.trees.oakMed];
  const smallTrees = [textures.trees.oakSmall, textures.trees.spruceSmall, textures.trees.birchSmall];

  for (let c = 0; c < clusterCount; c++) {
    let cx, cy, attempts = 0;
    do {
      cx = 1 + Math.floor(rng() * (worldTilesW - 2));
      cy = 1 + Math.floor(rng() * (worldTilesH - 2));
      attempts++;
    } while (attempts < 50 && (isInGarden(cx, cy) || isOnPath(cx, cy) || waterTiles.has(tileKey(cx, cy))));
    if (attempts >= 50) continue;

    // Place 1-4 trees per cluster
    const treeCount = 1 + Math.floor(rng() * 4);
    for (let t = 0; t < treeCount; t++) {
      const tx = cx + Math.floor((rng() - 0.5) * 5);
      const ty = cy + Math.floor((rng() - 0.5) * 5);

      if (tx < 0 || tx >= worldTilesW || ty < 0 || ty >= worldTilesH) continue;
      if (isInGarden(tx, ty) || isOnPath(tx, ty) || waterTiles.has(tileKey(tx, ty))) continue;

      // Pick tree size: 50% huge, 30% medium, 20% small
      const r = rng();
      let treeTex;
      if (r < 0.5) treeTex = hugeTrees[Math.floor(rng() * hugeTrees.length)];
      else if (r < 0.8) treeTex = medTrees[Math.floor(rng() * medTrees.length)];
      else treeTex = smallTrees[Math.floor(rng() * smallTrees.length)];

      const scale = SCALE * (0.85 + rng() * 0.4);
      treesToRender.push({
        tex: treeTex,
        x: tx * TILE + TILE / 2 + (rng() - 0.5) * 16,
        y: ty * TILE + TILE / 2 + (rng() - 0.5) * 8,
        scale,
      });

      // Mark occupied area under tree canopy
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          occupied.add(tileKey(tx + ox, ty + oy));
        }
      }
    }
  }

  // Also scatter some individual trees for natural feel
  for (let ty = 0; ty < worldTilesH; ty += 2) {
    for (let tx = 0; tx < worldTilesW; tx += 2) {
      if (isInGarden(tx, ty) || isOnPath(tx, ty) || occupied.has(tileKey(tx, ty))) continue;
      if (rng() < 0.06) {
        const r = rng();
        let treeTex;
        if (r < 0.4) treeTex = hugeTrees[Math.floor(rng() * hugeTrees.length)];
        else if (r < 0.7) treeTex = medTrees[Math.floor(rng() * medTrees.length)];
        else treeTex = smallTrees[Math.floor(rng() * smallTrees.length)];

        treesToRender.push({
          tex: treeTex,
          x: tx * TILE + TILE / 2 + (rng() - 0.5) * 16,
          y: ty * TILE + TILE / 2 + (rng() - 0.5) * 8,
          scale: SCALE * (0.85 + rng() * 0.4),
        });

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            occupied.add(tileKey(tx + ox, ty + oy));
          }
        }
      }
    }
  }

  // Sort trees by Y for proper overlap (trees lower on screen render on top)
  treesToRender.sort((a, b) => a.y - b.y);
  for (const t of treesToRender) {
    const tree = new Sprite(t.tex);
    tree.anchor.set(0.5, 0.85);
    tree.x = t.x;
    tree.y = t.y;
    tree.scale.set(t.scale);
    container.addChild(tree);
  }

  // ---- 3. Ground Decorations (Flowers & Mushrooms) ----
  for (let ty = 0; ty < worldTilesH; ty++) {
    for (let tx = 0; tx < worldTilesW; tx++) {
      if (isInGarden(tx, ty) || isOnPath(tx, ty) || waterTiles.has(tileKey(tx, ty))) continue;
      if (occupied.has(tileKey(tx, ty))) continue;

      // Flowers (main decoration, ~20% density)
      if (rng() < 0.20) {
        const flowerTex = textures.flowerGrassTextures[Math.floor(rng() * textures.flowerGrassTextures.length)];
        const flower = new Sprite(flowerTex);
        flower.anchor.set(0.5, 0.5);
        flower.x = tx * TILE + TILE / 2 + (rng() - 0.5) * 20;
        flower.y = ty * TILE + TILE / 2 + (rng() - 0.5) * 20;
        flower.scale.set(SCALE * (0.8 + rng() * 0.4));
        container.addChild(flower);
      }
      // Mushrooms (sparse, ~3% density)
      else if (rng() < 0.03) {
        const mushTex = textures.mushroomTextures[Math.floor(rng() * textures.mushroomTextures.length)];
        const mush = new Sprite(mushTex);
        mush.anchor.set(0.5, 0.5);
        mush.x = tx * TILE + TILE / 2 + (rng() - 0.5) * 16;
        mush.y = ty * TILE + TILE / 2 + (rng() - 0.5) * 16;
        mush.scale.set(SCALE * (0.7 + rng() * 0.3));
        container.addChild(mush);
      }
      // Occasional rocks on grass (~2%)
      else if (rng() < 0.02) {
        const rockTex = textures.rockTextures[Math.floor(rng() * textures.rockTextures.length)];
        const rock = new Sprite(rockTex);
        rock.anchor.set(0.5, 0.5);
        rock.x = tx * TILE + TILE / 2 + (rng() - 0.5) * 16;
        rock.y = ty * TILE + TILE / 2 + (rng() - 0.5) * 16;
        rock.scale.set(SCALE * (0.6 + rng() * 0.4));
        container.addChild(rock);
      }
    }
  }
}

// ===== Plant Rendering =====

function renderPlants(container, plants, gardenOX, gardenOY, textures) {
  container.removeChildren();
  if (!textures) return;

  plants.forEach((plant) => {
    const wx = gardenOX + plant.grid_x * TILE;
    const wy = gardenOY + plant.grid_y * TILE;

    const cropInfo = CROP_MAP[plant.plant_type] || CROP_MAP.sunflower;
    const stageCol = cropInfo.stages[Math.min(plant.growth_stage, cropInfo.stages.length - 1)];
    const cropRow = cropInfo.row;

    const tex = extractFrame(
      textures.cropsSheet,
      stageCol * PX,
      cropRow * PX,
      PX,
      PX,
    );

    const plantSprite = new Sprite(tex);
    plantSprite.anchor.set(0.5, 1);
    plantSprite.x = wx + TILE / 2;
    plantSprite.y = wy + TILE;
    plantSprite.scale.set(SCALE);

    if (plant.wither_stage > 0) {
      const grey = [0.7, 0.5, 0.3][Math.min(plant.wither_stage - 1, 2)];
      plantSprite.tint = rgbToHex(grey, grey * 0.9, grey * 0.7);
    }

    container.addChild(plantSprite);

    if (plant.sunshine_count > 0) {
      const sparkle = new Text({
        text: '✦',
        style: new TextStyle({ fontSize: 10, fill: 0xFFD700 }),
      });
      sparkle.x = wx + TILE - 14;
      sparkle.y = wy + 2;
      container.addChild(sparkle);
    }
  });
}
