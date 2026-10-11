#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f supabase/.temp/project-ref ]]; then
  echo 'REFUSED: no linked project. Link myht-staging only after approval.' >&2
  exit 1
fi
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
change=false
case "$*" in
  'migration list --linked'|'db push --linked --dry-run'|'secrets list') ;;
  'db push --linked'|'db reset --linked'|'functions deploy transcribe-audio'|'config push') change=true;;
  *) echo 'REFUSED: command is not on the staging allowlist.' >&2; exit 1;;
esac
if [[ "$change" == true && "${STAGING_CONFIRM:-}" != "$ref" ]]; then
  echo "REFUSED: set STAGING_CONFIRM=$ref for this invocation." >&2
  exit 1
fi
# Ambient workdir/project overrides must not change the checked target.
unset SUPABASE_WORKDIR SUPABASE_PROJECT_REF SUPABASE_DB_URL
case "$*" in
  'functions deploy transcribe-audio'|'config push'|'secrets list')
    exec supabase --workdir "$PWD" "$@" --project-ref "$ref";;
  *) exec supabase --workdir "$PWD" "$@";;
esac
