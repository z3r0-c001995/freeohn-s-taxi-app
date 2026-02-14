# 🚗 Ride-Hailing App - Quick Start & Test Users

## 📱 Dual Android Apps (Same Device)

Use the release APKs built for separate app variants:

- `artifacts/apk/freeohn-seeker-release.apk` (Service Seeker app)
- `artifacts/apk/freeohn-driver-release.apk` (Driver app)

Install both on one Android phone:

```bash
adb install -r artifacts/apk/freeohn-seeker-release.apk
adb install -r artifacts/apk/freeohn-driver-release.apk
```

They install side-by-side because package IDs are different.

### Driver Login (Company-Registered)

The driver app blocks self-registration. A pre-registered demo driver is seeded automatically on first launch of the driver variant:

- **Phone**: `5551234567`
- **Name**: `Demo Driver`
- **Vehicle**: `Toyota Prius` / `KAA111A`

OTP is mocked in current build, so any 6-digit code is accepted for this test flow.

### Service Seeker Registration

Use the seeker app to register a rider with any valid phone number format and complete profile setup.

## 🧪 Android Emulator Dev Workflow (No Rebuild Every Change)

Run this once:

```bash
npm run emulator:setup
npm run emulator:start
npm run android:dev:install
```

Then day-to-day development:

```bash
npm run android:dev
```

What this does:

- Starts backend on port `3000`
- Starts Expo Metro on an open host port (default starts from `8090`)
- Uses Android emulator API URL `http://10.0.2.2:3000` so both apps talk to the same backend
- Sets up `adb reverse` so device `localhost:8081` maps to the chosen host Metro port, and `3000` maps to backend
- Lets both installed debug variants use live JS reload instead of rebuilding APKs each time

## 🌐 Internet Mode (Two phones, real network)

Set a public/reachable backend URL before starting Metro or building APKs:

```bash
export API_BASE_URL="https://your-server-domain.com"
export EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL"
export EXPO_PUBLIC_OAUTH_SERVER_URL="$API_BASE_URL"
```

Then run dev or rebuild APKs:

```bash
npm run android:dev
# or
npm run build:apk:both
```

Both apps must point to the same backend URL to communicate across devices.

Launch app variants on emulator:

```bash
adb shell monkey -p space.manus.ride.hailing.app.t20260201043515.seeker -c android.intent.category.LAUNCHER 1
adb shell monkey -p space.manus.ride.hailing.app.t20260201043515.driver -c android.intent.category.LAUNCHER 1
```

If your emulator is extremely slow or never finishes booting, enable CPU virtualization (VT-x/AMD-V) in BIOS and make sure `/dev/kvm` is available on Linux.

## 🎉 Application Features

Your ride-hailing app is now **live** with all features implemented:

✅ **Real-time Chat** - Message between riders and drivers  
✅ **Driver Online/Offline System** - Toggle availability  
✅ **Destination Search & Ride Requests** - Interactive location selection  
✅ **Real-time Location Tracking** - GPS tracking during rides  
✅ **Fare Calculation** - Dynamic pricing based on distance  
✅ **Ride History** - Track all past rides  
✅ **Driver Ratings** - Rate and review experience

---

## 🌐 Access the App

### Web Version
**URL**: http://localhost:8083
Open in your browser and navigate through:
- Home screen with ride requests
- Chat tab for messaging
- Driver toggle for online/offline status
- Active ride tracking

### Mobile Version
```bash
# Android (requires emulator or device)
npm run android

# iOS (requires macOS)
npm run ios

# Web (current)
npm run dev:metro
```

---

## 👤 Test User Accounts

Since the app uses OAuth authentication, here are **mock user profiles** for testing different scenarios:

