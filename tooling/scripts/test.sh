#!/usr/bin/env bash
# Token takarekos wrapper a Vitest korul (SPEC-001 11. szekcio).
#
# Ez a wrapper - a format.sh mintajara - KOZVETLENUL a Vitestet hivja, NEM a
# `turbo run test` taskon keresztul. Indok: a Vitest "Test Projects"
# dokumentacioja a `coverage` blokkot explicit "Unsupported Option"-kent
# sorolja fel projekt szinten, mert a lefedettseg a TELJES folyamatra
# vonatkozik, nem projektenkent (https://vitest.dev/guide/projects,
# "Configuration" szakasz). Emiatt a Vitest EGYETLEN, gyoker szintu
# folyamatban fedi le az osszes csomagot - pontosan ugyanaz az ok, amiert a
# Prettier is kozvetlenul fut, nem `turbo run format:check`-en keresztul
# (lasd format.sh). A turbo.json `//#test` taskja ugyanezt a Vitest
# parancsot futtatja a gyoker `package.json` "test" scriptjen keresztul -
# azt a `turbo run format:check typecheck lint test` (SPEC-001 12. szekcio,
# CI `verify` job) hivja, ezen a wrapperen kivul, hogy a Turborepo cache-e
# lefedje.
set -euo pipefail

readonly WRAPPER_LOG_DIR=".turbo/wrapper-logs"
# A csonkolasi hatarok: legfeljebb ennyi hibas teszt sorat irjuk ki, es
# hibaüzenetenkent legfeljebb ennyi karaktert. Erre nincs dokumentalt szabaly
# (SPEC-001 11. szekcio, V-16) - ugyanaz az elv, mint a tooling/scripts/_lib.sh
# WRAPPER_ERROR_LIMIT-jenel: onkenyesen valasztott, de eleg nagy ahhoz, hogy
# tobb hibas teszt is lathato legyen egy futasban, es nem arasztja el a hivo
# agent context ablakat egy nagy hibaüzenettel.
readonly WRAPPER_ERROR_LIMIT=50
readonly WRAPPER_MESSAGE_CHAR_LIMIT=200

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"
mkdir -p "$WRAPPER_LOG_DIR"

full_log="$WRAPPER_LOG_DIR/test.log"
results_json="$WRAPPER_LOG_DIR/test-results.json"
rm -f "$results_json"

start_ts=$(date +%s)
exit_code=0
node_modules/.bin/vitest run --coverage --reporter=default --reporter=json --outputFile="$results_json" \
  >"$full_log" 2>&1 || exit_code=$?
end_ts=$(date +%s)
duration=$((end_ts - start_ts))

echo "test | ${duration}s"

if [[ ! -f "$results_json" ]]; then
  # A Vitest meg a tesztek elinditasa elott osszeomlott (pl. hibas
  # vitest.config.ts) - nincs JSON eredmeny, a nyers naplo vegevel adunk kepet.
  echo "teszteredmeny JSON nem keszult, a nyers kimenet vege:"
  tail -n 20 "$full_log"
  exit "$exit_code"
fi

total=$(jq -r '.numTotalTests' "$results_json")
passed=$(jq -r '.numPassedTests' "$results_json")
failed=$(jq -r '.numFailedTests' "$results_json")
pending=$(jq -r '.numPendingTests' "$results_json")

echo "${passed}/${total} teszt sikeres, ${failed} hibás, ${pending} függőben"

# Kulon coverage osszegzo blokk: metrikankent a szazalek es a kuszob. A
# json-summary reporter (vitest.config.ts coverage.reporter) irja a
# coverage/coverage-summary.json "total" kulcsat - ha a `coverage.include`
# jelenleg semmit nem fed (lasd vitest.config.ts megjegyzese: minden csomag
# meg placeholder), a pct erteke a Vitest sajat "Unknown" stringje, ez itt is
# valtozatlanul megjelenik.
if [[ -f coverage/coverage-summary.json ]]; then
  echo
  echo "coverage:"
  jq -r '
    .total
    | to_entries
    | map(select(.key == "lines" or .key == "statements" or .key == "functions" or .key == "branches"))
    | .[]
    | "  \(.key): \(.value.pct)% (küszöb: 100%)"
  ' coverage/coverage-summary.json
fi

if [[ "$failed" -gt 0 ]]; then
  echo
  jq -r --arg limit "$WRAPPER_MESSAGE_CHAR_LIMIT" '
    .testResults[]
    | .name as $file
    | .assertionResults[]
    | select(.status == "failed")
    | "\($file) > \(.fullName // .title): " + ((.failureMessages // [""])[0] | gsub("\n"; " ") | .[0:($limit | tonumber)])
  ' "$results_json" | sed "s|${root_dir}/||g" >"$WRAPPER_LOG_DIR/test-failures.txt"

  failure_count=$(wc -l <"$WRAPPER_LOG_DIR/test-failures.txt" | tr -d ' ')
  head -n "$WRAPPER_ERROR_LIMIT" "$WRAPPER_LOG_DIR/test-failures.txt"
  remaining=$((failure_count > WRAPPER_ERROR_LIMIT ? failure_count - WRAPPER_ERROR_LIMIT : 0))
  if [[ "$remaining" -gt 0 ]]; then
    echo "... és még ${remaining} hibás teszt (lásd a teljes kimenetet)"
  fi

  echo
  echo "teljes kimenet: ${full_log}"
fi

exit "$exit_code"
