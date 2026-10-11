#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
classic_pages() {
  scratch=$(mktemp -d /private/tmp/myht-pages.XXXXXX)
  trap 'rm -rf "$scratch"' EXIT
  if [[ "$1" == deploy ]]; then
    cp -R "$repo/dist-staging" "$scratch/dist-staging"
  fi
  cd "$scratch"
  if [[ "$1" == create ]]; then
    "$repo/node_modules/.bin/wrangler" pages project create myht-staging --production-branch main --force
  else
    "$repo/node_modules/.bin/wrangler" pages deploy dist-staging --project-name myht-staging --branch main --force
  fi
}
case "$*" in
  whoami) exec npx --no-install wrangler whoami;;
  create)
    if [[ "${HOSTING_CONFIRM:-}" != 'myht-staging' ]]; then
      echo 'REFUSED: set HOSTING_CONFIRM=myht-staging for this invocation.' >&2
      exit 1
    fi
    classic_pages create;;
  deploy)
    if [[ "${HOSTING_CONFIRM:-}" != 'myht-staging' ]]; then
      echo 'REFUSED: set HOSTING_CONFIRM=myht-staging for this invocation.' >&2
      exit 1
    fi
    node scripts/hosting-check.mjs
    classic_pages deploy;;
  *) echo 'REFUSED: hosting command is not on the allowlist.' >&2; exit 1;;
esac
