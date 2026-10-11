import { useState } from 'react';
import Panel from '../../game/ui/Panel';
import SpriteThumb from '../../game/ui/SpriteThumb';
import { PLANT_DEFS, cropSprite } from './plantData';

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
    <Panel title={`Plant a seed (${gridX}, ${gridY})`} icon="sprout" onClose={onCancel}>
      <form className="compose" onSubmit={handleSubmit}>
        <label className="ed-field-like">
          What does this plant represent?
          <input placeholder="e.g. Learn Rust, Stay healthy..." value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>
        <label className="ed-field-like">
          A note about it (optional)
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="seed-grid">
          {plantTypes.map(([key, def]) => (
            <button
              key={key}
              type="button"
              className={`pixel-inset seed${plantType === key ? ' on' : ''}`}
              onClick={() => setPlantType(key)}
              title={`${def.name} — ${def.represents}`}
            >
              <SpriteThumb def={cropSprite(key, 4)} size={32} />
              <span>{def.name}</span>
            </button>
          ))}
        </div>
        <div className="plant-actions">
          <button type="submit" className="pixel-button">Plant it</button>
          <button type="button" className="pixel-button subtle" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </Panel>
  );
}
