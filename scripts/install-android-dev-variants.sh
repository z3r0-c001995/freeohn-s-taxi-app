#!/usr/bin/env bash

set -euo pipefail

SERIAL="${1:-}"
if [ -z "${SERIAL}" ]; then
  SERIAL="$(adb devices | awk '/^emulator-[0-9]+\s+device/{print $1; exit}')"
fi

if [ -z "${SERIAL}" ]; then
  echo "No running emulator found."
  echo "Start one with: ./scripts/start-android-emulator.sh"
  exit 1
fi

echo "Using emulator: ${SERIAL}"

./scripts/build-variant-apk.sh seeker
adb -s "${SERIAL}" install -r artifacts/apk/freeohn-seeker-debug.apk

./scripts/build-variant-apk.sh driver
adb -s "${SERIAL}" install -r artifacts/apk/freeohn-driver-debug.apk

echo "Debug variant installs complete on ${SERIAL}."
echo "Launch apps with:"
echo "  adb -s ${SERIAL} shell monkey -p space.manus.ride.hailing.app.t20260201043515.seeker -c android.intent.category.LAUNCHER 1"
echo "  adb -s ${SERIAL} shell monkey -p space.manus.ride.hailing.app.t20260201043515.driver -c android.intent.category.LAUNCHER 1"
