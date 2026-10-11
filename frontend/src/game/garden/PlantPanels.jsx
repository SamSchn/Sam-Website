// Windows for the garden: inspecting a plant, and planting / editing an idea.
import { useState } from 'react';
import Panel from '../ui/Panel';
import SpriteThumb from '../ui/SpriteThumb';
import {
  CROPS, STAGE_LABELS, MAX_STAGE, GROWTH_PRESETS, WITHER_PRESETS,
  crop, cropFrame, cropIcon, formatDuration, formatHours,
} from './crops';

const fmtDate = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function statusFor(plant, now) {
  const s = plant.state;
  const until = (t) => formatDuration(Math.max(0, t - now));
  if (s.wither === 2) return { tone: 'bad', text: 'Withered. Watering will bring it back, but it will lose some growth.' };
  if (s.wither === 1) return { tone: 'warn', text: `Wilting! It needs water — it withers in ${until(s.withers_at)}.` };
  if (s.watered && s.fully_grown) return { tone: 'good', text: `Fully grown and freshly watered. The soil dries in ${until(s.dry_at)}.` };
  if (s.watered) return { tone: 'good', text: `Freshly watered — it grows to “${STAGE_LABELS[s.stage + 1]}” in ${until(s.next_growth_at)}.` };
  if (s.fully_grown) return { tone: 'ok', text: `Fully grown. The soil is dry — water it within ${until(s.wilts_at)} to keep it healthy.` };
  return { tone: 'ok', text: `The soil is dry. Water it to grow the next stage (it starts wilting in ${until(s.wilts_at)}).` };
}

// ------------------------------------------------------------------ inspect a plant
export function PlantPanel({ plant, now, isOwner, onWater, onSunshine, onUpdate, onRemove, onClose }) {
  const [editing, setEditing] = useState(false);
  if (!plant) return null;
  const s = plant.state;
  const info = crop(plant.crop);
  const status = statusFor(plant, now);

  if (editing) {
    return (
      <Panel title="Edit idea" icon="sprout" onClose={onClose}>
        <PlantForm
          initial={plant}
          submitLabel="Save"
          onSubmit={async (data) => { await onUpdate(plant.id, data); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </Panel>
    );
  }

  return (
    <Panel title={plant.title} icon="sprout" onClose={onClose}>
      <div className="plant-head">
        <span className={`pixel-inset plant-thumb wither-${s.wither}`}>
          <SpriteThumb def={cropFrame(plant.crop, s.stage)} size={64} />
        </span>
        <div>
          <strong>{info.name}</strong> · {STAGE_LABELS[s.stage]}
          <div className="pips" aria-label={`Growth ${s.stage} of ${MAX_STAGE}`}>
            {Array.from({ length: MAX_STAGE + 1 }, (_, i) => (
              <span key={i} className={`pip${i <= s.stage ? ' on' : ''}${s.wither ? ' dry' : ''}`} />
            ))}
          </div>
        </div>
      </div>

      {plant.description && <p className="plant-desc">{plant.description}</p>}

      <p className={`plant-status ${status.tone}`}>{status.text}</p>

      <dl className="plant-stats">
        <div className="pixel-inset"><dt>Planted</dt><dd>{fmtDate(plant.created_at)}</dd></div>
        <div className="pixel-inset"><dt>Watered</dt><dd>{plant.water_count}×</dd></div>
        <div className="pixel-inset"><dt>Sunshine</dt><dd>{plant.sunshine_count}×</dd></div>
        <div className="pixel-inset"><dt>Grows every</dt><dd>{formatHours(plant.growth_hours)} watered</dd></div>
        <div className="pixel-inset"><dt>Wilts after</dt><dd>{formatHours(plant.wither_hours)} dry</dd></div>
      </dl>

      <div className="plant-actions">
        <button className="pixel-button" onClick={() => onWater(plant)} disabled={s.watered}>
          {s.watered ? 'Soil is still wet' : 'Water it'}
        </button>
        <button className="pixel-button subtle" onClick={() => onSunshine(plant)}>Send sunshine</button>
        {isOwner && <button className="pixel-button subtle" onClick={() => setEditing(true)}>Edit</button>}
        {isOwner && (
          <button
            className="pixel-button danger"
            onClick={() => { if (window.confirm(`Pull up “${plant.title}”? This can't be undone.`)) onRemove(plant); }}
          >
            Pull up
          </button>
        )}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ plant a new idea
export function PlantDialog({ onPlant, onClose }) {
  return (
    <Panel title="Plant an idea" icon="sprout" onClose={onClose}>
      <PlantForm submitLabel="Plant it" onSubmit={onPlant} onCancel={onClose} />
    </Panel>
  );
}

function SpeedSelect({ label, presets, value, onChange }) {
  const options = presets.some(p => Math.abs(p.hours - value) < 1e-9)
    ? presets
    : [...presets, { label: `${formatHours(value)} (current)`, hours: value }];
  return (
    <label className="ed-field-like">
      {label}
      <select value={value} onChange={e => onChange(Number(e.target.value))}>
        {options.map(p => <option key={p.label} value={p.hours}>{p.label}</option>)}
      </select>
    </label>
  );
}

function PlantForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [cropId, setCropId] = useState(initial?.crop || 'sunflower');
  const [growth, setGrowth] = useState(initial?.growth_hours ?? 24);
  const [wither, setWither] = useState(initial?.wither_hours ?? 72);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), crop: cropId, growth_hours: growth, wither_hours: wither });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="compose plant-form" onSubmit={submit}>
      {error && <p className="form-error">{error}</p>}
      <label className="ed-field-like">
        What's the idea?
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Learn Rust, Write a blog post…" maxLength={80} required autoFocus />
      </label>
      <label className="ed-field-like">
        A few words about it (optional)
        <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} />
      </label>

      <span className="ed-field-like">Seed</span>
      <div className="seed-grid">
        {CROPS.map(c => (
          <button key={c.id} type="button" className={`pixel-inset seed${cropId === c.id ? ' on' : ''}`} onClick={() => setCropId(c.id)} title={c.name}>
            <SpriteThumb def={cropIcon(c.id)} size={32} />
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      <div className="ce-row">
        <SpeedSelect label="Grows one stage every" presets={GROWTH_PRESETS} value={growth} onChange={setGrowth} />
        <SpeedSelect label="Starts wilting after it's dry for" presets={WITHER_PRESETS} value={wither} onChange={setWither} />
      </div>
      <p className="panel-hint">
        Fully grown after {MAX_STAGE} waterings — about {formatHours(growth * MAX_STAGE)} if it's watered whenever the soil dries.
        Left dry, it wilts after {formatHours(wither)} and withers after {formatHours(wither * 2)}.
      </p>

      <div className="plant-actions">
        <button type="submit" className="pixel-button active" disabled={busy}>{busy ? 'Planting…' : submitLabel}</button>
        <button type="button" className="pixel-button subtle" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
