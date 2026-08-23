#!/usr/bin/env bash
set -euo pipefail
MOBILE="${1:-$PWD}"
BACKUP="$(cd "$(dirname "$0")" && pwd)"
find "$BACKUP/src" -type f 2>/dev/null | while read -r file; do
  rel="${file#$BACKUP/}"
  mkdir -p "$MOBILE/$(dirname "$rel")"
  cp "$file" "$MOBILE/$rel"
done
if [ -d "$BACKUP/assets/trava-workspace" ]; then
  rm -rf "$MOBILE/assets/trava-workspace"
  mkdir -p "$MOBILE/assets"
  cp -R "$BACKUP/assets/trava-workspace" "$MOBILE/assets/trava-workspace"
fi
echo "Rolled back TRAVA iOS workspace patch."
