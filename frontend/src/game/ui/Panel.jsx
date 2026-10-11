import { useEffect } from 'react';
import Icon from './Icon';
import { sfx } from '../engine/sound';

/** Framed in-game menu window (Stardew-style) with a title tab and close button. */
export default function Panel({ title, icon, onClose, wide, children }) {
  useEffect(() => {
    sfx.open();
    return () => sfx.close();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="panel-overlay" onPointerDown={onClose}>
      <section
        className={`pixel-frame panel${wide ? ' panel-wide' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <header className="pixel-frame panel-tab">
          {icon && <Icon name={icon} />}
          {title}
        </header>
        <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="panel-body">{children}</div>
      </section>
    </div>
  );
}
