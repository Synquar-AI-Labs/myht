#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "$*" in
  whoami) exec npx wrangler whoami;;
  deploy)
    if [[ "${HOSTING_CONFIRM:-}" != 'myht-staging' ]]; then
      echo 'REFUSED: set HOSTING_CONFIRM=myht-staging for this invocation.' >&2
      exit 1
    fi
    node scripts/hosting-check.mjs
    exec npx wrangler pages deploy dist-staging --project-name myht-staging --branch main;;
  *) echo 'REFUSED: hosting command is not on the allowlist.' >&2; exit 1;;
esac
