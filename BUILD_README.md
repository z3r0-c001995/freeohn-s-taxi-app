# RideHaul - Ride Hailing App Build Guide

## Overview

RideHaul is a fully functional, offline-first ride-hailing mobile application built with React Native and Expo. All features are local—no external APIs or cloud dependencies.

## Features

- **Offline-First Architecture**: All data stored locally using SQLite
- **Rider & Driver Modes**: Support for both riders and drivers
- **Real-Time Location Tracking**: GPS-based location services
- **Local Messaging**: In-app chat with local storage
- **Ride Management**: Request, accept, and complete rides locally
- **Rating System**: Local ratings and reviews
- **Payment Tracking**: Local transaction history
- **Android Native Support**: Full Android app with native performance

## Android Implementation

### ✅ **Implemented Features for Android**
- **Native Permissions**: Location, camera, notifications configured
- **Google Maps Integration**: Interactive maps with API key support
- **Background Location**: GPS tracking for drivers when online
- **Push Notifications**: Framework ready for Firebase integration
- **Camera Access**: Profile photo upload functionality
- **Offline Storage**: SQLite database with native performance

### **Android-Specific Setup**
```bash
# Verify Android environment
npm run verify:android

# Setup Android configuration
npm run setup:android

# Run on Android device/emulator
npm run android

# Build Android APK
npm run build:android
```

### **Google Maps Configuration**
1. Get API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Add to `android/app/src/main/assets/google_maps_api_key.txt`
3. Maps will work automatically in the app

## Project Structure

```
ride_hailing_app/
├── app/                    # Expo Router app directory
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main app screens
│   └── _layout.tsx        # Root layout
├── lib/                   # Core libraries
│   ├── db.ts             # Database initialization
│   ├── db-service.ts     # Database operations
│   ├── store.ts          # Zustand state management
│   └── ride-utils.ts     # Utility functions
├── components/           # Reusable components
├── package.json          # Dependencies
├── dependency.py         # Python build manager
├── build-apk.sh         # Bash build script
└── app.config.ts        # Expo configuration
```

## Prerequisites

Before building, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **pnpm** (package manager)
- **Java Development Kit (JDK)** (v11 or higher)
- **Android SDK** (for Android development)
- **Gradle** (usually installed with Android SDK)
- **Git** (for version control)

### System Requirements

- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: 5GB minimum
- **OS**: Linux, macOS, or Windows with WSL2

## Installation

### 1. Install Node.js and npm

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y nodejs npm
```

**macOS:**
```bash
brew install node
```

**Windows:**
Download from https://nodejs.org/

### 2. Install pnpm (Recommended)

```bash
npm install -g pnpm
```

### 3. Install Java Development Kit

**Ubuntu/Debian:**
```bash
sudo apt install -y openjdk-11-jdk
```

**macOS:**
```bash
brew install openjdk@11
```

### 4. Install Android SDK

**Linux/macOS:**
```bash
# Create SDK directory
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools

# Download Android SDK
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
unzip commandlinetools-linux-9477386_latest.zip

# Set environment variables
echo 'export ANDROID_HOME=~/android-sdk' >> ~/.bashrc
echo 'export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Accept licenses and install SDK
sdkmanager --licenses
sdkmanager "platforms;android-34" "build-tools;34.0.0"
```

**Windows (WSL2):**
Follow the Linux instructions above in your WSL terminal.

## Building the APK

### Method 1: Using Python Script (Recommended)

```bash
cd ride_hailing_app

# Check requirements
python3 dependency.py check

# Setup environment
python3 dependency.py setup

# Build debug APK
python3 dependency.py debug

# Or build everything at once
python3 dependency.py all
```

### Method 2: Using Bash Script

```bash
cd ride_hailing_app

# Make script executable (if not already)
chmod +x build-apk.sh

# Check requirements
./build-apk.sh check

# Setup environment
./build-apk.sh setup

# Build debug APK
./build-apk.sh debug

# Or build everything at once
./build-apk.sh all
```

### Method 3: Manual Build

```bash
cd ride_hailing_app

