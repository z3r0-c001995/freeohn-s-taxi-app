# Maps API Quickstart

This project now exposes REST endpoints for map features at `/api/maps/*` backed by the existing ORS + fallback map router.

## 1) Configure ORS locally

Use your ORS key in your shell/session (do **not** commit this into git):

```bash
export ORS_API_KEY='eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI1M2Q2MThmYjQ5MTRkMmFiMjYwMzIxOGJhNTFiYWIyIiwiaCI6Im11cm11cjY0In0='
export ORS_COUNTRY_BIAS='ZM'
```

Optional map style config:

```bash
export MAP_STYLE_URL='https://demotiles.maplibre.org/style.json'
export MAP_TILE_ATTRIBUTION='© OpenStreetMap contributors'
```

## 2) API Endpoints

### `GET /api/maps/config`

Returns style/provider settings for MapLibre clients.

### `POST /api/maps/autocomplete`

```json
{
  "query": "East Park Mall",
  "location": { "lat": -15.4067, "lng": 28.2871 }
}
```

### `POST /api/maps/reverse-geocode`

```json
{
  "lat": -15.4067,
  "lng": 28.2871
}
```

### `POST /api/maps/route`

```json
{
  "origin": { "lat": -15.4067, "lng": 28.2871 },
  "destination": { "lat": -15.3305, "lng": 28.4529 },
  "travelMode": "DRIVE"
}
```

## 3) Example cURL checks

```bash
curl -s http://localhost:3000/api/maps/config | jq

curl -s -X POST http://localhost:3000/api/maps/autocomplete \
  -H 'content-type: application/json' \
  -d '{"query":"East Park Mall","location":{"lat":-15.4067,"lng":28.2871}}' | jq
```
