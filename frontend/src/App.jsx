import { Routes, Route, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Posts from './pages/Posts';
import Board from './pages/Board';
import Garden from './pages/Garden';
import TileEditor from './pages/TileEditor';
import { useAuth } from './context/AuthContext';

function BackToJungle() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (location.pathname === '/' || location.pathname === '/garden' || location.pathname === '/editor') return null;

  return (
    <div className="back-bar">
      <Link to="/" className="back-link">🐒 Back to the Jungle</Link>
      {user && (
        <div className="back-bar-user">
          <span className="back-bar-name">🌿 {user.displayName}</span>
          <button onClick={logout} className="btn btn-sm">Logout</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <BackToJungle />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/board" element={<Board />} />
          <Route path="/garden" element={<Garden />} />
          <Route path="/editor" element={<TileEditor />} />
        </Routes>
      </main>
    </div>
  );
}
