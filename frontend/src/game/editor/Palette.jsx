// Left-hand editor palette: terrain brushes, the sprite catalog, and raw sprite sheets.
import { useState } from 'react';
import { SPRITES } from '../sprites';
import { TERRAIN } from '../terrain';
import { SPRITE_CATEGORIES } from '../../components/editor/spriteManifest';
import { SheetGrid } from '../../components/editor/SpritePalette';
import SpriteThumb from '../ui/SpriteThumb';

const TERRAIN_SWATCH = {
  grass: '#3e8948', dirt: '#e4a672', cobble: '#8e9ab4', water: '#3ba7e8',
  floor: '#bf6f4a', wall: '#743f39', void: '#120d0b',
};

export default function Palette({
  tool, setTool,
  terrainChar, setTerrainChar, brush, setBrush, fill, setFill,
  placeDef, setPlaceDef, outdoor,
}) {
  const [tab, setTab] = useState('catalog');
  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState(0);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [sheetSel, setSheetSel] = useState(null);
  const [flat, setFlat] = useState(false);

  const terrainChoices = Object.entries(TERRAIN).filter(([, t]) =>
    outdoor ? ['grass', 'dirt', 'cobble', 'water', 'farm'].includes(t.type) : ['floor', 'wall', 'void'].includes(t.type) || t.type === 'grass');

  const catalog = Object.entries(SPRITES).filter(([name, d]) =>
    !filter || name.includes(filter.toLowerCase()) || (d.label || '').toLowerCase().includes(filter.toLowerCase()));

  const category = SPRITE_CATEGORIES[cat];
  const sheet = category?.sheets[sheetIdx];

  function pickRegion(sel) {
    setSheetSel(sel);
    const w = sel.sprite_w * (sel.stampW || 1);
    const h = sel.sprite_h * (sel.stampH || 1);
    setPlaceDef({
      custom: {
        sheet: '/' + sel.sheet, x: sel.sprite_x, y: sel.sprite_y, w, h,
        sortY: h, layer: flat ? 'ground' : 'entity',
      },
    });
    setTool('place');
  }

  return (
    <aside className="ed-palette">
      <div className="ed-tools">
        {[
          ['select', 'Select', 'V'],
          ['terrain', 'Terrain', 'B'],
          ['place', 'Place', 'P'],
          ['spawn', 'Spawn', ''],
        ].map(([id, label, key]) => (
          <button key={id} className={`pixel-button small${tool === id ? ' active' : ''}`} onClick={() => setTool(id)} title={key ? `Shortcut: ${key}` : undefined}>
            {label}
          </button>
        ))}
      </div>

      {tool === 'terrain' && (
        <section className="ed-section">
          <h4>Terrain</h4>
          <div className="ed-terrain">
            {terrainChoices.map(([ch, t]) => (
              <button key={ch} className={`ed-terrain-btn${terrainChar === ch ? ' on' : ''}`} onClick={() => setTerrainChar(ch)}>
                <span className="ed-swatch" style={{ background: TERRAIN_SWATCH[t.type] }} />
                {t.label}
              </button>
            ))}
          </div>
          <h4>Brush</h4>
          <div className="segmented">
            {[1, 2, 3, 5].map(b => (
              <button key={b} className={`pixel-button small${brush === b && !fill ? ' active' : ''}`} onClick={() => { setBrush(b); setFill(false); }}>{b}×{b}</button>
            ))}
            <button className={`pixel-button small${fill ? ' active' : ''}`} onClick={() => setFill(f => !f)}>Fill</button>
          </div>
          <p className="ed-tip">Paths and water need to be at least 2 tiles wide to draw nicely.</p>
        </section>
      )}

      {(tool === 'place' || tool === 'select') && (
        <section className="ed-section ed-place">
          <div className="segmented">
            <button className={`pixel-button small${tab === 'catalog' ? ' active' : ''}`} onClick={() => setTab('catalog')}>Catalog</button>
            <button className={`pixel-button small${tab === 'sheets' ? ' active' : ''}`} onClick={() => setTab('sheets')}>Sprite sheets</button>
          </div>

          {tab === 'catalog' && (
            <>
              <input className="ed-filter" placeholder="Filter (tree, lamp, bed...)" value={filter} onChange={e => setFilter(e.target.value)} />
              <div className="ed-catalog">
                {catalog.map(([name, def]) => (
                  <button
                    key={name}
                    className={`ed-cat-item${placeDef?.sprite === name ? ' on' : ''}`}
                    onClick={() => { setPlaceDef({ sprite: name }); setTool('place'); }}
                    title={name}
                  >
                    <SpriteThumb def={def} />
                    <span>{name.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'sheets' && (
            <>
              <select value={cat} onChange={e => { setCat(Number(e.target.value)); setSheetIdx(0); }}>
                {SPRITE_CATEGORIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
              </select>
              <select value={sheetIdx} onChange={e => setSheetIdx(Number(e.target.value))}>
                {category?.sheets.map((s, i) => <option key={s.path} value={i}>{s.label}{s.animated ? ' ✦' : ''}</option>)}
              </select>
              <label className="ed-check">
                <input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} />
                Flat (draws under characters, e.g. rugs)
              </label>
              <p className="ed-tip">Drag over the sheet to select a region, then click the map to place it.</p>
              {sheet && (
                <div className="ed-sheet">
                  <SheetGrid key={sheet.path} sheet={sheet} selectedTile={sheetSel} onSelectTile={pickRegion} />
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tool === 'spawn' && (
        <section className="ed-section">
          <h4>Spawn points</h4>
          <p className="ed-tip">Click the map to move the selected spawn. Visitors appear at the spawn named after the place they came from (e.g. “house”), or “default”.</p>
        </section>
      )}
    </aside>
  );
}
