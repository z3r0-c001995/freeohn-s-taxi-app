# Freeohn's Yango-like Refactor Plan

## Current codebase snapshot
- Mobile app is Expo Router with auth screens under `app/(auth)` and role-aware flows under `app/(tabs)`.
- Current trip logic is mostly local (Expo SQLite + Zustand) via `lib/db.ts` and `lib/db-service.ts`.
- Backend server exists (`server/_core/index.ts`) with OAuth/auth support and tRPC.
- Existing backend has no ride-hailing lifecycle FSM, no dispatch lock handling, and no safety/route-share APIs.

## Target backend architecture
- `server/modules/trips`: lifecycle FSM + trip orchestration.
- `server/modules/dispatch`: nearest-driver matching and offer/accept timeout flow.
- `server/modules/location`: SSE publishing of trip/driver updates.
- `server/modules/payments`: payment abstraction (`CASH` active, pluggable for card/mobile money).
- `server/modules/pricing`: snapshot fare calculator.
- `server/modules/safety`: SOS/support incidents + revocable route sharing.
- `server/modules/ratings`: post-trip rating and rolling weighted driver rating.
- `server/modules/platform`: in-memory repository + idempotency and locking.
- `server/modules/http`: auth, rate-limit, REST API routing.

## Migration plan (DB)
1. Apply `drizzle/migrations/0001_yango_refactor.sql`.
2. Backfill from legacy tables:
   - `driver_profiles -> drivers + driver_status`
   - `rides -> trips`
3. Verify row counts and index usage.
4. Switch write traffic to new `trips` model.
5. Keep legacy reads in compatibility mode during rollout.
6. After stable period, deprecate legacy write paths.

## Refactor stages
### Stage 1: Domain modules
- Added strict trip FSM, dispatch service, pricing, payment abstraction, safety, ratings.
- Added structured logs + metrics counters.

### Stage 2: HTTP APIs
- Added passenger endpoints:
  - `POST /api/trips/estimate`
  - `POST /api/trips`
  - `GET /api/trips/:tripId`
  - `POST /api/trips/:tripId/cancel`
  - `POST /api/trips/:tripId/share`
  - `POST /api/trips/:tripId/sos`
  - `POST /api/trips/:tripId/rate`
- Added driver endpoints:
  - `POST /api/admin/drivers/register` (company owner/admin registers driver accounts)
  - `POST /api/admin/drivers/:driverId/verify` (verification gate before online status)
  - `POST /api/driver/status`
  - `GET /api/driver/requests`
  - `POST /api/driver/requests/:offerId/accept`
  - `POST /api/driver/requests/:offerId/decline`
  - `POST /api/trips/:tripId/arrived`
  - `POST /api/trips/:tripId/start`
  - `POST /api/trips/:tripId/complete`
  - `POST /api/driver/location`
- Added live updates:
  - `GET /api/stream/trips/:tripId` (SSE)
  - Polling fallback through `GET /api/trips/:tripId`.

### Stage 3: Safety features
- Revocable share links (`/api/share/:token` public view).
- SOS/support incident creation with support contacts in response.
- Driver verification guard before `online=true`.
- Rider app registration is service-seeker only; driver onboarding is owner-managed.

### Stage 4: Android integration (next incremental PRs)
- Move ride request + active trip screen from local SQLite to `/api/trips`.
- Add Safety Center screen and SOS/Share CTA.
- Add driver request card + countdown accept flow.
- Replace local polling for active rides with SSE/poll hybrid hook.

## Test plan
- Unit tests:
  - FSM transition validation.
  - Dispatch accept/timeout behavior.
- Integration tests:
  - Rider creates trip -> matching -> driver accept.
  - PIN verification start flow.
  - Completion + rating updates.

Run:
```bash
npx pnpm check
npx pnpm test
```
