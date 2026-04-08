import { useState, useEffect, useRef } from 'react';
import { SPRITE_CATEGORIES } from './spriteManifest';

function SheetGrid({ sheet, selectedTile, onSelectTile, onTileProps, animate }) {
  const [dims, setDims] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setDims({
        cols: Math.max(1, Math.floor(img.naturalWidth / sheet.tileW)),
        rows: Math.max(1, Math.floor(img.naturalHeight / sheet.tileH)),
        natW: img.naturalWidth,
        natH: img.naturalHeight,
      });
    };
    img.onerror = () => setDims(null);
    img.src = '/' + sheet.path;
  }, [sheet.path, sheet.tileW, sheet.tileH]);

  if (!dims) return <div className="palette-loading">Loading...</div>;

  const DISPLAY_CELL = 32;
  const scaleX = DISPLAY_CELL / sheet.tileW;
  const scaleY = DISPLAY_CELL / sheet.tileH;
  const displayW = dims.natW * scaleX;
  const displayH = dims.natH * scaleY;

  function getCellFromEvent(e) {
    const rect = gridRef.current.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / DISPLAY_CELL);
    const row = Math.floor((e.clientY - rect.top) / DISPLAY_CELL);
    return {
      col: Math.max(0, Math.min(dims.cols - 1, col)),
      row: Math.max(0, Math.min(dims.rows - 1, row)),
    };
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    const cell = getCellFromEvent(e);
    setDragStart(cell);
    setDragEnd(cell);
  }

  function handleMouseMove(e) {
    if (!dragStart) return;
    if (e.buttons === 0) { setDragStart(null); setDragEnd(null); return; }
    setDragEnd(getCellFromEvent(e));
  }

  function handleMouseUp() {
    if (!dragStart || !dragEnd) return;
    const c1 = Math.min(dragStart.col, dragEnd.col);
    const r1 = Math.min(dragStart.row, dragEnd.row);
    const c2 = Math.max(dragStart.col, dragEnd.col);
    const r2 = Math.max(dragStart.row, dragEnd.row);
    const stampW = c2 - c1 + 1;
    const stampH = r2 - r1 + 1;

    onSelectTile({
      sheet: sheet.path,
      sprite_x: c1 * sheet.tileW,
      sprite_y: r1 * sheet.tileH,
      sprite_w: sheet.tileW,
      sprite_h: sheet.tileH,
      stampW,
      stampH,
    });

    // Auto-suggest animation when animate is on
    if (animate && onTileProps) {
      const framesAvailable = Math.floor((dims.cols - c1) / stampW);
      if (framesAvailable > 1) {
        onTileProps(p => ({ ...p, anim_frames: framesAvailable, anim_step: stampW }));
      } else {
        onTileProps(p => ({ ...p, anim_frames: 1, anim_step: 1 }));
      }
    }

    setDragStart(null);
    setDragEnd(null);
  }

  // Calculate visible selection rect (active drag or committed selection)
  function getDisplaySelection() {
    if (dragStart && dragEnd) {
      const c1 = Math.min(dragStart.col, dragEnd.col);
      const r1 = Math.min(dragStart.row, dragEnd.row);
      const c2 = Math.max(dragStart.col, dragEnd.col);
      const r2 = Math.max(dragStart.row, dragEnd.row);
      return { col: c1, row: r1, w: c2 - c1 + 1, h: r2 - r1 + 1 };
    }
    if (selectedTile?.sheet === sheet.path) {
      const col = selectedTile.sprite_x / sheet.tileW;
      const row = selectedTile.sprite_y / sheet.tileH;
      return { col, row, w: selectedTile.stampW || 1, h: selectedTile.stampH || 1 };
    }
    return null;
  }

  const sel = getDisplaySelection();

  return (
    <div className="palette-grid-wrapper">
      <div
        ref={gridRef}
        className="palette-grid"
        style={{ width: displayW, height: displayH, position: 'relative', cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (dragStart) { setDragStart(null); setDragEnd(null); } }}
      >
        <img
          src={'/' + sheet.path}
          alt={sheet.label}
          style={{ width: displayW, height: displayH, imageRendering: 'pixelated', display: 'block', pointerEvents: 'none' }}
          draggable={false}
        />
        {sel && (
          <div
            className="palette-stamp-selection"
            style={{
              position: 'absolute',
              left: sel.col * DISPLAY_CELL,
              top: sel.row * DISPLAY_CELL,
              width: sel.w * DISPLAY_CELL,
              height: sel.h * DISPLAY_CELL,
            }}
          />
        )}
      </div>
    </div>
  );
}

