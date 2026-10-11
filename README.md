# Sam's Valley

A personal website that's a little Stardew Valley–style village. Instead of pages, visitors walk around: the village is the home page and each building is a part of the site.

- **Village** (`/`): the outdoor hub with houses, a town square, a pond and villagers to talk to
- **Sam's house** (`/house`): every piece of furniture opens something: the portrait (About), the bookshelf (Projects), the desk (Resume), the letters and the mailbox outside (Contact), the TV (News) and the bulletin board
- **Garden** (`/garden`): walk east from the village. Each plant is one of Sam's ideas, planted in tilled beds. Plants grow one stage each time they're watered (anyone can water a plant once its soil dries), and they wilt, then wither, if left dry. The owner picks the crop and the growth and wither speeds when planting. Growth is worked out from timestamps (`backend/garden/growth.js`), so there's no background job
- **Editor** (`/editor`, owner only): paint terrain, place, move and configure objects and villagers, then save

## How it fits together

- `frontend/src/game/engine/` is the PixiJS world: rendering, depth sorting, collisions, click-to-walk pathfinding, interactions, door warps, real-time day/night lighting, villagers and ambient life
- `frontend/src/game/maps/` holds the built-in maps, written in code. The editor saves edited copies to the database, and the game prefers a saved copy over the built-in one ("Revert to built-in" deletes the saved copy)
- `frontend/src/game/sprites.js` is the catalog of placeable objects (sprite, collision, lights, doors)
- `frontend/src/game/content/site.js` holds the default text for About, Projects, Resume and Contact. When you're logged in, each of those panels has an **Edit this page** button that saves your version to the database
- `frontend/scripts/generateCustomProps.py` draws the extra pixel art (bulletin board, TV, UI frame, icons...). Run it with Pillow installed to regenerate

## Tech Stack

- **Frontend:** React 19, Vite, React Router, PixiJS 8
- **Backend:** Node.js, Express, SQLite (better-sqlite3), JWT and bcrypt auth

## Getting Started

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set a strong JWT_SECRET (required for `npm start`;
# `npm run dev` falls back to a local-only secret)
```

Only the first account can register; after that, registration is closed unless
`ALLOW_REGISTRATION=true` is set.

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

## Notes

- Log in from the in-game menu (Esc → Owner login). Only the first account can register
- Add `?hour=22` to any URL to preview the village at night
