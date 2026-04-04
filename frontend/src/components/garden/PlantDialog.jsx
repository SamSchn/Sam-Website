import { useState } from 'react';
import { PLANT_DEFS } from './plantData';

const plantTypes = Object.entries(PLANT_DEFS);

export default function PlantDialog({ gridX, gridY, onPlant, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plantType, setPlantType] = useState('sunflower');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onPlant({ title: title.trim(), description: description.trim(), plant_type: plantType, grid_x: gridX, grid_y: gridY });
  };

  return (
    <div className="plant-dialog-overlay" onClick={onCancel}>
      <form className="plant-dialog" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>🌱 Plant a Seed at ({gridX}, {gridY})</h3>

        <label>
          What does this plant represent?
          <input
            type="text"
            placeholder="e.g. Learn Rust, Stay healthy..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label>
          Description (optional)
          <textarea
            placeholder="A note about what this means to you..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>

        <div className="plant-type-picker">
          <span className="plant-type-label">Choose a plant:</span>
          <div className="plant-type-grid">
            {plantTypes.map(([key, def]) => (
              <button
                key={key}
                type="button"
                className={`plant-type-btn ${plantType === key ? 'selected' : ''}`}
                onClick={() => setPlantType(key)}
                title={`${def.name} — ${def.represents}`}
              >
                <span className="plant-type-icon">{def.icon}</span>
                <span className="plant-type-name">{def.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="plant-dialog-actions">
          <button type="submit" className="btn btn-primary">🌱 Plant</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
