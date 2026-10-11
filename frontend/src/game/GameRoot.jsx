import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { World } from './engine/World';
import { DEFAULT_MAPS, EXTERNAL_ROUTES, mapIdForPath } from './maps';
import { loadMapData } from './maps/loader';
import { SITE, WELCOME } from './content/site';
import DialogueBox from './ui/DialogueBox';
import { PANELS } from './ui/panels';
import GameMenu, { LoginPanel } from './ui/GameMenu';
import { Clock, LocationBanner, ControlsHint } from './ui/Hud';
import { useAuth } from '../context/AuthContext';
import { useGarden } from './garden/useGarden';
import { PlantPanel, PlantDialog } from './garden/PlantPanels';
import './game.css';

const FADE_MS = 280;
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function seenWelcome() {
  try { return localStorage.getItem('sv_welcomed') === '1'; } catch { return true; }
}
function markWelcomed() {
  try { localStorage.setItem('sv_welcomed', '1'); } catch { /* storage unavailable */ }
}

function hourFromUrl() {
  const h = new URLSearchParams(window.location.search).get('hour');
  return h != null && !Number.isNaN(Number(h)) ? Number(h) : null;
}

/** Hosts the game world and all in-game UI. Mounted for every village route. */
export default function GameRoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const mountRef = useRef(null);
  const promptRef = useRef(null);
  const worldRef = useRef(null);
  const currentMapRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [mapName, setMapName] = useState('');
  const [fade, setFade] = useState(true);
  const [target, setTarget] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [panel, setPanel] = useState(null);
  const [menu, setMenu] = useState(false);
  const [login, setLogin] = useState(location.pathname === '/login');
  const [hourOverride, setHourOverride] = useState(hourFromUrl);
  const [plantId, setPlantId] = useState(null);
  const [plot, setPlot] = useState(null);
  const [toast, setToast] = useState('');
  const { user } = useAuth();

  const mapId = mapIdForPath(location.pathname) || 'village';
  const uiOpen = !!(dialog || panel || menu || login || plantId || plot);

  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const garden = useGarden({ worldRef, active: ready && mapId === 'garden', user, toast: showToast });
  // close a plant's window if that plant goes away (pulled up, or we left the garden)
  useEffect(() => {
    if (plantId && !garden.getPlant(plantId)) setPlantId(null);
  }, [plantId, garden]);

  // ---- warps: either another map (via the URL) or another page entirely
  const handleWarp = useCallback((to) => {
    const map = DEFAULT_MAPS[to];
    if (map) {
      navigate(map.route);
    } else if (EXTERNAL_ROUTES[to]) {
      setFade(true);
      setTimeout(() => navigate(EXTERNAL_ROUTES[to], { state: { from: currentMapRef.current } }), FADE_MS);
    }
  }, [navigate]);
  const handleWarpRef = useRef(handleWarp);
  handleWarpRef.current = handleWarp;

  // ---- create the world once
  useEffect(() => {
    const world = new World(mountRef.current, {
      onTarget: setTarget,
      onInteract: (it) => {
        if (it.type === 'dialog') setDialog({ speaker: it.speaker, lines: it.lines, portraitSprite: it.portraitSprite });
        else if (it.type === 'panel') setPanel(it.panel);
        else if (it.type === 'plant') setPlantId(it.plantId);
        else if (it.type === 'plot') setPlot({ c: it.c, r: it.r });
        else if (it.type === 'link') window.open(it.href, '_blank', 'noopener');
      },
      onWarp: (to) => handleWarpRef.current(to),
    }, promptRef.current);
    worldRef.current = world;
    if (import.meta.env.DEV) window.__world = world; // handy for debugging in the console
    world.init()
      .then(ok => { if (ok) setReady(true); })
      .catch(err => {
        console.error(err);
        setLoadError('Your browser could not start the game (WebGL is required).');
      });
    return () => world.destroy();
  }, []);

  // ---- load whichever map the URL points at, with a fade
  useEffect(() => {
    if (!ready || currentMapRef.current === mapId) return;
    let cancelled = false;
    (async () => {
      const from = currentMapRef.current ?? location.state?.from ?? null;
      setFade(true);
      if (currentMapRef.current) await wait(FADE_MS);
      const data = await loadMapData(mapId);
      if (cancelled) return;
      try {
        await worldRef.current.loadMap(data, from);
      } catch (err) {
        console.error('Failed to load map', mapId, err);
        setLoadError('Something went wrong loading this area. Try refreshing.');
        return;
      }
      if (cancelled) return;
      currentMapRef.current = mapId;
      setMapName(data.name);
      document.title = `${data.name} · ${SITE.title}`;
      setFade(false);
      if (location.state?.panel) setPanel(location.state.panel);
      else if (mapId === 'village' && !seenWelcome()) {
        markWelcomed();
        setTimeout(() => setDialog({ speaker: WELCOME.speaker, portrait: WELCOME.portrait, lines: isTouch ? WELCOME.touchLines : WELCOME.lines }), 600);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, mapId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- freeze the player while any UI is open
  useEffect(() => {
    worldRef.current?.setInputEnabled(!uiOpen && !fade);
  }, [uiOpen, fade]);

  useEffect(() => {
    worldRef.current?.setHourOverride(hourOverride);
  }, [hourOverride, ready]);

  // ---- Esc opens the menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !uiOpen) setMenu(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uiOpen]);

  useEffect(() => {
    if (location.pathname === '/login') setLogin(true);
  }, [location.pathname]);

  function closeLogin() {
    setLogin(false);
    if (location.pathname === '/login') navigate('/', { replace: true });
  }

  const ActivePanel = panel ? PANELS[panel] : null;
  const showPrompt = target && !uiOpen && !fade;

  return (
    <div className="game-root">
      <div className="game-canvas" ref={mountRef} />

      {/* Floating "use" prompt; the world positions it over the target every frame */}
      <div ref={promptRef} className="prompt-anchor" style={{ visibility: showPrompt ? 'visible' : 'hidden' }}>
        <div className="prompt pixel-frame">
          {!isTouch && <kbd>E</kbd>}
          {target?.label}
        </div>
      </div>

      {ready && <Clock hourOverride={hourOverride} onMenu={() => setMenu(true)} />}
      {mapName && !fade && <LocationBanner name={mapName} />}
      {ready && !fade && <ControlsHint touch={isTouch} />}

      {isTouch && showPrompt && (
        <button className="touch-action" onClick={() => worldRef.current?.interact()} aria-label={`Use ${target.label}`}>
          A
        </button>
      )}

      {dialog && (
        <DialogueBox
          speaker={dialog.speaker}
          portrait={dialog.portrait}
          portraitSprite={dialog.portraitSprite}
          lines={dialog.lines}
          onClose={() => setDialog(null)}
        />
      )}
      {ActivePanel && <ActivePanel onClose={() => setPanel(null)} />}
      {menu && (
        <GameMenu
          onClose={() => setMenu(false)}
          onLogin={() => { setMenu(false); setLogin(true); }}
          hourOverride={hourOverride}
          onHourOverride={setHourOverride}
          onWelcome={() => { setMenu(false); setDialog({ speaker: WELCOME.speaker, portrait: WELCOME.portrait, lines: isTouch ? WELCOME.touchLines : WELCOME.lines }); }}
        />
      )}
      {login && <LoginPanel onClose={closeLogin} />}

      {plantId && (
        <PlantPanel
          plant={garden.getPlant(plantId)}
          now={garden.now}
          isOwner={!!user && garden.getPlant(plantId)?.author_id === user.id}
          onWater={garden.water}
          onSunshine={garden.sunshine}
          onUpdate={garden.update}
          onRemove={async (p) => { await garden.remove(p); setPlantId(null); }}
          onClose={() => setPlantId(null)}
        />
      )}
      {plot && (
        <PlantDialog
          onPlant={async (data) => { await garden.plantSeed({ ...data, grid_x: plot.c, grid_y: plot.r }); setPlot(null); }}
          onClose={() => setPlot(null)}
        />
      )}
      {toast && <div className="toast pixel-frame" role="status">{toast}</div>}

      <div className={`fade${fade ? ' on' : ''}`} aria-hidden />
      {!ready && !loadError && <div className="boot pixel-frame">Loading {SITE.title}…</div>}
      {loadError && <div className="boot pixel-frame">{loadError}</div>}
    </div>
  );
}
