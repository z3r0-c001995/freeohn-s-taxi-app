#!/usr/bin/env bash

set -u -o pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
OWNER_TOKEN="${OWNER_TOKEN:-}"
DRIVER_TOKEN="${DRIVER_TOKEN:-}"
RIDER_TOKEN="${RIDER_TOKEN:-}"

PICKUP_LAT="${PICKUP_LAT:--1.286389}"
PICKUP_LNG="${PICKUP_LNG:-36.817223}"
DROPOFF_LAT="${DROPOFF_LAT:--1.292066}"
DROPOFF_LNG="${DROPOFF_LNG:-36.821945}"
DISTANCE_METERS="${DISTANCE_METERS:-4500}"
DURATION_SECONDS="${DURATION_SECONDS:-1100}"

VEHICLE_MAKE="${VEHICLE_MAKE:-Toyota}"
VEHICLE_MODEL="${VEHICLE_MODEL:-Axio}"
VEHICLE_COLOR="${VEHICLE_COLOR:-White}"
VEHICLE_PLATE="${VEHICLE_PLATE:-KDA 123A}"

POLL_RETRIES="${POLL_RETRIES:-30}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-2}"

TOTAL_STEPS=0
PASSED_STEPS=0
FAILED_STEPS=0

RESPONSE_CODE=""
RESPONSE_BODY=""
TRIP_ID=""
OFFER_ID=""
DRIVER_PROFILE_ID=""
RIDER_USER_ID=""
DRIVER_USER_ID=""
OWNER_USER_ID=""

usage() {
  cat <<'EOF'
Usage:
  OWNER_TOKEN=... DRIVER_TOKEN=... RIDER_TOKEN=... ./scripts/e2e-ride-hailing-check.sh

Optional env:
  API_BASE_URL=http://localhost:3000
  PICKUP_LAT=-1.286389 PICKUP_LNG=36.817223
  DROPOFF_LAT=-1.292066 DROPOFF_LNG=36.821945
  DISTANCE_METERS=4500 DURATION_SECONDS=1100
  VEHICLE_MAKE=Toyota VEHICLE_MODEL=Axio VEHICLE_COLOR=White VEHICLE_PLATE="KDA 123A"
  POLL_RETRIES=30 POLL_INTERVAL_SECONDS=2
EOF
}

log() {
  printf '%s\n' "$*"
}

pass() {
  PASSED_STEPS=$((PASSED_STEPS + 1))
  log "PASS: $1"
}

fail() {
  FAILED_STEPS=$((FAILED_STEPS + 1))
  log "FAIL: $1"
  if [ -n "${2:-}" ]; then
    log "  $2"
  fi
}

step() {
  TOTAL_STEPS=$((TOTAL_STEPS + 1))
  local name="$1"
  shift
  if "$@"; then
    pass "$name"
    return 0
  fi
  fail "$name"
  return 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1
}

api_request() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"
  local url="${API_BASE_URL}${path}"
  local tmp

  tmp="$(mktemp)"

  if [ -n "$body" ]; then
    if [ -n "$token" ]; then
      RESPONSE_CODE="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        --data "$body")"
    else
      RESPONSE_CODE="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        --data "$body")"
    fi
  else
    if [ -n "$token" ]; then
      RESPONSE_CODE="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" \
        -H "Authorization: Bearer $token")"
    else
      RESPONSE_CODE="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url")"
    fi
  fi

  RESPONSE_BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

is_2xx() {
  [[ "$RESPONSE_CODE" =~ ^2[0-9][0-9]$ ]]
}

check_health() {
  api_request "GET" "/api/health"
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.ok == true' >/dev/null
}

resolve_user_id() {
  local token="$1"
  api_request "GET" "/api/auth/me" "$token"
  if ! is_2xx; then
    return 1
  fi
  echo "$RESPONSE_BODY" | jq -r '.user.id // empty'
}

check_auth_tokens() {
  OWNER_USER_ID="$(resolve_user_id "$OWNER_TOKEN")" || return 1
  DRIVER_USER_ID="$(resolve_user_id "$DRIVER_TOKEN")" || return 1
  RIDER_USER_ID="$(resolve_user_id "$RIDER_TOKEN")" || return 1
  [ -n "$OWNER_USER_ID" ] && [ -n "$DRIVER_USER_ID" ] && [ -n "$RIDER_USER_ID" ]
}

check_driver_cannot_create_trip() {
  local payload
  payload="$(jq -n \
    --argjson pLat "$PICKUP_LAT" \
    --argjson pLng "$PICKUP_LNG" \
    --argjson dLat "$DROPOFF_LAT" \
    --argjson dLng "$DROPOFF_LNG" \
    --argjson distance "$DISTANCE_METERS" \
    --argjson duration "$DURATION_SECONDS" \
    --arg idem "driver-must-not-create-$(date +%s)" \
    '{
      pickup: {lat: $pLat, lng: $pLng},
      dropoff: {lat: $dLat, lng: $dLng},
      pickupAddress: "CBD",
      dropoffAddress: "Upper Hill",
      distanceMeters: $distance,
      durationSeconds: $duration,
      rideType: "standard",
      paymentMethod: "CASH",
      idempotencyKey: $idem
    }')"

  api_request "POST" "/api/trips" "$DRIVER_TOKEN" "$payload"
  if is_2xx; then
    return 1
  fi
  echo "$RESPONSE_BODY" | jq -e '.error | test("Role driver cannot perform this operation")' >/dev/null
}

