# FridgeVoid

FridgeVoid is a React/Vite frontend with an Express/MongoDB backend.

## Local Development

1. Copy `.env.example` to `.env` if you need to change local defaults.
2. Start MongoDB and the backend:

   ```sh
   npm run dev
   ```

3. In a second terminal, start the frontend:

   ```sh
   npm run dev:frontend
   ```

Defaults:

- Frontend: `https://localhost:5173`
- Backend: `http://localhost:8080`
- MongoDB: `mongodb://localhost:27017/fridgevoid`

## Scripts

- `npm run dev` - start local MongoDB with Docker Compose, then start the backend
- `npm run dev:backend` - start only the backend
- `npm run dev:frontend` - start only the frontend
- `npm run mongo:up` - start local MongoDB
- `npm run mongo:down` - stop local MongoDB
- `npm test` - run backend tests
- `npm run build` - build the frontend
