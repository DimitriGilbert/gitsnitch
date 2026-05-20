#!/usr/bin/env bash
set -euo pipefail

# ── git-snitch release ────────────────────────────────────────────────────────
# Bumps versions, tags, pushes, creates a GitHub release, and publishes
# all public packages to npm.
#
# Usage:
#   scripts/release.sh <version> [--no-gh] [--no-npm] [--dry-run]
#
# Examples:
#   scripts/release.sh 1.0.0
#   scripts/release.sh 2.1.3 --dry-run
#   scripts/release.sh 1.0.0 --no-gh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly REPO_ROOT

readonly GITHUB_REPO="DimitriGilbert/gitsnitch"
readonly SEMVER_REGEX='^[0-9]+\.[0-9]+\.[0-9]+$'

# ── helpers ───────────────────────────────────────────────────────────────────

info()   { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
ok()     { printf '\033[1;32m[ OK ]\033[0m  %s\n' "$*"; }
warn()   { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
die()    { printf '\033[1;31m[FAIL]\033[0m  %s\n' "$*" >&2; exit 1; }
dryrun() { printf '\033[1;36m[DRY]\033[0m   %s\n' "$*"; }

# ── arguments ─────────────────────────────────────────────────────────────────

VERSION=""
NO_GH=false
NO_NPM=false
DRY_RUN=false

parse_args() {
  if [[ $# -lt 1 ]]; then
    die "Usage: scripts/release.sh <version> [--no-gh] [--no-npm] [--dry-run]"
  fi
  VERSION="$1"; shift
  for arg in "$@"; do
    case "$arg" in
      --no-gh)   NO_GH=true ;;
      --no-npm)  NO_NPM=true ;;
      --dry-run) DRY_RUN=true ;;
      *)         die "Unknown option: ${arg}" ;;
    esac
  done
}

# ── discover publishable packages ─────────────────────────────────────────────
# Finds packages with "publishConfig" in their package.json (excludes private).

PUBLISHABLE=()

