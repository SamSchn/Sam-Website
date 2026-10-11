const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response (e.g. proxy error page) — fall through to status handling
  }

  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  // Auth
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username, password, displayName) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),
  me: () => request('/auth/me'),

  // Posts
  getPosts: () => request('/posts'),
  getPost: (id) => request(`/posts/${id}`),
  createPost: (title, body) =>
    request('/posts', { method: 'POST', body: JSON.stringify({ title, body }) }),
  updatePost: (id, title, body) =>
    request(`/posts/${id}`, { method: 'PUT', body: JSON.stringify({ title, body }) }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),

  // Notes (bulletin board)
  getNotes: () => request('/notes'),
  createNote: (content, color, posX, posY) =>
    request('/notes', { method: 'POST', body: JSON.stringify({ content, color, posX, posY }) }),
  updateNote: (id, data) =>
    request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  // Digital Garden
  getGarden: () => request('/garden'),
  plantSeed: (data) =>
    request('/garden/plant', { method: 'POST', body: JSON.stringify(data) }),
  waterPlant: (id) => request(`/garden/${id}/water`, { method: 'POST' }),
  sunshinePlant: (id) => request(`/garden/${id}/sunshine`, { method: 'POST' }),
  updatePlant: (id, data) =>
    request(`/garden/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlant: (id) => request(`/garden/${id}`, { method: 'DELETE' }),

  // Site content (owner-edited About / Projects / Resume / Contact)
  getContent: () => request('/content'),
  saveContent: (key, data) =>
    request(`/content/${key}`, { method: 'PUT', body: JSON.stringify({ data }) }),
  resetContent: (key) => request(`/content/${key}`, { method: 'DELETE' }),

  // Game maps (editor-saved copies of the built-in village maps)
  getGameMap: (id) => request(`/game-maps/${id}`),
  saveGameMap: (id, data) =>
    request(`/game-maps/${id}`, { method: 'PUT', body: JSON.stringify({ data }) }),
  resetGameMap: (id) => request(`/game-maps/${id}`, { method: 'DELETE' }),
};
