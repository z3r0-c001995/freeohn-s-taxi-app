# Deploy Backend to Render (Public API URL)

This gets your Node API online so seeker + driver apps can communicate through one backend.

## 1) Push this repo to GitHub

Render pulls from GitHub. Push the latest code first.

## 2) Create a Render Web Service

In Render dashboard:
- New -> Web Service
- Connect your GitHub repo
- Use `render.yaml` from this repo (Blueprint) or set values manually:
  - Build command: `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm run build:server`
  - Start command: `npm start`

## 3) Required environment variables

Set these in Render:

- `NODE_ENV=production`
- `JWT_SECRET=<strong-random-secret>`
- `CORS_ALLOWED_ORIGINS=https://freeohn-seeker.expo.app,https://freeohn-driver.expo.app,http://localhost:8081,http://localhost:8090`

For your current OTP/demo auth test flow (no OAuth provider), also set:

- `ALLOW_DEV_AUTH_HEADER=1`

Optional OAuth-related vars (set when you enable real OAuth):

- `OAUTH_SERVER_URL`
- `VITE_APP_ID`
- `OWNER_OPEN_ID`

Optional map/routing vars (recommended for production routing + geocoding):

- `ORS_API_KEY=<your-openrouteservice-key>`
- `ORS_BASE_URL=https://api.openrouteservice.org`
- `ORS_COUNTRY_BIAS=ZM`
- `ORS_TIMEOUT_MS=4500`
- `MAPS_CACHE_TTL_MS=45000`
- `MAPS_RATE_WINDOW_MS=60000`
- `MAPS_RATE_MAX=120`

Optional driver presence / anti-spoof hardening vars:

- `DRIVER_STALE_AFTER_MS=15000`
- `DRIVER_LOCATION_MAX_SPEED_KMH=180`
- `DRIVER_LOCATION_MAX_JUMP_METERS=2000`
- `DRIVER_LOCATION_MAX_JUMP_WINDOW_MS=12000`

## 4) Verify backend is live

After deploy, Render gives a URL like:

- `https://your-api.onrender.com`

Verify:

```bash
curl https://your-api.onrender.com/api/health
```

Expected JSON includes `ok: true`.

## 5) Point both web apps to the same API URL and redeploy

Replace with your Render URL:

```bash
export API_BASE_URL="https://your-api.onrender.com"
export EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL"
export EXPO_PUBLIC_OAUTH_SERVER_URL="$API_BASE_URL"
export EXPO_PUBLIC_MAP_STYLE_URL="https://demotiles.maplibre.org/style.json"
npm run web:export:seeker
npm run web:deploy:seeker

npm run web:export:driver
npm run web:deploy:driver
```

Note: the export scripts clear Metro cache each run to prevent seeker/driver bundle mix-ups.

Both deployed apps will then talk to the same live backend.