function AnimPreview({ tile, animFrames, animSpeed, animStep }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!tile || animFrames <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    let frame = 0;
    let timer;
    const step = animStep || 1;
    const stampW = tile.stampW || 1;
    const stampH = tile.stampH || 1;

    img.onload = () => {
      const scale = 3;
      canvas.width = tile.sprite_w * stampW * scale;
      canvas.height = tile.sprite_h * stampH * scale;
      ctx.imageSmoothingEnabled = false;

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw each sub-tile in the stamp
        for (let dy = 0; dy < stampH; dy++) {
          for (let dx = 0; dx < stampW; dx++) {
            const sx = tile.sprite_x + dx * tile.sprite_w + frame * step * tile.sprite_w;
            const sy = tile.sprite_y + dy * tile.sprite_h;
            ctx.drawImage(
              img, sx, sy, tile.sprite_w, tile.sprite_h,
              dx * tile.sprite_w * scale, dy * tile.sprite_h * scale,
              tile.sprite_w * scale, tile.sprite_h * scale
            );
          }
        }
        frame = (frame + 1) % animFrames;
      }

      draw();
      timer = setInterval(draw, animSpeed);
    };
    img.src = '/' + tile.sheet;

    return () => clearInterval(timer);
  }, [tile, animFrames, animSpeed, animStep]);

  if (!tile || animFrames <= 1) return null;
  const stampW = tile.stampW || 1;
  const stampH = tile.stampH || 1;
  const label = stampW > 1 || stampH > 1
    ? `Animation preview (${animFrames} frames, ${stampW}×${stampH} stamp)`
    : `Animation preview (${animFrames} frames)`;
  return (
    <div className="palette-anim-preview">
      <span className="palette-anim-label">{label}</span>
      <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
    </div>
  );
}

export default function SpritePalette({ selectedTile, onSelectTile, tileProps, onTileProps }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [activeSheet, setActiveSheet] = useState(0);
  const [sheetDropOpen, setSheetDropOpen] = useState(false);

  const category = SPRITE_CATEGORIES[activeCategory];
  const sheet = category?.sheets[activeSheet];

  function switchCategory(i) {
    setActiveCategory(i);
    setActiveSheet(0);
    setSheetDropOpen(false);
  }

  function pickSheet(i) {
    setActiveSheet(i);
    setSheetDropOpen(false);
  }

  const stampW = selectedTile?.stampW || 1;
  const stampH = selectedTile?.stampH || 1;
  const isStamp = stampW > 1 || stampH > 1;

  return (
    <div className="sprite-palette">
      <div className="palette-categories">
        {SPRITE_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            className={`palette-cat-btn${i === activeCategory ? ' active' : ''}`}
            onClick={() => switchCategory(i)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="palette-sheets">
        <button
          className="palette-sheet-toggle"
          onClick={() => setSheetDropOpen(o => !o)}
        >
          <span className="palette-sheet-toggle-label">{sheet?.label ?? '—'}{sheet?.animated ? ' ✦' : ''}</span>
          <span className="palette-sheet-toggle-arrow">{sheetDropOpen ? '▲' : '▼'}</span>
        </button>
        {sheetDropOpen && (
          <div className="palette-sheet-dropdown">
            {category.sheets.map((s, i) => (
              <button
                key={s.path}
                className={`palette-sheet-option${i === activeSheet ? ' active' : ''}${s.animated ? ' animated' : ''}`}
                onClick={() => pickSheet(i)}
              >
                {s.label}{s.animated ? ' ✦' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {sheet && (
        <SheetGrid
          sheet={sheet}
          selectedTile={selectedTile}
          onSelectTile={onSelectTile}
          onTileProps={onTileProps}
          animate={tileProps?.animate}
        />
      )}

      {selectedTile && (
        <div className="palette-selection-info">
          {selectedTile.sheet.split('/').pop()} [{selectedTile.sprite_x}, {selectedTile.sprite_y}]
          {isStamp && ` — ${stampW}×${stampH} stamp`}
        </div>
      )}

      <AnimPreview
        tile={selectedTile}
        animFrames={tileProps?.animate ? (tileProps?.anim_frames || 1) : 1}
        animSpeed={tileProps?.anim_speed || 150}
        animStep={tileProps?.anim_step || 1}
      />
    </div>
  );
}
