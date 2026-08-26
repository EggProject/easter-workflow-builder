#!/usr/bin/env bash
# Token takarekos wrapper a `turbo run typecheck` korul (SPEC-001 11. szekcio).
# Csak osszegzest es hibat ir ki, a nyers tsc kimenetet nem.
set -euo pipefail

# shellcheck source=./_lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

wrapper_run_turbo_task "typecheck"
