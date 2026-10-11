import { useState } from 'react';
import { Link } from 'react-router-dom';
import Panel from './Panel';
import { useAuth } from '../../context/AuthContext';
import { isMuted, setMuted } from '../engine/sound';

const TIME_OPTIONS = [
  { label: 'Live', value: null },
  { label: 'Morning', value: 9 },
  { label: 'Sunset', value: 19 },
  { label: 'Night', value: 22 },
];

export default function GameMenu({ onClose, onLogin, hourOverride, onHourOverride, onWelcome }) {
  const { user, logout } = useAuth();
  const [showControls, setShowControls] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

  return (
    <Panel title="Menu" icon="gear" onClose={onClose}>
      <div className="menu-list">
        <button className="pixel-button" onClick={onClose}>Back to the village</button>
        <button className="pixel-button" onClick={() => setShowControls(v => !v)}>Controls</button>
        {showControls && (
          <dl className="controls pixel-inset">
            <dt>Move</dt><dd>WASD / arrow keys, or click / tap the ground</dd>
            <dt>Use</dt><dd>E, Space or Enter — or click / tap an object</dd>
            <dt>Zoom</dt><dd>+ / −</dd>
            <dt>Menu</dt><dd>Esc</dd>
          </dl>
        )}
        <button className="pixel-button" onClick={onWelcome}>Replay welcome</button>
        <div className="menu-row">
          <span>Sound effects</span>
          <button className={`pixel-button small${muted ? '' : ' active'}`} onClick={() => { setMuted(!muted); setMutedState(!muted); }}>
            {muted ? 'Off' : 'On'}
          </button>
        </div>
        <div className="menu-row">
          <span>Time of day</span>
          <div className="segmented">
            {TIME_OPTIONS.map(o => (
              <button
                key={o.label}
                className={`pixel-button small${hourOverride === o.value ? ' active' : ''}`}
                onClick={() => onHourOverride(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {user ? (
          <>
            <p className="menu-user">Signed in as <strong>{user.displayName}</strong></p>
            <Link className="pixel-button" to="/editor">Open map editor</Link>
            <button className="pixel-button" onClick={() => { logout(); onClose(); }}>Log out</button>
          </>
        ) : (
          <button className="pixel-button subtle" onClick={onLogin}>Owner login</button>
        )}
      </div>
    </Panel>
  );
}

export function LoginPanel({ onClose }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Owner Login" icon="key" onClose={() => onClose(false)}>
      <form className="login-form" onSubmit={submit}>
        {error && <p className="form-error">{error}</p>}
        <label>
          Username
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="pixel-button" type="submit" disabled={busy}>{busy ? 'Opening the gate...' : 'Log in'}</button>
      </form>
    </Panel>
  );
}
