#!/usr/bin/env bash
# Token takarekos wrapper az e2e lefedettsegi riport (nyc) korul
# (SPEC-001 11. szekcio).
#
# ============================ MIERT VAN SZUKSEG RA ===========================
#
# A riportot eddig a CI kozvetlenul hivta, `bun run --filter web
# coverage:e2e:report > fajl` alakban. Ket baja volt ennek:
#
#   1. A stdout fajlba ment, ezert HIBA ESETEN a `nyc` egyetlen hibasora
#      (`ENOENT: no such file or directory, scandir ... e2e/.nyc_output`)
#      a fajlban ragadt, es a CI naploban csak egy csupasz "Process completed
#      with exit code 1" latszott. A hibakereses igy lehetetlen volt.
#   2. A `nyc` hibauzenete onmagaban sem beszedes: nem mondja meg, hogy a
#      hianyzo temp-dir valojaban azt jelenti, hogy a Playwright teszt nem
#      futott le (peldaul mert a Turborepo cache-bol jatszotta vissza).
#
# A KIMENETI CSATORNAK SZANDEKOSAN SZET VANNAK VALASZTVA:
#
#   - stdout: KIZAROLAG a `nyc` szoveges tablazata, semmi mas. A CI ezt
#     iranyitja fajlba, es ebbol keszul a PR komment toredeke es a job
#     summary kodblokkja, ezert nem szabad fejlecsorral vagy idomeressel
#     szennyezni.
#   - stderr: a fejlec, az idomeres es minden hibauzenet. Ez CI-ben akkor is
#     lathato marad a naploban, ha a stdout fajlba megy, tehat a hiba soha
#     tobbe nem tud elrejtozni.
#
# A tenyleges `nyc` kapcsolok egyetlen helyen, az `apps/web/package.json`
# `coverage:e2e:report` scriptjeben allnak - ez a wrapper azt hivja, nem
# masolja le oket.
#
# =============================================================================
set -euo pipefail

readonly WEB_DIR="apps/web"
readonly NYC_TEMP_DIR="${WEB_DIR}/e2e/.nyc_output"
readonly WRAPPER_LOG_DIR=".turbo/wrapper-logs"
# A nyers naplo vegebol ennyi sort mutatunk hiba eseten. Nem uj, talalgatott
# ertek: ugyanaz a projekt konvencio, amit a test.sh es a _lib.sh is hasznal
# arra az esetre, amikor a futtatott eszkoznek nincs gepi olvashato
# hibakimenete.
readonly WRAPPER_TAIL_LINES=20

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

# Elofeltetel-ellenorzes. A nyers coverage JSON fajlokat az
# `apps/web/e2e/coverage-fixture.ts` Playwright fixture irja ki, a turbo.json
# `test:e2e` taskja pedig az `outputs` kozott cache-eli, tehat cache talalat
# eseten is helyreall. Ha megsincs egyetlen fajl sem, akkor a `test:e2e`
# egyaltalan nem futott le ebben a munkakonyvtarban - ezt mondjuk ki, ne a
# `nyc` nyers ENOENT sorabol kelljen kitalalni.
if ! compgen -G "${NYC_TEMP_DIR}/*.json" >/dev/null; then
  echo "e2e-coverage | hiba" >&2
  echo "nincs nyers coverage adat a ${NYC_TEMP_DIR} alatt" >&2
  echo "futtasd elotte: bun run test:e2e" >&2
  exit 1
fi

mkdir -p "$WRAPPER_LOG_DIR"
full_log="${WRAPPER_LOG_DIR}/e2e-coverage.log"

start_ts=$(date +%s)
exit_code=0
# A `--silent` a bun sajat `$ <parancs>` visszhangjat nemitja el, hogy a
# stdout tenylegesen csak a nyc tablazatat tartalmazza. A csomag
# konyvtarabol futtatjuk, nem `--filter`-rel, mert a `--filter` minden sor ele
# `web coverage:e2e:report:` elotagot fuz, ami a PR kommentben olvashatatlan.
(cd "$WEB_DIR" && bun run --silent coverage:e2e:report) >"$full_log" 2>&1 || exit_code=$?
end_ts=$(date +%s)
duration=$((end_ts - start_ts))

echo "e2e-coverage | ${duration}s" >&2

if [[ "$exit_code" -ne 0 ]]; then
  echo "a nyc riport nem keszult el, a nyers kimenet vege:" >&2
  tail -n "$WRAPPER_TAIL_LINES" "$full_log" >&2
  echo "teljes kimenet: ${full_log}" >&2
  exit "$exit_code"
fi

cat "$full_log"
