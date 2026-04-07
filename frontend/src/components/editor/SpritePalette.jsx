import { useState, useEffect } from 'react';
import { SPRITE_CATEGORIES } from './spriteManifest';

function SheetGrid({ sheet, selectedTile, onSelectTile }) {
  const [dims, setDims] = useState(null);

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

  return (
    <div className="palette-grid-wrapper">
      <div className="palette-grid" style={{ width: displayW, height: displayH, position: 'relative' }}>
        <img
          src={'/' + sheet.path}
          alt={sheet.label}
          style={{ width: displayW, height: displayH, imageRendering: 'pixelated', display: 'block' }}
          draggable={false}
        />
        {Array.from({ length: dims.rows }, (_, r) =>
          Array.from({ length: dims.cols }, (_, c) => {
            const sx = c * sheet.tileW;
            const sy = r * sheet.tileH;
            const isSelected =
              selectedTile?.sheet === sheet.path &&
              selectedTile?.sprite_x === sx &&
              selectedTile?.sprite_y === sy;
            return (
              <div
                key={`${r}-${c}`}
                className={`palette-cell${isSelected ? ' selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: c * DISPLAY_CELL,
                  top: r * DISPLAY_CELL,
                  width: DISPLAY_CELL,
                  height: DISPLAY_CELL,
                }}
                onClick={() =>
                  onSelectTile({
                    sheet: sheet.path,
                    sprite_x: sx,
                    sprite_y: sy,
                    sprite_w: sheet.tileW,
                    sprite_h: sheet.tileH,
                  })
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SpritePalette({ selectedTile, onSelectTile }) {
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
          <span className="palette-sheet-toggle-label">{sheet?.label ?? '—'}</span>
          <span className="palette-sheet-toggle-arrow">{sheetDropOpen ? '▲' : '▼'}</span>
        </button>
        {sheetDropOpen && (
          <div className="palette-sheet-dropdown">
            {category.sheets.map((s, i) => (
              <button
                key={s.path}
                className={`palette-sheet-option${i === activeSheet ? ' active' : ''}`}
                onClick={() => pickSheet(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {sheet && (
        <SheetGrid sheet={sheet} selectedTile={selectedTile} onSelectTile={onSelectTile} />
      )}

      {selectedTile && (
        <div className="palette-selection-info">
          {selectedTile.sheet.split('/').pop()} [{selectedTile.sprite_x}, {selectedTile.sprite_y}]
        </div>
      )}
    </div>
  );
}
