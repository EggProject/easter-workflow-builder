#!/usr/bin/env bash
# Token takarekos wrapper a Prettier korul (SPEC-001 11. szekcio).
# Alapertelmezesben ellenorzo (--check) mod, `--write` kapcsoloval iras mod.
# Ez a wrapper a Prettiert kozvetlenul hivja, nem a `turbo run format:check`
# taskon keresztul, mert a Prettier egyetlen futassal a teljes repot fedi
# (SPEC-001 11. szekcio tablazata).
set -euo pipefail

readonly WRAPPER_LOG_DIR=".turbo/wrapper-logs"
# Ugyanaz az indoklas, mint a turbo-alapu wrappereknel (_lib.sh
# WRAPPER_ERROR_LIMIT): dokumentalt szabaly nincs, az ertek projekt dontes,
# amit a V-16 meres keretez (docs/research/2026-08-26-spec001-ellenorzesek.md).
# Itt a sorok fajlnevek, tehat rovidebbek mint egy tsc hibasor, a 15 kB-os
# nagysagrendi keret bosegesen tartja ezt a hatart.
readonly WRAPPER_FILE_LIMIT=50

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"
mkdir -p "$WRAPPER_LOG_DIR"

mode="check"
if [[ "${1:-}" == "--write" ]]; then
  mode="write"
fi

full_log="$WRAPPER_LOG_DIR/format-${mode}.log"
start_ts=$(date +%s)

exit_code=0
if [[ "$mode" == "write" ]]; then
  node_modules/.bin/prettier --write . >"$full_log" 2>&1 || exit_code=$?
else
  node_modules/.bin/prettier --check . >"$full_log" 2>&1 || exit_code=$?
fi

end_ts=$(date +%s)
duration=$((end_ts - start_ts))

echo "format (${mode}) | ${duration}s"

if [[ "$mode" == "check" ]]; then
  if [[ "$exit_code" -eq 0 ]]; then
    echo "minden fajl formazott"
  else
    # A nem formazott fajlokat a Prettier soronkent "[warn] <ut>" alakban irja
    # ki, majd egy zaro osszegzo sorral. A darabszamot a fajlsorok
    # megszamolasabol vesszuk, NEM az osszegzo sorbol: az osszegzo egyes es
    # tobbes szamban is elofordul ("... in the above file." vs "... in 3
    # files."), es a korabbi, csak tobbes szamra illeszkedo minta egyetlen
    # hibas fajlnal ures erteket adott, amitol az also aritmetika
    # "syntax error: operand expected" hibaval elszallt.
    file_count=$(grep '^\[warn\]' "$full_log" | grep -vc 'Code style issues found' || true)
    [[ -z "$file_count" ]] && file_count=0
    echo "${file_count} fajl nincs formazva"
    echo
    grep '^\[warn\]' "$full_log" | grep -v 'Code style issues found' | head -n "$WRAPPER_FILE_LIMIT" | sed 's/^\[warn\] /nem formazott: /'
    remaining=$((file_count > WRAPPER_FILE_LIMIT ? file_count - WRAPPER_FILE_LIMIT : 0))
    if [[ "$remaining" -gt 0 ]]; then
      echo "... es meg ${remaining} fajl (lasd a teljes kimenetet)"
    fi
    echo
    echo "teljes kimenet: ${full_log}"
  fi
else
  changed=$(grep -cvE '\(unchanged\)|^$' "$full_log" || true)
  echo "${changed} fajl ujraformazva"
  if [[ "$exit_code" -ne 0 ]]; then
    echo "teljes kimenet: ${full_log}"
  fi
fi

exit "$exit_code"
