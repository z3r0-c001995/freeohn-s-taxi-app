# Seeker Onboarding & Persistence Fix — Walkthrough

## What Was Done

All five code changes from the implementation plan were completed successfully.

### Changes Made

| File | Change |
|---|---|
| [lib/db-service.ts](file:///home/mr_robot/Desktop/Work/code/lib/db-service.ts) | [createUser](file:///home/mr_robot/Desktop/Work/code/lib/db-service.ts#10-39) now stores phone as digits-only (`replace(/\D/g, "")`) in the `openId` field, ensuring consistent lookups |
| [app/(auth)/otp-verification.tsx](file:///home/mr_robot/Desktop/Work/code/app/%28auth%29/otp-verification.tsx) | Normalizes the phone before the local DB lookup so returning riders are matched and redirected to Home, not profile-setup |
| [app/(auth)/profile-setup.tsx](file:///home/mr_robot/Desktop/Work/code/app/%28auth%29/profile-setup.tsx) | [buildFallbackUser](file:///home/mr_robot/Desktop/Work/code/app/%28auth%29/profile-setup.tsx#29-44) now also normalizes the phone, keeping the web fallback path consistent |
| [lib/store.ts](file:///home/mr_robot/Desktop/Work/code/lib/store.ts) | [hydrate](file:///home/mr_robot/Desktop/Work/code/lib/store.ts#140-172) now revives `Date` objects in both `currentUser` and `activeRide` after `JSON.parse`, preventing stale/null date fields |
| [app/_layout.tsx](file:///home/mr_robot/Desktop/Work/code/app/_layout.tsx) | `hydrateTimeoutMs` increased to `10000ms` on web, giving state time to fully restore before routing decisions are made |
| [app/(tabs)/index.tsx](file:///home/mr_robot/Desktop/Work/code/app/%28tabs%29/index.tsx) | Added `await persist()` after every [setActiveRide](file:///home/mr_robot/Desktop/Work/code/lib/store.ts#115-116) call so ride state survives page refresh |
| [app/driver-dashboard.tsx](file:///home/mr_robot/Desktop/Work/code/app/driver-dashboard.tsx) | Added `await persist()` after [setActiveRide](file:///home/mr_robot/Desktop/Work/code/lib/store.ts#115-116) in offline mode |

---

## Verification Steps (Manual)

The automated browser agent could not be used due to repeated upstream network errors. Both dev servers are confirmed running:

- **Seeker app**: http://localhost:8082
- **Driver app**: http://localhost:8083
- **API**: http://localhost:3000

### Please verify these four scenarios manually in your browser:

#### ✅ Scenario 1 — New Seeker Onboarding
1. Open http://localhost:8082/onboarding
2. Enter phone `+260971000001` → Continue
3. Enter OTP `123456` → Verify
4. Fill in Name "Test Rider" on `/profile-setup` → Submit
5. **Expected**: Redirected to Home screen  

#### ✅ Scenario 2 — Booking Flow
6. Click the ride CTA on Home ("Ride", "Book a Ride", etc.)
7. Type `Manda Hill` as destination, select it
8. Pick a vehicle tier and confirm
9. **Expected**: URL changes to `/trip/[id]`

#### ✅ Scenario 3 — Session Persistence
10. Refresh the page
11. **Expected**: Still on Home (not kicked back to `/onboarding`)

#### ✅ Scenario 4 — Returning User Skips Profile Setup
12. Tap "Reset Profile" debug button on Home
13. Go to `/onboarding`, enter same phone + OTP
14. **Expected**: Goes directly to Home WITHOUT stopping at `/profile-setup`
