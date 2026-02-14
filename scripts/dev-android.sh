#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-http://10.0.2.2:3000}"
OAUTH_SERVER_URL="${EXPO_PUBLIC_OAUTH_SERVER_URL:-${API_BASE_URL}}"
HOST_METRO_PORT="${EXPO_PORT:-8090}"
DEVICE_METRO_PORT="8081"

port_in_use() {
  local port="$1"
  lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1
}

pick_open_port() {
  local start_port="$1"
  local port="$start_port"
  for _ in $(seq 1 20); do
    if ! port_in_use "${port}"; then
      echo "${port}"
      return 0
    fi
    port=$((port + 1))
  done
  return 1
}

if ! HOST_METRO_PORT="$(pick_open_port "${HOST_METRO_PORT}")"; then
  echo "Unable to find an open host Metro port starting from ${HOST_METRO_PORT}."
  exit 1
fi

ready_android_device() {
  while read -r serial; do
    [ -n "${serial}" ] || continue
    if adb -s "${serial}" shell service check package 2>/dev/null | grep -q "Service package: found"; then
      echo "${serial}"
      return 0
    fi
  done < <(adb devices | awk '/\sdevice$/{print $1}')
  return 1
}

ONLINE_DEVICE_SERIAL="$(ready_android_device || true)"
EXPO_ANDROID_FLAG=""
if [ -n "${ONLINE_DEVICE_SERIAL}" ]; then
  EXPO_ANDROID_FLAG="--android"
  echo "Detected ready Android device: ${ONLINE_DEVICE_SERIAL}"
else
  echo "No ready Android device detected yet. Starting Metro without auto-launch."
fi

echo "Starting Android dev stack..."
echo "  API base URL: ${API_BASE_URL}"
echo "  Metro host port: ${HOST_METRO_PORT}"
echo "  Metro device port: ${DEVICE_METRO_PORT}"
echo ""
echo "Tip: install debug apps once with ./scripts/install-android-dev-variants.sh"
echo "Tip: app requests localhost:${DEVICE_METRO_PORT}; adb reverse maps it to host:${HOST_METRO_PORT}."

# Helpful for emulator + physical devices.
while read -r serial; do
  [ -n "${serial}" ] || continue
  adb -s "${serial}" reverse tcp:3000 tcp:3000 >/dev/null 2>&1 || true
  adb -s "${serial}" reverse tcp:"${DEVICE_METRO_PORT}" tcp:"${HOST_METRO_PORT}" >/dev/null 2>&1 || true
done < <(adb devices | awk '/\sdevice$/{print $1}')

if port_in_use 3000; then
  echo "Detected existing backend on port 3000. Reusing it."
  npx cross-env EXPO_PUBLIC_API_BASE_URL="${API_BASE_URL}" EXPO_PUBLIC_OAUTH_SERVER_URL="${OAUTH_SERVER_URL}" \
    npx expo start ${EXPO_ANDROID_FLAG} --port "${HOST_METRO_PORT}" --clear
else
  npx concurrently -k \
    "npx cross-env NODE_ENV=development PORT=3000 OAUTH_SERVER_URL=http://127.0.0.1:3000 tsx watch server/_core/index.ts" \
    "npx cross-env EXPO_PUBLIC_API_BASE_URL=${API_BASE_URL} EXPO_PUBLIC_OAUTH_SERVER_URL=${OAUTH_SERVER_URL} npx expo start ${EXPO_ANDROID_FLAG} --port ${HOST_METRO_PORT} --clear"
fi
