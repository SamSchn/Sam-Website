import { useEffect, useState } from 'react';
import { sfx } from '../engine/sound';
import SpriteThumb from './SpriteThumb';

const CHAR_MS = 22;

/** Stardew-style dialogue box: types text out, advances on E / Space / Enter / click. */
export default function DialogueBox({ speaker, portrait, portraitSprite, lines, onClose }) {
  const hasPortrait = !!(portrait || portraitSprite);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[index] || '';
  const done = shown >= line.length;

  useEffect(() => {
    setShown(0);
  }, [index, lines]);

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      if (shown % 3 === 0 && line[shown] !== ' ') sfx.blip();
      setShown(s => Math.min(line.length, s + 1));
    }, CHAR_MS);
    return () => clearTimeout(t);
  }, [shown, done, line]);

  function advance() {
    if (!done) {
      setShown(line.length);
    } else if (index < lines.length - 1) {
      sfx.select();
      setIndex(i => i + 1);
    } else {
      onClose();
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) advance();
      } else if (k === 'escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <div className="dialogue-wrap" onPointerDown={(e) => { e.stopPropagation(); advance(); }}>
      <div className={`pixel-frame dialogue${hasPortrait ? ' with-portrait' : ''}`} role="dialog" aria-live="polite">
        {speaker && !hasPortrait && <div className="pixel-frame dialogue-speaker">{speaker}</div>}
        <p className="dialogue-text">
          {line.slice(0, shown)}
          <span className="dialogue-ghost">{line.slice(shown)}</span>
        </p>
        {hasPortrait && (
          <div className="dialogue-portrait">
            <div className="pixel-inset portrait-box">
              {portrait ? <img src={portrait} alt="" /> : <SpriteThumb def={portraitSprite} size={96} />}
            </div>
            <span>{speaker}</span>
          </div>
        )}
        {done && <span className="dialogue-next" aria-hidden>{index < lines.length - 1 ? '▼' : '■'}</span>}
      </div>
    </div>
  );
}
