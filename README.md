
  # Ghost Sightings Reporting Website

  This is a code bundle for Ghost Sightings Reporting Website. The original project is available at https://www.figma.com/design/uXdTavqw2clySvEVZhy4JS/Ghost-Sightings-Reporting-Website.

  ## Running the code
  ## Running the code (development)

  This repository contains a Vite React frontend and a small Express backend (in the `backend/` folder). The backend uses SQLite for local development by default and will initialize the database from `backend/db_init.sql` on first run.

  1) Install dependencies (root + backend)

  ```powershell
  # from repo root
  npm install
  # install backend deps (optional if you already ran the command above)
  Set-Location .\backend
  npm install
  Set-Location ..
  ```

  2) Start frontend only

  ```powershell
  npm run dev
  # frontend served by Vite (defaults to http://localhost:3000)
  ```

  3) Start backend only

  ```powershell
  Set-Location .\backend
  npm start
  # backend listens on http://localhost:8100 by default
  ```

  4) Start both (single command)

  ```powershell
  # from repo root
  npm run dev:all
  ```

  Notes:
  - The dev server uses SQLite by default. The database file is `dev.sqlite` (ignored by .gitignore).
  - To use MySQL in production, set environment variables `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`, and set `USE_SQLITE=false` or `NODE_ENV=production` before starting the backend.
  - If you want to change the backend URL the frontend calls, set `VITE_API_URL` in an `.env` file (for example `VITE_API_URL=http://localhost:8100`).

  