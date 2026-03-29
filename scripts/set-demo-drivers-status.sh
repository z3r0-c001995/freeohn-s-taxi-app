#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
MODE="${1:-online}"

if [[ "$MODE" != "online" && "$MODE" != "offline" ]]; then
  echo "Usage: $0 [online|offline]"
  exit 1
fi

drivers=(
  "2001001:-15.420621:28.311552"
  "2001002:-15.424200:28.318000"
  "2001003:-15.417900:28.305100"
  "2001004:-15.413400:28.326800"
)

for entry in "${drivers[@]}"; do
  IFS=":" read -r user_id lat lng <<<"$entry"

  if [[ "$MODE" == "online" ]]; then
    body="{\"isOnline\":true,\"lat\":${lat},\"lng\":${lng}}"
  else
    body="{\"isOnline\":false}"
  fi

  response="$(curl -sS -X POST \
    "${API_BASE_URL}/api/driver/status" \
    -H "content-type: application/json" \
    -H "x-dev-user-id: ${user_id}" \
    -H "x-dev-user-role: driver" \
    --data "$body")"

  echo "driver ${user_id} -> ${response}"
done
