#!/bin/zsh
set -e

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

cleanup() {
  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting TRAVA API on port 3001..."
npm run api &
API_PID=$!

sleep 2
if ! kill -0 "$API_PID" >/dev/null 2>&1; then
  echo "The API process exited before Expo started."
  wait "$API_PID"
  exit 1
fi

echo
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
CONFIGURED_API="${EXPO_PUBLIC_API_BASE_URL:-}"
if [[ -z "$CONFIGURED_API" && -f "$ROOT/apps/mobile/.env" ]]; then
  CONFIGURED_API="$(grep -E '^EXPO_PUBLIC_API_BASE_URL=' "$ROOT/apps/mobile/.env" | tail -1 | cut -d= -f2- | tr -d '"')" || true
fi
if [[ -n "$LAN_IP" && ( -z "$CONFIGURED_API" || "$CONFIGURED_API" == *"localhost"* || "$CONFIGURED_API" == *"127.0.0.1"* ) ]]; then
  export EXPO_PUBLIC_API_BASE_URL="http://${LAN_IP}:3001"
  echo "Physical-device API URL: $EXPO_PUBLIC_API_BASE_URL"
fi

echo "Starting Expo. Press w for web; scan the QR for mobile."
cd "$ROOT/apps/mobile"
npx expo start --clear --lan
