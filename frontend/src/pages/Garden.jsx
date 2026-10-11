import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import GardenCanvas from '../components/garden/GardenCanvas';
import PlantInfoPanel from '../components/garden/PlantInfoPanel';
import PlantDialog from '../components/garden/PlantDialog';
import { Clock, LocationBanner } from '../game/ui/Hud';
import { daylight } from '../game/engine/daylight';
import '../game/game.css';

export default function Garden() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [tint, setTint] = useState(() => daylight(null, true).tint);

  // same real-time day/night colouring as the village
  useEffect(() => {
    const t = setInterval(() => setTint(daylight(null, true).tint), 60000);
    return () => clearInterval(t);
  }, []);
  const [plants, setPlants] = useState([]);
  const [gridWidth, setGridWidth] = useState(15);
  const [gridHeight, setGridHeight] = useState(15);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [plantingAt, setPlantingAt] = useState(null);
  const [toast, setToast] = useState('');

  const interactionOpen = !!(selectedPlant || plantingAt);

  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Load garden data
  useEffect(() => {
    api.getGarden().then((data) => {
      setPlants(data.plants || []);
      if (data.settings) {
        setGridWidth(data.settings.grid_width);
        setGridHeight(data.settings.grid_height);
      }
    }).catch(() => {});
  }, []);

  const refreshPlant = (updated) => {
    setPlants(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedPlant(updated);
  };

  // Close popups on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedPlant(null);
        setPlantingAt(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Character interaction callback
  const leaveToVillage = useCallback(() => {
    setLeaving(true);
    setTimeout(() => navigate('/', { state: { from: 'garden' } }), 280);
  }, [navigate]);

  const handleInteract = useCallback((interaction) => {
    if (interaction.type === 'plant') {
      setSelectedPlant(interaction.plant);
      setPlantingAt(null);
    } else if (interaction.type === 'empty') {
      setSelectedPlant(null);
      setPlantingAt({ x: interaction.gridX, y: interaction.gridY });
    }
  }, []);

  // Actions
  const handlePlant = async (data) => {
    try {
      const plant = await api.plantSeed(data.title, data.description, data.plant_type, data.grid_x, data.grid_y);
      setPlants(prev => [...prev, plant]);
      setPlantingAt(null);
      showToast(`🌱 Planted "${data.title}"!`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleWater = async (id) => {
    try {
      const updated = await api.waterPlant(id);
      refreshPlant(updated);
      showToast('💧 Watered!');
    } catch (err) { showToast(err.message); }
  };

  const handleWither = async (id) => {
    try {
      const updated = await api.witherPlant(id);
      refreshPlant(updated);
      showToast('🍂 Withering...');
    } catch (err) { showToast(err.message); }
  };

  const handleRevive = async (id) => {
    try {
      const updated = await api.revivePlant(id);
      refreshPlant(updated);
      showToast('💚 Revived!');
    } catch (err) { showToast(err.message); }
  };

  const handleSunshine = async (id) => {
    try {
      const result = await api.sunshinePlant(id);
      setPlants(prev => prev.map(p => p.id === id ? { ...p, sunshine_count: result.sunshine_count } : p));
      if (selectedPlant && selectedPlant.id === id) {
        setSelectedPlant(prev => ({ ...prev, sunshine_count: result.sunshine_count }));
      }
      showToast('☀️ Sunshine sent!');
    } catch (err) { showToast(err.message); }
  };

  const handleDelete = async (id) => {
    try {
      await api.deletePlant(id);
      setPlants(prev => prev.filter(p => p.id !== id));
      setSelectedPlant(null);
      showToast('🗑️ Plant removed.');
    } catch (err) { showToast(err.message); }
  };

  return (
    <div className="game-root garden-game">
      {/* Game canvas (full screen) */}
      <GardenCanvas
        plants={plants}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        onInteract={handleInteract}
        interactionOpen={interactionOpen}
        isAuthenticated={!!user}
        onExit={leaveToVillage}
        spawnAtGate={location.state?.from === 'village'}
      />

      <div className="garden-tint" style={{ background: `#${tint.toString(16).padStart(6, '0')}` }} aria-hidden />

      {/* HUD — same pieces as the village */}
      <Clock />
      <LocationBanner name="Sam's Garden" />
      <Link to="/" state={{ from: 'garden' }} className="pixel-button small garden-back">← Village</Link>
      <div className="controls-hint pixel-frame">
        <kbd>WASD</kbd> move · <kbd>E</kbd> {user ? 'tend plants' : 'send sunshine'} · walk south to leave
      </div>

      <div className={`fade${leaving ? ' on' : ''}`} aria-hidden />

      {/* Toast notifications */}
      {toast && <div className="garden-toast pixel-frame">{toast}</div>}

      {/* Plant info popup */}
      {selectedPlant && (
        <PlantInfoPanel
          plant={selectedPlant}
          user={user}
          onWater={handleWater}
          onWither={handleWither}
          onRevive={handleRevive}
          onSunshine={handleSunshine}
          onDelete={handleDelete}
          onClose={() => setSelectedPlant(null)}
        />
      )}

      {/* Plant dialog popup */}
      {plantingAt && (
        <PlantDialog
          gridX={plantingAt.x}
          gridY={plantingAt.y}
          onPlant={handlePlant}
          onCancel={() => setPlantingAt(null)}
        />
      )}
    </div>
  );
}
