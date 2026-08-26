#!/usr/bin/env bash
# Token takarekos ellenorzo: a git INDEXBEN tarolt fajlnevek betuzese
# megegyezik-e a rajuk hivatkozo relativ import specifikatorok betuzesevel.
#
# ============================ A KIKENYSZERITETT SZABALY ======================
#
# Case-insensitive fejlesztoi fajlrendszeren (`git config core.ignorecase` =
# `true`) egy hibas atnevezes a git indexet a REGI betuzesen hagyhatja,
# miközben a lemez mar a helyeset mutatja - ilyenkor sem a `git status`, sem
# a lemez-alapu eszkozok (`eslint import-x/no-unresolved` `caseSensitive`
# opcioja, `tsc forceConsistentCasingInFileNames`) nem jeleznek semmit, mert
# ok a lemezt latjak, nem a git indexet. Csak egy VALODI, kis-nagybetu-
# erzekeny checkoutnal (a CI-ban) derul ki a hiba: `TS2307 Cannot find
# module`. A resztes indoklas es az elo meres, ami ezt igazolja:
# `tooling/scripts/src/casing/find-casing-mismatches.ts` fejleceben.
#
# A tenyleges ellenorzest a `tooling/scripts/src/casing/check-casing.ts`
# vegzi (Node 26 type stripping, nincs build lepes) - ez a wrapper csak
# osszegzest ad a kimenetehez, a claude-md.sh mintajara: nem turbo taskon
# keresztul fut, mert a szabalya a teljes reporra vonatkozik, nem
# csomagonkent.
#
# =============================================================================
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

start_ts=$(date +%s)

log_dir=".turbo/wrapper-logs"
mkdir -p "$log_dir"
full_log="$log_dir/casing-check.log"

exit_code=0
node tooling/scripts/src/casing/check-casing.ts >"$full_log" 2>&1 || exit_code=$?

end_ts=$(date +%s)
duration=$((end_ts - start_ts))

echo "casing-check | ${duration}s"

if [[ "$exit_code" -eq 0 ]]; then
  echo "0 eltérés a git index fájlnevek és az importok betűzése között"
  exit 0
fi

mismatch_count=$(wc -l <"$full_log" | tr -d ' ')
echo "${mismatch_count} eltérés a git index fájlnevek és az importok betűzése között"
echo
cat "$full_log"
exit "$exit_code"
