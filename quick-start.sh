#!/bin/bash

# Expo Quick Start Script
echo "🚀 Ride-Hailing App - Quick Start"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root"
    exit 1
fi

echo "📋 System Check:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Expo CLI: $(npx expo --version 2>/dev/null || echo 'Installing...')"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Display available commands
echo "🎯 Available Commands:"
echo ""
echo "  Development:"
echo "    npm run dev              - Start dev server + Metro"
echo "    npm run android          - Run on Android device/emulator"
echo "    npm run ios              - Run on iOS device/simulator"
echo ""
echo "  Building:"
echo "    npm run build:android    - Build Android APK"
echo "    npm run build:apk        - Build debug APK with Gradle"
echo ""
echo "  Android Setup:"
echo "    npm run setup:android    - Setup Android (Google Maps API key)"
echo "    npm run verify:android   - Verify Android environment"
echo ""
echo "  Code Quality:"
echo "    npm run lint             - Lint code"
echo "    npm run format           - Format code"
echo ""
echo "📱 Quick Start Options:"
echo ""
echo "1. Test on Web:"
echo "   npm run dev:metro"
echo "   Open http://localhost:8081 in your browser"
echo ""
echo "2. Test on Android:"
echo "   npm run android"
echo ""
echo "3. Setup Android & Build APK:"
echo "   npm run setup:android"
echo "   npm run build:android"
echo ""
echo "4. See all ride-hailing features:"
echo "   - Rider: Request rides, chat, track driver"
echo "   - Driver: Go online, accept rides, track earnings"
echo "   - Chat: Real-time messaging during active rides"
echo "   - Maps: Interactive location selection"
echo "   - Location: Real-time GPS tracking for drivers"
echo ""
echo "✨ Everything is ready! Choose an option above to get started."
echo ""