// Plant visual data — colors for each plant type at each growth/wither stage
// Growth stages 0-4: seed, sprout, young, mature, blooming
// Wither stages 1-3: fading, wilting, withered

const GROWTH_LABELS = ['Seed', 'Sprout', 'Young', 'Mature', 'Blooming'];
const WITHER_LABELS = ['', 'Fading', 'Wilting', 'Withered'];

const PLANT_DEFS = {
  sunflower: {
    name: 'Sunflower',
    icon: '🌻',
    represents: 'Goals & Ambitions',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0x4CAF50, height: 0.30, label: 'Sprout' },
      { color: 0x66BB6A, height: 0.50, label: 'Young' },
      { color: 0x388E3C, height: 0.75, label: 'Mature' },
      { color: 0xFFC107, height: 1.0, label: 'Blooming' },
    ],
    wither: [
      { tint: 0xCCCC88, label: 'Fading' },
      { tint: 0xAA9966, label: 'Wilting' },
      { tint: 0x887755, label: 'Withered' },
    ],
  },
  cactus: {
    name: 'Cactus',
    icon: '🌵',
    represents: 'Resilience & Challenges',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0x2E7D32, height: 0.25, label: 'Sprout' },
      { color: 0x388E3C, height: 0.45, label: 'Young' },
      { color: 0x1B5E20, height: 0.70, label: 'Mature' },
      { color: 0x4CAF50, height: 0.90, label: 'Blooming' },
    ],
    wither: [
      { tint: 0x9E9E7A, label: 'Fading' },
      { tint: 0x7A7A5A, label: 'Wilting' },
      { tint: 0x5A5A3A, label: 'Withered' },
    ],
  },
  bonsai: {
    name: 'Bonsai',
    icon: '🌳',
    represents: 'Long-term Projects',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0x6D4C41, height: 0.30, label: 'Sprout' },
      { color: 0x5D4037, height: 0.50, label: 'Young' },
      { color: 0x4E342E, height: 0.70, label: 'Mature' },
      { color: 0x33691E, height: 0.95, label: 'Blooming' },
    ],
    wither: [
      { tint: 0xA09080, label: 'Fading' },
      { tint: 0x807060, label: 'Wilting' },
      { tint: 0x605040, label: 'Withered' },
    ],
  },
  herb: {
    name: 'Herb',
    icon: '🌿',
    represents: 'Skills Being Learned',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0x81C784, height: 0.30, label: 'Sprout' },
      { color: 0x66BB6A, height: 0.45, label: 'Young' },
      { color: 0x43A047, height: 0.65, label: 'Mature' },
      { color: 0x2E7D32, height: 0.85, label: 'Blooming' },
    ],
    wither: [
      { tint: 0xB0B090, label: 'Fading' },
      { tint: 0x909070, label: 'Wilting' },
      { tint: 0x706050, label: 'Withered' },
    ],
  },
  rose: {
    name: 'Rose',
    icon: '🌹',
    represents: 'Relationships & People',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0x4CAF50, height: 0.30, label: 'Sprout' },
      { color: 0x66BB6A, height: 0.50, label: 'Young' },
      { color: 0xC62828, height: 0.75, label: 'Mature' },
      { color: 0xE53935, height: 1.0, label: 'Blooming' },
    ],
    wither: [
      { tint: 0xCC8888, label: 'Fading' },
      { tint: 0xAA6666, label: 'Wilting' },
      { tint: 0x884444, label: 'Withered' },
    ],
  },
  vine: {
    name: 'Vine',
    icon: '🍃',
    represents: 'Habits & Routines',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0x7CB342, height: 0.25, label: 'Sprout' },
      { color: 0x689F38, height: 0.40, label: 'Young' },
      { color: 0x558B2F, height: 0.60, label: 'Mature' },
      { color: 0x33691E, height: 0.80, label: 'Blooming' },
    ],
    wither: [
      { tint: 0xA0A080, label: 'Fading' },
      { tint: 0x808060, label: 'Wilting' },
      { tint: 0x606040, label: 'Withered' },
    ],
  },
  mushroom: {
    name: 'Mushroom',
    icon: '🍄',
    represents: 'Fun & Side Projects',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0xBCAAA4, height: 0.30, label: 'Sprout' },
      { color: 0xA1887F, height: 0.50, label: 'Young' },
      { color: 0x8D6E63, height: 0.70, label: 'Mature' },
      { color: 0xD32F2F, height: 0.90, label: 'Blooming' },
    ],
    wither: [
      { tint: 0xB0A0A0, label: 'Fading' },
      { tint: 0x908080, label: 'Wilting' },
      { tint: 0x706060, label: 'Withered' },
    ],
  },
  fern: {
    name: 'Fern',
    icon: '🌿',
    represents: 'Self-care & Health',
    growth: [
      { color: 0x8B6914, height: 0.15, label: 'Seed' },
      { color: 0xA5D6A7, height: 0.30, label: 'Sprout' },
      { color: 0x81C784, height: 0.50, label: 'Young' },
      { color: 0x66BB6A, height: 0.70, label: 'Mature' },
      { color: 0x4CAF50, height: 0.90, label: 'Blooming' },
    ],
    wither: [
      { tint: 0xB8C8A8, label: 'Fading' },
      { tint: 0x98A888, label: 'Wilting' },
      { tint: 0x788868, label: 'Withered' },
    ],
  },
};

export function getPlantDef(type) {
  return PLANT_DEFS[type] || PLANT_DEFS.sunflower;
}

export function getPlantVisual(type, growthStage, witherStage) {
  const def = getPlantDef(type);
  const growth = def.growth[Math.min(growthStage, def.growth.length - 1)];

  if (witherStage > 0) {
    const wither = def.wither[Math.min(witherStage - 1, def.wither.length - 1)];
    return { ...growth, color: wither.tint, label: wither.label, withering: true };
  }

  return { ...growth, withering: false };
}

export function getStageLabel(growthStage, witherStage) {
  if (witherStage > 0) return WITHER_LABELS[witherStage] || 'Withered';
  return GROWTH_LABELS[growthStage] || 'Seed';
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr + 'Z');
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}


export { PLANT_DEFS, GROWTH_LABELS, WITHER_LABELS };
