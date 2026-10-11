// Crops from Cute Fantasy's Crops.png. Each crop has a 32px-tall slot:
// col 0 sign, col 1 seed packet, cols 2-5 growth stages, col 6 harvest icon.
// Tall growth stages reach up into the empty 16px row above the slot.

const SHEET = '/sprites/crops/Crops.png';
const SEED = '/sprites/custom/seed_mound.png';

export const CROPS = [
  ['wheat', 'Wheat'], ['tomato', 'Tomato'], ['carrot', 'Carrot'], ['turnip', 'Turnip'],
  ['corn', 'Corn'], ['pumpkin', 'Pumpkin'], ['parsnip', 'Parsnip'], ['cabbage', 'Cabbage'],
  ['cucumber', 'Cucumber'], ['chili', 'Chili'], ['red_pepper', 'Red pepper'], ['orange_pepper', 'Orange pepper'],
  ['green_pepper', 'Green pepper'], ['kale', 'Kale'], ['sunflower', 'Sunflower'], ['onion', 'Onion'],
  ['potato', 'Potato'], ['strawberry', 'Strawberry'], ['radish', 'Radish'], ['garlic', 'Garlic'],
  ['leek', 'Leek'], ['grapes', 'Grapes'],
].map(([id, name], row) => ({ id, name, row }));

const BY_ID = Object.fromEntries(CROPS.map(c => [c.id, c]));

export const STAGE_LABELS = ['Seed', 'Sprout', 'Young', 'Mature', 'Fully grown'];
export const MAX_STAGE = 4;

export function crop(id) {
  return BY_ID[id] || BY_ID.wheat;
}

/** Sprite for a crop at a growth stage, bottom-aligned (16 wide, 16 or 32 tall). */
export function cropFrame(id, stage) {
  if (stage <= 0) return { sheet: SEED, x: 0, y: 0, w: 16, h: 16 };
  const { row } = crop(id);
  const x = (stage + 1) * 16;
  return row === 0
    ? { sheet: SHEET, x, y: 0, w: 16, h: 16 }
    : { sheet: SHEET, x, y: row * 32 - 16, w: 16, h: 32 };
}

/** The harvested-crop icon, used in pickers. */
export function cropIcon(id) {
  return { sheet: SHEET, x: 96, y: crop(id).row * 32, w: 16, h: 16 };
}

export const GARDEN_SHEETS = [SHEET, SEED, '/sprites/tiles/FarmLand_FarmLand_Wet_Tile.png'];

export const GROWTH_PRESETS = [
  { label: '1 minute (demo)', hours: 1 / 60 },
  { label: '10 minutes', hours: 1 / 6 },
  { label: '1 hour', hours: 1 },
  { label: '6 hours', hours: 6 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
];

export const WITHER_PRESETS = [
  { label: '10 minutes', hours: 1 / 6 },
  { label: '1 hour', hours: 1 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
  { label: '2 weeks', hours: 336 },
  { label: '1 month', hours: 720 },
];

/** "3 days", "5h 12m", "45 min", "under a minute" */
export function formatDuration(ms) {
  if (ms < 60 * 1000) return 'under a minute';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

export function formatHours(hours) {
  return formatDuration(hours * 3600 * 1000);
}
