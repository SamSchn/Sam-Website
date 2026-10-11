import village from './village';
import house from './house';

// Built-in maps. The editor can save edited copies to the database; the game
// prefers a saved copy and falls back to these.
export const DEFAULT_MAPS = { village, house };

// Places you can travel to that aren't maps rendered by this engine
export const EXTERNAL_ROUTES = { garden: '/garden' };

export function mapIdForPath(pathname) {
  for (const m of Object.values(DEFAULT_MAPS)) {
    if (m.route === pathname) return m.id;
  }
  if (pathname === '/login') return 'village';
  return null;
}
