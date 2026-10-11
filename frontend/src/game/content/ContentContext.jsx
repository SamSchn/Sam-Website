// Site content = the defaults in site.js, overridden by anything the owner has
// saved in-game (stored in the database).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { ABOUT, PROJECTS, RESUME, CONTACT } from './site';

const DEFAULTS = { about: ABOUT, projects: PROJECTS, resume: RESUME, contact: CONTACT };

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const [saved, setSaved] = useState({});

  useEffect(() => {
    api.getContent().then(setSaved).catch(() => { /* offline: defaults are fine */ });
  }, []);

  const save = useCallback(async (key, data) => {
    await api.saveContent(key, data);
    setSaved(s => ({ ...s, [key]: data }));
  }, []);

  const reset = useCallback(async (key) => {
    await api.resetContent(key);
    setSaved(s => {
      const next = { ...s };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    content: { ...DEFAULTS, ...saved },
    isCustom: (key) => key in saved,
    defaults: DEFAULTS,
    save,
    reset,
  }), [saved, save, reset]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
