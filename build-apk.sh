#!/bin/bash

# RideHaul APK Build Script
# Comprehensive script for building the Expo ride-hailing app

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
BUILD_OUTPUT="$ANDROID_DIR/app/build/outputs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check requirements
check_requirements() {
    print_header "Checking Requirements"
    
    local missing=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing+=("node")
    else
        print_success "Node.js: $(node --version)"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    else
        print_success "npm: $(npm --version)"
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        missing+=("pnpm")
    else
        print_success "pnpm: $(pnpm --version)"
    fi
    
    # Check Java
    if ! command -v java &> /dev/null; then
        missing+=("java")
    else
        print_success "Java: $(java -version 2>&1 | head -1)"
    fi
    
    # Check Gradle
    if ! command -v gradle &> /dev/null; then
        missing+=("gradle")
    else
        print_success "Gradle: $(gradle --version | head -1)"
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing requirements: ${missing[*]}"
        echo "Please install the missing tools and try again."
        return 1
    fi
    
    print_success "All requirements met!"
    return 0
}

# Setup environment
setup_environment() {
    print_header "Setting Up Environment"
    
    cd "$PROJECT_ROOT"
    
    print_info "Installing dependencies with pnpm..."
    pnpm install
    
    print_success "Environment setup complete!"
    return 0
}

# Prebuild
prebuild() {
    print_header "Generating Native Android Project"
    
    cd "$PROJECT_ROOT"
    
    print_info "Running Expo prebuild..."
    npx expo prebuild --clean
    
    print_success "Prebuild complete!"
    return 0
}

# Build debug APK
build_debug() {
    print_header "Building Debug APK"
    
    if [ ! -d "$ANDROID_DIR" ]; then
        print_error "Android directory not found. Run prebuild first."
        return 1
    fi
    
    cd "$ANDROID_DIR"
    
    # Make gradlew executable
    chmod +x gradlew
    
    print_info "Building debug APK..."
    ./gradlew assembleDebug
    
    # Check if APK was created
    if [ -f "$BUILD_OUTPUT/apk/debug/app-debug.apk" ]; then
        print_success "Debug APK created: $BUILD_OUTPUT/apk/debug/app-debug.apk"
        return 0
    else
        print_error "Debug APK not found"
        return 1
    fi
}

# Build release APK and AAB
build_release() {
    print_header "Building Release APK and AAB"
    
    if [ ! -d "$ANDROID_DIR" ]; then
        print_error "Android directory not found. Run prebuild first."
        return 1
    fi
    
    cd "$ANDROID_DIR"
    
    # Make gradlew executable
    chmod +x gradlew
    
    print_info "Building release APK..."
    ./gradlew assembleRelease
    
    print_info "Building release AAB..."
    ./gradlew bundleRelease
    
    # Check outputs
    local success=0
    
    if [ -f "$BUILD_OUTPUT/apk/release/app-release.apk" ]; then
        print_success "Release APK created: $BUILD_OUTPUT/apk/release/app-release.apk"
    else
        print_warning "Release APK not found"
    fi
    
    if [ -f "$BUILD_OUTPUT/bundle/release/app-release.aab" ]; then
        print_success "Release AAB created: $BUILD_OUTPUT/bundle/release/app-release.aab"
    else
        print_warning "Release AAB not found"
    fi
    
    return 0
}

# Clean build artifacts
clean() {
    print_header "Cleaning Build Artifacts"
    
    if [ -d "$ANDROID_DIR" ]; then
        cd "$ANDROID_DIR"
        chmod +x gradlew
        ./gradlew clean || print_warning "Gradle clean failed, continuing..."
    fi
    
    print_success "Clean complete!"
    return 0
}

# Complete build
build_all() {
    print_header "Starting Complete Build Process"
    
    if ! check_requirements; then
        return 1
    fi
    
    if ! setup_environment; then
        return 1
    fi
    
    if ! prebuild; then
        return 1
    fi
    
    if ! build_debug; then
        return 1
    fi
    
    print_header "BUILD COMPLETE!"
    print_success "Your APK is ready!"
    return 0
}

# Main
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  check      - Check if all requirements are installed"
        echo "  setup      - Install dependencies"
        echo "  prebuild   - Generate native Android project"
        echo "  debug      - Build debug APK"
        echo "  release    - Build release APK and AAB"
        echo "  clean      - Clean build artifacts"
        echo "  all        - Complete build process (check + setup + prebuild + debug)"
        echo ""
        echo "Examples:"
        echo "  $0 check"
        echo "  $0 setup"
        echo "  $0 all"
        echo "  $0 release"
        return 1
    fi
    
    case "$1" in
        check)
            check_requirements
            ;;
        setup)
            setup_environment
            ;;
        prebuild)
            prebuild
            ;;
        debug)
            build_debug
            ;;
        release)
            build_release
            ;;
        clean)
            clean
            ;;
        all)
            build_all
            ;;
        *)
            print_error "Unknown command: $1"
            return 1
            ;;
    esac
}

# Run main
main "$@"
