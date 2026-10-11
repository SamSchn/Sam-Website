// Garden growth rules, computed from timestamps (no background jobs).
//
// - Each watering lasts one growth period (growth_hours). When that period
//   finishes, the plant has grown one stage.
// - You can't water a plant that's still damp from its last watering.
// - Once the soil dries out, the clock starts: after wither_hours it wilts,
//   after twice that it withers. Fully grown plants wither too if neglected.
// - Watering a withered plant revives it, but it loses a stage.

const CROPS = [
  'wheat', 'tomato', 'carrot', 'turnip', 'corn', 'pumpkin', 'parsnip', 'cabbage',
  'cucumber', 'chili', 'red_pepper', 'orange_pepper', 'green_pepper', 'kale',
  'sunflower', 'onion', 'potato', 'strawberry', 'radish', 'garlic', 'leek', 'grapes',
];

const MAX_STAGE = 4; // 0 seed, 1 sprout, 2 young, 3 mature, 4 fully grown
const GRID = { cols: 12, rows: 6 };

// Owner-chosen speeds are clamped to sane bounds (in hours)
const LIMITS = {
  growth: { min: 1 / 60, max: 24 * 60 },   // 1 minute .. 60 days per stage
  wither: { min: 1 / 60, max: 24 * 365 },  // 1 minute .. 1 year
};

const HOUR = 3600 * 1000;
const toMs = (s) => (s ? Date.parse(s.replace(' ', 'T') + 'Z') : null);

function plantState(p, now = Date.now()) {
  const grow = p.growth_hours * HOUR;
  const wither = p.wither_hours * HOUR;
  const planted = toMs(p.created_at);
  const last = toMs(p.last_watered);

  const watered = last !== null && now < last + grow;
  const completed = p.water_count - (watered ? 1 : 0);
  const stage = Math.max(0, Math.min(MAX_STAGE, completed - p.setbacks));

  const drySince = watered ? null : (last !== null ? last + grow : planted);
  const dryFor = watered ? 0 : now - drySince;
  const witherLevel = dryFor >= 2 * wither ? 2 : dryFor >= wither ? 1 : 0;

  return {
    stage,
    wither: witherLevel,
    watered,
    fully_grown: stage >= MAX_STAGE,
    completed,
    next_growth_at: watered && stage < MAX_STAGE ? last + grow : null,
    dry_at: watered ? last + grow : null,
    wilts_at: witherLevel === 0 ? (watered ? last + grow : drySince) + wither : null,
    withers_at: witherLevel < 2 ? (watered ? last + grow : drySince) + 2 * wither : null,
  };
}

module.exports = { CROPS, MAX_STAGE, GRID, LIMITS, plantState, toMs };
