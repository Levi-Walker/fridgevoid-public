# FridgeVoid

FridgeVoid is a work-in-progress leftover tracker for keeping a small household fridge, freezer, or pantry inventory visible. It is currently built as a React/Vite frontend with an Express/MongoDB backend.

The app lets you add leftovers, assign expiration dates, group food by location, tag items, save recurring presets, mark food as used up, and restore recently removed items. Cards can use either uploaded food photos or an emoji visual. When no photo is used, the selected emoji becomes the card's visual background/fallback, which keeps the inventory scannable without requiring every item to have a personal image.

This project is still actively evolving. The current Docker Compose setup is used for local MongoDB. As the project continues, I plan to fully dockerize the application so the frontend, backend, and database can be started together in a production-like container setup.

## Project Layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React/Vite app for the inventory UI, settings, presets, barcode/dev tools, themes, and item visual picker. |
| `backend/` | Express API with MongoDB models, routes, services, uploads, preferences, and test coverage. |
| `scripts/dev.js` | Root development launcher used by `npm run dev` to start backend and frontend together. |
| `docker-compose.yml` | Local MongoDB service for development. Full app Dockerization is planned. |
| `uploaded-images/` | Local user-uploaded item images. This folder is ignored because it contains personal runtime data. |

## Current Features

- Inventory cards for leftovers with expiration status, location, tags, container, notes, and quick remove/edit actions.
- Emoji or image visuals for each item, including an emoji background/fallback when no photo is attached.
- Presets for foods that are added repeatedly, including shelf-life defaults.
- Settings for locations, status labels/order, default visual behavior, and UI colors.
- Image upload/camera capture support for item photos.
- Barcode scanning/dev tooling for scanned product workflows.
- Express routes for leftovers, locations, presets, scanned products, uploads, preferences, theme settings, and development helpers.

## Local Development

1. Copy `.env.example` to `.env` if you need to change local defaults.
2. Start the full app:

   ```sh
   npm run dev
   ```

Defaults:

- Frontend: `https://localhost:5173`
- Backend: `http://localhost:8080`
- MongoDB: `mongodb://localhost:27017/fridgevoid`

## Scripts

| Command | What it does | When to use it |
| --- | --- | --- |
| `npm run dev` | Starts the full local app: MongoDB, backend API, and frontend dev server. | Use this for normal local development. |
| `npm run dev:frontend` | Starts only the Vite frontend dev server. | Use this when the backend is already running. |
| `npm run dev:backend` | Starts MongoDB, then starts only the backend API. | Use this when you only need the API. |
| `npm run mongo:up` | Starts the local MongoDB container. | Use this if you only need the database. |
| `npm run mongo:down` | Stops the local MongoDB container. | Use this when you are done developing. |
| `npm test` | Runs the backend test suite. | Use this before committing backend changes. |
| `npm run build` | Builds the frontend for production. | Use this to verify the frontend compiles. |
