#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${AGORA_LENS_HOST:-jackey@60.204.151.206}"
APP_DIR="${AGORA_LENS_APP_DIR:-/home/jackey/apps/agora-lens}"
PORT="${AGORA_LENS_PORT:-18080}"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
ARCHIVE="/tmp/agora-lens-prod-${TIMESTAMP}.tgz"
REMOTE_ARCHIVE="/tmp/agora-lens-prod-${TIMESTAMP}.tgz"

cd "$ROOT_DIR"

if [[ "${SKIP_CHECKS:-0}" != "1" ]]; then
  npm test
  npm run lint
fi

npm run build

COPYFILE_DISABLE=1 tar \
  --exclude='.DS_Store' \
  -czf "$ARCHIVE" \
  dist \
  server \
  package.json \
  package-lock.json \
  README.md \
  docs \
  deploy

scp "$ARCHIVE" "$HOST:$REMOTE_ARCHIVE"

ssh "$HOST" "APP_DIR='$APP_DIR' PORT='$PORT' TIMESTAMP='$TIMESTAMP' REMOTE_ARCHIVE='$REMOTE_ARCHIVE' bash -s" <<'REMOTE'
set -euo pipefail

RELEASE="$APP_DIR/releases/$TIMESTAMP"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/agora-lens.service"

mkdir -p "$RELEASE" "$APP_DIR/shared" "$APP_DIR/data" "$SERVICE_DIR"
tar -xzf "$REMOTE_ARCHIVE" -C "$RELEASE"
ln -sfn "$RELEASE" "$APP_DIR/current"
cp "$APP_DIR/current/deploy/systemd/agora-lens.service" "$SERVICE_FILE"

if [[ -f "$APP_DIR/shared/server.pid" ]]; then
  OLD_PID="$(cat "$APP_DIR/shared/server.pid")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
  fi
fi

systemctl --user daemon-reload
systemctl --user enable --now agora-lens.service
systemctl --user restart agora-lens.service
sleep 1

systemctl --user --no-pager --full status agora-lens.service
curl -fsS "http://127.0.0.1:$PORT/api/health"
echo
REMOTE

echo "Deployed Agora Lens to http://60.204.151.206:${PORT}/"
