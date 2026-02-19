# Freeohn's Ride App UI Redesign (Rider + Driver)

## Brand Palette

- Orange (primary rider action): `#F97316`
- Blue (primary driver accent / secondary rider action): `#1E40AF`
- Text: `#0F172A`
- Muted text: `#64748B`
- Surface: `#FFFFFF`
- Background: `#F7FAFF` (rider), `#F6F8FC` (driver)
- Border: `#E2E8F0`

Source: `constants/design-system.ts`

## Reusable UI Components

- `AppButton` (`components/ui/app-button.tsx`)
  - Variants: `primary`, `secondary`, `outline`, `danger`, `success`, `ghost`
  - Sizes: `sm`, `md`, `lg`
  - Supports loading state and optional icons
- `AppCard` (`components/ui/app-card.tsx`)
  - Tones: `default`, `muted`, `accent`, `primary`
  - Shared rounded corners + soft shadow
- `AppInput` (`components/ui/app-input.tsx`)
  - Label/hint/error support
  - Validation styling through `error`
- `AppBadge` (`components/ui/app-badge.tsx`)
  - Tone-based status chips for realtime/status labels

## Screen Breakdown

### Rider

- Onboarding: hero + CTA (`app/(auth)/onboarding.tsx`)
- Login: phone entry + validation (`app/(auth)/phone-entry.tsx`)
- OTP: verification + resend (`app/(auth)/otp-verification.tsx`)
- Profile setup: signup completion (`app/(auth)/profile-setup.tsx`)
- Home: map preview, booking CTA, safety/history shortcuts (`app/(tabs)/index.tsx`)
- Request ride:
  - Native/Android/iOS: `app/request-ride.tsx`
  - Web: `app/request-ride.web.tsx`
- Trip lifecycle UI: matching, assigned driver, in-trip, SOS, rating (`app/trip/[id].tsx`)
- Payment summary: fare breakdown + method (`app/payment.tsx`)
- Ride history: expandable past rides (`app/ride-history.tsx`)

### Driver

- Onboarding/login/OTP: operational driver access (`app/(auth)/onboarding.tsx`, `app/(auth)/phone-entry.tsx`, `app/(auth)/otp-verification.tsx`)
- Dashboard: online/offline toggle, map, incoming requests, trip actions (`app/driver-dashboard.tsx`)
- Earnings: daily, weekly chart, trip list (`app/driver-earnings.tsx`)

## Map Visual Language

- Native map markers and route colors: `components/maps/RideMap.tsx`
- Web map markers and route colors: `components/maps/RideMap.web.tsx`
- Driver/user/pickup/dropoff colors are variant-aware from `constants/design-system.ts`

## Suggested Folder Structure (UI Layer)

```text
components/
  ui/
    app-button.tsx
    app-card.tsx
    app-input.tsx
    app-badge.tsx
  maps/
    RideMap.tsx
    RideMap.web.tsx

constants/
  design-system.ts

hooks/
  use-brand-theme.ts

app/
  (auth)/
  (tabs)/
  request-ride.tsx
  request-ride.web.tsx
  trip/[id].tsx
  payment.tsx
  ride-history.tsx
  driver-dashboard.tsx
  driver-earnings.tsx
```

## Backend Compatibility

- No backend endpoints changed.
- Existing API calls are reused in all redesigned screens:
  - trip creation/estimate/dispatch/status
  - driver online/offline, accept/decline/start/complete
  - safety actions (share/SOS)
  - realtime trip updates

