#!/bin/bash

# Android Build Verification Script
echo "🔍 Verifying Android build environment..."
echo "========================================"

# Check if we're in project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run from project root"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm not found"
fi

# Check Expo CLI
if command -v expo &> /dev/null; then
    EXPO_VERSION=$(expo --version)
    echo "✅ Expo CLI: $EXPO_VERSION"
else
    echo "⚠️  Expo CLI not found globally (will use npx)"
fi

# Check Android SDK
if [ -n "$ANDROID_HOME" ]; then
    echo "✅ Android SDK found: $ANDROID_HOME"
    if [ -d "$ANDROID_HOME/platform-tools" ]; then
        echo "✅ Android platform tools found"
    else
        echo "❌ Android platform tools missing"
    fi
else
    echo "❌ Android SDK not found. Set ANDROID_HOME"
fi

# Check Java
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1)
    echo "✅ Java: $JAVA_VERSION"
else
    echo "❌ Java not found"
fi

# Check Google Maps API key
if [ -f "android/app/src/main/assets/google_maps_api_key.txt" ]; then
    echo "✅ Google Maps API key configured"
else
    echo "⚠️  Google Maps API key missing"
    echo "   Maps won't work without it"
fi

# Check Android manifest permissions
if grep -q "ACCESS_FINE_LOCATION" android/app/src/main/AndroidManifest.xml; then
    echo "✅ Location permissions configured"
else
    echo "❌ Location permissions missing"
fi

if grep -q "CAMERA" android/app/src/main/AndroidManifest.xml; then
    echo "✅ Camera permissions configured"
else
    echo "❌ Camera permissions missing"
fi

echo ""
echo "🎯 Verification complete!"
echo ""
echo "To build for Android:"
echo "1. Run: ./setup-android.sh"
echo "2. Run: npx expo run:android"
echo "3. Or build APK: eas build --platform android"