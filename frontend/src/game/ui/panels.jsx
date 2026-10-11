// Content windows opened by furniture in the house.
import { useEffect, useState } from 'react';
import Panel from './Panel';
import Icon from './Icon';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { NEWS_WELCOME, BOARD_WELCOME } from '../content/site';
import { useContent } from '../content/ContentContext';
import { AboutEditor, ProjectsEditor, ResumeEditor, ContactEditor } from './contentEditors';

const fmtDate = (s) => new Date(s + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Owner-only edit mode for a content section. */
function useOwnerEdit(key) {
  const { user } = useAuth();
  const { content, isCustom, save, reset } = useContent();
  const [editing, setEditing] = useState(false);
  return {
    value: content[key],
    editing,
    editButton: user && !editing
      ? <button className="pixel-button small owner-edit" onClick={() => setEditing(true)}>Edit this page</button>
      : null,
    editorProps: {
      value: content[key],
      custom: isCustom(key),
      onSave: (d) => save(key, d),
      onReset: () => reset(key),
      onDone: () => setEditing(false),
    },
  };
}

// ------------------------------------------------------------------ About
export function AboutPanel({ onClose }) {
  const { value: ABOUT, editing, editButton, editorProps } = useOwnerEdit('about');
  if (editing) {
    return <Panel title="Edit · About" icon="portrait" onClose={onClose} wide><AboutEditor {...editorProps} /></Panel>;
  }
  return (
    <Panel title="About Sam" icon="portrait" onClose={onClose}>
      {editButton}
      <div className="about">
        <div className="about-portrait pixel-inset">
          <img src="/sprites/custom/portrait.png" alt="Pixel portrait of Sam" />
        </div>
        <div>
          <h2 className="about-heading">{ABOUT.heading}</h2>
          <p className="about-tagline">{ABOUT.tagline}</p>
        </div>
      </div>
      {ABOUT.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      <dl className="facts">
        {ABOUT.facts.map(f => (
          <div key={f.label} className="pixel-inset fact">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

// ------------------------------------------------------------------ Projects (bookshelf)
export function ProjectsPanel({ onClose }) {
  const { value: PROJECTS, editing, editButton, editorProps } = useOwnerEdit('projects');
  const [open, setOpen] = useState(0);
  const project = PROJECTS[Math.min(open, PROJECTS.length - 1)];
  if (editing) {
    return <Panel title="Edit · Projects" icon="book" onClose={onClose} wide><ProjectsEditor {...editorProps} /></Panel>;
  }
  return (
    <Panel title="Bookshelf · Projects" icon="book" onClose={onClose} wide>
      {editButton}
      <p className="panel-hint">Each book is a project. Pick one off the shelf.</p>
      <div className="shelf">
        {PROJECTS.map((p, i) => (
          <button
            key={p.name}
            className={`book${p === project ? ' book-open' : ''}`}
            style={{ '--book': p.color }}
            onClick={() => setOpen(i)}
            title={p.name}
          >
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      {project && (
        <article className="pixel-inset project">
          <header>
            <h3>{project.name}</h3>
            <span className="project-year">{project.year}</span>
          </header>
          <p>{project.description}</p>
          <ul className="tags">{project.tags.map(t => <li key={t}>{t}</li>)}</ul>
          {project.link && (
            <a className="pixel-button" href={project.link} target={project.link.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              {project.link.startsWith('http') ? 'Open project ↗' : 'Visit →'}
            </a>
          )}
        </article>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ Resume (desk)
export function ResumePanel({ onClose }) {
  const { value: RESUME, editing, editButton, editorProps } = useOwnerEdit('resume');
  if (editing) {
    return <Panel title="Edit · Resume" icon="scroll" onClose={onClose} wide><ResumeEditor {...editorProps} /></Panel>;
  }
  return (
    <Panel title="Desk · Resume" icon="scroll" onClose={onClose} wide>
      {editButton}
      <p className="resume-summary">{RESUME.summary}</p>
      <h3 className="section-title">Experience</h3>
      {RESUME.experience.map(job => (
        <article key={job.role + job.org} className="pixel-inset job">
          <header>
            <strong>{job.role}</strong> · {job.org}
            <span className="job-dates">{job.dates}</span>
          </header>
          <ul>{job.points.map(p => <li key={p}>{p}</li>)}</ul>
        </article>
      ))}
      <h3 className="section-title">Education</h3>
      {RESUME.education.map(e => (
        <p key={e.school}><strong>{e.school}</strong> — {e.detail}</p>
      ))}
      <h3 className="section-title">Skills</h3>
      <ul className="tags">{RESUME.skills.map(s => <li key={s}>{s}</li>)}</ul>
      {RESUME.pdf && (
        <a className="pixel-button" href={RESUME.pdf} target="_blank" rel="noreferrer">Download PDF ↓</a>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ Contact (mailbox / letters)
const CONTACT_ICONS = { github: 'code', mail: 'letter', linkedin: 'briefcase' };

export function ContactPanel({ onClose }) {
  const { value: CONTACT, editing, editButton, editorProps } = useOwnerEdit('contact');
  if (editing) {
    return <Panel title="Edit · Contact" icon="letter" onClose={onClose} wide><ContactEditor {...editorProps} /></Panel>;
  }
  return (
    <Panel title="Mailbox · Contact" icon="letter" onClose={onClose}>
      {editButton}
      <p className="panel-hint">Want to send Sam a letter? Here's where to find him.</p>
      <ul className="contact-list">
        {CONTACT.map(c => (
          <li key={c.label}>
            <a className="pixel-inset contact" href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              <Icon name={CONTACT_ICONS[c.icon] || 'letter'} />
              <span>
                <strong>{c.label}</strong>
                <span className="contact-value">{c.value}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ------------------------------------------------------------------ News (TV)
export function NewsPanel({ onClose }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [channel, setChannel] = useState(0);

  useEffect(() => {
    api.getPosts().then(setPosts).catch(() => setPosts([]));
  }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      const post = await api.createPost(title, body);
      setPosts(p => [post, ...(p || [])]);
      setTitle('');
      setBody('');
      setChannel(0);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await api.deletePost(id);
      setPosts(p => p.filter(x => x.id !== id));
      setChannel(0);
    } catch (err) {
      setError(err.message);
    }
  }

  const post = posts?.[channel];
  return (
    <Panel title="TV · Valley News" icon="tv" onClose={onClose} wide>
      <div className="tv-screen">
        {posts === null && <p className="tv-static">Tuning in...</p>}
        {posts?.length === 0 && (
          <article className="tv-post">
            <span className="tv-channel">CH 1</span>
            <h3>{NEWS_WELCOME.title}</h3>
            <p className="tv-body">{NEWS_WELCOME.body}</p>
          </article>
        )}
        {post && (
          <article className="tv-post">
            <span className="tv-channel">CH {channel + 1}</span>
            <h3>{post.title}</h3>
            <p className="tv-meta">{fmtDate(post.created_at)} · {post.author_name}</p>
            <p className="tv-body">{post.body}</p>
          </article>
        )}
      </div>
      {posts?.length > 1 && (
        <div className="tv-controls">
          <button className="pixel-button" disabled={channel === 0} onClick={() => setChannel(c => c - 1)}>◀ Newer</button>
          <span>{channel + 1} / {posts.length}</span>
          <button className="pixel-button" disabled={channel >= posts.length - 1} onClick={() => setChannel(c => c + 1)}>Older ▶</button>
        </div>
      )}
      {user && post && post.author_id === user.id && (
        <button className="pixel-button danger" onClick={() => remove(post.id)}>Delete this broadcast</button>
      )}
      {user && (
        <form className="compose" onSubmit={create}>
          <h3 className="section-title">Broadcast an update</h3>
          {error && <p className="form-error">{error}</p>}
          <input placeholder="Headline" value={title} onChange={e => setTitle(e.target.value)} required />
          <textarea placeholder="What's new in the valley?" rows={3} value={body} onChange={e => setBody(e.target.value)} required />
          <button className="pixel-button" type="submit">Go live</button>
        </form>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ Bulletin board
const NOTE_COLORS = ['#f6ead6', '#ffe08a', '#bde0f6', '#f5b8c4', '#c8ecb0'];

export function BoardPanel({ onClose }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState(null);
  const [content, setContent] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getNotes().then(setNotes).catch(() => setNotes([]));
  }, []);

  async function pin(e) {
    e.preventDefault();
    setError('');
    try {
      const note = await api.createNote(content, color);
      setNotes(n => [note, ...(n || [])]);
      setContent('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await api.deleteNote(id);
      setNotes(n => n.filter(x => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Panel title="Bulletin Board" icon="pin" onClose={onClose} wide>
      <div className="cork">
        {notes === null && <p className="cork-empty">Loading notes...</p>}
        {(notes?.length === 0 ? BOARD_WELCOME : notes || []).map((n, i) => (
          <div key={n.id} className="note" style={{ '--note': n.color || NOTE_COLORS[0], '--tilt': `${((i * 37 + 11) % 7) - 3}deg` }}>
            <span className="note-pin" style={{ background: ['#c42430', '#3b6fb6', '#33984b'][i % 3] }} />
            <p>{n.content}</p>
            <footer>
              — {n.author_name}
              {user && user.id === n.author_id && (
                <button className="note-delete" onClick={() => remove(n.id)} aria-label="Remove note">✕</button>
              )}
            </footer>
          </div>
        ))}
      </div>
      {user && (
        <form className="compose" onSubmit={pin}>
          <h3 className="section-title">Pin a note</h3>
          {error && <p className="form-error">{error}</p>}
          <textarea placeholder="Write something..." rows={2} value={content} onChange={e => setContent(e.target.value)} required />
          <div className="compose-row">
            <div className="swatches">
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`swatch${c === color ? ' on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Paper colour ${c}`}
                />
              ))}
            </div>
            <button className="pixel-button" type="submit">Pin it</button>
          </div>
        </form>
      )}
    </Panel>
  );
}

export const PANELS = {
  about: AboutPanel,
  projects: ProjectsPanel,
  resume: ResumePanel,
  contact: ContactPanel,
  news: NewsPanel,
  board: BoardPanel,
};
