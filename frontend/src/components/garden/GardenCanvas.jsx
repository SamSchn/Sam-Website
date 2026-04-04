import { useRef, useEffect } from 'react';
import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { getPlantVisual, getPlantDef } from './plantData';

const TILE = 48;
const PAD = 4;          // grass tiles around the garden
const PLAYER_SPEED = 180;
const CAM_LERP = 0.08;

// Terrain
const GRASS_A = 0x5b8c3e;
const GRASS_B = 0x4e7a34;
const SOIL_A  = 0x3d2b1f;
const SOIL_B  = 0x4a3628;
const PATH_COLOR = 0xc4a882;
const FENCE_COL  = 0x8B6914;
const FENCE_DARK = 0x6b5210;

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
    renderPlants(s.plantsContainer, plants, s.gardenOX, s.gardenOY);
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
        background: 0x4a7a30,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true); return; }

      el.appendChild(app.canvas);
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      appRef.current = app;

      const world = new Container();
      app.stage.addChild(world);

      // ---- Static layers ----

      // Grass
      const grass = new Graphics();
      for (let wy = 0; wy < worldTilesH; wy++) {
        for (let wx = 0; wx < worldTilesW; wx++) {
          grass.rect(wx * TILE, wy * TILE, TILE, TILE)
            .fill((wx + wy) % 2 === 0 ? GRASS_A : GRASS_B);
        }
      }
      world.addChild(grass);

      // Path from gate to south edge
      const path = new Graphics();
      for (let py = PAD + gridHeight; py < worldTilesH; py++) {
        for (let px = PAD + gateStart; px < PAD + gateEnd; px++) {
          path.rect(px * TILE, py * TILE, TILE, TILE).fill(PATH_COLOR);
        }
      }
      world.addChild(path);

      // Soil
      const soil = new Graphics();
      for (let gy = 0; gy < gridHeight; gy++) {
        for (let gx = 0; gx < gridWidth; gx++) {
          const sx = gardenOX + gx * TILE;
          const sy = gardenOY + gy * TILE;
          soil.rect(sx, sy, TILE, TILE)
            .fill((gx + gy) % 2 === 0 ? SOIL_A : SOIL_B);
          soil.rect(sx, sy, TILE, TILE)
            .stroke({ color: 0x5a3a1a, width: 0.5, alpha: 0.3 });
        }
      }
      world.addChild(soil);

      // Fence with gate opening on south side
      const fence = new Graphics();
      drawFence(fence, gardenOX, gardenOY, gridWidth, gridHeight, gateStart, gateEnd);
      world.addChild(fence);

      // ---- Dynamic layers ----

      const plantsContainer = new Container();
      world.addChild(plantsContainer);
      renderPlants(plantsContainer, plantsRef.current, gardenOX, gardenOY);

      const highlight = new Graphics();
      world.addChild(highlight);

      const playerGfx = new Container();
      world.addChild(playerGfx);

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
        },
        camera: { x: 0, y: 0 },
        keys: new Set(),
        world,
        plantsContainer,
        highlight,
        playerGfx,
        prompt,
        gardenOX,
        gardenOY,
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

        // Camera
        const tCX = player.x - app.screen.width / 2;
        const tCY = player.y - app.screen.height / 2;
        camera.x += (tCX - camera.x) * CAM_LERP;
        camera.y += (tCY - camera.y) * CAM_LERP;
        world.x = Math.round(-camera.x);
        world.y = Math.round(-camera.y);

        // Player
        drawPlayer(playerGfx, player);

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

function drawPlayer(container, player) {
  container.removeChildren();
  const g = new Graphics();
  const { x, y, facing, moving, walkTime } = player;
  const bob = moving ? Math.sin(walkTime * Math.PI) * 1.5 : 0;

  // Shadow
  g.ellipse(x, y + 16, 10, 4).fill({ color: 0x000000, alpha: 0.25 });

  // Body
  const by = y - 8 - bob;
  g.roundRect(x - 8, by, 16, 22, 3).fill(0x4477cc);
  g.roundRect(x - 8, by, 16, 22, 3).stroke({ color: 0x335599, width: 1 });

  // Arms
  const armSwing = moving ? Math.sin(walkTime * Math.PI) * 3 : 0;
  g.roundRect(x - 11, by + 4 + armSwing, 4, 10, 2).fill(0x4477cc);
  g.roundRect(x + 7, by + 4 - armSwing, 4, 10, 2).fill(0x4477cc);

  // Head
  const hy = by - 8;
  g.circle(x, hy, 9).fill(0xffcc99);
  g.circle(x, hy, 9).stroke({ color: 0xddaa77, width: 1 });

  // Hair
  g.ellipse(x, hy - 6, 10, 5).fill(0x553322);

  // Eyes
  if (facing !== 'up') {
    let ex = 0, ey = 0;
    if (facing === 'left')  ex = -2;
    if (facing === 'right') ex = 2;
    if (facing === 'down')  ey = 1;
    g.circle(x - 3 + ex, hy + ey, 1.5).fill(0x222222);
    g.circle(x + 3 + ex, hy + ey, 1.5).fill(0x222222);
  }

  // Direction dot
  let ix = x, iy = y;
  if (facing === 'down')  iy = y + 20;
  if (facing === 'up')    iy = y - 30;
  if (facing === 'left')  ix = x - 18;
  if (facing === 'right') ix = x + 18;
  g.circle(ix, iy, 2.5).fill({ color: 0xffffff, alpha: 0.35 });

  container.addChild(g);
}

