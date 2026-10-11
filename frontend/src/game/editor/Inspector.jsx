// Right-hand editor panel: properties of the selected object, or of the map.
import { useEffect, useState } from 'react';
import { spriteDef } from '../engine/World';
import { PANELS } from '../ui/panels';
import { DEFAULT_MAPS, EXTERNAL_ROUTES } from '../maps';
import SpriteThumb from '../ui/SpriteThumb';

const INTERACT_TYPES = [
  ['', 'Nothing'],
  ['dialog', 'Show dialogue'],
  ['panel', 'Open a page'],
  ['warp', 'Door to another place'],
  ['link', 'Open a link'],
];
const PANEL_LABELS = {
  about: 'About me', projects: 'Projects', resume: 'Resume',
  contact: 'Contact', news: 'News (TV)', board: 'Bulletin board',
};
const PLACES = [...Object.keys(DEFAULT_MAPS), ...Object.keys(EXTERNAL_ROUTES)];

/** Text input that commits on blur/Enter, so typing doesn't create an undo step per key. */
function Field({ label, value, onCommit, type = 'text', multiline, placeholder }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const commit = () => {
    const v = type === 'number' ? Number(draft) : draft;
    if (v !== value) onCommit(v);
  };
  const props = {
    value: draft,
    placeholder,
    onChange: e => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: e => { if (e.key === 'Enter' && !multiline) e.currentTarget.blur(); },
  };
  return (
    <label className="ed-field">
      <span>{label}</span>
      {multiline ? <textarea rows={4} {...props} /> : <input type={type} {...props} />}
    </label>
  );
}

export default function Inspector({ map, selected, onChange, onDelete, onDuplicate, spawnName, setSpawnName, onResize }) {
  if (!selected) {
    return (
      <aside className="ed-inspector">
        <h3>{map.name}</h3>
        <p className="ed-tip">Click an object to edit it. Right-drag (or Space + drag) to pan, scroll to zoom.</p>
        <MapSize map={map} onResize={onResize} />
        <h4>Spawn points</h4>
        <ul className="ed-spawns">
          {Object.entries(map.spawns || {}).map(([name, sp]) => (
            <li key={name}>
              <button className={`pixel-button small${spawnName === name ? ' active' : ''}`} onClick={() => setSpawnName(name)}>{name}</button>
              <span>{Math.round(sp.x)}, {Math.round(sp.y)} · facing {sp.facing}</span>
            </li>
          ))}
        </ul>
        <h4>Legend</h4>
        <ul className="ed-legend">
          <li><span style={{ background: '#ffe08a' }} /> Interaction area</li>
          <li><span style={{ background: '#3ba7ff' }} /> Warp (walk-in door / exit)</li>
          <li><span style={{ background: '#5cff7a' }} /> Spawn point</li>
          <li><span style={{ background: '#ff3b3b' }} /> Collision</li>
        </ul>
      </aside>
    );
  }

  const def = spriteDef(selected);
  const it = selected.interact || null;
  const setInteract = (patch) => onChange({ interact: patch === null ? undefined : { ...(it || {}), ...patch } });

  return (
    <aside className="ed-inspector">
      <div className="ed-selected">
        {def && <SpriteThumb def={def} size={56} />}
        <div>
          <h3>{selected.sprite ? selected.sprite.replace(/_/g, ' ') : 'Custom sprite'}</h3>
          <code>{selected.id}</code>
        </div>
      </div>

      <div className="ed-row">
        <Field label="X" type="number" value={selected.x} onCommit={v => onChange({ x: Math.round(v) })} />
        <Field label="Y" type="number" value={selected.y} onCommit={v => onChange({ y: Math.round(v) })} />
      </div>
      <label className="ed-check">
        <input type="checkbox" checked={!!selected.flip} onChange={e => onChange({ flip: e.target.checked || undefined })} />
        Mirror horizontally
      </label>
      <label className="ed-check">
        <input
          type="checkbox"
          checked={selected.solid === undefined ? !!def?.solid?.length : selected.solid.length > 0}
          onChange={e => {
            if (e.target.checked) {
              // catalog sprites have their own collision; custom ones get a base strip
              onChange({ solid: def?.solid?.length ? undefined : [{ x: 2, y: def.h - 6, w: def.w - 4, h: 6 }] });
            } else {
              onChange({ solid: [] });
            }
          }}
        />
        Blocks movement
      </label>

      <h4>When the player uses it</h4>
      <select value={it?.type || ''} onChange={e => {
        const type = e.target.value;
        if (!type) return setInteract(null);
        const base = { type, label: it?.label || 'Look' };
        if (type === 'dialog') base.lines = it?.lines || ['...'];
        if (type === 'panel') base.panel = it?.panel || 'about';
        if (type === 'warp') base.to = it?.to || 'house';
        if (type === 'link') base.href = it?.href || 'https://';
        onChange({ interact: base });
      }}>
        {INTERACT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      {it && (
        <>
          <Field label="Prompt label" value={it.label} onCommit={v => setInteract({ label: v })} placeholder="e.g. Mailbox" />
          {it.type === 'dialog' && (
            <>
              <Field label="Speaker (optional)" value={it.speaker} onCommit={v => setInteract({ speaker: v || undefined })} />
              <Field
                label="Lines (one per line)"
                multiline
                value={(it.lines || []).join('\n')}
                onCommit={v => setInteract({ lines: v.split('\n').map(l => l.trim()).filter(Boolean) })}
              />
            </>
          )}
          {it.type === 'panel' && (
            <label className="ed-field">
              <span>Page</span>
              <select value={it.panel} onChange={e => setInteract({ panel: e.target.value })}>
                {Object.keys(PANELS).map(p => <option key={p} value={p}>{PANEL_LABELS[p] || p}</option>)}
              </select>
            </label>
          )}
          {it.type === 'warp' && (
            <label className="ed-field">
              <span>Goes to</span>
              <select value={it.to} onChange={e => setInteract({ to: e.target.value })}>
                {PLACES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          )}
          {it.type === 'link' && (
            <Field label="URL" value={it.href} onCommit={v => setInteract({ href: v })} />
          )}
        </>
      )}

      <div className="ed-actions">
        <button className="pixel-button small" onClick={onDuplicate}>Duplicate</button>
        <button className="pixel-button small danger" onClick={onDelete}>Delete</button>
      </div>
    </aside>
  );
}

function MapSize({ map, onResize }) {
  const [w, setW] = useState(map.width);
  const [h, setH] = useState(map.height);
  useEffect(() => { setW(map.width); setH(map.height); }, [map.width, map.height]);
  return (
    <div className="ed-row ed-size">
      <label className="ed-field"><span>Width</span><input type="number" min={8} max={120} value={w} onChange={e => setW(e.target.value)} /></label>
      <label className="ed-field"><span>Height</span><input type="number" min={8} max={120} value={h} onChange={e => setH(e.target.value)} /></label>
      <button
        className="pixel-button small"
        disabled={Number(w) === map.width && Number(h) === map.height}
        onClick={() => onResize(Math.max(8, Math.min(120, Number(w) || map.width)), Math.max(8, Math.min(120, Number(h) || map.height)))}
      >
        Resize
      </button>
    </div>
  );
}