### **Test User 1: Rider (You)**
- **Name**: John Rider
- **Email**: john.rider@example.com
- **Role**: Passenger/Rider
- **Status**: Looking for rides
- **Testing Goal**: Request rides and chat with drivers
- **Flow**:
  1. Open app
  2. Click "Request Ride"
  3. Select pickup (current location)
  4. Select dropoff location
  5. Choose ride type (Standard/Premium)
  6. See fare estimate
  7. Request ride
  8. Chat with driver
  9. Rate experience

### **Test User 2: Driver (Alice) - ONLINE**
- **Name**: Alice Driver
- **Email**: alice.driver@example.com  
- **Role**: Driver
- **Status**: 🟢 Online & Accepting Rides
- **Rating**: ⭐⭐⭐⭐⭐ 4.8 (156 completed rides)
- **Location**: Nairobi CBD
- **Testing Goal**: Accept rides, track location, complete rides
- **Flow**:
  1. Login as Alice
  2. Toggle "Go Online" on home screen
  3. Receive ride requests in real-time
  4. View rider details and route
  5. Accept incoming ride
  6. Track real-time location
  7. Complete ride
  8. Chat with rider
  9. Rate rider

### **Test User 3: Driver (Bob) - OFFLINE**
- **Name**: Bob Driver
- **Email**: bob.driver@example.com
- **Role**: Driver
- **Status**: 🔴 Offline (Not Available)
- **Rating**: ⭐⭐⭐⭐ 4.6 (127 completed rides)
- **Location**: Westlands, Nairobi
- **Testing Goal**: Test offline mode and profile
- **Flow**:
  1. Login as Bob
  2. View offline profile
  3. Toggle "Go Online" to activate
  4. Receive notifications
  5. Toggle back offline

### **Test User 4: Admin**
- **Name**: Admin User
- **Email**: admin@example.com
- **Role**: Administrator
- **Status**: System access
- **Testing Goal**: System management and monitoring
- **Permissions**: Full access to all features

---

## 📋 Test Scenarios & Use Cases

### Scenario 1: Basic Ride Request
**Duration**: 5 minutes

1. **Login as John Rider**
   - Open http://localhost:8083
   - (OAuth will redirect - use test account)

2. **Request Ride**
   - Tap "Request Ride" button
   - Current location: Nairobi (-1.2864, 36.8172)
   - Dropoff: Airport (-1.3194, 36.9272)
   - Fare estimate: ~KSh 450
   - Select "Standard" ride type
   - Tap "Request Ride"

3. **Accept Ride (as Driver)**
   - Switch to Alice Driver account
   - Go online (toggle button)
   - See "1 Available Request"
   - Accept John's ride
   - View route to pickup

4. **Chat**
   - Tap Chat tab
   - John messages: "Hi, ETA?"
   - Alice replies: "5 minutes away"

5. **Complete Ride**
   - Alice clicks "Start Ride"
   - Track location updates
   - Click "Complete Ride" at destination
   - John rates Alice: ⭐⭐⭐⭐⭐ "Great driver!"

### Scenario 2: Premium Ride
**Duration**: 3 minutes

1. John requests premium ride
2. Fare: +20% (KSh 540)
3. Wait for Alice to accept
4. Premium features: Priority, Better vehicle

### Scenario 3: Offline Driver
**Duration**: 2 minutes

1. Login as Bob Driver
2. Note: Status = Offline (no rides received)
3. Toggle "Go Online"
4. Instantly available for rides
5. Toggle back offline
6. Stops receiving requests

### Scenario 4: Chat History
**Duration**: 2 minutes

1. During active ride, both users chat
2. Messages saved in database
3. Visible in Chat tab
4. Persist after ride completes
5. Shows timestamps and user names

### Scenario 5: Multiple Drivers
**Duration**: 5 minutes

1. Request ride as John
2. Alice and Bob both online
3. Closest driver accepted first
4. Others see "Ride accepted by another driver"
5. Notified in real-time

---

## 🗄️ Database Information