function drawFence(g, ox, oy, gw, gh, gateStart, gateEnd) {
  // Top
  for (let x = -1; x <= gw; x++) drawFencePost(g, ox + x * TILE, oy - TILE);
  // Bottom (with gate opening)
  for (let x = -1; x <= gw; x++) {
    if (x >= gateStart && x < gateEnd) continue;
    drawFencePost(g, ox + x * TILE, oy + gh * TILE);
  }
  // Left
  for (let y = 0; y < gh; y++) drawFencePost(g, ox - TILE, oy + y * TILE);
  // Right
  for (let y = 0; y < gh; y++) drawFencePost(g, ox + gw * TILE, oy + y * TILE);
}

function drawFencePost(g, x, y) {
  g.rect(x + TILE / 2 - 3, y + 6, 6, TILE - 12).fill(FENCE_COL);
  g.rect(x + TILE / 2 - 3, y + 6, 6, TILE - 12).stroke({ color: FENCE_DARK, width: 1 });
  g.rect(x + 4, y + Math.floor(TILE * 0.3), TILE - 8, 4).fill(FENCE_COL);
  g.rect(x + 4, y + Math.floor(TILE * 0.65), TILE - 8, 4).fill(FENCE_COL);
}

function renderPlants(container, plants, gardenOX, gardenOY) {
  container.removeChildren();

  plants.forEach((plant) => {
    const visual = getPlantVisual(plant.plant_type, plant.growth_stage, plant.wither_stage);
    const g = new Graphics();
    const wx = gardenOX + plant.grid_x * TILE;
    const wy = gardenOY + plant.grid_y * TILE;
    const pad = 4;
    const maxH = TILE - pad * 2;
    const plantH = maxH * visual.height;

    // Stem
    if (plant.growth_stage > 0) {
      const stemW = Math.max(2, (TILE - pad * 2) * 0.15);
      const stemColor = visual.withering ? 0x886644 : 0x5D4037;
      g.rect(wx + TILE / 2 - stemW / 2, wy + TILE - pad - plantH, stemW, plantH).fill(stemColor);
    }

    // Plant body
    if (plant.growth_stage === 0) {
      g.circle(wx + TILE / 2, wy + TILE - pad - 4, 6).fill(0xBFA76A);
      g.circle(wx + TILE / 2, wy + TILE - pad - 4, 4).fill(visual.color);
    } else if (plant.growth_stage === 1) {
      g.ellipse(wx + TILE / 2, wy + TILE - pad - plantH + 4, 6, 8).fill(visual.color);
    } else if (plant.growth_stage === 2) {
      g.ellipse(wx + TILE / 2, wy + TILE - pad - plantH + 6, 10, 10).fill(visual.color);
    } else if (plant.growth_stage === 3) {
      g.ellipse(wx + TILE / 2, wy + TILE - pad - plantH + 10, 14, 14).fill(visual.color);
    } else {
      g.circle(wx + TILE / 2, wy + TILE - pad - plantH + 12, 16).fill(visual.color);
      if (!visual.withering) {
        const cc = plant.plant_type === 'rose' ? 0xFFEB3B
          : plant.plant_type === 'mushroom' ? 0xFFFFFF
          : plant.plant_type === 'sunflower' ? 0x795548 : 0xFFF9C4;
        g.circle(wx + TILE / 2, wy + TILE - pad - plantH + 12, 5).fill(cc);
      }
    }

    // Wither overlay
    if (visual.withering) {
      g.setStrokeStyle({ width: 1, color: 0x444444, alpha: 0.3 });
      for (let i = 0; i < plant.wither_stage; i++) {
        const off = i * 4;
        g.moveTo(wx + pad + off, wy + TILE - pad);
        g.lineTo(wx + TILE - pad, wy + pad + off);
        g.stroke();
      }
    }

    container.addChild(g);

    // Sunshine sparkle
    if (plant.sunshine_count > 0) {
      const sparkle = new Text({
        text: '✦',
        style: new TextStyle({ fontSize: 8, fill: 0xFFD700 }),
      });
      sparkle.x = wx + TILE - 12;
      sparkle.y = wy + 2;
      container.addChild(sparkle);
    }
  });
}
