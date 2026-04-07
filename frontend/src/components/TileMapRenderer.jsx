import { useRef, useEffect } from 'react';
import {
  Application, Container, Sprite, Graphics,
  Text, TextStyle, Texture, Rectangle, Assets, TextureStyle,
} from 'pixi.js';

const PX = 16;
const SCALE = 3;
const TILE = PX * SCALE; // 48
const PLAYER_SPEED = 180;
const CAM_LERP = 0.08;

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

export default function TileMapRenderer({ mapData, onPortal }) {
  const containerRef = useRef(null);
  const onPortalRef = useRef(onPortal);
  useEffect(() => { onPortalRef.current = onPortal; }, [onPortal]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapData) return;

    let cancelled = false;
    let wheelHandler = null;

    const initApp = async () => {
      TextureStyle.defaultOptions.scaleMode = 'nearest';

      const app = new Application();
      await app.init({
        resizeTo: el,
        background: 0x2a4a18,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true); return; }

      el.appendChild(app.canvas);
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';

      const mapW = mapData.width || 30;
      const mapH = mapData.height || 30;
      const worldW = mapW * TILE;
      const worldH = mapH * TILE;

      // Build walkability + interactable + portal maps from all layers
      const walkable = new Uint8Array(mapW * mapH).fill(1);  // default walkable
      const interactable = new Map();   // "x,y" → portal_target
      const hasGround = new Uint8Array(mapW * mapH).fill(0);

      if (mapData.layers) {
        for (const layer of mapData.layers) {
          for (const cell of (layer.cells || [])) {
            const idx = cell.grid_y * mapW + cell.grid_x;
            // If any layer marks a cell non-walkable, it's blocked
            if (!cell.walkable) walkable[idx] = 0;
            // Track ground coverage
            if (layer.layer_index === 0) hasGround[idx] = 1;
            // Portal
            if (cell.interactable && cell.portal_target) {
              interactable.set(`${cell.grid_x},${cell.grid_y}`, cell.portal_target);
            }
          }
        }
      }

      // Preload all unique sprite sheets used in this map
      const sheets = new Set();
      if (mapData.layers) {
        for (const layer of mapData.layers) {
          for (const cell of (layer.cells || [])) {
            sheets.add('/' + cell.sheet);
          }
        }
      }
      // Player sprites
      const playerPaths = [
        '/sprites/player/Player_Base_animations.png',
        '/sprites/player/Farmer_Shirt_1_Blue.png',
        '/sprites/player/Farmer_Pants_1_Blue.png',
        '/sprites/player/Hair_1_Brown.png',
        '/sprites/player/Shoes_1_Brown.png',
      ];
      for (const p of playerPaths) sheets.add(p);

      await Promise.all([...sheets].map(p => Assets.load(p).catch(() => null)));
      if (cancelled) { app.destroy(true); return; }

      // Build player animation frames
      const playerLayers = playerPaths.map(p => Assets.get(p));
      const playerAnims = {};
      for (const [name, cfg] of Object.entries(ANIM)) {
        playerAnims[name] = [];
        for (let f = 0; f < cfg.frames; f++) {
          const frameTex = playerLayers.map(sheet => {
            if (!sheet) return null;
            try {
              return new Texture({ source: sheet.source, frame: new Rectangle(f * PF_W, cfg.row * PF_H, PF_W, PF_H) });
            } catch { return null; }
          }).filter(Boolean);
          playerAnims[name].push(frameTex);
        }
      }

      // World container
      const world = new Container();
      app.stage.addChild(world);

      // Render tile layers
      const layerContainers = [];
      const sortedLayers = [...(mapData.layers || [])].sort((a, b) => a.layer_index - b.layer_index);
      const animatedTiles = []; // { sprite, cell, timer, currentFrame }

      for (const layer of sortedLayers) {
        const c = new Container();
        world.addChild(c);
        layerContainers.push(c);

        for (const cell of (layer.cells || [])) {
          const base = Assets.get('/' + cell.sheet);
          if (!base) continue;
          let tex;
          try {
            tex = new Texture({ source: base.source, frame: new Rectangle(cell.sprite_x, cell.sprite_y, cell.sprite_w, cell.sprite_h) });
          } catch { continue; }

          const sprite = new Sprite(tex);
          sprite.x = cell.grid_x * TILE;
          sprite.y = cell.grid_y * TILE;
          sprite.width = TILE;
          sprite.height = TILE;
          c.addChild(sprite);

          const animFrames = cell.anim_frames || 1;
          if (animFrames > 1) {
            animatedTiles.push({
              sprite,
              sheet: cell.sheet,
              baseX: cell.sprite_x,
              baseY: cell.sprite_y,
              frameW: cell.sprite_w,
              frameH: cell.sprite_h,
              frames: animFrames,
              speed: cell.anim_speed || 150,
              timer: 0,
              currentFrame: 0,
            });
          }
        }
      }

      // Interaction highlight + prompt
      const highlight = new Graphics();
      world.addChild(highlight);

      // Player container (rendered between objects and canopy, or on top)
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

      // Player state — start at center of map
      const player = {
        x: (mapW * TILE) / 2,
        y: (mapH * TILE) / 2,
        facing: 'down',
        moving: false,
        animFrame: 0,
        animTimer: 0,
      };

      const camera = {
        x: player.x - app.screen.width / 2,
        y: player.y - app.screen.height / 2,
      };

      const keys = new Set();

      // Keyboard
      const onKeyDown = (e) => {
        const key = e.key.toLowerCase();
        keys.add(key);

        if (key === 'e' || key === ' ') {
          e.preventDefault();
          const faced = getFacedTile(player, mapW, mapH);
          if (!faced) return;
          const portalTarget = interactable.get(`${faced.gx},${faced.gy}`);
          if (portalTarget) {
            onPortalRef.current?.(portalTarget);
          }
        }
      };
      const onKeyUp = (e) => keys.delete(e.key.toLowerCase());

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      // Game loop
      let lastTime = performance.now();
      const tick = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        // Movement with collision
        let dx = 0, dy = 0;
        if (keys.has('w') || keys.has('arrowup'))    { dy = -1; player.facing = 'up'; }
        if (keys.has('s') || keys.has('arrowdown'))  { dy =  1; player.facing = 'down'; }
        if (keys.has('a') || keys.has('arrowleft'))  { dx = -1; player.facing = 'left'; }
        if (keys.has('d') || keys.has('arrowright')) { dx =  1; player.facing = 'right'; }

        player.moving = dx !== 0 || dy !== 0;
        if (player.moving) {
          if (dx !== 0 && dy !== 0) { dx /= Math.SQRT2; dy /= Math.SQRT2; }
          const spd = PLAYER_SPEED * dt;
          const newX = player.x + dx * spd;
          const newY = player.y + dy * spd;

          // Collision check: test the tile the player center would move into
          const testTileX = Math.floor(newX / TILE);
          const testTileY = Math.floor(newY / TILE);

          // Try X movement
          const txX = Math.floor(newX / TILE);
          const txY = Math.floor(player.y / TILE);
          if (txX >= 0 && txX < mapW && txY >= 0 && txY < mapH && walkable[txY * mapW + txX]) {
            player.x = newX;
          }
          // Try Y movement
          const tyX = Math.floor(player.x / TILE);
          const tyY = Math.floor(newY / TILE);
          if (tyX >= 0 && tyX < mapW && tyY >= 0 && tyY < mapH && walkable[tyY * mapW + tyX]) {
            player.y = newY;
          }

          // Clamp to world
          player.x = Math.max(TILE * 0.5, Math.min(worldW - TILE * 0.5, player.x));
          player.y = Math.max(TILE * 0.5, Math.min(worldH - TILE * 0.5, player.y));
        }

        // Animation
        player.animTimer += dt;
        if (player.animTimer > 0.12) {
          player.animTimer = 0;
          player.animFrame = (player.animFrame + 1) % 6;
        }

        // Animate tiles
        const dtMs = dt * 1000;
        for (const at of animatedTiles) {
          at.timer += dtMs;
          if (at.timer >= at.speed) {
            at.timer -= at.speed;
            at.currentFrame = (at.currentFrame + 1) % at.frames;
            const frameX = at.baseX + at.currentFrame * at.frameW;
            const base = Assets.get('/' + at.sheet);
            if (base) {
              try {
                at.sprite.texture = new Texture({ source: base.source, frame: new Rectangle(frameX, at.baseY, at.frameW, at.frameH) });
              } catch { /* skip bad frame */ }
            }
          }
        }

        // Camera
        const tCX = player.x - app.screen.width / 2;
        const tCY = player.y - app.screen.height / 2;
        camera.x += (tCX - camera.x) * CAM_LERP;
        camera.y += (tCY - camera.y) * CAM_LERP;
        world.x = Math.round(-camera.x);
        world.y = Math.round(-camera.y);

        // Draw player
        drawPlayer(playerContainer, player, playerAnims);

        // Interaction highlight
        highlight.clear();
        prompt.text = '';
        const faced = getFacedTile(player, mapW, mapH);
        if (faced) {
          const portalTarget = interactable.get(`${faced.gx},${faced.gy}`);
          if (portalTarget) {
            highlight.rect(faced.wx + 1, faced.wy + 1, TILE - 2, TILE - 2)
              .stroke({ color: 0x40b0f0, width: 2, alpha: 0.8 });
            prompt.text = `[E] Enter ${portalTarget}`;
            prompt.x = faced.wx + TILE / 2;
            prompt.y = faced.wy - 4;
          }
        }
      };

      app.ticker.add(tick);

      // Resize
      const onResize = () => {
        app.renderer?.resize(el.clientWidth, el.clientHeight);
      };
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', onResize);
        app.destroy(true, { children: true });
      };
    };

    let cleanup;
    initApp().then(c => { cleanup = c; });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [mapData]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

// ---- Helpers ----

function getFacedTile(player, mapW, mapH) {
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);
  let ftx = ptx, fty = pty;
  if (player.facing === 'up')    fty -= 1;
  if (player.facing === 'down')  fty += 1;
  if (player.facing === 'left')  ftx -= 1;
  if (player.facing === 'right') ftx += 1;
  if (ftx < 0 || ftx >= mapW || fty < 0 || fty >= mapH) return null;
  return { gx: ftx, gy: fty, wx: ftx * TILE, wy: fty * TILE };
}

function drawPlayer(container, player, playerAnims) {
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

  const frames = playerAnims[animName];
  if (!frames || frames.length === 0) return;
  const frameIdx = animFrame % frames.length;
  const layerTextures = frames[frameIdx];

  for (const tex of layerTextures) {
    const s = new Sprite(tex);
    s.anchor.set(0.484, 0.625);
    s.x = player.x;
    s.y = player.y;
    s.scale.set(SCALE, SCALE);
    if (facing === 'left') s.scale.x = -SCALE;
    container.addChild(s);
  }
}
