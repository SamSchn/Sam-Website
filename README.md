# Sam's Website

A self-hosted personal website with a news feed and bulletin board for sharing updates with friends.

## Tech Stack

- **Frontend:** React 19 + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3)
- **Auth:** JWT + bcrypt

## Project Structure

```
SamWebsite/
├── backend/
│   ├── server.js           # Express entry point
│   ├── db/init.js          # SQLite setup & schema
│   ├── middleware/auth.js   # JWT auth middleware
│   └── routes/
│       ├── auth.js          # Login/register
│       ├── posts.js         # News post CRUD
│       └── notes.js         # Sticky note CRUD
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── api.js           # API client
        ├── context/         # Auth context
        ├── components/      # Navbar, StickyNote, PostCard
        └── pages/           # Home, Login, Posts, Board
```

## Getting Started

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set a strong JWT_SECRET
```

### 3. Run in development

Open two terminals:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to the backend on port 3002.

### 4. Build for production

```bash
cd frontend && npm run build
cd ../backend && npm start
```

The backend serves the built frontend from `frontend/dist/`.

## Features

- **News posts** — Create, read, update, and delete blog-style updates
- **Bulletin board** — Pin colorful sticky notes for quick messages
- **Authentication** — Register/login with hashed passwords and JWT tokens
- **Self-hosted** — SQLite database, no external services required
