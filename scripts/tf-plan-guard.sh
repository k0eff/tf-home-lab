#!/usr/bin/env bash
# tf-plan-guard.sh — run `terraspace plan` for one stack and refuse destructive plans.
#
# PLAN ONLY. This script has no apply path: it never runs `terraspace up`,
# `terraform apply` or `terraform destroy`, and there is no flag that enables one.
# Applying stays a deliberate human step (`make apply` after reading the plan).
#
# Usage:
#   scripts/tf-plan-guard.sh [STACK] [TS_ENV]      # defaults: proxmox-vm prod
#   scripts/tf-plan-guard.sh --plan-json FILE      # judge a saved `terraform show -json` plan
#
# Exit codes:
#   0  plan has no delete / replace actions
#   2  plan deletes or force-replaces at least one resource (listed on stderr) — do NOT apply
#   1  could not tell (plan failed, env missing, JSON unreadable) — fails closed, never "0"
set -uo pipefail

REPO_ROOT="${TF_HOME_LAB_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"  # override: a checkout with protected/ populated

judge() { # $1 = plan JSON file
  local json="$1" destructive rc
  command -v jq >/dev/null || { echo "FATAL: jq not found" >&2; return 1; }
  jq -e '.resource_changes' "$json" >/dev/null || { echo "FATAL: $json is not a terraform show -json plan" >&2; return 1; }
  jq -r '"summary: " + ([.resource_changes[]?.change.actions | join("/")] | group_by(.) | map("\(.[0])=\(length)") | join(" "))' "$json"
  destructive="$(jq -r '.resource_changes[]? | select(.change.actions | index("delete")) | "  \(.change.actions | join("/"))  \(.address)"' "$json")"
  rc=$?
  [ $rc -eq 0 ] || { echo "FATAL: jq failed ($rc) while reading actions" >&2; return 1; }
  if [ -n "$destructive" ]; then
    echo "REFUSED: plan destroys or force-replaces resources:" >&2
    echo "$destructive" >&2
    return 2
  fi
  echo "OK: no delete/replace actions"
  return 0
}

if [ "${1:-}" = "--plan-json" ]; then
  [ -f "${2:-}" ] || { echo "usage: $0 --plan-json FILE" >&2; exit 1; }
  judge "$2"; exit $?
fi

STACK="${1:-proxmox-vm}"
TS_ENV_ARG="${2:-prod}"
[ -d "$REPO_ROOT/app/stacks/$STACK" ] || { echo "FATAL: no stack app/stacks/$STACK" >&2; exit 1; }
[ -f "$REPO_ROOT/protected/main.sh" ] || { echo "FATAL: protected/ submodule not checked out" >&2; exit 1; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
cd "$REPO_ROOT" || exit 1

# protected/main.sh exports credentials; its echo lines only name env/stack. Output is discarded
# so nothing sourced from protected/ reaches the terminal.
# shellcheck disable=SC1091
. ./protected/main.sh "$TS_ENV_ARG" "$STACK" >/dev/null || { echo "FATAL: sourcing protected/main.sh failed" >&2; exit 1; }

echo "== terraspace plan $STACK (env $TS_ENV_ARG) — plan only, no apply =="
if ! terraspace plan "$STACK" --out "$WORK/guard.tfplan" --no-input --no-copy-to-root >"$WORK/plan.log" 2>&1; then
  tail -20 "$WORK/plan.log" >&2
  echo "FATAL: terraspace plan failed — could not tell" >&2; exit 1
fi
grep -E '^(Plan:|No changes\.)' "$WORK/plan.log" || true

CACHE_DIR="$REPO_ROOT/.terraspace-cache/$TS_ENV_ARG/stacks/$STACK"
( cd "$CACHE_DIR" && terraform show -json "$WORK/guard.tfplan" ) >"$WORK/plan.json" \
  || { echo "FATAL: terraform show -json failed in $CACHE_DIR" >&2; exit 1; }
judge "$WORK/plan.json"; exit $?
