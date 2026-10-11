// Client copy of backend/garden/growth.js, so stages and countdowns stay live
// between refreshes. Keep the two in sync.
import { MAX_STAGE } from './crops';

const HOUR = 3600 * 1000;
const toMs = (s) => (s ? Date.parse(s.replace(' ', 'T') + 'Z') : null);

export function plantState(p, now = Date.now()) {
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
