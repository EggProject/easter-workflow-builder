#!/usr/bin/env bash
# Token takarekos ellenorzo: a packages/db sema (a .ts tabla fajlok) es a
# commitolt packages/db/drizzle migraciok szinkronban vannak-e (SPEC-003
# 10.3 szekcio "Drift ellenorzes" bekezdese, 15. szekcio 36. kriterium).
#
# ============================ A KIKENYSZERITETT SZABALY ======================
#
# Ha valaki modositana egy tablat `drizzle-kit generate` futtatasa (es a
# migracio commitolasa) NELKUL, a fejlesztoi es az eles adatbazis sema
# eltavolodna a commitolt migraciok altal leirt allapottol. Ez a szkript ezt
# a driftet detektalja: ujra lefuttatja a generalast, es megnezi, keletkezik-e
# nyomon nem kovetett valtozas a `drizzle/` mappaban.
#
# A mert viselkedes (docs/research/2026-08-27-spec003-f1-nyitott-kerdesek.md,
# O-5 szekcio): a `drizzle-kit generate` sema valtozas NELKUL NEM modositja a
# `drizzle/` mappat ("No schema changes, nothing to migrate", kilepesi kod
# `0`, fajlrendszeri hatas nelkul). Ha VAN eltavolodas, uj migracios SQL fajl
# es uj `meta/*_snapshot.json` keletkezik, a `meta/_journal.json` pedig
# modosul - ezt a `git status --porcelain` jelzi a `drizzle/` mappara szukitve.
#
# A PROBA drift eseten UJ migracios fajlt hoz letre a valodi munkakonyvtarban.
# Ezt a szkript a diagnosztikai kiiras UTAN, meg a kilepes ELOTT visszaallitja
# (`git checkout` a modositott, mar commitolt fajlokra, `git clean -fd` az
# ujonnan keletkezett, nyomon nem kovetett fajlokra), hogy a repo
# munkakonyvtara ne maradjon piszkosan.
#
# =============================================================================
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

readonly DB_DIR="packages/db"
readonly DRIZZLE_DIR="${DB_DIR}/drizzle"
readonly WRAPPER_LOG_DIR=".turbo/wrapper-logs"

start_ts=$(date +%s)

mkdir -p "$WRAPPER_LOG_DIR"
full_log="${WRAPPER_LOG_DIR}/db-drift.log"

exit_code=0
(cd "$DB_DIR" && bun x drizzle-kit generate) >"$full_log" 2>&1 || exit_code=$?

end_ts=$(date +%s)
duration=$((end_ts - start_ts))

echo "db-drift | ${duration}s"

if [[ "$exit_code" -ne 0 ]]; then
  echo "a drizzle-kit generate hibával lépett ki, a teljes kimenet:" >&2
  cat "$full_log" >&2
  exit "$exit_code"
fi

drift_status="$(git status --porcelain -- "$DRIZZLE_DIR")"

if [[ -z "$drift_status" ]]; then
  echo "DB séma és migrációk szinkronban"
  exit 0
fi

drift_count=$(printf '%s\n' "$drift_status" | wc -l | tr -d ' ')
echo "DRIFT ÉSZLELVE: ${drift_count} fájl eltér"

{
  echo "a commitolt migrációk NEM tükrözik a jelenlegi sémát."
  echo "eltérő fájlok (git status --porcelain ${DRIZZLE_DIR}):"
  printf '%s\n' "$drift_status"
  echo
  echo "futtasd helyben: cd ${DB_DIR} && bun x drizzle-kit generate, majd commitold a drizzle/ változást."
} >&2

# Visszaallitas, hogy a repo munkakonyvtara ne maradjon piszkosan: a mar
# commitolt, de a proba altal modositott fajlokat (pl. meta/_journal.json) a
# checkout, az UJONNAN generalt, nyomon nem kovetett fajlokat (uj migracios
# sql + uj meta snapshot) a clean allitja vissza / tavolitja el.
git checkout -- "$DRIZZLE_DIR"
git clean -fd -- "$DRIZZLE_DIR" >/dev/null

exit 1
