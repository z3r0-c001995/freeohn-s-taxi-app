# Map: Place-Name Search + Visual Improvements

## Overview

Two focused improvements:
1. **Place-Name Search** — The `request-ride` screen's address row shows static text. Wire in the existing [PlaceSearchInput](file:///home/mr_robot/Desktop/Work/code/components/places/PlaceSearchInput.tsx#16-125) autocomplete component with a premium redesigned UI.
2. **Map Visuals** — Upgrade from plain CARTO raster tiles to a styled dark/premium vector tile map, improve markers (pulsing user dot, labeled pickup/dropoff pins, better car icon), and thicken the route line with a casing.

---

## Proposed Changes

### Place Search UI

#### [MODIFY] [PlaceSearchInput.tsx](file:///home/mr_robot/Desktop/Work/code/components/places/PlaceSearchInput.tsx)
- Full brand-theme styling (use `useBrandTheme`)
- Floating dropdown results with shadow, rounded bottom corners, max-height scroll
- Each result shows icon (location pin), bold main text, grey secondary text
- Loading spinner row + error/empty states styled consistently
- Dismiss dropdown on backdrop tap (blur delay stays)

#### [MODIFY] [request-ride.tsx](file:///home/mr_robot/Desktop/Work/code/app/request-ride.tsx)
- Replace the static address display card with two [PlaceSearchInput](file:///home/mr_robot/Desktop/Work/code/components/places/PlaceSearchInput.tsx#16-125) fields stacked:
  - Top: Pickup (orange dot) pre-filled with current location address
  - Bottom: Drop-off (blue dot) placeholder "Where to?"
- Connected with a vertical dashed separator line between them
- Map height reduced slightly to give the inputs more breathing room
- Inputs float **above** the map in a card overlay (Uber-style top card)

### Map Visuals

#### [MODIFY] [RideMap.web.tsx](file:///home/mr_robot/Desktop/Work/code/components/maps/RideMap.web.tsx)
- **Map style**: Switch CARTO raster fallback to a premium dark vector style using the free `protomaps` tiles (no API key needed) or upgrade to a styled CARTO dark vector URL. Use `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` as the vector tile style — elegantly dark like Uber's night mode.
- **User location marker**: Pulsing animated ring (CSS keyframe `@keyframes pulse`) — blue/primary dot with glowing ring
- **Pickup marker**: Green upward-pointing pin SVG with a white border and subtle drop shadow
- **Dropoff marker**: Orange diamond/pin SVG, branded color
- **Driver markers**: Black rounded pill with a 🚗 emoji and subtle glow — larger (36×36px)
- **Route line**: Add a white casing below the colored route line (two layers: white at width 7, colored at width 4) for depth
- **Map zoom**: Start at zoom 14 (tighter) for better street detail

#### [MODIFY] [RideMap.tsx](file:///home/mr_robot/Desktop/Work/code/components/maps/RideMap.tsx) *(native)*
- Replace plain `pinColor` markers with custom `<View>` marker elements for pickup (green) and dropoff (orange)
- Driver markers: improve the car icon container with a larger size and shadow
- Route line: increase `strokeWidth` to 5, add `lineDashPattern` for in-progress trips

---

## Verification Plan

### Manual (Browser)
1. Open request-ride screen → both pickup and dropoff fields should be searchable inputs
2. Type 3+ chars → autocomplete dropdown appears with branded styling  
3. Select a place → map pan/zooms to show route between pickup and dropoff
4. Verify dark map style loads on web
5. Verify markers are distinct and legible
