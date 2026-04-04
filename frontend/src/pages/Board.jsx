import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import StickyNote from '../components/StickyNote';

const NOTE_COLORS = ['#d4e8b0', '#fef08a', '#fed7aa', '#bfdbfe', '#e9d5ff', '#a7f3d0'];

export default function Board() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [content, setContent] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getNotes().then(setNotes).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const note = await api.createNote(content, color);
      setNotes([note, ...notes]);
      setContent('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteNote(id);
      setNotes(notes.filter((n) => n.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page board-page">
      <h1>🌴 Jungle Board</h1>

      {user && (
        <form className="create-form note-form" onSubmit={handleCreate}>
          <h3>📌 Pin a new leaf</h3>
          {error && <div className="form-error">{error}</div>}
          <textarea
            placeholder="Write something..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            required
          />
          <div className="color-picker">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${color === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
          <button type="submit" className="btn btn-primary">🍃 Pin Note</button>
        </form>
      )}

      <div className="board-grid">
        {notes.length === 0 && <p className="empty-state">The board is empty. Pin the first leaf! 🍃</p>}
        {notes.map((note) => (
          <StickyNote key={note.id} note={note} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
