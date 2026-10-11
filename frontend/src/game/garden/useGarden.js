import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { plantState } from './growth';
import { crop } from './crops';
import { sfx } from '../engine/sound';

const POLL_MS = 60 * 1000;   // pick up other people's watering
const TICK_MS = 5 * 1000;    // recompute stages/countdowns locally

/**
 * Garden data + actions while the garden map is active. Stages are recomputed
 * locally between fetches using the server's clock (to avoid clock skew).
 */
export function useGarden({ worldRef, active, user, toast }) {
  const [raw, setRaw] = useState([]);
  const [tick, setTick] = useState(0);
  const offset = useRef(0);

  const refresh = useCallback(async () => {
    const data = await api.getGarden();
    offset.current = data.now - Date.now();
    setRaw(data.plants);
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh().catch(() => toast?.("Couldn't reach the garden right now."));
    const poll = setInterval(() => refresh().catch(() => {}), POLL_MS);
    const t = setInterval(() => setTick(n => n + 1), TICK_MS);
    return () => { clearInterval(poll); clearInterval(t); };
  }, [active, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = Date.now() + offset.current;
  const plants = useMemo(
    () => raw.map(p => ({ ...p, state: plantState(p, now) })),
    [raw, tick], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (active) worldRef.current?.setGarden({ plants, owner: !!user });
  }, [active, plants, user, worldRef]);

  const replace = (plant) => setRaw(list => list.map(p => (p.id === plant.id ? plant : p)));

  const water = useCallback(async (plant) => {
    try {
      const res = await api.waterPlant(plant.id);
      replace(res.plant);
      worldRef.current?.splash(plant.grid_x, plant.grid_y);
      sfx.coin();
      toast?.(res.lostStage
        ? `${plant.title} is back — but it lost a little growth.`
        : res.revived ? `${plant.title} perks right back up!` : `You watered ${plant.title}.`);
    } catch (err) {
      toast?.(err.message);
      refresh().catch(() => {});
    }
  }, [refresh, toast, worldRef]);

  const sunshine = useCallback(async (plant) => {
    try {
      replace(await api.sunshinePlant(plant.id));
      sfx.select();
      toast?.(`You sent ${plant.title} some sunshine.`);
    } catch (err) {
      toast?.(err.message);
    }
  }, [toast]);

  const plantSeed = useCallback(async (data) => {
    const plant = await api.plantSeed(data);
    setRaw(list => [...list, plant]);
    worldRef.current?.splash(plant.grid_x, plant.grid_y);
    sfx.coin();
    toast?.(`Planted ${crop(plant.crop).name.toLowerCase()} seeds: “${plant.title}”.`);
  }, [toast, worldRef]);

  const update = useCallback(async (id, data) => {
    replace(await api.updatePlant(id, data));
    toast?.('Saved.');
  }, [toast]);

  const remove = useCallback(async (plant) => {
    await api.deletePlant(plant.id);
    setRaw(list => list.filter(p => p.id !== plant.id));
    toast?.(`Pulled up ${plant.title}.`);
  }, [toast]);

  return {
    plants,
    now,
    getPlant: (id) => plants.find(p => p.id === id) || null,
    water, sunshine, plantSeed, update, remove,
  };
}
