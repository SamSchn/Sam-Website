import { useEffect, useState } from 'react';
import { currentHour } from '../engine/daylight';
import Icon from './Icon';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SEASONS = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
const SEASON_ICON = { Spring: 'flower', Summer: 'sun', Fall: 'leaf', Winter: 'snow' };

function formatTime(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60 / 10) * 10; // Stardew shows 10-minute steps
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Stardew-style date & clock box (uses the visitor's real local time). */
export function Clock({ hourOverride, onMenu }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  const hour = currentHour(hourOverride);
  const season = SEASONS[now.getMonth()];
  const isNight = hour < 6 || hour >= 19.5;
  return (
    <div className="hud-clock pixel-frame">
      <div className="hud-date">
        {DAYS[now.getDay()]}. {now.getDate()}
      </div>
      <div className="hud-dial" aria-hidden>
        <Icon name={isNight ? 'moon' : SEASON_ICON[season]} scale={1} />
        <span className="hud-season">{season}</span>
      </div>
      <div className="hud-time">{formatTime(hour)}</div>
      {onMenu && <button className="hud-menu-btn" onClick={onMenu} aria-label="Open menu"><Icon name="gear" scale={1} /> Menu</button>}
    </div>
  );
}

/** "Sam's House" banner that slides in when you arrive somewhere. */
export function LocationBanner({ name }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [name]);
  return (
    <div className={`location-banner pixel-frame${visible ? ' show' : ''}`} aria-live="polite">
      {name}
    </div>
  );
}

export function ControlsHint({ touch }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 12000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="controls-hint pixel-frame" onPointerDown={() => setVisible(false)}>
      {touch
        ? <>Tap to walk · Tap things to use them</>
        : <><kbd>WASD</kbd> or click to move · <kbd>E</kbd> to use · <kbd>Esc</kbd> menu</>}
    </div>
  );
}
