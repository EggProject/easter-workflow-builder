#!/usr/bin/env bash
# Token takarekos ellenorzo: a workspace fuggosegi grafja aciklikus-e, es
# minden ele a SPEC-002 4. szekcio "Retegbesorolas, mind a 32 csomagra"
# tablazata szerint szigoruan csokkeno retegszam fele mutat-e (T-002-24).
#
# A tenyleges ellenorzest a `tooling/scripts/src/dependency-graph/
# check-dependency-graph.ts` vegzi (Node 26 type stripping, nincs build
# lepes) - ez a wrapper csak osszegzest ad a kimenetehez, a casing.sh
# mintajara: nem turbo taskon keresztul fut, mert a szabalya a teljes repora
# vonatkozik, nem csomagonkent.
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

start_ts=$(date +%s)

log_dir=".turbo/wrapper-logs"
mkdir -p "$log_dir"
full_log="$log_dir/dependency-graph-check.log"

exit_code=0
node tooling/scripts/src/dependency-graph/check-dependency-graph.ts >"$full_log" 2>&1 || exit_code=$?

end_ts=$(date +%s)
duration=$((end_ts - start_ts))

echo "dependency-graph-check | ${duration}s"

if [[ "$exit_code" -eq 0 ]]; then
  echo "0 eltérés a függőségi gráf rétegzési szabályaitól"
  exit 0
fi

violation_count=$(wc -l <"$full_log" | tr -d ' ')
echo "${violation_count} eltérés a függőségi gráf rétegzési szabályaitól"
echo
cat "$full_log"
exit "$exit_code"
