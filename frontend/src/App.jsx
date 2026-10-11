import { Routes, Route, Navigate } from 'react-router-dom';
import GameRoot from './game/GameRoot';
import Garden from './pages/Garden';
import VillageEditor from './game/editor/VillageEditor';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Routes>
      {/* The village and every building in it share one persistent game world
          (a layout route, so moving between them never remounts it) */}
      <Route element={<GameRoot />}>
        <Route path="/" element={null} />
        <Route path="/house" element={null} />
        <Route path="/login" element={null} />
      </Route>

      <Route path="/garden" element={<Garden />} />
      <Route path="/editor" element={<VillageEditor />} />

      {/* Old page URLs now live inside the house */}
      <Route path="/posts" element={<Navigate to="/house" replace state={{ panel: 'news' }} />} />
      <Route path="/board" element={<Navigate to="/house" replace state={{ panel: 'board' }} />} />
      <Route path="/village" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
