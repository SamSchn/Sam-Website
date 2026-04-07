const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Request failed');
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
  getPlantTypes: () => request('/garden/types'),
  plantSeed: (title, description, plant_type, grid_x, grid_y) =>
    request('/garden/plant', { method: 'POST', body: JSON.stringify({ title, description, plant_type, grid_x, grid_y }) }),
  waterPlant: (id) =>
    request(`/garden/${id}/water`, { method: 'POST' }),
  witherPlant: (id) =>
    request(`/garden/${id}/wither`, { method: 'POST' }),
  revivePlant: (id) =>
    request(`/garden/${id}/revive`, { method: 'POST' }),
  sunshinePlant: (id) =>
    request(`/garden/${id}/sunshine`, { method: 'POST' }),
  deletePlant: (id) =>
    request(`/garden/${id}`, { method: 'DELETE' }),
  updateGardenSettings: (grid_width, grid_height) =>
    request('/garden/settings', { method: 'PUT', body: JSON.stringify({ grid_width, grid_height }) }),

  // Tile Maps
  getTileMaps: () => request('/tilemap'),
  getTileMap: (id) => request(`/tilemap/${id}`),
  createTileMap: (name, width, height) =>
    request('/tilemap', { method: 'POST', body: JSON.stringify({ name, width, height }) }),
  updateTileMap: (id, data) =>
    request(`/tilemap/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTileMap: (id) =>
    request(`/tilemap/${id}`, { method: 'DELETE' }),
  saveTileMapCells: (id, cells) =>
    request(`/tilemap/${id}/cells`, { method: 'PUT', body: JSON.stringify({ cells }) }),
  deleteTileMapCells: (id, cells) =>
    request(`/tilemap/${id}/cells`, { method: 'DELETE', body: JSON.stringify({ cells }) }),
};
