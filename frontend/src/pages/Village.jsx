import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import TileMapRenderer from '../components/TileMapRenderer';

export default function Village() {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadVillageMap() {
      try {
        const maps = await api.getTileMaps();
        const village = maps.find(m => m.name === 'village');
        if (!village) {
          setError('no-village');
          setLoading(false);
          return;
        }
        const data = await api.getTileMap(village.id);
        setMapData(data);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    loadVillageMap();
  }, []);

  function handlePortal(target) {
    // Portal targets map to routes
    const routes = {
      garden: '/garden',
      posts: '/posts',
      board: '/board',
      login: '/login',
      editor: '/editor',
    };
    const route = routes[target.toLowerCase()] || `/${target.toLowerCase()}`;
    navigate(route);
  }

  if (loading) {
    return <div className="loading">Loading village...</div>;
  }

  if (error === 'no-village') {
    return (
      <div className="village-empty">
        <h2>No village map yet</h2>
        <p>Create a map named "village" in the tile editor to use it as your home page.</p>
        {user && <Link to="/editor" className="btn btn-primary">Open Editor</Link>}
      </div>
    );
  }

  if (error) {
    return <div className="village-empty"><p>Error: {error}</p></div>;
  }

  return (
    <div className="village-game">
      <TileMapRenderer mapData={mapData} onPortal={handlePortal} />
      <div className="village-hud">
        <div className="village-hud-top-left">
          <span className="village-title">Village</span>
        </div>
        <div className="village-hud-top-right">
          {user && (
            <>
              <span className="village-user">🌿 {user.displayName}</span>
              <Link to="/editor" className="btn btn-sm btn-secondary">Editor</Link>
            </>
          )}
        </div>
        <div className="village-hud-bottom">
          <span>WASD — Move &nbsp; E — Interact</span>
        </div>
      </div>
    </div>
  );
}
