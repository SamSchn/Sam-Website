import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="jungle-home">
      <h1 className="jungle-title">🐒 Sam's Jungle Garden</h1>
      <p className="jungle-subtitle">Welcome to the jungle — pick a path to explore</p>

      <div className="jungle-grid">
        <Link to="/posts" className="jungle-card">
          <span className="jungle-card-icon">📰</span>
          <span className="jungle-card-name">Jungle News</span>
          <span className="jungle-card-desc">Updates & announcements</span>
        </Link>

        <Link to="/board" className="jungle-card">
          <span className="jungle-card-icon">📋</span>
          <span className="jungle-card-name">Message Board</span>
          <span className="jungle-card-desc">Pinned notes & messages</span>
        </Link>

        <Link to="/garden" className="jungle-card">
          <span className="jungle-card-icon">🌱</span>
          <span className="jungle-card-name">Digital Garden</span>
          <span className="jungle-card-desc">Ideas at various stages of growth</span>
        </Link>
      </div>

      <div className="jungle-footer">
        🌴🌿🐸🌺🦜🌳🍄🐒🌴
      </div>
    </div>
  );
}