discover_packages() {
  info "Discovering publishable packages..."
  local pkg_json
  while IFS= read -r -d '' pkg_json; do
    if grep -q '"publishConfig"' "$pkg_json" 2>/dev/null; then
      local dir
      dir="$(dirname "$pkg_json")"
      local rel="${dir#"${REPO_ROOT}"/}"
      PUBLISHABLE+=("$rel")
    fi
  done < <(find "$REPO_ROOT" -path '*/node_modules' -prune -o -name 'package.json' -print0)
  if [[ ${#PUBLISHABLE[@]} -eq 0 ]]; then
    die "No publishable packages found"
  fi
  ok "Found: ${PUBLISHABLE[*]}"
}

# ── version validation ────────────────────────────────────────────────────────

validate_version() {
  [[ "$VERSION" =~ $SEMVER_REGEX ]] || die "Invalid version '${VERSION}'. Must be semver (e.g. 1.0.0)"
}

# ── preflight ─────────────────────────────────────────────────────────────────

preflight() {
  info "Running preflight checks..."
  command -v git  &>/dev/null || die "git not found"
  command -v node &>/dev/null || die "node not found"
  command -v pnpm &>/dev/null || die "pnpm not found"

  git -C "$REPO_ROOT" diff --quiet        || die "Working tree dirty — commit or stash first"
  git -C "$REPO_ROOT" diff --cached --quiet || die "Staged changes exist — commit or stash first"

  local branch
  branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" != "main" && "$branch" != "master" ]]; then
    warn "Not on main/master (current: ${branch})"
  fi

  if [[ "$NO_GH" == false ]]; then
    command -v gh &>/dev/null || die "gh CLI required for GitHub releases"
    gh auth status &>/dev/null 2>&1 || die "gh not authenticated — run 'gh auth login'"
    ok "gh CLI authenticated"
  fi

  if [[ "$NO_NPM" == false ]]; then
    npm whoami &>/dev/null 2>&1 || die "npm not authenticated — run 'npm login'"
    ok "npm authenticated as $(npm whoami 2>/dev/null)"
  fi

  ok "Preflight checks passed"
}

# ── guards ────────────────────────────────────────────────────────────────────

guard_typecheck() {
  info "Running typecheck..."
  pnpm check-types || die "Typecheck failed"
  ok "Typecheck passed"
}

guard_build() {
  info "Building all packages..."
  pnpm build || die "Build failed"
  ok "Build complete"
}

# ── bump versions ─────────────────────────────────────────────────────────────

bump_version_in_file() {
  local file="$1"
  if [[ ! -f "$file" ]] || ! grep -q '"version"' "$file"; then
    return 0
  fi
  if command -v jq &>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    jq --arg v "$VERSION" '.version = $v' "$file" > "$tmp" && mv "$tmp" "$file"
  else
    sed -i -E 's/"version"[[:space:]]*:[[:space:]]*"[^"]*"/"version": "'"${VERSION}"'"/' "$file"
  fi
}

bump_versions() {
  info "Bumping versions to ${VERSION}..."

  if [[ "$DRY_RUN" == true ]]; then
    dryrun "Would bump root package.json"
    for rel in "${PUBLISHABLE[@]}"; do
      dryrun "Would bump ${rel}/package.json"
    done
    return 0
  fi

  bump_version_in_file "${REPO_ROOT}/package.json"
  for rel in "${PUBLISHABLE[@]}"; do
    bump_version_in_file "${REPO_ROOT}/${rel}/package.json"
  done

  ok "Versions bumped to ${VERSION}"
}

# ── git: commit, tag, push ────────────────────────────────────────────────────

git_release() {
  if [[ "$DRY_RUN" == true ]]; then
    dryrun "git add + commit 'release v${VERSION}' + tag v${VERSION} + push"
    return 0
  fi

  local files=(package.json)
  for rel in "${PUBLISHABLE[@]}"; do
    files+=("${rel}/package.json")
  done

  info "Committing version bump..."
  git -C "$REPO_ROOT" add "${files[@]}"
  if git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
    ok "Version already at ${VERSION}, nothing to commit"
  else
    git -C "$REPO_ROOT" commit -m "release v${VERSION}"
    ok "Committed version bump"
  fi

  info "Tagging v${VERSION}..."
  git -C "$REPO_ROOT" tag "v${VERSION}"
  ok "Tagged v${VERSION}"

  info "Pushing to remote..."
  git -C "$REPO_ROOT" push -u origin HEAD
  git -C "$REPO_ROOT" push --tags
  ok "Pushed commit and tag"
}

# ── GitHub release ────────────────────────────────────────────────────────────

github_release() {
  if [[ "$NO_GH" == true ]]; then
    info "Skipping GitHub release (--no-gh)"
    return 0
  fi

  if [[ "$DRY_RUN" == true ]]; then
    dryrun "gh release create v${VERSION} --repo ${GITHUB_REPO}"
    return 0
  fi

  info "Creating GitHub release v${VERSION}..."
  gh release create "v${VERSION}" \
    --repo "$GITHUB_REPO" \
    --title "v${VERSION}" \
    --notes "Release v${VERSION} of git-snitch."
  ok "GitHub release: https://github.com/${GITHUB_REPO}/releases/tag/v${VERSION}"
}

# ── npm publish ───────────────────────────────────────────────────────────────

npm_publish() {
  if [[ "$NO_NPM" == true ]]; then
    info "Skipping npm publish (--no-npm)"
    return 0
  fi

  for rel in "${PUBLISHABLE[@]}"; do
    local pkg_dir="${REPO_ROOT}/${rel}"
    local pkg_name
    pkg_name="$(node -e "process.stdout.write(require('${pkg_dir}/package.json').name)")"

    if [[ "$DRY_RUN" == true ]]; then
      dryrun "npm publish --access public  (${pkg_name} from ${rel})"
      (cd "$pkg_dir" && npm publish --access public --dry-run)
      continue
    fi

    info "Publishing ${pkg_name}..."
    (cd "$pkg_dir" && npm publish --access public)
    ok "Published ${pkg_name}"
  done
}

# ── summary ───────────────────────────────────────────────────────────────────

print_summary() {
  echo ""
  printf '\033[1;32m%s\033[0m\n' "══════════════════════════════════════════"
  printf '\033[1;32m%s\033[0m\n' "  Release v${VERSION} complete!"
  printf '\033[1;32m%s\033[0m\n' "══════════════════════════════════════════"
  echo "  Version:  ${VERSION}"
  echo "  Tag:      v${VERSION}"
  echo "  GitHub:   $([[ "$NO_GH" == false ]] && echo "https://github.com/${GITHUB_REPO}/releases/tag/v${VERSION}" || echo "(skipped)")"
  echo "  npm:      $([[ "$NO_NPM" == false ]] && echo "${#PUBLISHABLE[@]} packages published" || echo "(skipped)")"
  if [[ "$DRY_RUN" == true ]]; then
    printf '\033[1;36m%s\033[0m\n' "  (dry run — no mutations performed)"
  fi
  echo ""
}

# ── main ──────────────────────────────────────────────────────────────────────

main() {
  parse_args "$@"
  validate_version
  discover_packages

  info "git-snitch release — v${VERSION}"

  preflight
  guard_typecheck
  guard_build
  bump_versions
  git_release
  github_release
  npm_publish
  print_summary
}

main "$@"
