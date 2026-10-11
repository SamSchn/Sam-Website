// Owner-only editors for the house content (shown inside the panels).
import { useState } from 'react';

const clone = (v) => JSON.parse(JSON.stringify(v));

function EditorShell({ children, onSave, onCancel, onReset, custom, busy, error }) {
  return (
    <div className="content-editor">
      {error && <p className="form-error">{error}</p>}
      {children}
      <div className="content-editor-actions">
        <button className="pixel-button active" onClick={onSave} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="pixel-button subtle" onClick={onCancel} disabled={busy}>Cancel</button>
        {custom && <button className="pixel-button danger" onClick={onReset} disabled={busy}>Reset to default</button>}
      </div>
    </div>
  );
}

function Text({ label, value, onChange, multiline, rows = 3, placeholder, type = 'text' }) {
  return (
    <label className="ce-field">
      <span>{label}</span>
      {multiline
        ? <textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        : <input type={type} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />}
    </label>
  );
}

/** Shared save/reset plumbing for every section editor. */
function useSectionEditor(initial, { onSave, onReset, onDone }) {
  const [draft, setDraft] = useState(() => clone(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return {
    draft, setDraft, busy, error,
    save: (transform = (d) => d) => run(() => onSave(transform(draft))),
    reset: () => window.confirm('Go back to the default text for this section?') && run(onReset),
  };
}

function ListControls({ index, length, onMove, onRemove }) {
  return (
    <div className="ce-list-controls">
      <button type="button" className="pixel-button small" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
      <button type="button" className="pixel-button small" disabled={index === length - 1} onClick={() => onMove(1)} aria-label="Move down">↓</button>
      <button type="button" className="pixel-button small danger" onClick={onRemove} aria-label="Remove">✕</button>
    </div>
  );
}

const move = (arr, i, d) => {
  const next = arr.slice();
  const [item] = next.splice(i, 1);
  next.splice(i + d, 0, item);
  return next;
};

// ------------------------------------------------------------------ About
export function AboutEditor({ value, custom, onSave, onReset, onDone }) {
  const ed = useSectionEditor({
    ...value,
    paragraphsText: (value.paragraphs || []).join('\n\n'),
    factsText: (value.facts || []).map(f => `${f.label}: ${f.value}`).join('\n'),
  }, { onSave, onReset, onDone });
  const set = (patch) => ed.setDraft(d => ({ ...d, ...patch }));
  const toData = (d) => ({
    heading: d.heading,
    tagline: d.tagline,
    paragraphs: d.paragraphsText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
    facts: d.factsText.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.indexOf(':');
      return i < 0 ? { label: l, value: '' } : { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    }),
  });
  return (
    <EditorShell onSave={() => ed.save(toData)} onCancel={onDone} onReset={ed.reset} custom={custom} busy={ed.busy} error={ed.error}>
      <Text label="Heading" value={ed.draft.heading} onChange={v => set({ heading: v })} />
      <Text label="Tagline" value={ed.draft.tagline} onChange={v => set({ tagline: v })} />
      <Text label="About you (blank line between paragraphs)" multiline rows={8} value={ed.draft.paragraphsText} onChange={v => set({ paragraphsText: v })} />
      <Text label="Quick facts (one per line, “Label: value”)" multiline rows={4} value={ed.draft.factsText} onChange={v => set({ factsText: v })} />
    </EditorShell>
  );
}

// ------------------------------------------------------------------ Projects
export function ProjectsEditor({ value, custom, onSave, onReset, onDone }) {
  const ed = useSectionEditor(value.map(p => ({ ...p, tagsText: (p.tags || []).join(', ') })), { onSave, onReset, onDone });
  const update = (i, patch) => ed.setDraft(list => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const toData = (list) => list.map(({ tagsText, ...p }) => ({
    ...p,
    tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
    link: p.link?.trim() || null,
  }));
  return (
    <EditorShell onSave={() => ed.save(toData)} onCancel={onDone} onReset={ed.reset} custom={custom} busy={ed.busy} error={ed.error}>
      {ed.draft.map((p, i) => (
        <fieldset key={i} className="pixel-inset ce-item">
          <ListControls index={i} length={ed.draft.length} onMove={d => ed.setDraft(l => move(l, i, d))} onRemove={() => ed.setDraft(l => l.filter((_, j) => j !== i))} />
          <div className="ce-row">
            <Text label="Name" value={p.name} onChange={v => update(i, { name: v })} />
            <Text label="Year" value={p.year} onChange={v => update(i, { year: v })} />
            <label className="ce-field ce-color"><span>Book colour</span><input type="color" value={p.color || '#c42430'} onChange={e => update(i, { color: e.target.value })} /></label>
          </div>
          <Text label="Description" multiline value={p.description} onChange={v => update(i, { description: v })} />
          <Text label="Tags (comma separated)" value={p.tagsText} onChange={v => update(i, { tagsText: v })} />
          <Text label="Link (https://… or a page like /garden)" value={p.link} onChange={v => update(i, { link: v })} />
        </fieldset>
      ))}
      <button type="button" className="pixel-button" onClick={() => ed.setDraft(l => [...l, { name: 'New project', year: String(new Date().getFullYear()), color: '#3b6fb6', description: '', tagsText: '', link: '' }])}>
        + Add a book
      </button>
    </EditorShell>
  );
}

// ------------------------------------------------------------------ Resume
export function ResumeEditor({ value, custom, onSave, onReset, onDone }) {
  const ed = useSectionEditor({
    ...value,
    experience: (value.experience || []).map(j => ({ ...j, pointsText: (j.points || []).join('\n') })),
    educationText: (value.education || []).map(e => `${e.school} — ${e.detail}`).join('\n'),
    skillsText: (value.skills || []).join(', '),
  }, { onSave, onReset, onDone });
  const set = (patch) => ed.setDraft(d => ({ ...d, ...patch }));
  const updateJob = (i, patch) => set({ experience: ed.draft.experience.map((j, k) => (k === i ? { ...j, ...patch } : j)) });
  const toData = (d) => ({
    pdf: d.pdf?.trim() || null,
    summary: d.summary,
    experience: d.experience.map(({ pointsText, ...j }) => ({ ...j, points: pointsText.split('\n').map(p => p.trim()).filter(Boolean) })),
    education: d.educationText.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [school, ...rest] = l.split(/\s+[—-]\s+/);
      return { school: school.trim(), detail: rest.join(' — ').trim() };
    }),
    skills: d.skillsText.split(',').map(s => s.trim()).filter(Boolean),
  });
  return (
    <EditorShell onSave={() => ed.save(toData)} onCancel={onDone} onReset={ed.reset} custom={custom} busy={ed.busy} error={ed.error}>
      <Text label="Summary" multiline value={ed.draft.summary} onChange={v => set({ summary: v })} />
      <Text label="Resume PDF link (optional, e.g. /resume.pdf)" value={ed.draft.pdf} onChange={v => set({ pdf: v })} />
      <h3 className="section-title">Experience</h3>
      {ed.draft.experience.map((j, i) => (
        <fieldset key={i} className="pixel-inset ce-item">
          <ListControls
            index={i}
            length={ed.draft.experience.length}
            onMove={d => set({ experience: move(ed.draft.experience, i, d) })}
            onRemove={() => set({ experience: ed.draft.experience.filter((_, k) => k !== i) })}
          />
          <div className="ce-row">
            <Text label="Role" value={j.role} onChange={v => updateJob(i, { role: v })} />
            <Text label="Organisation" value={j.org} onChange={v => updateJob(i, { org: v })} />
            <Text label="Dates" value={j.dates} onChange={v => updateJob(i, { dates: v })} />
          </div>
          <Text label="Highlights (one per line)" multiline value={j.pointsText} onChange={v => updateJob(i, { pointsText: v })} />
        </fieldset>
      ))}
      <button type="button" className="pixel-button" onClick={() => set({ experience: [...ed.draft.experience, { role: '', org: '', dates: '', pointsText: '' }] })}>
        + Add a role
      </button>
      <Text label="Education (one per line, “School — detail”)" multiline value={ed.draft.educationText} onChange={v => set({ educationText: v })} />
      <Text label="Skills (comma separated)" value={ed.draft.skillsText} onChange={v => set({ skillsText: v })} />
    </EditorShell>
  );
}

