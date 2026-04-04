import { getPlantDef, getStageLabel, daysSince } from './plantData';

export default function PlantInfoPanel({ plant, user, onWater, onWither, onRevive, onSunshine, onDelete, onClose }) {
  if (!plant) return null;

  const def = getPlantDef(plant.plant_type);
  const stageLabel = getStageLabel(plant.growth_stage, plant.wither_stage);
  const isOwner = user && user.id === plant.author_id;
  const lastTouched = daysSince(plant.last_touched);
  const fullyGrown = plant.growth_stage >= 4;
  const fullyWithered = plant.wither_stage >= 2;
  const isWithering = plant.wither_stage > 0;

  return (
    <div className="plant-info-panel">
      <button className="plant-info-close" onClick={onClose}>&times;</button>

      <div className="plant-info-header">
        <span className="plant-info-icon">{def.icon}</span>
        <div>
          <h3 className="plant-info-title">{plant.title}</h3>
          <span className="plant-info-type">{def.name} — {def.represents}</span>
        </div>
      </div>

      {plant.description && (
        <p className="plant-info-desc">{plant.description}</p>
      )}

      <div className="plant-info-stats">
        <div className="plant-stat">
          <span className="plant-stat-label">Stage</span>
          <span className={`plant-stat-value ${isWithering ? 'withering' : ''}`}>{stageLabel}</span>
        </div>
        <div className="plant-stat">
          <span className="plant-stat-label">Growth</span>
          <div className="plant-growth-bar">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`plant-growth-pip ${i <= plant.growth_stage ? 'filled' : ''} ${isWithering ? 'withering' : ''}`}
              />
            ))}
          </div>
        </div>
        {isWithering && (
          <div className="plant-stat">
            <span className="plant-stat-label">Wither</span>
            <div className="plant-growth-bar">
              {[1, 2].map(i => (
                <div
                  key={i}
                  className={`plant-growth-pip wither-pip ${i <= plant.wither_stage ? 'wither-filled' : ''}`}
                />
              ))}
            </div>
          </div>
        )}
        <div className="plant-stat">
          <span className="plant-stat-label">Times Watered</span>
          <span className="plant-stat-value">{plant.water_count} 💧</span>
        </div>
        <div className="plant-stat">
          <span className="plant-stat-label">Sunshine</span>
          <span className="plant-stat-value">{plant.sunshine_count} ☀️</span>
        </div>
        <div className="plant-stat">
          <span className="plant-stat-label">Last Touched</span>
          <span className="plant-stat-value">
            {lastTouched === null ? 'Never' : lastTouched === 0 ? 'Today' : `${lastTouched} day${lastTouched !== 1 ? 's' : ''} ago`}
          </span>
        </div>
        <div className="plant-stat">
          <span className="plant-stat-label">Planted</span>
          <span className="plant-stat-value">
            {new Date(plant.created_at + 'Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="plant-info-actions">
        {isOwner && !isWithering && !fullyGrown && (
          <button className="btn btn-primary btn-sm" onClick={() => onWater(plant.id)}>
            💧 Water
          </button>
        )}
        {isOwner && fullyGrown && !isWithering && (
          <span className="plant-info-note">🌸 Fully bloomed!</span>
        )}
        {isOwner && !fullyWithered && (
          <button className="btn btn-secondary btn-sm" onClick={() => onWither(plant.id)}>
            🍂 Wither
          </button>
        )}
        {isOwner && isWithering && (
          <button className="btn btn-secondary btn-sm" onClick={() => onRevive(plant.id)}>
            💚 Revive
          </button>
        )}
        {!isOwner && (
          <button className="btn btn-primary btn-sm" onClick={() => onSunshine(plant.id)}>
            ☀️ Send Sunshine
          </button>
        )}
        {isOwner && (
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(plant.id)}>
            🗑️ Remove
          </button>
        )}
      </div>
    </div>
  );
}
