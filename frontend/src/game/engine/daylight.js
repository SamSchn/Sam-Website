// Real-time day/night cycle. The world is tinted with a multiply colour that
// follows the visitor's local clock, and lamps fade in after sunset.

const WHITE = 0xffffff;
const NIGHT = 0x5262a3;

// [hour, multiply tint, lamp strength]
const KEYS = [
  [0, NIGHT, 1],
  [5, NIGHT, 1],
  [6, 0xd9b6c4, 0.6],
  [7.5, WHITE, 0],
  [17, WHITE, 0],
  [18.5, 0xffd6a8, 0.25],
  [19.5, 0xb59bcf, 0.75],
  [20.5, NIGHT, 1],
  [24, NIGHT, 1],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(a, b, t) {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

export function currentHour(override) {
  if (override != null) return override;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

/** @returns {{ tint: number, lights: number }} */
export function daylight(hourOverride, outdoor = true) {
  const h = currentHour(hourOverride);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const [h0, c0, l0] = KEYS[i];
  const [h1, c1, l1] = KEYS[i + 1];
  const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  let tint = lerpColor(c0, c1, t);
  let lights = lerp(l0, l1, t);
  if (!outdoor) {
    // Interiors: lamps and the fire keep things cosy; only dim slightly at night
    tint = lerpColor(tint, 0xfff3e0, 0.6);
    lights = 0.35 + lights * 0.65;
  }
  return { tint, lights };
}
