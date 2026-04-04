import { useAuth } from '../context/AuthContext';

export default function StickyNote({ note, onDelete }) {
  const { user } = useAuth();
  const isOwner = user && user.id === note.author_id;

  return (
    <div
      className="sticky-note"
      style={{ backgroundColor: note.color || '#fef08a' }}
    >
      <div className="sticky-note-content">{note.content}</div>
      <div className="sticky-note-footer">
        <span className="sticky-note-author">— {note.author_name}</span>
        {isOwner && (
          <div className="sticky-note-actions">
            <button onClick={() => onDelete(note.id)} className="btn-icon" title="Delete">✕</button>
          </div>
        )}
      </div>
      {note.pinned === 1 && <div className="sticky-note-pin">📌</div>}
    </div>
  );
}
