# FridgeVoid Backend

Express and MongoDB API for the FridgeVoid frontend.

## Scripts

- `npm run dev` - start the API with nodemon
- `npm start` - start the production server
- `npm run start:prod` - production start alias
- `npm test` - run API compatibility and route tests

From the repository root:

- `npm run dev` - start local MongoDB with Docker Compose, then start the backend
- `npm run dev:frontend` - start the Vite frontend
- `npm run mongo:up` - start only MongoDB
- `npm run mongo:down` - stop local MongoDB

## Environment

Backend configuration is loaded from the repository root `.env`.
Use the root `.env.example` as the template.

Important variables:

| Variable | Description |
|---|---|
| `BACKEND_HOST`, `BACKEND_PORT` | API bind address and port |
| `MONGODB_URI` | Full MongoDB connection string |
| `MONGO_HOST`, `MONGO_PORT`, `MONGO_DATABASE`, `MONGO_USERNAME`, `MONGO_PASSWORD` | MongoDB component values used when `MONGODB_URI` is not set |
| `UPLOAD_DIR`, `MAX_UPLOAD_SIZE` | Uploaded image storage and file size limit |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origin patterns |
| `LEFTOVER_STATUS_EXPIRING_DAYS`, `LEFTOVER_STATUS_USE_SOON_DAYS` | Derived status thresholds |
| `LEFTOVER_RECOVERY_DAYS` | Soft-delete restore window |
| `LEFTOVER_DEFAULT_LOCATION` | Default location when none is supplied |

## API Surface

The frontend uses these route groups:

- `/leftovers` and `/api/leftovers`
- `/locations` and `/api/locations`
- `/presets` and `/api/presets`
- `/scanned-products` and `/api/scanned-products`
- `/uploads` and `/api/uploads`
- `/preferences` and `/api/preferences`
- `/theme` and `/api/theme`

The `/api/*` aliases support deployments where the frontend is configured with `VITE_API_BASE_URL=/api`. The root routes are kept for existing frontend production fallbacks and direct API usage.

No authentication middleware is currently enabled because the frontend does not send tokens or call auth endpoints.
