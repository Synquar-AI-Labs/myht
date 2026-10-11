#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "$*" in
  whoami) exec npx --no-install wrangler whoami;;
  create)
    if [[ "${HOSTING_CONFIRM:-}" != 'myht-staging' ]]; then
      echo 'REFUSED: set HOSTING_CONFIRM=myht-staging for this invocation.' >&2
      exit 1
    fi
    exec npx --no-install wrangler pages project create myht-staging --production-branch main;;
  deploy)
    if [[ "${HOSTING_CONFIRM:-}" != 'myht-staging' ]]; then
      echo 'REFUSED: set HOSTING_CONFIRM=myht-staging for this invocation.' >&2
      exit 1
    fi
    node scripts/hosting-check.mjs
    exec npx --no-install wrangler pages deploy dist-staging --project-name myht-staging --branch main;;
  *) echo 'REFUSED: hosting command is not on the allowlist.' >&2; exit 1;;
esac
