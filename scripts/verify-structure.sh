#!/usr/bin/env bash
set -euo pipefail
required=(
  "apps/mobile/package.json"
  "apps/api/package.json"
  "packages/shared/package.json"
  "supabase/config.toml"
  "legacy/web-vite/package.json"
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Missing required path: $path" >&2; exit 1; }
done
echo "Repository structure is valid."
