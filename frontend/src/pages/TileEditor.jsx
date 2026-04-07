import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import SpritePalette from '../components/editor/SpritePalette';
import EditorCanvas from '../components/editor/EditorCanvas';

export default function TileEditor() {
  const { user } = useAuth();
  const canvasRef = useRef();

  // Map management
  const [maps, setMaps] = useState([]);
  const [currentMapId, setCurrentMapId] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // Editor state
  const [selectedTile, setSelectedTile] = useState(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [tool, setTool] = useState('paint');
  const [tileProps, setTileProps] = useState({ walkable: true, interactable: false, portal_target: '', anim_frames: 1, anim_speed: 150 });
  const [layerVisibility, setLayerVisibility] = useState([true, true, true]);
  const [showGrid, setShowGrid] = useState(true);

  // New map dialog
  const [showNewMap, setShowNewMap] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapWidth, setNewMapWidth] = useState(30);
  const [newMapHeight, setNewMapHeight] = useState(30);

  // Toast
  const [toast, setToast] = useState(null);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Load map list
  useEffect(() => {
    if (!user) return;
    api.getTileMaps().then(data => {
      setMaps(data);
      if (data.length > 0) selectMap(data[0].id);
    }).catch(err => showToast('Failed to load maps: ' + err.message, 'error'));
  }, [user]);

  async function selectMap(id) {
    try {
      const data = await api.getTileMap(id);
      setCurrentMapId(id);
      setMapData(data);
      setIsDirty(false);
    } catch (err) {
      showToast('Failed to load map: ' + err.message, 'error');
    }
  }

  async function createMap() {
    if (!newMapName.trim()) return;
    try {
      const data = await api.createTileMap(newMapName, newMapWidth, newMapHeight);
      setShowNewMap(false);
      setNewMapName('');
      const refreshed = await api.getTileMaps();
      setMaps(refreshed);
      selectMap(data.id);
      showToast('Map created!');
    } catch (err) {
      showToast('Failed to create map: ' + err.message, 'error');
    }
  }

  const saveMap = useCallback(async () => {
    if (!currentMapId || !canvasRef.current) return;
    try {
      const cells = canvasRef.current.getAllCells();
      const deleted = canvasRef.current.getDeletedCells();

      if (deleted.length > 0) {
        await api.deleteTileMapCells(currentMapId, deleted);
      }
      if (cells.length > 0) {
        await api.saveTileMapCells(currentMapId, cells);
      }

      canvasRef.current.clearDirty();
      setIsDirty(false);
      showToast('Map saved!');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
  }, [currentMapId]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e) {
      // Don't capture when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveMap();
      }
      if (e.key === '1') setActiveLayer(0);
      if (e.key === '2') setActiveLayer(1);
      if (e.key === '3') setActiveLayer(2);
      if (e.key === 'e' || e.key === 'E') setTool(t => t === 'erase' ? 'paint' : 'erase');
      if (e.key === 'g' || e.key === 'G') setShowGrid(v => !v);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveMap]);

  async function deleteMap() {
    if (!currentMapId) return;
    if (!window.confirm('Delete this map? This cannot be undone.')) return;
    try {
      await api.deleteTileMap(currentMapId);
      const refreshed = await api.getTileMaps();
      setMaps(refreshed);
      if (refreshed.length > 0) {
        selectMap(refreshed[0].id);
      } else {
        setCurrentMapId(null);
        setMapData(null);
      }
      showToast('Map deleted');
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  if (!user) {
    return (
      <div className="editor-auth-wall">
        <p>Login required to access the tile editor.</p>
        <a href="/login" className="btn btn-primary">Login</a>
      </div>
    );
  }

  const LAYER_NAMES = ['Ground', 'Objects', 'Canopy'];

  return (
    <div className="tile-editor">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-group">
          <select
            value={currentMapId || ''}
            onChange={e => selectMap(Number(e.target.value))}
          >
            {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setShowNewMap(true)}>+ New</button>
          <button className="btn btn-sm btn-primary" onClick={saveMap} disabled={!isDirty}>
            {isDirty ? 'Save *' : 'Saved'}
          </button>
          <button className="btn btn-sm btn-danger" onClick={deleteMap} disabled={!currentMapId}>Del</button>
        </div>

        <div className="editor-toolbar-group">
          {LAYER_NAMES.map((name, i) => (
            <button
              key={i}
              className={`btn btn-sm${activeLayer === i ? ' btn-primary' : ' btn-secondary'}`}
              onClick={() => setActiveLayer(i)}
            >
              {name} ({i + 1})
            </button>
          ))}
        </div>

        <div className="editor-toolbar-group">
          <button
            className={`btn btn-sm${tool === 'paint' ? ' btn-primary' : ' btn-secondary'}`}
            onClick={() => setTool('paint')}
          >
            Paint
          </button>
          <button
            className={`btn btn-sm${tool === 'erase' ? ' btn-danger' : ' btn-secondary'}`}
            onClick={() => setTool('erase')}
          >
            Erase (E)
          </button>
          <button
            className={`btn btn-sm${showGrid ? ' btn-primary' : ' btn-secondary'}`}
            onClick={() => setShowGrid(v => !v)}
          >
            Grid (G)
          </button>
        </div>

        <div className="editor-toolbar-group">
          <label className="editor-toggle">
            <input
              type="checkbox"
              checked={tileProps.walkable}
              onChange={e => setTileProps(p => ({ ...p, walkable: e.target.checked }))}
            />
            Walk
          </label>
          <label className="editor-toggle">
            <input
              type="checkbox"
              checked={tileProps.interactable}
              onChange={e => setTileProps(p => ({ ...p, interactable: e.target.checked }))}
            />
            Interact
          </label>
          <label className="editor-toggle portal-input">
            Portal
            <input
              type="text"
              placeholder="target"
              value={tileProps.portal_target}
              onChange={e => setTileProps(p => ({ ...p, portal_target: e.target.value }))}
            />
          </label>
          <label className="editor-toggle anim-input">
            Frames
            <input
              type="number"
              min={1}
              max={64}
              value={tileProps.anim_frames}
              onChange={e => setTileProps(p => ({ ...p, anim_frames: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
          </label>
          <label className="editor-toggle anim-input">
            Speed(ms)
            <input
              type="number"
              min={30}
              max={2000}
              step={10}
              value={tileProps.anim_speed}
              onChange={e => setTileProps(p => ({ ...p, anim_speed: Math.max(30, parseInt(e.target.value) || 150) }))}
            />
          </label>
        </div>
      </div>

      {/* Main body */}
      <div className="editor-body">
        <SpritePalette selectedTile={selectedTile} onSelectTile={setSelectedTile} tileProps={tileProps} onTileProps={setTileProps} />

        <EditorCanvas
          ref={canvasRef}
          mapData={mapData}
          selectedTile={selectedTile}
          activeLayer={activeLayer}
          tool={tool}
          tileProps={tileProps}
          layerVisibility={layerVisibility}
          showGrid={showGrid}
          onDirty={setIsDirty}
        />
      </div>

      {/* Layer visibility footer */}
      <div className="editor-layer-vis">
        <span className="editor-layer-vis-label">Visible:</span>
        {LAYER_NAMES.map((name, i) => (
          <label key={i}>
            <input
              type="checkbox"
              checked={layerVisibility[i]}
              onChange={() =>
                setLayerVisibility(v => v.map((val, j) => (j === i ? !val : val)))
              }
            />
            {name}
          </label>
        ))}
        {mapData && (
          <span className="editor-map-info">
            {mapData.name} — {mapData.width}×{mapData.height}
          </span>
        )}
      </div>

      {/* New map dialog */}
      {showNewMap && (
        <div className="editor-dialog-overlay" onClick={() => setShowNewMap(false)}>
          <div className="editor-dialog" onClick={e => e.stopPropagation()}>
            <h3>New Map</h3>
            <label>
              Name
              <input
                value={newMapName}
                onChange={e => setNewMapName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createMap()}
                autoFocus
              />
            </label>
            <label>
              Width (tiles)
              <input
                type="number"
                min={5}
                max={200}
                value={newMapWidth}
                onChange={e => setNewMapWidth(Number(e.target.value))}
              />
            </label>
            <label>
              Height (tiles)
              <input
                type="number"
                min={5}
                max={200}
                value={newMapHeight}
                onChange={e => setNewMapHeight(Number(e.target.value))}
              />
            </label>
            <div className="editor-dialog-actions">
              <button className="btn btn-primary" onClick={createMap}>Create</button>
              <button className="btn btn-secondary" onClick={() => setShowNewMap(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`editor-toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
