#!/usr/bin/env bash

set -euo pipefail

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
EMULATOR_BIN="${SDK_ROOT}/emulator/emulator"
AVD_NAME="${1:-freeohn_api33}"
LOG_FILE="${2:-/tmp/freeohn-emulator.log}"

if [ ! -x "${EMULATOR_BIN}" ]; then
  echo "Android emulator binary not found at ${EMULATOR_BIN}"
  exit 1
fi

if ! "${EMULATOR_BIN}" -list-avds | grep -qx "${AVD_NAME}"; then
  echo "AVD '${AVD_NAME}' not found."
  echo "Run: ./scripts/setup-android-emulator.sh ${AVD_NAME}"
  exit 1
fi

RUNNING_SERIAL="$(adb devices | awk '/^emulator-[0-9]+\s+device/{print $1; exit}')"
if [ -n "${RUNNING_SERIAL}" ]; then
  echo "An emulator is already running: ${RUNNING_SERIAL}"
  adb devices -l
  exit 0
fi

OFFLINE_SERIAL="$(adb devices | awk '/^emulator-[0-9]+\s+offline/{print $1; exit}')"
if [ -n "${OFFLINE_SERIAL}" ]; then
  echo "Found offline emulator (${OFFLINE_SERIAL}); resetting adb state."
  adb -s "${OFFLINE_SERIAL}" emu kill >/dev/null 2>&1 || true
  adb kill-server >/dev/null 2>&1 || true
  adb start-server >/dev/null 2>&1 || true
fi

ACCEL_FLAG="-accel on"
if [ ! -e /dev/kvm ]; then
  ACCEL_FLAG="-accel off"
  echo "Warning: /dev/kvm is unavailable. Emulator will run in software mode and be very slow."
fi

WINDOW_ARGS=()
if [ -z "${DISPLAY:-}" ]; then
  WINDOW_ARGS=(-no-window)
  echo "No DISPLAY detected. Starting emulator in headless mode."
fi

echo "Starting emulator '${AVD_NAME}'..."
nohup "${EMULATOR_BIN}" \
  -avd "${AVD_NAME}" \
  ${ACCEL_FLAG} \
  "${WINDOW_ARGS[@]}" \
  -gpu swiftshader_indirect \
  -netdelay none \
  -netspeed full \
  -no-snapshot \
  -no-audio \
  -no-boot-anim \
  >"${LOG_FILE}" 2>&1 &

echo "Emulator logs: ${LOG_FILE}"
adb wait-for-device

SERIAL=""
for _ in $(seq 1 30); do
  SERIAL="$(adb devices | awk '/^emulator-[0-9]+\s+device/{print $1; exit}')"
  if [ -n "${SERIAL}" ]; then
    break
  fi
  sleep 1
done

if [ -z "${SERIAL}" ]; then
  echo "Emulator process started but no adb emulator device detected yet."
  echo "Check logs: ${LOG_FILE}"
  exit 1
fi

echo "Waiting for Android package service on ${SERIAL}..."
READY=0
for _ in $(seq 1 300); do
  if adb -s "${SERIAL}" shell service check package 2>/dev/null | grep -q "Service package: found"; then
    READY=1
    break
  fi
  sleep 2
done

if [ "${READY}" -eq 1 ]; then
  echo "Emulator is ready: ${SERIAL}"
else
  echo "Emulator detected but still booting. It may take longer on software emulation."
  echo "Tail logs with: tail -f ${LOG_FILE}"
fi

adb devices -l
