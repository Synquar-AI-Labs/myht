#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ref=$(tr -d '\r\n' < supabase/.temp/project-ref)
if [[ "$ref" == "fvasmrdtzqhswhowlydx" ]]; then
  echo 'REFUSED: legacy production project.' >&2
  exit 1
fi
if [[ "$ref" != "lefqfxkvujqnukgzaviz" ]]; then
  echo 'REFUSED: not myht-staging.' >&2
  exit 1
fi
echo "Staging project: $ref"
# Do not permit callers to redirect an approved command to another database.
for arg in "$@"; do
  case "$arg" in
    --db-url*|--project-ref*|--workdir*) echo 'REFUSED: target override.' >&2; exit 1;;
  esac
done
case "$*" in
  'db push --linked'|'migration list --linked'|'db reset --linked') exec supabase "$@";;
  *) echo 'Use: staging.sh db push --linked | migration list --linked | db reset --linked' >&2; exit 1;;
esac
