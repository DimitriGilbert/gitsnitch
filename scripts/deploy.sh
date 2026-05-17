#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$REPO_ROOT/apps/web/public"
DIST_DIR="$REPO_ROOT/apps/web/dist/client"
EXAMPLE_DIR="$PUBLIC_DIR/example-report"

step() { echo "==> $*"; }

step "Building all packages..."
pnpm --filter "$REPO_ROOT" run build

step "Generating example report on this repo..."
mkdir -p "$EXAMPLE_DIR"
node "$REPO_ROOT/apps/cli/dist/index.js" repo "$REPO_ROOT" \
  --output "$EXAMPLE_DIR/index.html" \
  --overwrite

step "Verifying example report exists..."
if [ ! -f "$EXAMPLE_DIR/index.html" ]; then
  echo "ERROR: example report was not generated at $EXAMPLE_DIR/index.html" >&2
  exit 1
fi

step "Building web app (includes public/example-report in output)..."
pnpm --filter web run build

step "Deploying dist/client to gh-pages branch..."
npx gh-pages -d "$DIST_DIR" \
  --message "deploy: update site and example report"

step "Done! Site should be live at https://git-snitch.dbuild.dev"