register_driver_by_owner() {
  local payload
  payload="$(jq -n \
    --argjson userId "$DRIVER_USER_ID" \
    --arg vehicleMake "$VEHICLE_MAKE" \
    --arg vehicleModel "$VEHICLE_MODEL" \
    --arg vehicleColor "$VEHICLE_COLOR" \
    --arg plateNumber "$VEHICLE_PLATE" \
    '{
      userId: $userId,
      vehicleMake: $vehicleMake,
      vehicleModel: $vehicleModel,
      vehicleColor: $vehicleColor,
      plateNumber: $plateNumber,
      verified: false
    }')"

  api_request "POST" "/api/admin/drivers/register" "$OWNER_TOKEN" "$payload"
  if ! is_2xx; then
    return 1
  fi

  DRIVER_PROFILE_ID="$(echo "$RESPONSE_BODY" | jq -r '.driverId // empty')"
  [ -n "$DRIVER_PROFILE_ID" ] || return 1
  echo "$RESPONSE_BODY" | jq -e '.verified == false' >/dev/null
}

check_unverified_driver_blocked_online() {
  local payload
  payload="$(jq -n \
    --argjson lat "$PICKUP_LAT" \
    --argjson lng "$PICKUP_LNG" \
    '{isOnline: true, lat: $lat, lng: $lng}')"

  api_request "POST" "/api/driver/status" "$DRIVER_TOKEN" "$payload"
  if is_2xx; then
    return 1
  fi
  echo "$RESPONSE_BODY" | jq -e '.error | test("verified")' >/dev/null
}

verify_driver() {
  api_request "POST" "/api/admin/drivers/${DRIVER_PROFILE_ID}/verify" "$OWNER_TOKEN" '{"verified":true}'
  is_2xx
}

driver_go_online() {
  local payload
  payload="$(jq -n \
    --argjson lat "$PICKUP_LAT" \
    --argjson lng "$PICKUP_LNG" \
    '{isOnline: true, lat: $lat, lng: $lng}')"

  api_request "POST" "/api/driver/status" "$DRIVER_TOKEN" "$payload"
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.isOnline == true' >/dev/null
}

rider_estimate_fare() {
  local payload
  payload="$(jq -n \
    --argjson pLat "$PICKUP_LAT" \
    --argjson pLng "$PICKUP_LNG" \
    --argjson dLat "$DROPOFF_LAT" \
    --argjson dLng "$DROPOFF_LNG" \
    --argjson distance "$DISTANCE_METERS" \
    --argjson duration "$DURATION_SECONDS" \
    '{
      pickup: {lat: $pLat, lng: $pLng},
      dropoff: {lat: $dLat, lng: $dLng},
      distanceMeters: $distance,
      durationSeconds: $duration,
      rideType: "standard"
    }')"

  api_request "POST" "/api/trips/estimate" "$RIDER_TOKEN" "$payload"
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.fare.total >= 0 and .etaSeconds >= 0 and .distanceMeters >= 0' >/dev/null
}

rider_create_trip() {
  local idem payload
  idem="trip-create-$(date +%s)"
  payload="$(jq -n \
    --argjson pLat "$PICKUP_LAT" \
    --argjson pLng "$PICKUP_LNG" \
    --argjson dLat "$DROPOFF_LAT" \
    --argjson dLng "$DROPOFF_LNG" \
    --argjson distance "$DISTANCE_METERS" \
    --argjson duration "$DURATION_SECONDS" \
    --arg idem "$idem" \
    '{
      pickup: {lat: $pLat, lng: $pLng},
      dropoff: {lat: $dLat, lng: $dLng},
      pickupAddress: "Nairobi CBD",
      dropoffAddress: "Upper Hill",
      distanceMeters: $distance,
      durationSeconds: $duration,
      rideType: "standard",
      paymentMethod: "CASH",
      idempotencyKey: $idem
    }')"

  api_request "POST" "/api/trips" "$RIDER_TOKEN" "$payload"
  if ! is_2xx; then
    return 1
  fi
  TRIP_ID="$(echo "$RESPONSE_BODY" | jq -r '.id // empty')"
  [ -n "$TRIP_ID" ]
}

wait_for_offer() {
  local i
  OFFER_ID=""
  for ((i = 1; i <= POLL_RETRIES; i++)); do
    api_request "GET" "/api/driver/requests" "$DRIVER_TOKEN"
    if is_2xx; then
      OFFER_ID="$(echo "$RESPONSE_BODY" | jq -r '.requests[0].id // empty')"
      if [ -n "$OFFER_ID" ]; then
        return 0
      fi
    fi
    sleep "$POLL_INTERVAL_SECONDS"
  done
  return 1
}

