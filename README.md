
  # Ghost Sightings Reporting Website

  ## Running the code (development)

  This repository contains a Vite React frontend and a small Express backend (in the `backend/` folder). The backend uses SQLite for local development by default and will initialize the database from `backend/db_init.sql` on first run.

  1) Install dependencies (root + backend)

  ```powershell
  # from repo root
  npm install
  cd backend
  npm install
  cd ..
  ```

  2) Start frontend only

  (ensure at project root)
  ```powershell
  npm run dev
  # frontend served by Vite (defaults to http://localhost:3000)
  ```

  3) Start backend only

  ```powershell
  cd backend
  npm start
  # backend listens on https://ghost-report-backend.azurewebsites.net by default
  ```

Both the frontend and backend must be running at the same time for the application to work. 

  Notes:
  - The dev server uses SQLite by default. The database file is `dev.sqlite` (ignored by .gitignore).
  - To use MySQL in production, set environment variables `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`, and set `USE_SQLITE=false` or `NODE_ENV=production` before starting the backend.
  - If you want to change the backend URL the frontend calls, set `VITE_API_URL` in an `.env` file (for example `VITE_API_URL=https://ghost-report-backend.azurewebsites.net`).

## Running the code (cloud)
The cloud server is still in development and is not ready at this moment.