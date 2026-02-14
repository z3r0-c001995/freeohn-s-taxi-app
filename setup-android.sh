#!/bin/bash

# Android Setup Script for Ride-Hailing App
# This script helps configure Android-specific settings

echo "🚀 Ride-Hailing App - Android Setup"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📱 Setting up Android configuration..."

# Create assets directory for Google Maps API key
echo "🗺️  Creating assets directory for Google Maps..."
mkdir -p android/app/src/main/assets

# Check if Google Maps API key file exists
if [ ! -f "android/app/src/main/assets/google_maps_api_key.txt" ]; then
    echo "⚠️  Google Maps API key not found!"
    echo "📝 Please get your Google Maps API key from:"
    echo "   https://console.cloud.google.com/google/maps-apis"
    echo ""
    echo "Then create the file: android/app/src/main/assets/google_maps_api_key.txt"
    echo "And add your API key to it."
    echo ""
    read -p "Do you have your Google Maps API key? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Enter your Google Maps API key:"
        read -r api_key
        echo "$api_key" > android/app/src/main/assets/google_maps_api_key.txt
        echo "✅ Google Maps API key saved!"
    else
        echo "⚠️  Maps will not work without an API key."
        echo "   You can add it later to: android/app/src/main/assets/google_maps_api_key.txt"
    fi
else
    echo "✅ Google Maps API key found!"
fi

# Make gradlew executable
echo "🔧 Making Gradle wrapper executable..."
chmod +x android/gradlew

# Check Android SDK
echo "📋 Checking Android setup..."
if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  ANDROID_HOME not set. Please install Android SDK and set ANDROID_HOME"
    echo "   Download from: https://developer.android.com/studio"
else
    echo "✅ Android SDK found at: $ANDROID_HOME"
fi

echo ""
echo "🎯 Android setup complete!"
echo ""
echo "Next steps:"
echo "1. Connect an Android device or start an emulator"
echo "2. Run: npx expo run:android"
echo "3. Or build APK: npx expo build:android"
echo ""
echo "For production builds:"
echo "1. Configure signing keys in android/app/build.gradle"
echo "2. Run: eas build --platform android --profile production"