import { api } from '../../api';
import { DEFAULT_MAPS } from './index';

/**
 * A map's data: the copy saved from the editor if there is one, otherwise the
 * built-in default from code.
 */
export async function loadMapData(id) {
  const fallback = DEFAULT_MAPS[id];
  try {
    const saved = await api.getGameMap(id);
    if (saved?.data) return { ...fallback, ...saved.data, id };
  } catch {
    // offline or no backend: the built-in map is fine
  }
  return fallback;
}
