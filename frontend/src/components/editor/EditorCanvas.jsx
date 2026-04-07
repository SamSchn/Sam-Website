import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Application, Container, Graphics, Sprite, Texture, Rectangle, Assets, TextureStyle } from 'pixi.js';

const TILE_SIZE = 16;
const INITIAL_ZOOM = 3;

const EditorCanvas = forwardRef(function EditorCanvas(props, ref) {
  const containerRef = useRef(null);

  // Keep latest props in a ref so PixiJS callbacks always read current values
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; });

  // Internal PixiJS state, set once during init
  const internalsRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getAllCells() {
      if (!internalsRef.current) return [];
      return Array.from(internalsRef.current.cells.values()).map(v => v.data);
    },
    getDirtyCells() {
      if (!internalsRef.current) return [];
      const result = [];
      for (const key of internalsRef.current.dirty) {
        const val = internalsRef.current.cells.get(key);
        if (val) result.push(val.data);
      }
      return result;
    },
    getDeletedCells() {
      if (!internalsRef.current) return [];
      const del = [];
      for (const key of internalsRef.current.dirty) {
        if (!internalsRef.current.cells.has(key)) {
          const [li, gx, gy] = key.split(',').map(Number);
          del.push({ layer_index: li, grid_x: gx, grid_y: gy });
        }
      }
      return del;
    },
    clearDirty() {
      if (internalsRef.current) internalsRef.current.dirty.clear();
    },
  }));

  // Main PixiJS init — runs once
  useEffect(() => {
    let destroyed = false;
    let wheelHandler = null;
    let contextHandler = null;

    // All mutable state for the canvas
    const S = {
      app: null,
      world: null,
      layers: [],       // Container per layer (0=ground, 1=objects, 2=canopy)
      grid: null,        // Graphics for grid lines
      cursor: null,      // Graphics for cursor highlight
      checker: null,     // Graphics for checkerboard background
      cells: new Map(),  // "layer,x,y" → { sprite, data }
      dirty: new Set(),  // "layer,x,y" keys that changed since last save
      mapW: 30,
      mapH: 30,
      painting: false,   // false | 'paint' | 'erase'
      panning: false,
      panStart: { x: 0, y: 0 },
      lastPainted: null, // "x,y" — avoid re-painting same cell on drag
    };

    // Expose to imperative handle and other effects
    internalsRef.current = S;

    // ---- Helpers ----

    function getSubTexture(sheet, sx, sy, sw, sh) {
      const base = Assets.get('/' + sheet);
      if (!base) return null;
      try {
        return new Texture({ source: base.source, frame: new Rectangle(sx, sy, sw, sh) });
      } catch {
        return null;
      }
    }

    // Load a sheet on demand if not already cached
    async function ensureSheet(sheetPath) {
      const key = '/' + sheetPath;
      if (Assets.get(key)) return;
      await Assets.load(key).catch(() => null);
    }

    function drawChecker() {
      if (!S.checker) return;
      S.checker.clear();
      const size = TILE_SIZE;
      for (let y = 0; y < S.mapH; y++) {
        for (let x = 0; x < S.mapW; x++) {
          const shade = (x + y) % 2 === 0 ? 0x222233 : 0x1a1a2e;
          S.checker.rect(x * size, y * size, size, size);
          S.checker.fill(shade);
        }
      }
    }

    function drawGrid() {
      if (!S.grid) return;
      S.grid.clear();
      const zoom = S.world?.scale.x || INITIAL_ZOOM;

      // Grid lines
      S.grid.setStrokeStyle({ width: 0.5 / zoom, color: 0xffffff, alpha: 0.15 });
      for (let x = 0; x <= S.mapW; x++) {
        S.grid.moveTo(x * TILE_SIZE, 0).lineTo(x * TILE_SIZE, S.mapH * TILE_SIZE);
      }
      for (let y = 0; y <= S.mapH; y++) {
        S.grid.moveTo(0, y * TILE_SIZE).lineTo(S.mapW * TILE_SIZE, y * TILE_SIZE);
      }
      S.grid.stroke();

      // Border
      S.grid.setStrokeStyle({ width: 1.5 / zoom, color: 0xf0b840, alpha: 0.5 });
      S.grid.rect(0, 0, S.mapW * TILE_SIZE, S.mapH * TILE_SIZE);
      S.grid.stroke();
    }

    function screenToGrid(sx, sy) {
      if (!S.world) return null;
      const wx = (sx - S.world.x) / S.world.scale.x;
      const wy = (sy - S.world.y) / S.world.scale.y;
      const gx = Math.floor(wx / TILE_SIZE);
      const gy = Math.floor(wy / TILE_SIZE);
      if (gx < 0 || gx >= S.mapW || gy < 0 || gy >= S.mapH) return null;
      return { x: gx, y: gy };
    }

    function paintTile(gx, gy) {
      const p = propsRef.current;
      const tile = p.selectedTile;
      const layerIdx = p.activeLayer ?? 0;
      if (!tile) return;

      const posKey = `${gx},${gy}`;
      if (S.lastPainted === `${layerIdx},${posKey}`) return;
      S.lastPainted = `${layerIdx},${posKey}`;

      let texture = getSubTexture(tile.sheet, tile.sprite_x, tile.sprite_y, tile.sprite_w, tile.sprite_h);
      if (!texture) {
        // Sheet not loaded yet — load it then paint
        ensureSheet(tile.sheet).then(() => {
          S.lastPainted = null; // allow re-paint
          paintTile(gx, gy);
        });
        return;
      }

      const key = `${layerIdx},${gx},${gy}`;
      const existing = S.cells.get(key);

      const cellData = {
        layer_index: layerIdx,
        grid_x: gx,
        grid_y: gy,
        sheet: tile.sheet,
        sprite_x: tile.sprite_x,
        sprite_y: tile.sprite_y,
        sprite_w: tile.sprite_w,
        sprite_h: tile.sprite_h,
        walkable: p.tileProps?.walkable ? 1 : 0,
        interactable: p.tileProps?.interactable ? 1 : 0,
        portal_target: p.tileProps?.portal_target || null,
      };

      if (existing) {
        existing.sprite.texture = texture;
        existing.data = cellData;
      } else {
        const sprite = new Sprite(texture);
        sprite.x = gx * TILE_SIZE;
        sprite.y = gy * TILE_SIZE;
        S.layers[layerIdx]?.addChild(sprite);
        S.cells.set(key, { sprite, data: cellData });
      }

      S.dirty.add(key);
      p.onDirty?.(true);
    }

    function eraseTile(gx, gy) {
      const p = propsRef.current;
      const layerIdx = p.activeLayer ?? 0;

      const posKey = `${gx},${gy}`;
      if (S.lastPainted === `erase_${layerIdx},${posKey}`) return;
      S.lastPainted = `erase_${layerIdx},${posKey}`;

      const key = `${layerIdx},${gx},${gy}`;
      const existing = S.cells.get(key);
      if (existing) {
        existing.sprite.destroy();
        S.cells.delete(key);
        S.dirty.add(key);
        p.onDirty?.(true);
      }
    }

    function updateCursor(sx, sy) {
      if (!S.cursor) return;
      S.cursor.clear();
      const pos = screenToGrid(sx, sy);
      if (!pos) return;

      const zoom = S.world?.scale.x || INITIAL_ZOOM;
      const tool = propsRef.current.tool || 'paint';
      const color = tool === 'erase' ? 0xd94f4f : 0xf0b840;

      S.cursor.setStrokeStyle({ width: 1.5 / zoom, color, alpha: 0.9 });
      S.cursor.rect(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      S.cursor.stroke();
    }

    function centerView() {
      if (!S.world || !S.app) return;
      const mapPxW = S.mapW * TILE_SIZE * S.world.scale.x;
      const mapPxH = S.mapH * TILE_SIZE * S.world.scale.y;
      S.world.x = (S.app.screen.width - mapPxW) / 2;
      S.world.y = (S.app.screen.height - mapPxH) / 2;
    }

    function loadMap(data) {
      if (!data || !S.app) return;

      S.mapW = data.width || 30;
      S.mapH = data.height || 30;

      // Clear existing
      for (const val of S.cells.values()) {
        val.sprite.destroy();
      }
      S.cells.clear();
      S.dirty.clear();

      S.layers.forEach(c => c.removeChildren());

      // Rebuild from map data
      if (data.layers) {
        for (const layer of data.layers) {
          for (const cell of (layer.cells || [])) {
            const texture = getSubTexture(cell.sheet, cell.sprite_x, cell.sprite_y, cell.sprite_w, cell.sprite_h);
            if (!texture) continue;

            const sprite = new Sprite(texture);
            sprite.x = cell.grid_x * TILE_SIZE;
            sprite.y = cell.grid_y * TILE_SIZE;

            const li = layer.layer_index;
            S.layers[li]?.addChild(sprite);

            const key = `${li},${cell.grid_x},${cell.grid_y}`;
            S.cells.set(key, {
              sprite,
              data: {
                layer_index: li,
                grid_x: cell.grid_x,
                grid_y: cell.grid_y,
                sheet: cell.sheet,
                sprite_x: cell.sprite_x,
                sprite_y: cell.sprite_y,
                sprite_w: cell.sprite_w,
                sprite_h: cell.sprite_h,
                walkable: cell.walkable,
                interactable: cell.interactable,
                portal_target: cell.portal_target,
              },
            });
          }
        }
      }

      drawChecker();
      drawGrid();
      centerView();
    }

    // ---- Pointer handlers ----

    function onPointerDown(e) {
      if (e.button === 1) {
        S.panning = true;
        S.panStart = { x: e.globalX - S.world.x, y: e.globalY - S.world.y };
        return;
      }

      const pos = screenToGrid(e.globalX, e.globalY);
      if (!pos) return;

      if (e.button === 2 || propsRef.current.tool === 'erase') {
        eraseTile(pos.x, pos.y);
        S.painting = 'erase';
      } else {
        paintTile(pos.x, pos.y);
        S.painting = 'paint';
      }
    }

    function onPointerMove(e) {
      updateCursor(e.globalX, e.globalY);

      if (S.panning && S.world) {
        S.world.x = e.globalX - S.panStart.x;
        S.world.y = e.globalY - S.panStart.y;
        return;
      }

      if (S.painting) {
        const pos = screenToGrid(e.globalX, e.globalY);
        if (!pos) return;
        if (S.painting === 'erase') {
          eraseTile(pos.x, pos.y);
        } else {
          paintTile(pos.x, pos.y);
        }
      }
    }

    function onPointerUp() {
      S.painting = false;
      S.panning = false;
      S.lastPainted = null;
    }

    // ---- Init PixiJS ----

    async function init() {
      TextureStyle.defaultOptions.scaleMode = 'nearest';

      // Only preload sheets used by the current map (not all 500+)
      if (propsRef.current.mapData?.layers) {
        const sheets = new Set();
        for (const layer of propsRef.current.mapData.layers) {
          for (const cell of (layer.cells || [])) {
            sheets.add('/' + cell.sheet);
          }
        }
        await Promise.all([...sheets].map(p => Assets.load(p).catch(() => null)));
      }

      if (destroyed) return;

      const app = new Application();
      await app.init({
        resizeTo: containerRef.current,
        background: 0x111122,
        antialias: false,
        resolution: 1,
      });

      if (destroyed) { app.destroy(true); return; }

      containerRef.current.appendChild(app.canvas);
      S.app = app;

      // World container
      const world = new Container();
      world.scale.set(INITIAL_ZOOM);
      app.stage.addChild(world);
      S.world = world;

      // Checkerboard BG
      const checker = new Graphics();
      world.addChild(checker);
      S.checker = checker;

      // Layer containers
      for (let i = 0; i < 3; i++) {
        const c = new Container();
        world.addChild(c);
        S.layers.push(c);
      }

      // Grid overlay
      const grid = new Graphics();
      world.addChild(grid);
      S.grid = grid;

      // Cursor highlight
      const cursor = new Graphics();
      world.addChild(cursor);
      S.cursor = cursor;

      drawChecker();
      drawGrid();
      centerView();

      // Events
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      app.stage.on('pointerdown', onPointerDown);
      app.stage.on('pointermove', onPointerMove);
      app.stage.on('pointerup', onPointerUp);
      app.stage.on('pointerupoutside', onPointerUp);

      wheelHandler = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newScale = Math.min(12, Math.max(0.5, world.scale.x * zoomFactor));

        const mx = e.offsetX;
        const my = e.offsetY;
        const wx = (mx - world.x) / world.scale.x;
        const wy = (my - world.y) / world.scale.y;

        world.scale.set(newScale);
        world.x = mx - wx * newScale;
        world.y = my - wy * newScale;

        drawGrid();
      };
      app.canvas.addEventListener('wheel', wheelHandler, { passive: false });

      contextHandler = (e) => e.preventDefault();
      app.canvas.addEventListener('contextmenu', contextHandler);

      // Load initial map data if available
      if (propsRef.current.mapData) {
        loadMap(propsRef.current.mapData);
      }
    }

    init();

    return () => {
      destroyed = true;
      internalsRef.current = null;
      if (S.app) {
        if (wheelHandler) S.app.canvas?.removeEventListener('wheel', wheelHandler);
        if (contextHandler) S.app.canvas?.removeEventListener('contextmenu', contextHandler);
        S.app.destroy(true, { children: true });
        S.app = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload map when mapData prop changes
  useEffect(() => {
    const S = internalsRef.current;
    if (!S?.app || !props.mapData) return;

    // Rebuild from new data
    S.mapW = props.mapData.width || 30;
    S.mapH = props.mapData.height || 30;

    for (const val of S.cells.values()) val.sprite.destroy();
    S.cells.clear();
    S.dirty.clear();
    S.layers.forEach(c => c.removeChildren());

    if (props.mapData.layers) {
      for (const layer of props.mapData.layers) {
        for (const cell of (layer.cells || [])) {
          const base = Assets.get('/' + cell.sheet);
          if (!base) continue;
          let texture;
          try {
            texture = new Texture({ source: base.source, frame: new Rectangle(cell.sprite_x, cell.sprite_y, cell.sprite_w, cell.sprite_h) });
          } catch { continue; }

          const sprite = new Sprite(texture);
          sprite.x = cell.grid_x * TILE_SIZE;
          sprite.y = cell.grid_y * TILE_SIZE;

          const li = layer.layer_index;
          S.layers[li]?.addChild(sprite);

          const key = `${li},${cell.grid_x},${cell.grid_y}`;
          S.cells.set(key, {
            sprite,
            data: {
              layer_index: li,
              grid_x: cell.grid_x,
              grid_y: cell.grid_y,
              sheet: cell.sheet,
              sprite_x: cell.sprite_x,
              sprite_y: cell.sprite_y,
              sprite_w: cell.sprite_w,
              sprite_h: cell.sprite_h,
              walkable: cell.walkable,
              interactable: cell.interactable,
              portal_target: cell.portal_target,
            },
          });
        }
      }
    }

    // Redraw
    if (S.checker) {
      S.checker.clear();
      for (let y = 0; y < S.mapH; y++) {
        for (let x = 0; x < S.mapW; x++) {
          S.checker.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          S.checker.fill((x + y) % 2 === 0 ? 0x222233 : 0x1a1a2e);
        }
      }
    }

    if (S.grid) {
      S.grid.clear();
      const zoom = S.world?.scale.x || INITIAL_ZOOM;
      S.grid.setStrokeStyle({ width: 0.5 / zoom, color: 0xffffff, alpha: 0.15 });
      for (let x = 0; x <= S.mapW; x++) {
        S.grid.moveTo(x * TILE_SIZE, 0).lineTo(x * TILE_SIZE, S.mapH * TILE_SIZE);
      }
      for (let y = 0; y <= S.mapH; y++) {
        S.grid.moveTo(0, y * TILE_SIZE).lineTo(S.mapW * TILE_SIZE, y * TILE_SIZE);
      }
      S.grid.stroke();
      S.grid.setStrokeStyle({ width: 1.5 / zoom, color: 0xf0b840, alpha: 0.5 });
      S.grid.rect(0, 0, S.mapW * TILE_SIZE, S.mapH * TILE_SIZE);
      S.grid.stroke();
    }

    // Center
    if (S.world && S.app) {
      const mapPxW = S.mapW * TILE_SIZE * S.world.scale.x;
      const mapPxH = S.mapH * TILE_SIZE * S.world.scale.y;
      S.world.x = (S.app.screen.width - mapPxW) / 2;
      S.world.y = (S.app.screen.height - mapPxH) / 2;
    }

    props.onDirty?.(false);
  }, [props.mapData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layer visibility
  useEffect(() => {
    const S = internalsRef.current;
    if (!S) return;
    S.layers.forEach((c, i) => {
      c.visible = props.layerVisibility?.[i] ?? true;
    });
  }, [props.layerVisibility]);

  // Grid visibility
  useEffect(() => {
    const S = internalsRef.current;
    if (S?.grid) S.grid.visible = props.showGrid !== false;
  }, [props.showGrid]);

  return <div ref={containerRef} className="editor-canvas" />;
});

export default EditorCanvas;
