# Ride-Hailing App - Test User Credentials

## Overview
The app is now running on `http://localhost:8083` with all new features implemented:
- ✅ Real-time Chat functionality
- ✅ Driver Online/Offline system
- ✅ Destination search with interactive ride requests
- ✅ Real-time location tracking and route calculation

## Authentication
The app uses OAuth-based authentication through Manus. Since this is running locally without a configured OAuth server, you can test the app with the following approaches:

### Option 1: Direct Database Insert (For Testing)
You can directly insert test users into the SQLite database for immediate testing:

```bash
# Open SQLite database
sqlite3 data.db

# Insert test users
INSERT INTO users (openId, name, email, role, loginMethod) VALUES 
('oauth_rider_001', 'John Rider', 'john@rider.com', 'user', 'oauth');

INSERT INTO users (openId, name, email, role, loginMethod) VALUES 
('oauth_driver_001', 'Alice Driver', 'alice@driver.com', 'user', 'oauth');

INSERT INTO users (openId, name, email, role, loginMethod) VALUES 
('oauth_driver_002', 'Bob Driver', 'bob@driver.com', 'user', 'oauth');

INSERT INTO driver_profiles (userId, rating, totalRides, onlineStatus, currentLatitude, currentLongitude) VALUES
((SELECT id FROM users WHERE openId='oauth_driver_001'), 4.8, 150, 1, -1.2864, 36.8172),
((SELECT id FROM users WHERE openId='oauth_driver_002'), 4.6, 120, 0, -1.2965, 36.8245);
```

## Test User Scenarios

### Scenario 1: Rider Requesting a Ride
**User**: John Rider
- **Email**: john@rider.com
- **OAuth ID**: oauth_rider_001
- **Role**: Rider
- **Use Case**: 
  1. Login to app
  2. View home screen (as rider)
  3. Click "Request Ride" button
  4. Set pickup location (current location)
  5. Set dropoff location (e.g., 37.7749, -122.4194)
  6. Select ride type (Standard or Premium)
  7. See fare estimate
  8. Request ride and wait for driver acceptance

### Scenario 2: Driver Online and Accepting Rides
**User**: Alice Driver
- **Email**: alice@driver.com
- **OAuth ID**: oauth_driver_001
- **Role**: Driver
- **Rating**: 4.8 ⭐
- **Total Rides**: 150
- **Current Location**: Nairobi (-1.2864, 36.8172)
- **Online Status**: Active
- **Use Case**:
  1. Login to app
  2. View home screen (as driver)
  3. Toggle "Go Online" button to set online status
  4. See available ride requests in real-time
  5. Accept incoming ride request
  6. Track rider location
  7. Complete ride when arrived
  8. Rate rider experience

### Scenario 3: Offline Driver
**User**: Bob Driver
- **Email**: bob@driver.com
- **OAuth ID**: oauth_driver_002
- **Role**: Driver
- **Rating**: 4.6 ⭐
- **Total Rides**: 120
- **Current Location**: Nairobi (-1.2965, 36.8245)
- **Online Status**: Offline
- **Use Case**:
  1. Login to app
  2. View driver profile
  3. Toggle "Go Online" to activate
  4. Receive ride notifications
  5. Chat with riders during active rides

## Features to Test

### 1. Chat Functionality
- **Access**: Navigate to Chat tab
- **Test**: 
  - Send message to active rider/driver
  - View message history
  - See real-time message updates
  - Timestamps and read status

### 2. Ride Request Flow
- **Access**: Click "Request Ride" button on home
- **Test**:
  - Set pickup location
  - Set dropoff location
  - See fare calculation
  - Select ride type
  - View available drivers
  - Track ride status

### 3. Driver Online/Offline Toggle
- **Access**: Home screen toggle button
- **Test**:
  - Toggle online status
  - See status persistence
  - Receive ride notifications when online
  - Stop receiving notifications when offline

### 4. Real-time Location Tracking
- **Access**: Automatic during active ride
- **Test**:
  - GPS updates every 5-10 seconds
  - Route calculation
  - Distance estimation
  - Arrival time estimation

### 5. Active Ride Management
- **Access**: Home screen shows active ride
- **Test**:
  - View active ride details
  - Start ride (driver)
  - Complete ride (driver)
  - Rate experience (rider)
  - View ride summary

## Database Schema

### Key Tables
1. **users** - User accounts and authentication
2. **driver_profiles** - Driver ratings, stats, location
3. **rides** - Ride bookings and status
4. **messages** - Chat messages between riders/drivers
5. **ratings** - Ride ratings and reviews
6. **location_history** - GPS tracking data
7. **transactions** - Payment records

## API Endpoints (If Backend Running)

### Development Server (Port 3000)
```
POST /api/auth/login - User login
GET  /api/auth/profile - Get current user
GET  /api/rides - List rides
POST /api/rides - Create new ride
GET  /api/rides/:id - Get ride details
PUT  /api/rides/:id/accept - Accept ride (driver)
PUT  /api/rides/:id/start - Start ride (driver)
PUT  /api/rides/:id/complete - Complete ride (driver)
GET  /api/messages/:rideId - Get chat messages
POST /api/messages/:rideId - Send message
GET  /api/drivers/online - Get online drivers
GET  /api/location/track - Track location
```

## Mobile App Testing

### Android Emulator
```bash
npm run android
# Requires Android emulator running
```

### iOS Simulator
```bash
npm run ios
# Requires macOS
```

### Web (Current)
- Navigate to http://localhost:8083
- All features work on web (except native maps)

## Performance Testing

### Location Tracking
- GPS updates: Every 5-10 seconds
- Database updates: Async (non-blocking)
- Battery impact: Minimal (foreground only)

### Chat
- Message delivery: Instant (SQLite)
- Message history: Loads on demand
- Real-time updates: Event-based

### Rides
- Ride matching: Real-time polling every 5 seconds
- Fare calculation: Instant (Haversine formula)
- Route optimization: Based on Google Maps

## Troubleshooting

### No Rides Available
- Ensure driver is online
- Check driver's current location
- Verify ride request parameters

### Chat Not Working
- Ensure active ride exists
- Check database connectivity
- Verify user IDs match

### Location Tracking Issues
- Enable location permission
- Check GPS availability
- Verify database permissions

## Next Steps

1. **Test All Scenarios**: Use the test users above to test each feature
2. **Mobile Testing**: Build and test on Android device
3. **Production Build**: Run `npm run build:apk` for Android APK
4. **Cloud Integration**: Add backend APIs when ready
5. **App Store**: Submit to Google Play Store and Apple App Store

## Environment Variables

```bash
# .env
OAUTH_SERVER_URL=http://localhost:3001  # OAuth server
GOOGLE_MAPS_API_KEY=your_key_here       # Google Maps
DATABASE_URL=data.db                    # SQLite database
NODE_ENV=development                    # Development mode
EXPO_PORT=8083                          # Web port
```

## Support

For issues or questions:
1. Check the app logs in the browser console
2. Review database schema in `drizzle/schema.ts`
3. Check API implementation in `server/routers.ts`
4. Review components in `app/` directory
