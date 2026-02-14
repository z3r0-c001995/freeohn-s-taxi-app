#!/usr/bin/env bash

set -euo pipefail

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
CMDLINE_BIN="${SDK_ROOT}/cmdline-tools/latest/bin"
EMULATOR_BIN="${SDK_ROOT}/emulator/emulator"
AVD_NAME="${1:-freeohn_api33}"
SYSTEM_IMAGE="system-images;android-33;google_apis;x86_64"

if [ ! -x "${CMDLINE_BIN}/sdkmanager" ] || [ ! -x "${CMDLINE_BIN}/avdmanager" ]; then
  echo "Android command-line tools not found at ${CMDLINE_BIN}"
  echo "Install Android SDK command-line tools first."
  exit 1
fi

if [ ! -x "${EMULATOR_BIN}" ]; then
  echo "Android emulator binary not found at ${EMULATOR_BIN}"
  exit 1
fi

echo "SDK root: ${SDK_ROOT}"
echo "Ensuring required Android packages are installed..."
yes | "${CMDLINE_BIN}/sdkmanager" --licenses >/dev/null || true
"${CMDLINE_BIN}/sdkmanager" \
  "platform-tools" \
  "emulator" \
  "platforms;android-33" \
  "${SYSTEM_IMAGE}"

if ! "${EMULATOR_BIN}" -list-avds | grep -qx "${AVD_NAME}"; then
  echo "Creating AVD: ${AVD_NAME}"
  printf "no\n" | "${CMDLINE_BIN}/avdmanager" create avd -f -n "${AVD_NAME}" -k "${SYSTEM_IMAGE}" -d pixel_6
else
  echo "AVD already exists: ${AVD_NAME}"
fi

echo "Emulator setup complete."
echo "Start with: ./scripts/start-android-emulator.sh ${AVD_NAME}"
