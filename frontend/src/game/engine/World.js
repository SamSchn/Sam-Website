// The game world: renders one map at a time with PixiJS and runs the player,
// collisions, interactions, warps, camera and lighting. React owns the UI
// (dialogs, menus, HUD) and talks to the world through callbacks.
import {
  Application, Container, Sprite, Texture, Rectangle, Assets, TextureStyle, Graphics,
} from 'pixi.js';
import { SPRITES } from '../sprites';
import { buildTerrain, TERRAIN_SHEETS, TILE } from '../terrain';
import { findPath } from './pathfinding';
import { daylight } from './daylight';
import { Ambient, AMBIENT_SHEETS } from './ambient';
import { sfx } from './sound';
import { cropFrame, GARDEN_SHEETS } from '../garden/crops';
import { farmCell } from '../garden/farm';

const SPEED = 80;            // px per second (~5 tiles/s, Stardew's run speed)
const FOOT_W = 10;
const FOOT_H = 6;
const REACH = 12;            // how far in front of the player interactions reach

const PLAYER_SHEETS = [
  '/sprites/player/Player_Base_animations.png',
  '/sprites/player/Shoes_1_Brown.png',
  '/sprites/player/Farmer_Pants_1_Blue.png',
  '/sprites/player/Farmer_Shirt_1_Blue.png',
  '/sprites/player/Hair_1_Brown.png',
];
const PLAYER_ANIMS = {
  idle_down: 0, idle_right: 1, idle_up: 2,
  walk_down: 3, walk_right: 4, walk_up: 5,
};
const PLAYER_FRAMES = 6;

const DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Sprite definition for a placed object: a catalog entry, or an inline custom sprite from the editor. */
export function spriteDef(o) {
  return o.custom || SPRITES[o.sprite] || null;
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export class World {
  /**
   * @param el        container element the canvas is mounted in
   * @param callbacks { onTarget(target|null), onInteract(interact, obj), onWarp(to), onReady() }
   * @param promptEl  DOM element positioned over the current interaction target
   * @param opts      { editMode } — edit mode renders the map without a player,
   *                  with a free camera and pointer events forwarded to the editor
   */
  constructor(el, callbacks, promptEl, opts = {}) {
    this.editMode = !!opts.editMode;
    this.cam = { x: 0, y: 0 };
    this.editorState = {};
    this.el = el;
    this.cb = callbacks;
    this.promptEl = promptEl;
    this.keys = new Set();
    this.inputEnabled = true;
    this.frozen = false;
    this.texCache = new Map();
    this.map = null;
    this.time = 0;
    this.zoom = 3;
    this.zoomBias = 0;
    this.hourOverride = null;
  }

  // ------------------------------------------------------------------ setup

  async init() {
    TextureStyle.defaultOptions.scaleMode = 'nearest';
    const app = new Application();
    await app.init({
      resizeTo: this.el,
      background: 0x120d0b,
      antialias: false,
      roundPixels: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    if (this.destroyed) {
      app.destroy(true);
      return false;
    }
    this.app = app;
    this.el.appendChild(app.canvas);
    app.canvas.style.display = 'block';
    app.canvas.style.touchAction = 'none';

    this.root = new Container();
    app.stage.addChild(this.root);

    this.glowTexture = makeGlowTexture();
    await Assets.load(PLAYER_SHEETS);
    if (this.destroyed) {
      app.destroy(true);
      this.app = null;
      return false;
    }
    this.buildPlayer();
    this.bindInput();
    app.ticker.add(this.tick);
    return true;
  }

  destroy() {
    this.destroyed = true;
    this.unbindInput?.();
    // If init is still in flight it sees `destroyed` and tears the app down itself
    if (this.app && this.player) {
      this.app.ticker.remove(this.tick);
      this.app.destroy(true, { children: true });
      this.app = null;
    }
  }

  tex(sheet, x, y, w, h) {
    const key = `${sheet}|${x}|${y}|${w}|${h}`;
    let t = this.texCache.get(key);
    if (!t) {
      const base = Assets.get(sheet);
      if (!base) return Texture.EMPTY;
      t = new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) });
      this.texCache.set(key, t);
    }
    return t;
  }

  // ------------------------------------------------------------------ player

  buildPlayer() {
    this.player = {
      x: 0, y: 0, facing: 'down', moving: false,
      frame: 0, frameTime: 0,
      path: null, pendingTarget: null,
    };
    this.playerView = new Container();
    this.playerLayers = PLAYER_SHEETS.map(() => {
      const s = new Sprite();
      s.anchor.set(31.5 / 64, 40 / 64);
      this.playerView.addChild(s);
      return s;
    });
    // soft shadow under the feet
    this.playerShadow = new Graphics().ellipse(0, 0, 5, 2).fill({ color: 0x000000, alpha: 0.22 });
  }

  updatePlayerSprite() {
    const p = this.player;
    const dirName = p.facing === 'left' || p.facing === 'right' ? 'right' : p.facing;
    const row = PLAYER_ANIMS[`${p.moving ? 'walk' : 'idle'}_${dirName}`];
    const frame = p.frame % PLAYER_FRAMES;
    PLAYER_SHEETS.forEach((sheet, i) => {
      const s = this.playerLayers[i];
      s.texture = this.tex(sheet, frame * 64, row * 64, 64, 64);
      s.scale.x = p.facing === 'left' ? -1 : 1;
    });
    this.playerView.position.set(p.x, p.y);
    this.playerView.zIndex = p.y;
    this.playerShadow.position.set(p.x, p.y - 1);
  }

  footBox(x = this.player.x, y = this.player.y) {
    return { x: x - FOOT_W / 2, y: y - FOOT_H, w: FOOT_W, h: FOOT_H };
  }

  // ------------------------------------------------------------------ map loading

  async loadMap(map, from) {
    this.frozen = true;
    const token = (this.loadToken = (this.loadToken || 0) + 1);
    const sheets = new Set(TERRAIN_SHEETS);
    if (map.outdoor && !this.editMode) AMBIENT_SHEETS.forEach(a => sheets.add(a));
    if (map.farm) GARDEN_SHEETS.forEach(a => sheets.add(a));
    for (const o of map.objects) {
      const s = spriteDef(o);
      if (s) sheets.add(s.sheet);
    }
    await Assets.load([...sheets]).catch(err => console.error('World: failed to load sheets', err));
    // a newer load started while we were waiting (e.g. rapid edits): let it win
    if (this.destroyed || token !== this.loadToken) return;

    if (this.mapView) {
      // the player persists across maps; detach it before tearing the old map down
      this.playerView.removeFromParent();
      this.playerShadow.removeFromParent();
      this.root.removeChild(this.mapView);
      this.mapView.destroy({ children: true });
    }
    this.map = map;
    this.animated = [];
    this.fading = [];
    this.lights = [];
    this.solids = [];
    this.interactables = [];
    this.warps = [];
    this.ambient = null;
    this.npcs = [];
    const chimneys = [];

    const view = new Container();
    this.mapView = view;
    this.root.addChild(view);

    // ---- terrain
    const terrain = buildTerrain(map);
    this.terrain = terrain;
    this.mapW = terrain.width * TILE;
    this.mapH = terrain.height * TILE;
    const ground = new Container();
    const animGround = new Container();
    for (const t of terrain.tiles) {
      const s = new Sprite(this.tex(t.sheet, t.sx, t.sy, TILE, TILE));
      s.position.set(t.x, t.y);
      if (t.anim) {
        animGround.addChild(s);
        this.animated.push({ sprite: s, frames: this.animFrames(t.sheet, t.sx, t.sy, TILE, TILE, t.anim), speed: t.anim.speed, offset: 0 });
      } else {
        ground.addChild(s);
      }
    }
    view.addChild(ground, animGround);
    this.wetLayer = new Container(); // darker soil under watered plants
    view.addChild(this.wetLayer);
    if (!map.outdoor) view.addChild(this.buildRoomBorder(terrain));

    // ---- objects
    const groundObjects = new Container();
    const entities = new Container();
    entities.sortableChildren = true;
    view.addChild(groundObjects, entities);
    this.entities = entities;

    this.objectViews = [];
    for (const o of map.objects) {
      const def = spriteDef(o);
      if (!def) {
        console.warn(`World: unknown sprite "${o.sprite}"`);
        continue;
      }
      if (def.npc && !this.editMode) {
        this.spawnNpc(o, def, entities);
        continue;
      }
      const sprite = new Sprite(this.tex(def.sheet, def.x, def.y, def.w, def.h));
      sprite.position.set(o.x, o.y);
      if (o.flip) {
        sprite.scale.x = -1;
        sprite.x += def.w;
      }
      const sortY = o.y + (def.sortY ?? def.h);
      if (def.anim) {
        const frames = this.animFrames(def.sheet, def.x, def.y, def.w, def.h, def.anim);
        const start = def.anim.start || 0;
        this.animated.push({ sprite, frames, speed: def.anim.speed || 150, offset: start * (def.anim.speed || 150) + (o.x * 7 + o.y * 13) % 500 });
      }
      if ((def.layer || 'entity') === 'ground') {
        groundObjects.addChild(sprite);
      } else {
        sprite.zIndex = sortY;
        entities.addChild(sprite);
      }
      this.objectViews.push({ obj: o, def, sprite, sortY, ground: def.layer === 'ground' });
      if (def.fade) this.fading.push({ sprite, rect: { x: o.x, y: o.y, w: def.w, h: def.h }, sortY });

      const solids = o.solid !== undefined ? o.solid : def.solid;
      for (const r of solids || []) this.solids.push({ x: o.x + r.x, y: o.y + r.y, w: r.w, h: r.h });

      if (def.light) {
        this.lights.push({ x: o.x + def.light.x, y: o.y + def.light.y, r: def.light.r, color: def.light.color });
      }
      if (def.chimney) chimneys.push({ x: o.x + def.chimney.x, y: o.y + def.chimney.y });
      for (const w of def.windows || []) {
        this.lights.push({ x: o.x + w.x, y: o.y + w.y, r: 16, color: 0xffd27a });
      }

      if (o.warp && def.door) {
        this.warps.push({ x: o.x + def.door.x, y: o.y + def.door.y, w: def.door.w, h: def.door.h, to: o.warp.to });
      }

      if (o.interact) {
        const h = o.hit || { x: 0, y: 0, w: def.w, h: def.h };
        this.interactables.push({
          obj: o,
          interact: o.interact,
          rect: { x: o.x + h.x, y: o.y + h.y, w: h.w, h: h.h },
          sortY,
          labelY: o.y + (o.hit ? h.y : 0),
        });
      }
    }
    for (const w of map.warps || []) this.warps.push({ ...w });

    // ---- player
    const spawn = (from && map.spawns?.[from]) || map.spawns?.default || { x: this.mapW / 2, y: this.mapH / 2, facing: 'down' };
    Object.assign(this.player, { x: spawn.x, y: spawn.y, facing: spawn.facing || 'down', moving: false, path: null, pendingTarget: null });
    if (!this.editMode) {
      entities.addChild(this.playerShadow, this.playerView);
      this.playerShadow.zIndex = -1e6;
    }
    // Don't re-trigger the warp we just arrived through
    this.warpsArmed = false;

    // ---- ambient life drawn above characters (leaves, butterflies, smoke)
    const above = new Container();
    view.addChild(above);

    // ---- interior window beams
    const fx = new Container();
    view.addChild(fx);
    this.beams = [];
    for (const b of map.beams || []) {
      const g = new Graphics();
      const top = b.y + 18;
      g.poly([b.x, top, b.x + b.w, top, b.x + b.w + 22, top + 74, b.x + 10, top + 74]).fill({ color: 0xfff4d6, alpha: 0.13 });
      g.blendMode = 'add';
      fx.addChild(g);
      this.beams.push(g);
    }

    // ---- lighting: multiply tint over the map + additive glows
    this.tintSprite = new Sprite(Texture.WHITE);
    this.tintSprite.width = this.mapW;
    this.tintSprite.height = this.mapH;
    this.tintSprite.blendMode = 'multiply';
    view.addChild(this.tintSprite);
    this.lightLayer = new Container();
    view.addChild(this.lightLayer);
    for (const l of this.lights) {
      const s = new Sprite(this.glowTexture);
      s.anchor.set(0.5);
      s.position.set(l.x, l.y);
      s.width = s.height = l.r * 2;
      s.tint = l.color;
      s.blendMode = 'add';
      l.sprite = s;
      this.lightLayer.addChild(s);
    }
    const glow = new Container();
    view.addChild(glow);
    if (map.outdoor && !this.editMode) {
      this.ambient = new Ambient(this, above, glow);
      this.ambient.build(map, chimneys);
    }

    this.buildWalkGrid();
    this.gardenViews = [];
    if (this.garden) this.renderGarden();
    if (this.editMode) {
      this.overlay = new Graphics();
      view.addChild(this.overlay);
      if (!this.editorFramed) this.frameMap();
      this.drawOverlay();
    } else {
      this.updateZoom();
      this.updatePlayerSprite();
    }
    this.updateCamera(true);
    this.updateLighting();
    this.currentTarget = undefined;
    this.frozen = false;
  }

  animFrames(sheet, x, y, w, h, anim) {
    const out = [];
    for (let i = 0; i < anim.frames; i++) {
      out.push(this.tex(sheet, x + i * (anim.dx ?? w), y + i * (anim.dy ?? 0), w, h));
    }
    return out;
  }

  /** Stardew-style thick wooden frame around interior rooms. */
  buildRoomBorder(terrain) {
    const { width: W, height: H, types } = terrain;
    const g = new Graphics();
    const isVoid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || types[y * W + x] === 'void';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isVoid(x, y)) continue;
        const px = x * TILE, py = y * TILE;
        // draw a lip on each void side that touches the room
        if (!isVoid(x + 1, y)) g.rect(px + 10, py, 6, TILE);
        if (!isVoid(x - 1, y)) g.rect(px, py, 6, TILE);
        if (!isVoid(x, y + 1)) g.rect(px, py + 10, TILE, 6);
        if (!isVoid(x, y - 1)) g.rect(px, py, TILE, 6);
        if (!isVoid(x + 1, y + 1) && isVoid(x + 1, y) && isVoid(x, y + 1)) g.rect(px + 10, py + 10, 6, 6);
        if (!isVoid(x - 1, y + 1) && isVoid(x - 1, y) && isVoid(x, y + 1)) g.rect(px, py + 10, 6, 6);
        if (!isVoid(x + 1, y - 1) && isVoid(x + 1, y) && isVoid(x, y - 1)) g.rect(px + 10, py, 6, 6);
        if (!isVoid(x - 1, y - 1) && isVoid(x - 1, y) && isVoid(x, y - 1)) g.rect(px, py, 6, 6);
      }
    }
    g.fill(0xb5652b);
    // dark outline drawn as a slightly larger pass underneath
    const outline = new Graphics();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isVoid(x, y)) continue;
        const px = x * TILE, py = y * TILE;
        if (!isVoid(x + 1, y)) outline.rect(px + 8, py - 2, 8, TILE + 4);
        if (!isVoid(x - 1, y)) outline.rect(px, py - 2, 8, TILE + 4);
        if (!isVoid(x, y + 1)) outline.rect(px - 2, py + 8, TILE + 4, 8);
        if (!isVoid(x, y - 1)) outline.rect(px - 2, py, TILE + 4, 8);
      }
    }
    outline.fill(0x3b1e12);
    const c = new Container();
    c.addChild(outline, g);
    return c;
  }

  // ------------------------------------------------------------------ collision

  collides(box, self = null) {
    for (const n of this.npcs || []) {
      if (n !== self && overlap(box, this.npcBox(n))) return true;
    }
    if (self && overlap(box, this.footBox())) return true;
    return this.collidesStatic(box);
  }

  collidesStatic(box) {
    if (box.x < 0 || box.y < 0 || box.x + box.w > this.mapW || box.y + box.h > this.mapH) return true;
    const { width: W, solid } = this.terrain;
    const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w - 0.01) / TILE);
    const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (solid[ty * W + tx]) return true;
      }
    }
    for (const r of this.solids) if (overlap(box, r)) return true;
    return false;
  }

  buildWalkGrid() {
    const { width: W, height: H } = this.terrain;
    this.walk = new Uint8Array(W * H);
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2 + FOOT_H / 2;
        this.walk[ty * W + tx] = this.collidesStatic(this.footBox(cx, cy)) ? 0 : 1;
      }
    }
  }

  /** Move with axis-separated sliding plus a little corner-nudging (helps with doorways). */
  move(dx, dy) {
    const p = this.player;
    // already overlapping a villager (e.g. they walked into us): only static
    // collision applies, so neither of us gets stuck
    const hit = this.collides(this.footBox()) ? (b) => this.collidesStatic(b) : (b) => this.collides(b);
    if (dx) {
      if (!hit(this.footBox(p.x + dx, p.y))) p.x += dx;
      else if (!dy) this.nudge('y', dx);
    }
    if (dy) {
      if (!hit(this.footBox(p.x, p.y + dy))) p.y += dy;
      else if (!dx) this.nudge('x', dy);
    }
  }

  nudge(axis, step) {
    const p = this.player;
    for (let off = 1; off <= 6; off++) {
      for (const sign of [-1, 1]) {
        const nx = axis === 'x' ? p.x + sign * off : p.x + step;
        const ny = axis === 'y' ? p.y + sign * off : p.y + step;
        if (!this.collides(this.footBox(nx, ny))) {
          if (axis === 'x') p.x += sign * Math.min(off, Math.abs(step));
          else p.y += sign * Math.min(off, Math.abs(step));
          return;
        }
      }
    }
  }

  // ------------------------------------------------------------------ input

  bindInput() {
    const isTyping = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable;
    const onKeyDown = (e) => {
      if (isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (this.editMode) {
        if (k === ' ') this.spaceHeld = true;
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
        this.keys.add(k);
        return;
      }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.inputEnabled) return;
      this.keys.add(k);
      if (k === 'e' || k === ' ' || k === 'enter') {
        if (!e.repeat) this.interact();
      }
      if (k === '=' || k === '+') { this.zoomBias = Math.min(this.zoomBias + 1, 3); this.updateZoom(); }
      if (k === '-' || k === '_') { this.zoomBias = Math.max(this.zoomBias - 1, -2); this.updateZoom(); }
    };
    const onKeyUp = (e) => {
      this.keys.delete(e.key.toLowerCase());
      if (e.key === ' ') this.spaceHeld = false;
    };
    const onBlur = () => this.keys.clear();
    const onPointerDown = (e) => (this.editMode ? this.onEditPointer('down', e) : this.onPointer(e));
    const onPointerMove = (e) => this.editMode && this.onEditPointer('move', e);
    const onPointerUp = (e) => this.editMode && this.onEditPointer('up', e);
    const onWheel = (e) => this.editMode && this.onEditWheel(e);
    const onContext = (e) => this.editMode && e.preventDefault();
    const onResize = () => (this.editMode ? this.updateCamera() : this.updateZoom());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    this.app.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    this.app.canvas.addEventListener('wheel', onWheel, { passive: false });
    this.app.canvas.addEventListener('contextmenu', onContext);
    this.unbindInput = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      this.app?.canvas.removeEventListener('wheel', onWheel);
      this.app?.canvas.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      this.app?.canvas.removeEventListener('pointerdown', onPointerDown);
    };
  }

  setInputEnabled(on) {
    this.inputEnabled = on;
    if (!on && this.player) {
      this.keys.clear();
      this.player.path = null;
      this.player.pendingTarget = null;
    }
  }

  screenToWorld(sx, sy) {
    return { x: (sx - this.root.x) / this.zoom, y: (sy - this.root.y) / this.zoom };
  }

  worldToScreen(x, y) {
    return { x: x * this.zoom + this.root.x, y: y * this.zoom + this.root.y };
  }

  /** Click / tap: walk to the spot, or walk up to an object and use it. */
  onPointer(e) {
    if (!this.inputEnabled || this.frozen || !this.map) return;
    const rect = this.app.canvas.getBoundingClientRect();
    const w = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    // topmost interactable under the pointer
    const hits = this.interactables.filter(it => contains(it.rect, w.x, w.y) || this.spriteContains(it.obj, w.x, w.y));
    hits.sort((a, b) => b.sortY - a.sortY);
    const target = hits[0];

    const W = this.terrain.width, H = this.terrain.height;
    const goals = new Set();
    if (target) {
      // any walkable tile within reach of the target's interaction rect
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          if (!this.walk[ty * W + tx]) continue;
          const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
          if (distToRect(target.rect, cx, cy) <= TILE * 0.9) goals.add(ty * W + tx);
        }
      }
    } else {
      const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
      if (this.walk[ty * W + tx]) goals.add(ty * W + tx);
      else {
        // clicked something solid: go to the nearest walkable tile next to it
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = tx + dx, ny = ty + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && this.walk[ny * W + nx]) goals.add(ny * W + nx);
        }
      }
    }
    if (!goals.size) return;
    const start = [Math.floor(this.player.x / TILE), Math.floor((this.player.y - FOOT_H / 2) / TILE)];
    const path = findPath(this.walk, W, H, start, goals);
    if (!path) return;
    this.player.path = path.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 + FOOT_H / 2 }));
    // final step: if we clicked the ground, end exactly where clicked (when reachable)
    if (!target && path.length && !this.collides(this.footBox(w.x, w.y + FOOT_H / 2))) {
      this.player.path[this.player.path.length - 1] = { x: w.x, y: w.y + FOOT_H / 2 };
    }
    this.player.pendingTarget = target || null;
    this.cb.onPathStart?.();
  }

  spriteContains(obj, x, y) {
    const def = spriteDef(obj);
    return def && x >= obj.x && x < obj.x + def.w && y >= obj.y && y < obj.y + def.h;
  }

  // ------------------------------------------------------------------ interaction

  findTarget() {
    const p = this.player;
    const [fx, fy] = DIR_VEC[p.facing];
    const probeX = p.x + fx * REACH;
    const probeY = p.y - FOOT_H / 2 + fy * REACH;
    let best = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      const d = distToRect(it.rect, probeX, probeY);
      if (d < 5 && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  interact(target = this.findTarget()) {
    if (!target || this.frozen) return;
    if (target.npc) {
      this.talkTo(target.npc);
      return;
    }
    const it = target.interact;
    if (it.type === 'warp') {
      this.startWarp(it.to);
      return;
    }
    this.cb.onInteract?.(it, target.obj);
  }

  startWarp(to) {
    if (this.frozen) return;
    this.frozen = true;
    sfx.door();
    this.keys.clear();
    this.player.path = null;
    this.player.moving = false;
    this.cb.onWarp?.(to);
  }

  // ------------------------------------------------------------------ frame loop

  tick = (ticker) => {
    if (!this.map) return;
    const dt = Math.min(ticker.deltaMS, 50) / 1000;
    this.time += ticker.deltaMS;
    if (this.editMode) {
      this.editTick(dt);
      return;
    }
    const p = this.player;

    // --- movement
    let dx = 0, dy = 0;
    if (!this.frozen && this.inputEnabled) {
      if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
      if (dx || dy) {
        p.path = null;
        p.pendingTarget = null;
      } else if (p.path) {
        const wp = p.path[0];
        const vx = wp.x - p.x, vy = wp.y - p.y;
        const dist = Math.hypot(vx, vy);
        if (dist < 1.5) {
          p.path.shift();
          if (!p.path.length) {
            p.path = null;
            if (p.pendingTarget) {
              const t = p.pendingTarget;
              p.pendingTarget = null;
              p.facing = facingToward(p, t.rect);
              this.interact(t);
            }
          }
        } else {
          dx = vx / dist;
          dy = vy / dist;
        }
      }
    }

    p.moving = !!(dx || dy);
    if (p.moving) {
      if (Math.abs(dx) > Math.abs(dy) + 0.01) p.facing = dx > 0 ? 'right' : 'left';
      else if (Math.abs(dy) > 0.01) p.facing = dy > 0 ? 'down' : 'up';
      const len = Math.hypot(dx, dy);
      const step = SPEED * dt;
      const before = { x: p.x, y: p.y };
      this.move((dx / len) * step, (dy / len) * step);
      this.stepTimer = (this.stepTimer || 0) - dt;
      if (this.stepTimer <= 0 && (before.x !== p.x || before.y !== p.y)) {
        this.stepTimer = 0.3;
        sfx.step(!this.map.outdoor);
      }
      // stuck while following a path (e.g. something moved): give up
      if (p.path && before.x === p.x && before.y === p.y) {
        p.path = null;
        p.pendingTarget = null;
      }
    }

    p.frameTime += dt * 1000;
    const frameMs = p.moving ? 95 : 160;
    if (p.frameTime > frameMs) {
      p.frameTime = 0;
      p.frame = (p.frame + 1) % PLAYER_FRAMES;
    }
    this.updatePlayerSprite();

    for (const n of this.npcs) this.updateNpc(n, dt);

    // --- warps (walk into a door / off the edge)
    const box = this.footBox();
    const onWarp = this.warps.find(w => overlap(box, w));
    if (!this.warpsArmed) {
      if (!onWarp) this.warpsArmed = true;
    } else if (onWarp && !this.frozen && p.moving) {
      this.startWarp(onWarp.to);
    }

    // --- animated tiles & objects
    for (const a of this.animated) {
      const f = Math.floor((this.time + a.offset) / a.speed) % a.frames.length;
      if (a.sprite.texture !== a.frames[f]) a.sprite.texture = a.frames[f];
    }

    // --- see-through trees when the player walks behind them
    for (const f of this.fading) {
      const behind = p.y < f.sortY && contains(f.rect, p.x, p.y - 8);
      const target = behind ? 0.45 : 1;
      f.sprite.alpha += (target - f.sprite.alpha) * Math.min(1, dt * 10);
    }

    // --- interaction target + prompt
    const target = this.frozen || !this.inputEnabled ? null : this.findTarget();
    if (target !== this.currentTarget) {
      this.currentTarget = target;
      this.cb.onTarget?.(target ? { label: target.interact.label || 'Use', type: target.interact.type } : null);
    }

    this.updateCamera();
    if (this.promptEl) {
      if (target) {
        const sx = target.rect.x + target.rect.w / 2;
        const s = this.worldToScreen(sx, target.labelY);
        this.promptEl.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
      }
    }

    this.ambient?.update(dt, this.time);
    if (this.time - (this.lastLightUpdate || 0) > 5000) this.updateLighting();
  };

  /** The part of the map currently on screen, in world pixels. */
  viewRect() {
    return {
      x: -this.root.x / this.zoom,
      y: -this.root.y / this.zoom,
      w: this.app.screen.width / this.zoom,
      h: this.app.screen.height / this.zoom,
    };
  }

  // ------------------------------------------------------------------ garden

  /** garden: { plants: [{ id, crop, title, grid_x, grid_y, state }], owner: bool } */
  setGarden(garden) {
    this.garden = garden;
    this.renderGarden();
  }

  renderGarden() {
    const farm = this.map?.farm;
    if (!farm || this.editMode || !this.entities || !this.garden) return;
    for (const v of this.gardenViews) v.destroy();
    this.gardenViews = [];
    this.interactables = this.interactables.filter(i => !i.plot);

    const W = this.terrain.width;
    const byCell = new Map(this.garden.plants.map(p => [`${p.grid_x},${p.grid_y}`, p]));
    for (let r = 0; r < farm.rows; r++) {
      for (let c = 0; c < farm.cols; c++) {
        const { tx, ty } = farmCell(farm, c, r);
        const rect = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
        const p = byCell.get(`${c},${r}`);
        if (!p) {
          if (this.garden.owner) {
            this.interactables.push({
              plot: true, obj: { id: `plot_${c}_${r}` },
              interact: { type: 'plot', c, r, label: 'Plant a seed' },
              rect, sortY: rect.y + TILE, labelY: rect.y,
            });
          }
          continue;
        }

        // wet soil
        const piece = this.terrain.farmTiles.get(ty * W + tx);
        if (p.state.watered && piece) {
          const wet = new Sprite(this.tex(GARDEN_SHEETS[2], piece[0], piece[1], TILE, TILE));
          wet.position.set(rect.x, rect.y);
          this.wetLayer.addChild(wet);
          this.gardenViews.push(wet);
        }

        // the plant, bottom-aligned on its plot
        const f = cropFrame(p.crop, p.state.stage);
        const s = new Sprite(this.tex(f.sheet, f.x, f.y, f.w, f.h));
        s.position.set(rect.x, rect.y + TILE - f.h - 1);
        s.zIndex = rect.y + TILE - 3;
        if (p.state.wither === 1) s.tint = 0xe8c060; // yellowing
        if (p.state.wither === 2) {
          // brown and drooping
          s.tint = 0x8a5a32;
          s.scale.y = 0.85;
          s.y += Math.round(f.h * 0.15);
        }
        this.entities.addChild(s);
        this.gardenViews.push(s);

        this.interactables.push({
          plot: true, obj: { id: `plant_${p.id}` },
          interact: { type: 'plant', plantId: p.id, label: p.title },
          rect, sortY: rect.y + TILE, labelY: rect.y + TILE - f.h - 2,
        });
      }
    }
    this.currentTarget = undefined; // re-announce the prompt (labels may have changed)
  }

  /** Little water splash on a plot (after watering). */
  splash(c, r) {
    const farm = this.map?.farm;
    if (!farm || !this.mapView) return;
    const { tx, ty } = farmCell(farm, c, r);
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
    const drops = [];
    for (let i = 0; i < 9; i++) {
      const d = new Graphics().rect(0, 0, 1, 2).fill(i % 3 ? 0x6cc7ff : 0xd4f1ff);
      d.position.set(cx + (Math.random() - 0.5) * 12, cy - 14 - Math.random() * 10);
      this.mapView.addChild(d);
      drops.push({ d, vy: 40 + Math.random() * 30, life: 0.35 + Math.random() * 0.25 });
    }
    const tick = (t) => {
      const dt = t.deltaMS / 1000;
      let alive = 0;
      for (const p of drops) {
        if (p.life <= 0 || p.d.destroyed) continue;
        p.life -= dt;
        p.d.y += p.vy * dt;
        p.d.alpha = Math.max(0, p.life * 3);
        if (p.life > 0) alive++;
      }
      if (!alive || !this.app) {
        this.app?.ticker.remove(tick);
        drops.forEach(p => { if (!p.d.destroyed) p.d.destroy(); });
      }
    };
    this.app.ticker.add(tick);
  }

  // ------------------------------------------------------------------ villagers

  spawnNpc(o, def, entities) {
    const view = new Container();
    const sprite = new Sprite(this.tex(def.sheet, 0, 0, 64, 64));
    sprite.anchor.set(31.5 / 64, 40 / 64);
    const shadow = new Graphics().ellipse(0, 0, 5, 2).fill({ color: 0x000000, alpha: 0.22 });
    shadow.zIndex = -1e6;
    view.addChild(sprite);
    entities.addChild(view, shadow);
    const home = { x: o.x + 31.5, y: o.y + 40 };
    const n = {
      obj: o, def, view, sprite, shadow, home,
      x: home.x, y: home.y, facing: 'down', moving: false, frame: 0, ft: 0,
      target: null, pause: 1 + Math.random() * 2, talkIndex: 0,
      wander: o.npc?.wander ?? 40,
      name: o.interact?.speaker || def.label?.split(' ')[0] || 'Villager',
    };
    this.npcs.push(n);
    this.interactables.push({
      obj: o, npc: n,
      interact: { ...(o.interact || {}), type: 'npc', label: o.interact?.label || `Talk to ${n.name}` },
      rect: { x: 0, y: 0, w: 0, h: 0 },
      sortY: n.y,
      labelY: 0,
    });
  }

  npcBox(n) {
    return { x: n.x - 6, y: n.y - 5, w: 12, h: 5 };
  }

  talkTo(n) {
    const lines = n.obj.interact?.lines?.length ? n.obj.interact.lines : ['...'];
    const line = lines[n.talkIndex % lines.length];
    n.talkIndex++;
    // turn to face the player
    const dx = this.player.x - n.x, dy = this.player.y - n.y;
    n.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    n.target = null;
    n.pause = 2.5;
    this.cb.onInteract?.({
      type: 'dialog',
      speaker: n.name,
      lines: [line],
      portraitSprite: { sheet: n.def.sheet, x: 21, y: 17, w: 22, h: 20 },
    }, n.obj);
  }

  updateNpc(n, dt) {
    const busy = this.frozen || !this.inputEnabled;
    let vx = 0, vy = 0;
    if (!busy) {
      if (n.pause > 0) {
        n.pause -= dt;
      } else if (!n.target) {
        const a = Math.random() * Math.PI * 2;
        const d = 12 + Math.random() * n.wander;
        const t = { x: n.home.x + Math.cos(a) * d, y: n.home.y + Math.sin(a) * d * 0.7 };
        if (!this.collides(this.npcBoxAt(t.x, t.y), n)) n.target = t;
        else n.pause = 0.4;
      } else {
        const dx = n.target.x - n.x, dy = n.target.y - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1.5) {
          n.target = null;
          n.pause = 1.5 + Math.random() * 3;
        } else {
          const step = Math.min(dist, 30 * dt);
          vx = (dx / dist) * step;
          vy = (dy / dist) * step;
          const nx = n.x + vx, ny = n.y + vy;
          const stuck = this.collides(this.npcBoxAt(n.x, n.y), n);
          const hit = (b) => (stuck ? this.collidesStatic(b) : this.collides(b, n));
          if (!hit(this.npcBoxAt(nx, n.y))) n.x = nx; else vx = 0;
          if (!hit(this.npcBoxAt(n.x, ny))) n.y = ny; else vy = 0;
          if (!vx && !vy) {
            n.target = null;
            n.pause = 1 + Math.random() * 2;
          }
        }
      }
    }
    n.moving = !!(vx || vy);
    if (n.moving) {
      if (Math.abs(vx) > Math.abs(vy)) n.facing = vx > 0 ? 'right' : 'left';
      else n.facing = vy > 0 ? 'down' : 'up';
    }
    n.ft += dt * 1000;
    if (n.ft > (n.moving ? 120 : 180)) {
      n.ft = 0;
      n.frame = (n.frame + 1) % PLAYER_FRAMES;
    }
    const dir = n.facing === 'left' || n.facing === 'right' ? 'right' : n.facing;
    const row = PLAYER_ANIMS[`${n.moving ? 'walk' : 'idle'}_${dir}`];
    n.sprite.texture = this.tex(n.def.sheet, n.frame * 64, row * 64, 64, 64);
    n.sprite.scale.x = n.facing === 'left' ? -1 : 1;
    n.view.position.set(Math.round(n.x), Math.round(n.y));
    n.view.zIndex = n.y;
    n.shadow.position.set(Math.round(n.x), Math.round(n.y) - 1);

    // keep the interaction area on the villager
    const it = this.interactables.find(i => i.npc === n);
    if (it) {
      it.rect = { x: n.x - 8, y: n.y - 20, w: 16, h: 22 };
      it.sortY = n.y;
      it.labelY = n.y - 22;
    }
  }

  npcBoxAt(x, y) {
    return { x: x - 6, y: y - 5, w: 12, h: 5 };
  }

  // ------------------------------------------------------------------ edit mode

  /** Fit the whole map in view (used when the editor first opens a map). */
  frameMap() {
    if (!this.app) return;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.zoom = Math.max(1, Math.min(4, Math.floor(Math.min(sw / this.mapW, sh / this.mapH))));
    this.cam.x = (this.mapW - sw / this.zoom) / 2;
    this.cam.y = (this.mapH - sh / this.zoom) / 2;
    this.editorFramed = true;
    this.updateCamera();
  }

  editTick(dt) {
    for (const a of this.animated) {
      const f = Math.floor((this.time + a.offset) / a.speed) % a.frames.length;
      if (a.sprite.texture !== a.frames[f]) a.sprite.texture = a.frames[f];
    }
    // keyboard panning: WASD always; arrows only when nothing is selected
    // (the editor uses arrows to nudge the selected object)
    const pan = (400 / this.zoom) * dt;
    const arrows = !this.editorState?.selectedId;
    const k = this.keys;
    if (!this.spaceHeld && !k.has('control') && !k.has('meta')) {
      if (k.has('a') || (arrows && k.has('arrowleft'))) this.cam.x -= pan;
      if (k.has('d') || (arrows && k.has('arrowright'))) this.cam.x += pan;
      if (k.has('w') || (arrows && k.has('arrowup'))) this.cam.y -= pan;
      if (k.has('s') || (arrows && k.has('arrowdown'))) this.cam.y += pan;
    }
    this.updateCamera();
    if (this.overlayDirty) this.drawOverlay();
  }

  onEditPointer(type, e) {
    if (!this.app || !this.map) return;
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const inside = sx >= 0 && sy >= 0 && sx < rect.width && sy < rect.height;

    if (type === 'down' && inside && (e.button === 1 || e.button === 2 || this.spaceHeld)) {
      this.panning = { sx, sy, cx: this.cam.x, cy: this.cam.y };
      e.preventDefault();
      return;
    }
    if (this.panning) {
      if (type === 'move') {
        this.cam.x = this.panning.cx - (sx - this.panning.sx) / this.zoom;
        this.cam.y = this.panning.cy - (sy - this.panning.sy) / this.zoom;
        this.updateCamera();
      } else if (type === 'up') {
        this.panning = null;
      }
      return;
    }
    if (type === 'down' && !inside) return;
    const w = this.screenToWorld(sx, sy);
    this.cb.onEdit?.({
      type, x: w.x, y: w.y, tx: Math.floor(w.x / TILE), ty: Math.floor(w.y / TILE),
      inside, button: e.button, shift: e.shiftKey, alt: e.altKey,
    });
  }

  onEditWheel(e) {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const before = this.screenToWorld(sx, sy);
    const next = Math.max(1, Math.min(8, this.zoom + (e.deltaY < 0 ? 1 : -1)));
    if (next === this.zoom) return;
    this.zoom = next;
    this.cam.x = before.x - sx / this.zoom;
    this.cam.y = before.y - sy / this.zoom;
    this.updateCamera();
    this.drawOverlay();
  }

  /** Topmost placed object under a world point (entities before ground decor). */
  objectAt(x, y) {
    let best = null;
    for (const v of this.objectViews || []) {
      const { obj, def } = v;
      if (x < obj.x || y < obj.y || x >= obj.x + def.w || y >= obj.y + def.h) continue;
      const rank = (v.ground ? 0 : 1e6) + v.sortY;
      if (!best || rank > best.rank) best = { obj, rank };
    }
    return best?.obj || null;
  }

  /** Editor overlay state: { grid, hover:{tx,ty}, brush, selectedId, ghost:{def,x,y}, showSolids } */
  setEditorState(state) {
    this.editorState = state;
    this.overlayDirty = true;
  }

  drawOverlay() {
    this.overlayDirty = false;
    const g = this.overlay;
    if (!g || g.destroyed) return;
    g.clear();
    const st = this.editorState || {};
    const px = 1 / this.zoom;

    if (st.grid) {
      for (let x = 0; x <= this.mapW; x += TILE) g.moveTo(x, 0).lineTo(x, this.mapH);
      for (let y = 0; y <= this.mapH; y += TILE) g.moveTo(0, y).lineTo(this.mapW, y);
      g.stroke({ width: px, color: 0xffffff, alpha: 0.12 });
    }
    g.rect(0, 0, this.mapW, this.mapH).stroke({ width: 2 * px, color: 0xf0b840, alpha: 0.8 });

    if (st.showSolids) {
      for (const r of this.solids) g.rect(r.x, r.y, r.w, r.h);
      g.fill({ color: 0xff3b3b, alpha: 0.28 });
      const { width: W, height: H, solid } = this.terrain;
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (solid[ty * W + tx]) g.rect(tx * TILE, ty * TILE, TILE, TILE);
      g.fill({ color: 0xff3b3b, alpha: 0.12 });
    }

    // interactables, warps and spawns
    for (const it of this.interactables) g.rect(it.rect.x, it.rect.y, it.rect.w, it.rect.h);
    g.stroke({ width: px, color: 0xffe08a, alpha: 0.7 });
    for (const w of this.warps) g.rect(w.x, w.y, w.w, w.h);
    g.fill({ color: 0x3ba7ff, alpha: 0.45 });
    for (const sp of Object.values(this.map.spawns || {})) g.circle(sp.x, sp.y, 3);
    g.fill({ color: 0x5cff7a, alpha: 0.9 });

    const sel = st.selectedId && this.objectViews?.find(v => v.obj.id === st.selectedId);
    if (sel) {
      g.rect(sel.obj.x, sel.obj.y, sel.def.w, sel.def.h).stroke({ width: 2 * px, color: 0xffffff, alpha: 1 });
      for (const r of (sel.obj.solid !== undefined ? sel.obj.solid : sel.def.solid) || []) {
        g.rect(sel.obj.x + r.x, sel.obj.y + r.y, r.w, r.h);
      }
      g.fill({ color: 0xff3b3b, alpha: 0.45 });
    }

    if (st.hover && st.brush) {
      const half = Math.floor((st.brush - 1) / 2);
      g.rect((st.hover.tx - half) * TILE, (st.hover.ty - half) * TILE, st.brush * TILE, st.brush * TILE)
        .stroke({ width: 2 * px, color: 0xf0b840, alpha: 1 });
    }

    // translucent preview of the sprite about to be placed
    if (!this.ghost) {
      this.ghost = new Sprite();
      this.ghost.alpha = 0.65;
    }
    if (st.ghost) {
      const d = st.ghost.def;
      this.ghost.texture = this.tex(d.sheet, d.x, d.y, d.w, d.h);
      this.ghost.position.set(st.ghost.x, st.ghost.y);
      this.ghost.visible = true;
      if (this.ghost.parent !== this.mapView) this.mapView.addChild(this.ghost);
      if (!Assets.get(d.sheet)) Assets.load(d.sheet).then(() => { this.overlayDirty = true; });
    } else {
      this.ghost.visible = false;
    }
  }

  /** Re-render after an edit, keeping the editor camera where it is. */
  async rebuild(map) {
    if (this.ghost) this.ghost.removeFromParent();
    await this.loadMap(map, null);
  }

  // ------------------------------------------------------------------ camera & zoom

  updateZoom() {
    if (!this.app) return;
    const w = this.app.screen.width, h = this.app.screen.height;
    // ~20 tiles across the long side, but always at least ~9 across the short side (phones)
    const base = Math.min(Math.round(Math.max(w, h) / 280), Math.floor(Math.min(w, h) / (TILE * 9)));
    this.zoom = Math.max(1, Math.min(7, Math.max(2, base) + this.zoomBias));
    this.root.scale.set(this.zoom);
    this.updateCamera(true);
  }

  updateCamera() {
    if (!this.app || !this.map) return;
    if (this.editMode) {
      this.root.scale.set(this.zoom);
      this.root.x = Math.round(-this.cam.x * this.zoom);
      this.root.y = Math.round(-this.cam.y * this.zoom);
      return;
    }
    const vw = this.app.screen.width / this.zoom;
    const vh = this.app.screen.height / this.zoom;
    const p = this.player;
    let cx = p.x - vw / 2;
    let cy = p.y - 10 - vh / 2;
    cx = this.mapW <= vw ? (this.mapW - vw) / 2 : Math.max(0, Math.min(this.mapW - vw, cx));
    cy = this.mapH <= vh ? (this.mapH - vh) / 2 : Math.max(0, Math.min(this.mapH - vh, cy));
    this.root.x = Math.round(-cx * this.zoom);
    this.root.y = Math.round(-cy * this.zoom);
  }

  // ------------------------------------------------------------------ lighting

  setHourOverride(h) {
    this.hourOverride = h;
    this.updateLighting();
  }

  updateLighting() {
    if (!this.tintSprite) return;
    this.lastLightUpdate = this.time;
    const { tint, lights } = daylight(this.hourOverride, this.map.outdoor);
    this.tintSprite.tint = tint;
    for (const l of this.lights) l.sprite.alpha = lights;
    for (const b of this.beams) b.alpha = 1 - Math.min(1, lights * 1.4);
    this.ambient?.setDaylight(lights);
  }
}

function distToRect(r, x, y) {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

function facingToward(p, r) {
  const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(p.y - 3, r.y + r.h));
  const dx = cx - p.x, dy = cy - (p.y - 3);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function makeGlowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = Texture.from(c);
  t.source.scaleMode = 'linear';
  return t;
}