### Tables Created
```
users              - User accounts & profiles
driver_profiles    - Driver ratings & stats
rides              - Ride bookings & history
messages           - Chat messages
ratings            - Experience reviews
location_history   - GPS tracking data
transactions       - Payment records
```

### Location: 
- **SQLite File**: `ridehaul.db` (created on first app load)
- **Schema**: `drizzle/schema.ts`
- **Migrations**: `drizzle/migrations/`

---

## 🎯 Key Features to Test

| Feature | Test As | Expected Result |
|---------|---------|-----------------|
| Request Ride | Rider | Can see fare estimate and request |
| Accept Ride | Driver (Online) | Receives notification instantly |
| Chat | Both | Can exchange messages real-time |
| Location Track | Driver | Updates position every 5-10s |
| Go Online/Offline | Driver | Status toggles, requests respond |
| Ride History | Both | Saves all completed rides |
| Ratings | Both | Can rate after ride completes |
| Premium Ride | Rider | 20% fare increase option |

---

## 🔧 Troubleshooting Test Users

### Can't Find Test User?
- User accounts are created on first app load
- Check database at: `~/.expo/ridehaul.db`

### Chat Not Working?
- Ensure active ride exists
- Both users must be online
- Check browser console for errors

### Location Not Updating?
- Enable location permission
- Driver must be online
- GPS updates every 5-10 seconds

### Ride Not Showing Up?
- Driver must be online
- Check driver's location range
- Verify ride request parameters

---

## 💡 Testing Tips

### 1. **Multi-Device Testing**
- Open two browser windows
- One as rider, one as driver
- See real-time updates

### 2. **Speed Testing**
- Send rapid chat messages
- Create multiple ride requests
- Observe database performance

### 3. **Location Testing**
- Track driver movement
- Verify distance calculations
- Test fare calculation formula

### 4. **Error Testing**
- Request ride with no driver online
- Chat without active ride
- Complete ride without starting
- Toggle online mid-ride

### 5. **Performance Testing**
- Load test with multiple users
- Check battery impact (on mobile)
- Monitor database size
- Test chat with large message history

---

## 📊 App Statistics (Expected)

- **Load Time**: < 3 seconds
- **Chat Latency**: < 100ms
- **Location Update**: 5-10 seconds
- **Ride Accept**: < 2 seconds
- **Database Size**: ~5-10MB per 1000 rides

---

## 🚀 Next Steps

### Phase 1: Testing (Now)
- ✅ Test all user scenarios
- ✅ Verify chat functionality
- ✅ Test driver online/offline
- ✅ Check location tracking

### Phase 2: Mobile Build
```bash
# Android APK
npm run build:apk

# iOS (macOS only)
npm run build:ios
```

### Phase 3: Deployment
- Build production APK/IPA
- Submit to Google Play Store
- Submit to Apple App Store
- Configure backend APIs

### Phase 4: Production
- Scale database
- Add payment processing
- Implement real OAuth
- Monitor performance

---

## 📞 Support & Info

**Issues?**
1. Check browser console: F12 → Console tab
2. Check app logs in terminal
3. Verify database: `sqlite3 ridehaul.db`
4. Review code: `app/` directory

**Questions?**
- See `SETUP_COMPLETE.md` for installation
- See `EXPO_SETUP.md` for environment setup
- See `EXPO_READY.md` for feature list
- See `BUILD_README.md` for build process

---

## 🎓 Architecture Overview

```
┌─────────────────────────────────────┐
│     React Native + Expo (UI)        │
├─────────────────────────────────────┤
│  Zustand (State)  + NativeWind (UI) │
├─────────────────────────────────────┤
│   SQLite Database (Offline-First)   │
├─────────────────────────────────────┤
│  React Query (Data Sync)            │
├─────────────────────────────────────┤
│  Location Service + Maps            │
└─────────────────────────────────────┘
```

---

**Happy Testing! 🎉** Your ride-hailing app is ready to roll! 🚗
