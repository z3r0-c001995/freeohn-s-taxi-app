#!/usr/bin/env bash

set -euo pipefail

VARIANT="${1:-}"
BUILD_TYPE="${2:-debug}"

if [ "$VARIANT" != "driver" ] && [ "$VARIANT" != "seeker" ]; then
  echo "Usage: ./scripts/build-variant-apk.sh <driver|seeker> [debug|release]"
  exit 2
fi

if [ "$BUILD_TYPE" != "debug" ] && [ "$BUILD_TYPE" != "release" ]; then
  echo "Usage: ./scripts/build-variant-apk.sh <driver|seeker> [debug|release]"
  exit 2
fi

export APP_VARIANT="$VARIANT"
export EXPO_PUBLIC_APP_VARIANT="$VARIANT"

echo "Building APK for variant: $VARIANT ($BUILD_TYPE)"
echo "APP_VARIANT=$APP_VARIANT"

npx expo prebuild --clean

if [ "$BUILD_TYPE" = "release" ]; then
  SIGNING_DIR=".signing/android"
  SOURCE_PROPERTIES="${SIGNING_DIR}/keystore.properties"
  SOURCE_KEYSTORE="${SIGNING_DIR}/freeohn-release-key.jks"

  if [ ! -f "$SOURCE_PROPERTIES" ]; then
    echo "Missing ${SOURCE_PROPERTIES}. Generate a release keystore first."
    exit 1
  fi
  if [ ! -f "$SOURCE_KEYSTORE" ]; then
    echo "Missing ${SOURCE_KEYSTORE}. Generate a release keystore first."
    exit 1
  fi

  mkdir -p android/keystores
  cp "$SOURCE_PROPERTIES" android/keystore.properties
  cp "$SOURCE_KEYSTORE" android/keystores/freeohn-release-key.jks
  chmod 600 android/keystore.properties
  node ./scripts/configure-android-signing.mjs
fi

(
  cd android
  chmod +x gradlew
  if [ "$BUILD_TYPE" = "release" ]; then
    ./gradlew assembleRelease
  else
    ./gradlew assembleDebug
  fi
)

SRC_APK="android/app/build/outputs/apk/${BUILD_TYPE}/app-${BUILD_TYPE}.apk"
ARTIFACT_DIR="artifacts/apk"
DST_APK="${ARTIFACT_DIR}/freeohn-${VARIANT}-${BUILD_TYPE}.apk"
mkdir -p "$ARTIFACT_DIR"

if [ ! -f "$SRC_APK" ]; then
  echo "Build completed but APK not found at $SRC_APK"
  exit 1
fi

cp "$SRC_APK" "$DST_APK"
echo "APK created: $DST_APK"

