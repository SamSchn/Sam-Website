import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import GardenCanvas from '../components/garden/GardenCanvas';
import PlantInfoPanel from '../components/garden/PlantInfoPanel';
import PlantDialog from '../components/garden/PlantDialog';

export default function Garden() {
  const { user } = useAuth();
  const [plants, setPlants] = useState([]);
  const [gridWidth, setGridWidth] = useState(15);
  const [gridHeight, setGridHeight] = useState(15);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [plantingAt, setPlantingAt] = useState(null);
  const [toast, setToast] = useState('');

  const interactionOpen = !!(selectedPlant || plantingAt);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

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
    <div className="garden-game">
      {/* Game canvas (full screen) */}
      <GardenCanvas
        plants={plants}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        onInteract={handleInteract}
        interactionOpen={interactionOpen}
        isAuthenticated={!!user}
      />

      {/* HUD overlay */}
      <div className="garden-hud">
        <Link to="/" className="garden-hud-back">🐒 Back to Jungle</Link>
        {user && <span className="garden-hud-user">🌿 {user.displayName}</span>}
        <div className="garden-hud-controls">
          WASD to move &bull; E to interact
          {!user && ' &bull; Walk to a plant to send sunshine ☀️'}
        </div>
      </div>

      {/* Toast notifications */}
      {toast && <div className="garden-toast">{toast}</div>}

      {/* Plant info popup */}
      {selectedPlant && (
        <div className="garden-popup-overlay" onClick={() => setSelectedPlant(null)}>
          <div className="garden-popup" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
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