// ------------------------------------------------------------------ Contact
const CONTACT_ICON_CHOICES = [['github', 'Code / GitHub'], ['mail', 'Letter / Email'], ['linkedin', 'Briefcase / LinkedIn']];

export function ContactEditor({ value, custom, onSave, onReset, onDone }) {
  const ed = useSectionEditor(value, { onSave, onReset, onDone });
  const update = (i, patch) => ed.setDraft(list => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <EditorShell onSave={() => ed.save()} onCancel={onDone} onReset={ed.reset} custom={custom} busy={ed.busy} error={ed.error}>
      {ed.draft.map((c, i) => (
        <fieldset key={i} className="pixel-inset ce-item">
          <ListControls index={i} length={ed.draft.length} onMove={d => ed.setDraft(l => move(l, i, d))} onRemove={() => ed.setDraft(l => l.filter((_, j) => j !== i))} />
          <div className="ce-row">
            <label className="ce-field">
              <span>Icon</span>
              <select value={c.icon} onChange={e => update(i, { icon: e.target.value })}>
                {CONTACT_ICON_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <Text label="Label" value={c.label} onChange={v => update(i, { label: v })} />
          </div>
          <Text label="Shown as" value={c.value} onChange={v => update(i, { value: v })} />
          <Text label="Link (https://… or mailto:…)" value={c.href} onChange={v => update(i, { href: v })} />
        </fieldset>
      ))}
      <button type="button" className="pixel-button" onClick={() => ed.setDraft(l => [...l, { icon: 'mail', label: '', value: '', href: '' }])}>
        + Add a way to reach you
      </button>
    </EditorShell>
  );
}