driver_accept_offer() {
  api_request "POST" "/api/driver/requests/${OFFER_ID}/accept" "$DRIVER_TOKEN"
  is_2xx
}

wait_for_trip_state() {
  local expected="$1"
  local i state
  for ((i = 1; i <= POLL_RETRIES; i++)); do
    api_request "GET" "/api/trips/${TRIP_ID}" "$RIDER_TOKEN"
    if is_2xx; then
      state="$(echo "$RESPONSE_BODY" | jq -r '.state // empty')"
      if [ "$state" = "$expected" ]; then
        return 0
      fi
    fi
    sleep "$POLL_INTERVAL_SECONDS"
  done
  return 1
}

driver_arrived() {
  api_request "POST" "/api/trips/${TRIP_ID}/arrived" "$DRIVER_TOKEN"
  is_2xx
}

driver_start_trip() {
  local pin payload idem
  idem="trip-start-$(date +%s)"

  api_request "GET" "/api/trips/${TRIP_ID}" "$RIDER_TOKEN"
  if ! is_2xx; then
    return 1
  fi

  pin="$(echo "$RESPONSE_BODY" | jq -r '.startPin // empty')"
  if [ -n "$pin" ]; then
    payload="$(jq -n --arg pin "$pin" --arg idem "$idem" '{pin: $pin, idempotencyKey: $idem}')"
  else
    payload="$(jq -n --arg idem "$idem" '{idempotencyKey: $idem}')"
  fi

  api_request "POST" "/api/trips/${TRIP_ID}/start" "$DRIVER_TOKEN" "$payload"
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.state == "IN_PROGRESS"' >/dev/null
}

rider_share_route() {
  api_request "POST" "/api/trips/${TRIP_ID}/share" "$RIDER_TOKEN"
  if ! is_2xx; then
    return 1
  fi
  local share_token
  share_token="$(echo "$RESPONSE_BODY" | jq -r '.token // empty')"
  [ -n "$share_token" ] || return 1

  api_request "GET" "/api/share/${share_token}"
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.trip.id == "'"$TRIP_ID"'"' >/dev/null
}

rider_send_sos() {
  api_request "POST" "/api/trips/${TRIP_ID}/sos" "$RIDER_TOKEN" '{"description":"Emergency test trigger from rider app"}'
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.status == "OPEN"' >/dev/null
}

driver_complete_trip() {
  api_request "POST" "/api/trips/${TRIP_ID}/complete" "$DRIVER_TOKEN"
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.trip.state == "COMPLETED"' >/dev/null
}

rider_rate_trip() {
  api_request "POST" "/api/trips/${TRIP_ID}/rate" "$RIDER_TOKEN" '{"score":5,"feedback":"Smooth and safe trip"}'
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.driverRating >= 0' >/dev/null
}

validate_final_trip() {
  api_request "GET" "/api/trips/${TRIP_ID}" "$RIDER_TOKEN"
  is_2xx && echo "$RESPONSE_BODY" | jq -e '.state == "COMPLETED" and (.events | length) > 0' >/dev/null
}

summary() {
  log ""
  log "Summary:"
  log "  Total:  $TOTAL_STEPS"
  log "  Passed: $PASSED_STEPS"
  log "  Failed: $FAILED_STEPS"
  if [ -n "$TRIP_ID" ]; then
    log "  Trip ID: $TRIP_ID"
  fi
}

main() {
  if ! require_cmd curl; then
    log "curl is required."
    exit 2
  fi
  if ! require_cmd jq; then
    log "jq is required."
    exit 2
  fi

  if [ -z "$OWNER_TOKEN" ] || [ -z "$DRIVER_TOKEN" ] || [ -z "$RIDER_TOKEN" ]; then
    usage
    exit 2
  fi

  log "API_BASE_URL=$API_BASE_URL"
  log "Running ride-hailing E2E checks..."

  step "Health check" check_health
  step "Resolve auth identities" check_auth_tokens
  step "Driver cannot create trips (service seeker only)" check_driver_cannot_create_trip
  step "Owner registers driver profile" register_driver_by_owner
  step "Unverified driver blocked from online status" check_unverified_driver_blocked_online
  step "Owner verifies driver" verify_driver
  step "Driver goes online" driver_go_online
  step "Rider gets fare estimate" rider_estimate_fare
  step "Rider creates trip" rider_create_trip
  step "Driver receives dispatch offer" wait_for_offer
  step "Driver accepts dispatch offer" driver_accept_offer
  step "Trip reaches DRIVER_ASSIGNED" wait_for_trip_state "DRIVER_ASSIGNED"
  step "Driver marks arrived" driver_arrived
  step "Driver starts trip (PIN if enabled)" driver_start_trip
  step "Rider creates and resolves share route token" rider_share_route
  step "Rider triggers SOS" rider_send_sos
  step "Driver completes trip" driver_complete_trip
  step "Rider rates driver" rider_rate_trip
  step "Final trip and audit events validation" validate_final_trip

  summary

  if [ "$FAILED_STEPS" -gt 0 ]; then
    exit 1
  fi
}

main "$@"
