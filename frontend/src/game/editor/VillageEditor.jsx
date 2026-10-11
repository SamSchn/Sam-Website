// The village editor: opens the built-in maps (or your saved copies), lets you
// paint terrain, place / move / configure objects, and saves to the database.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { World, spriteDef } from '../engine/World';
import { DEFAULT_MAPS } from '../maps';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { LoginPanel } from '../ui/GameMenu';
import Palette from './Palette';
import Inspector from './Inspector';
import * as ops from './ops';
import '../game.css';
import './editor.css';

const HISTORY_LIMIT = 100;
const clone = (m) => JSON.parse(JSON.stringify(m));

export default function VillageEditor() {
  const { user } = useAuth();
  if (!user) return <EditorLogin />;
  return <Editor />;
}

function EditorLogin() {
  const navigate = useNavigate();
  return (
    <div className="game-root editor-login">
      <LoginPanel onClose={(ok) => { if (!ok) navigate('/'); }} />
    </div>
  );
}

function Editor() {
  const navigate = useNavigate();
  const mountRef = useRef(null);
  const worldRef = useRef(null);
  const [ready, setReady] = useState(false);

  const [mapId, setMapId] = useState('village');
  const [map, setMap] = useState(null);
  const [savedAt, setSavedAt] = useState(null);     // null = using the built-in map
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const [tool, setTool] = useState('select');
  const [terrainChar, setTerrainChar] = useState('d');
  const [brush, setBrush] = useState(2);
  const [fill, setFill] = useState(false);
  const [placeDef, setPlaceDef] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [spawnName, setSpawnName] = useState('default');
  const [snap, setSnap] = useState(8);
  const [grid, setGrid] = useState(true);
  const [showSolids, setShowSolids] = useState(false);
  const [night, setNight] = useState(false);

  // refs so the world's pointer callback always sees current state
  const st = useRef({});
  // `latest` is updated synchronously by apply(), so several pointer events
  // arriving between renders all build on the newest map
  const latest = useRef(null);
  st.current = { map: latest.current ?? map, tool, terrainChar, brush, fill, placeDef, selectedId, snap, spawnName, past, future };
  const dragRef = useRef(null);

  const apply = useCallback((next) => {
    latest.current = next;
    setMap(next);
  }, []);

  // ---------------------------------------------------------------- history
  const commit = useCallback((next, before) => {
    apply(next);
    setDirty(true);
    setPast([...st.current.past.slice(-HISTORY_LIMIT + 1), before]);
    setFuture([]);
  }, [apply]);

  const undo = useCallback(() => {
    const { past: p, future: f, map: cur } = st.current;
    if (!p.length) return;
    apply(p[p.length - 1]);
    setPast(p.slice(0, -1));
    setFuture([cur, ...f]);
    setDirty(true);
  }, [apply]);

  const redo = useCallback(() => {
    const { past: p, future: f, map: cur } = st.current;
    if (!f.length) return;
    apply(f[0]);
    setPast([...p, cur]);
    setFuture(f.slice(1));
    setDirty(true);
  }, [apply]);

  // ---------------------------------------------------------------- world
  useEffect(() => {
    const world = new World(mountRef.current, { onEdit: (e) => handleEditRef.current(e) }, null, { editMode: true });
    worldRef.current = world;
    if (import.meta.env.DEV) window.__editorWorld = world;
    world.init().then(ok => ok && setReady(true));
    return () => world.destroy();
  }, []);

  // load the chosen map: saved copy if there is one, else the built-in default
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('Loading…');
      let data = clone(DEFAULT_MAPS[mapId]);
      let at = null;
      try {
        const saved = await api.getGameMap(mapId);
        if (saved?.data) {
          data = { ...data, ...saved.data, id: mapId };
          at = saved.updated_at;
        }
      } catch (err) {
        setStatus(`Couldn't reach the server: ${err.message}`);
      }
      if (cancelled) return;
      if (worldRef.current) worldRef.current.editorFramed = false;
      apply(data);
      setSavedAt(at);
      setDirty(false);
      setPast([]);
      setFuture([]);
      setSelectedId(null);
      setStatus('');
    })();
    return () => { cancelled = true; };
  }, [mapId]);

  // re-render the map whenever it changes (batched to one rebuild per frame)
  const rebuildQueued = useRef(false);
  useEffect(() => {
    if (!ready || !map || rebuildQueued.current) return;
    rebuildQueued.current = true;
    requestAnimationFrame(() => {
      rebuildQueued.current = false;
      worldRef.current?.rebuild(st.current.map);
    });
  }, [ready, map]);

  useEffect(() => {
    worldRef.current?.setHourOverride(night ? 22 : 12);
  }, [night, ready, map]);

  // overlay (grid, selection, brush, ghost)
  const [hover, setHover] = useState(null);
  const [ghostPos, setGhostPos] = useState(null);
  useEffect(() => {
    const w = worldRef.current;
    if (!w) return;
    const def = placeDef ? (placeDef.custom || spriteDef(placeDef)) : null;
    w.setEditorState({
      grid,
      showSolids,
      selectedId,
      hover: tool === 'terrain' ? hover : null,
      brush: tool === 'terrain' ? (fill ? 1 : brush) : 0,
      ghost: tool === 'place' && def && ghostPos ? { def, x: ghostPos.x, y: ghostPos.y } : null,
    });
  }, [grid, showSolids, selectedId, hover, tool, brush, fill, placeDef, ghostPos, map, ready]);

  // ---------------------------------------------------------------- pointer handling
  const snapTo = (v) => (st.current.snap > 1 ? Math.round(v / st.current.snap) * st.current.snap : Math.round(v));

  const handleEdit = (e) => {
    const s = st.current;
    if (!s.map) return;

    if (s.tool === 'terrain') {
      if (e.type === 'move') setHover({ tx: e.tx, ty: e.ty });
      if (e.type === 'down') {
        dragRef.current = { kind: 'paint', before: s.map };
        const next = s.fill ? ops.fillTerrain(s.map, e.tx, e.ty, s.terrainChar) : ops.setTerrain(s.map, e.tx, e.ty, s.terrainChar, s.brush);
        if (next !== s.map) apply(next);
      } else if (e.type === 'move' && dragRef.current?.kind === 'paint' && !s.fill) {
        const next = ops.setTerrain(latest.current, e.tx, e.ty, s.terrainChar, s.brush);
        if (next !== latest.current) apply(next);
      } else if (e.type === 'up' && dragRef.current?.kind === 'paint') {
        if (latest.current !== dragRef.current.before) commit(latest.current, dragRef.current.before);
        dragRef.current = null;
      }
      return;
    }

    if (s.tool === 'place') {
      const def = s.placeDef ? (s.placeDef.custom || spriteDef(s.placeDef)) : null;
      if (!def) return;
      const x = snapTo(e.x - def.w / 2), y = snapTo(e.y - def.h + 4);
      if (e.type === 'move') setGhostPos({ x, y });
      if (e.type === 'down' && e.button === 0) {
        const { map: next, id } = ops.addObject(s.map, { ...s.placeDef, x, y });
        commit(next, s.map);
        setSelectedId(id);
      }
      return;
    }

    if (s.tool === 'spawn') {
      if (e.type === 'down') commit(ops.setSpawn(s.map, s.spawnName, e.x, e.y), s.map);
      return;
    }

    // select / move
    if (e.type === 'down' && e.button === 0) {
      const obj = worldRef.current.objectAt(e.x, e.y);
      setSelectedId(obj?.id || null);
      if (obj) dragRef.current = { kind: 'move', id: obj.id, dx: e.x - obj.x, dy: e.y - obj.y, before: s.map, moved: false };
    } else if (e.type === 'move' && dragRef.current?.kind === 'move') {
      const d = dragRef.current;
      const x = snapTo(e.x - d.dx), y = snapTo(e.y - d.dy);
      const cur = latest.current.objects.find(o => o.id === d.id);
      if (cur && (cur.x !== x || cur.y !== y)) {
        d.moved = true;
        apply(ops.updateObject(latest.current, d.id, { x, y }));
      }
    } else if (e.type === 'up' && dragRef.current?.kind === 'move') {
      if (dragRef.current.moved) commit(latest.current, dragRef.current.before);
      dragRef.current = null;
    }
  };
  const handleEditRef = useRef(handleEdit);
  handleEditRef.current = handleEdit;

  // ---------------------------------------------------------------- actions
  const selected = map?.objects.find(o => o.id === selectedId) || null;

  const changeSelected = (patch) => {
    if (!selected) return;
    commit(ops.updateObject(map, selected.id, patch), map);
  };
  const deleteSelected = () => {
    if (!selected) return;
    commit(ops.removeObject(map, selected.id), map);
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const { map: next, id } = ops.duplicateObject(map, selected.id);
    commit(next, map);
    setSelectedId(id);
  };

  async function save() {
    if (!map) return;
    setStatus('Saving…');
    try {
      const { id, ...data } = map; // eslint-disable-line no-unused-vars
      await api.saveGameMap(mapId, data);
      setSavedAt(new Date().toISOString());
      setDirty(false);
      setStatus('Saved! Visitors will see your changes.');
    } catch (err) {
      setStatus(`Save failed: ${err.message}`);
    }
  }

  async function revert() {
    if (!window.confirm('Discard your saved changes to this map and go back to the built-in version?')) return;
    try {
      await api.resetGameMap(mapId);
      const data = clone(DEFAULT_MAPS[mapId]);
      commit(data, map);
      setSavedAt(null);
      setDirty(false);
      setStatus('Back to the built-in map.');
    } catch (err) {
      setStatus(`Revert failed: ${err.message}`);
    }
  }

  function switchMap(id) {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    setMapId(id);
  }

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (mod && k === 's') { e.preventDefault(); save(); return; }
      if (mod && k === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (mod) return;
      if ((k === 'delete' || k === 'backspace') && selected) { e.preventDefault(); deleteSelected(); }
      if (k === 'escape') { setSelectedId(null); setTool('select'); }
      if (k === 'v') setTool('select');
      if (k === 'b') setTool('terrain');
      if (k === 'p') setTool('place');
      if (k === 'g') setGrid(g => !g);
      if (selected && k.startsWith('arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 16 : 1;
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
        const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
        changeSelected({ x: selected.x + dx, y: selected.y + dy });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // status messages fade after a few seconds
  useEffect(() => {
    if (!status || status.endsWith('…')) return;
    const t = setTimeout(() => setStatus(''), 3500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <div className="editor-root">
      <header className="ed-toolbar">
        <Link to="/" className="pixel-button small subtle" onClick={e => { if (dirty && !window.confirm('Leave without saving?')) e.preventDefault(); }}>← Village</Link>
        <div className="segmented">
          {Object.values(DEFAULT_MAPS).map(m => (
            <button key={m.id} className={`pixel-button small${mapId === m.id ? ' active' : ''}`} onClick={() => switchMap(m.id)}>{m.name}</button>
          ))}
        </div>
        <span className="ed-source">{savedAt ? 'Your saved copy' : 'Built-in map'}{dirty ? ' · unsaved changes' : ''}</span>
        <div className="ed-spacer" />
        <button className="pixel-button small" onClick={undo} disabled={!past.length} title="Undo (Ctrl/Cmd+Z)">↶ Undo</button>
        <button className="pixel-button small" onClick={redo} disabled={!future.length} title="Redo (Ctrl/Cmd+Shift+Z)">↷ Redo</button>
        <label className="ed-check"><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> Grid</label>
        <label className="ed-check"><input type="checkbox" checked={showSolids} onChange={e => setShowSolids(e.target.checked)} /> Collision</label>
        <label className="ed-check"><input type="checkbox" checked={night} onChange={e => setNight(e.target.checked)} /> Night</label>
        <label className="ed-check">
          Snap
          <select value={snap} onChange={e => setSnap(Number(e.target.value))}>
            <option value={1}>1px</option>
            <option value={4}>4px</option>
            <option value={8}>8px</option>
            <option value={16}>16px</option>
          </select>
        </label>
        <button className="pixel-button small subtle" onClick={revert} disabled={!savedAt}>Revert to built-in</button>
        <button className="pixel-button small" onClick={() => navigate(DEFAULT_MAPS[mapId].route)} disabled={dirty} title={dirty ? 'Save first' : ''}>Play ▶</button>
        <button className="pixel-button small active" onClick={save} disabled={!dirty} title="Save (Ctrl/Cmd+S)">Save</button>
      </header>
      {status && <div className="ed-status">{status}</div>}

      <div className="ed-body">
        <Palette
          tool={tool} setTool={t => { setTool(t); if (t !== 'place') setGhostPos(null); }}
          terrainChar={terrainChar} setTerrainChar={setTerrainChar}
          brush={brush} setBrush={setBrush} fill={fill} setFill={setFill}
          placeDef={placeDef} setPlaceDef={setPlaceDef}
          outdoor={map?.outdoor !== false}
        />
        <div className={`ed-canvas tool-${tool}`} ref={mountRef} onPointerLeave={() => { setHover(null); setGhostPos(null); }} />
        {map && (
          <Inspector
            map={map}
            selected={selected}
            onChange={changeSelected}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
            spawnName={spawnName}
            setSpawnName={(n) => { setSpawnName(n); setTool('spawn'); }}
            onResize={(w, h) => commit(ops.resizeMap(map, w, h), map)}
          />
        )}
      </div>
    </div>
  );
}