# Install dependencies
pnpm install

# Generate native Android project
npx expo prebuild --clean

# Navigate to Android directory
cd android

# Make Gradle executable
chmod +x gradlew

# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Build AAB (Android App Bundle)
./gradlew bundleRelease
```

## Build Output

After a successful build, you'll find the compiled files in:

- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **Release AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

## Installing the APK

### On Android Device

```bash
# Using ADB (Android Debug Bridge)
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or using Termux (if building on Android)
pm install android/app/build/outputs/apk/debug/app-debug.apk
```

### On Android Emulator

```bash
# Start emulator first
emulator -avd <emulator_name>

# Install APK
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Development Workflow

### Running in Development Mode

```bash
# Start the Metro bundler
pnpm dev

# Run on Android device/emulator
pnpm android

# Run on iOS (macOS only)
pnpm ios

# Run on web browser
pnpm web
```

### Testing

```bash
# Run tests
pnpm test

# Run linter
pnpm lint

# Format code
pnpm format
```

## Troubleshooting

### Common Issues

#### 1. "gradle not found"
```bash
# Install Gradle
# Ubuntu/Debian
sudo apt install gradle

# macOS
brew install gradle

# Verify
gradle --version
```

#### 2. "JAVA_HOME not set"
```bash
# Find Java installation
which java
java -version

# Set JAVA_HOME (Linux/macOS)
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
# Or for macOS
export JAVA_HOME=$(/usr/libexec/java_home -v 11)

# Add to ~/.bashrc or ~/.zshrc for persistence
```

#### 3. "Port 8081 already in use"
```bash
# Kill process using port
lsof -ti:8081 | xargs kill -9

# Or use different port
EXPO_PORT=8082 pnpm dev
```

#### 4. "Module not found"
```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 5. "Cannot find android directory"
```bash
# Run prebuild again
npx expo prebuild --clean
```

#### 6. "Gradle build failed"
```bash
# Clean gradle cache
rm -rf android/.gradle
cd android
./gradlew clean
./gradlew assembleDebug
```

## Configuration

### App Configuration

Edit `app.config.ts` to customize:

- App name and slug
- Package name (bundle ID)
- Permissions
- Splash screen
- App icon

### Environment Variables

Create `.env.local` if needed (currently not required for offline operation):

```env
# Optional: Add any future API keys here
EXPO_PUBLIC_APP_NAME=RideHaul
```

## Database

The app uses SQLite for local data storage. Database file location:

- **Android**: `/data/data/space.manus.ride.hailing.app/databases/ridehaul.db`

### Database Schema

The app includes tables for:
- Users (riders and drivers)
- Driver profiles
- Rides (active and history)
- Messages
- Ratings
- Transactions
- Location history

## Performance Tips

1. **Use Release Build**: Release APKs are optimized and faster
2. **Clear Cache**: Periodically clear app cache for better performance
3. **Database Maintenance**: Old records can be archived or deleted
4. **Location Updates**: Adjust location update frequency based on needs

## Security Considerations

- All data is stored locally on the device
- No data is sent to external servers
- Implement proper authentication before production use
- Consider encryption for sensitive data
- Use HTTPS if integrating with any backend in the future

## Deployment

### For Google Play Store

1. Generate a signing key:
```bash
keytool -genkey -v -keystore my-release-key.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

2. Build signed release APK:
```bash
cd android
./gradlew assembleRelease
```

3. Upload to Google Play Console

### For Direct Distribution

1. Build release APK:
```bash
python3 dependency.py release
```

2. Share `app-release.apk` with users
3. Users can install via file manager or ADB

## Support & Documentation

- **Expo Documentation**: https://docs.expo.dev/
- **React Native**: https://reactnative.dev/
- **Android Development**: https://developer.android.com/

## License

This project is provided as-is for educational and personal use.

## Version History

- **v1.0.0** (Feb 2026): Initial release with core features
  - Rider and driver authentication
  - Local ride management
  - Real-time location tracking
  - Local messaging system
  - Rating and review system

---

**Built with ❤️ using React Native, Expo, and SQLite**
