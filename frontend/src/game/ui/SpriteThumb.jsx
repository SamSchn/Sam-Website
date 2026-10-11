// A sprite drawn as a cropped, pixel-perfect CSS background (no canvas needed).
import { useEffect, useState } from 'react';

// Natural sizes of sheets, needed to scale the CSS background. Loaded on demand.
const sheetSizes = new Map();
const waiting = new Map();

function loadSize(sheet) {
  if (!waiting.has(sheet)) {
    waiting.set(sheet, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        sheetSizes.set(sheet, { w: img.naturalWidth, h: img.naturalHeight });
        resolve();
      };
      img.onerror = () => resolve();
      img.src = sheet;
    }));
  }
  return waiting.get(sheet);
}

/** def: { sheet, x, y, w, h }. Scales by whole pixels when it fits, otherwise shrinks to fit. */
export default function SpriteThumb({ def, size = 48 }) {
  const [, setLoaded] = useState(false);
  const known = sheetSizes.get(def.sheet);

  useEffect(() => {
    if (known) return;
    let alive = true;
    loadSize(def.sheet).then(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, [def.sheet, known]);

  const fit = Math.min(size / def.w, size / def.h);
  const s = fit >= 1 ? Math.floor(fit) : fit;
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      <span
        style={{
          width: def.w * s,
          height: def.h * s,
          backgroundImage: `url(${def.sheet})`,
          backgroundPosition: `${-def.x * s}px ${-def.y * s}px`,
          backgroundSize: known ? `${known.w * s}px ${known.h * s}px` : undefined,
          visibility: known ? 'visible' : 'hidden',
          imageRendering: 'pixelated',
        }}
      />
    </span>
  );
}
