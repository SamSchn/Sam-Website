import Panel from '../../game/ui/Panel';
import SpriteThumb from '../../game/ui/SpriteThumb';
import { getPlantDef, getStageLabel, daysSince, cropSprite } from './plantData';

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
    <Panel title={plant.title} icon="sprout" onClose={onClose}>
      <div className="plant-head">
        <span className="pixel-inset plant-thumb"><SpriteThumb def={cropSprite(plant.plant_type, plant.growth_stage)} size={64} /></span>
        <div>
          <strong>{def.name}</strong>
          <p className="panel-hint">{def.represents}</p>
        </div>
      </div>

      {plant.description && <p>{plant.description}</p>}

      <dl className="plant-stats">
        <div className="pixel-inset"><dt>Stage</dt><dd className={isWithering ? 'withering' : ''}>{stageLabel}</dd></div>
        <div className="pixel-inset">
          <dt>Growth</dt>
          <dd className="pips">
            {[0, 1, 2, 3, 4].map(i => <span key={i} className={`pip${i <= plant.growth_stage ? ' on' : ''}${isWithering ? ' dry' : ''}`} />)}
          </dd>
        </div>
        <div className="pixel-inset"><dt>Watered</dt><dd>{plant.water_count}×</dd></div>
        <div className="pixel-inset"><dt>Sunshine</dt><dd>{plant.sunshine_count}×</dd></div>
        <div className="pixel-inset">
          <dt>Last tended</dt>
          <dd>{lastTouched === null ? 'Never' : lastTouched === 0 ? 'Today' : `${lastTouched} day${lastTouched !== 1 ? 's' : ''} ago`}</dd>
        </div>
        <div className="pixel-inset">
          <dt>Planted</dt>
          <dd>{new Date(plant.created_at + 'Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
        </div>
      </dl>

      <div className="plant-actions">
        {isOwner && !isWithering && !fullyGrown && <button className="pixel-button" onClick={() => onWater(plant.id)}>Water</button>}
        {isOwner && fullyGrown && !isWithering && <span className="panel-hint">Fully bloomed!</span>}
        {isOwner && !fullyWithered && <button className="pixel-button subtle" onClick={() => onWither(plant.id)}>Let it wither</button>}
        {isOwner && isWithering && <button className="pixel-button" onClick={() => onRevive(plant.id)}>Revive</button>}
        {!isOwner && <button className="pixel-button" onClick={() => onSunshine(plant.id)}>Send sunshine</button>}
        {isOwner && <button className="pixel-button danger" onClick={() => onDelete(plant.id)}>Remove</button>}
      </div>
    </Panel>
  );
}
