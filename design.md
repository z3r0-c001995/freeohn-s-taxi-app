# Ride Hailing App - Mobile Interface Design

## Overview
A fully functional ride-hailing application with local database, real-time location tracking, local messaging, and ride management. All features are completely offline and local—no external API dependencies.

## Screen List

### 1. **Onboarding Screen**
- Welcome message
- Role selection: Rider or Driver
- Quick start button

### 2. **Authentication Screens**
- Phone number entry
- OTP verification (local validation)
- Profile setup (name, photo, vehicle info for drivers)

### 3. **Home Screen (Rider)**
- Current location map view
- Search destination input
- Recent destinations list
- Active ride card (if ride in progress)
- Ride history quick access

### 4. **Home Screen (Driver)**
- Current location map view
- Availability toggle (Online/Offline)
- Active ride card (if ride accepted)
- Earnings summary
- Ride history

### 5. **Ride Request Screen (Rider)**
- Map with pickup and destination
- Estimated fare calculation
- Ride type selection (Standard, Premium)
- Confirm booking button
- Waiting for driver status

### 6. **Driver Acceptance Screen**
- Incoming ride request notification
- Rider details and rating
- Pickup location and destination
- Estimated fare and distance
- Accept/Decline buttons

### 7. **Active Ride Screen**
- Real-time map with driver/rider location
- Driver/Rider details and rating
- ETA countdown
- Chat button (local messaging)
- Cancel ride button

### 8. **Chat Screen**
- Message history (local storage)
- Message input field
- Timestamp for each message
- Typing indicator

### 9. **Ride Completion Screen**
- Ride summary (distance, duration, fare)
- Rating screen (5-star)
- Tip option
- Receipt view

### 10. **Profile Screen**
- User details (name, phone, photo)
- Rating and review history
- Payment methods (local)
- Settings
- Logout

### 11. **Settings Screen**
- Notification preferences
- Language selection
- Dark mode toggle
- About & Help
- Data management (clear cache)

## Primary Content and Functionality

### Rider Flow
1. **Browse & Request**: View map, enter destination, select ride type
2. **Wait for Driver**: Real-time tracking of driver location
3. **In-Ride Communication**: Chat with driver, track progress
4. **Complete & Rate**: Rate driver, provide tip, view receipt

### Driver Flow
1. **Go Online**: Toggle availability, view incoming requests
2. **Accept Ride**: Review rider details and route
3. **Navigate & Communicate**: Real-time navigation, chat with rider
4. **Complete & Earn**: Mark ride complete, track earnings

### Local Database Features
- User profiles (riders and drivers)
- Ride history and active rides
- Chat messages
- Ratings and reviews
- Payment/transaction records
- Location history

## Key User Flows

### Requesting a Ride (Rider)
1. Tap "Request Ride"
2. Enter destination (or select from recent)
3. Choose ride type
4. Confirm booking
5. View driver location in real-time
6. Chat with driver if needed
7. Complete ride and rate

### Accepting a Ride (Driver)
1. Receive notification of new ride request
2. Review rider details, pickup, and destination
3. Accept or decline
4. Navigate to pickup location
5. Chat with rider
6. Complete ride and track earnings

### Messaging
1. Tap chat icon during active ride
2. View message history
3. Type and send message
4. Receive real-time notifications (local)

## Color Choices

| Element | Color | Hex |
|---------|-------|-----|
| Primary (Accent) | Uber Black | #000000 |
| Secondary | Uber White | #FFFFFF |
| Success (Active) | Green | #27AE60 |
| Warning (Pending) | Orange | #F39C12 |
| Error (Cancelled) | Red | #E74C3C |
| Background | Light Gray | #F5F5F5 |
| Text Primary | Dark Gray | #2C3E50 |
| Text Secondary | Medium Gray | #7F8C8D |
| Border | Light Gray | #ECF0F1 |

## Technical Stack

- **Frontend**: React Native with Expo
- **State Management**: Zustand (local state)
- **Local Database**: SQLite (via expo-sqlite)
- **Location**: expo-location
- **Maps**: react-native-maps
- **Messaging**: Local SQLite storage
- **Notifications**: expo-notifications (local)
- **Authentication**: Local phone verification (no external API)
- **Styling**: NativeWind (Tailwind CSS)

## Offline-First Architecture

All features operate completely offline:
- **Ride Matching**: Local algorithm based on proximity
- **Messaging**: Local SQLite storage
- **Payments**: Local transaction tracking
- **Ratings**: Local review storage
- **Location Tracking**: Device GPS only
- **Maps**: Offline map support (optional)

## Design Principles

1. **Mobile-First**: Optimized for portrait 9:16 aspect ratio
2. **One-Handed Usage**: All interactive elements within thumb reach
3. **Minimal Friction**: Quick actions, minimal taps
4. **Clear Feedback**: Visual confirmation for all actions
5. **Accessibility**: High contrast, readable fonts
6. **Offline-Ready**: No external dependencies
