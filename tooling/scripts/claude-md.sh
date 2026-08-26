#!/usr/bin/env bash
# Token takarekos ellenorzo: van-e CLAUDE.md ott, ahol a projekt szabalya
# szerint kotelezo. Csak osszegzest es a hianyzo helyeket irja ki.
#
# ============================ A KIKENYSZERITETT SZABALY ======================
#
# A gyoker CLAUDE.md eloirja, hogy "minden mappaban a CLAUDE.md fajlt vezetni
# kell", a SPEC-001 14. szekcio "Hol kell" tablazata pedig ezt szintekre
# bontja. A ketto egyutt a kovetkezo, mechanikusan ellenorizheto szabalyt adja.
#
# KOTELEZO a CLAUDE.md:
#
#   1. A repo gyokereben.
#   2. Minden workspace csomag gyokereben, azaz minden konyvtarban, ami sajat
#      package.json fajlt tartalmaz. Ez fedi a SPEC-001 14. szekcio
#      "Alkalmazas", "Csomag", "Eszkoz" es "Merooeszkoz" sorait.
#   3. Minden olyan csomagon BELULI konyvtarban, ami kozvetlenul tartalmaz
#      legalabb egy .ts vagy .tsx forrasfajlt. Ez a "Csomag alkonyvtar" sor:
#      ha egy konyvtarban sajat forras all, akkor onallo felelossege van.
#
# NEM kotelezo, es miert:
#
#   - A csomag sajat `src/` konyvtaranak TETEJEN. A felelosseget a csomag
#     szintu CLAUDE.md mar leirja, egy `src/CLAUDE.md` csak megismetelne. A
#     SPEC-001 14. szekcio "Amit tilos beleirni" pontja tiltja az ismetlest.
#   - Generalt vagy gitignore-olt konyvtarakban (node_modules, dist, coverage,
#     .turbo, test-results, artifacts). A SPEC-001 14. szekcio "Generalt
#     konyvtar" sora ezeket explicit kiveszi. Ez a script `git ls-files`
#     kimenetebol dolgozik, ezert a kovetetlen fajlok automatikusan kimaradnak,
#     nem kell kulon kizaro listat karbantartani.
#   - A `docs/` fa alatt. A SPEC-001 14. szekcio "Hol kell" tablazata nem
#     sorolja fel, a docs maga a dokumentacio.
#   - A csoportosito konyvtarakban (apps, packages, tooling, tools). Ezekben
#     nincs sajat forrasfajl es nincs package.json, csak csomagokat fognak
#     ossze, tehat egyik szabaly sem vonatkozik rajuk.
#
# =============================================================================
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

start_ts=$(date +%s)

# 2. szabaly: a csomag gyokerek. A gyoker package.json-t a mintaja
# (`*/package.json`) szandekosan nem fogja meg, azt az 1. szabaly adja.
mapfile -t package_dirs < <(git ls-files '*/package.json' | xargs -r -n1 dirname | sort -u)

# 3. szabaly jeloltjei: minden konyvtar, ami kozvetlenul tartalmaz .ts vagy
# .tsx fajlt.
mapfile -t source_dirs < <(git ls-files '*.ts' '*.tsx' | xargs -r -n1 dirname | sort -u)

# Megkeresi a leghosszabb csomag-eloforduast, ami az adott konyvtart tartalmazza.
# Ures stringet ad, ha a konyvtar egyetlen csomagon belul sincs.
owning_package() {
  local dir="$1"
  local best=""
  local candidate
  for candidate in "${package_dirs[@]}"; do
    if [[ "$dir" == "$candidate" || "$dir" == "$candidate"/* ]]; then
      if [[ "${#candidate}" -gt "${#best}" ]]; then
        best="$candidate"
      fi
    fi
  done
  printf '%s' "$best"
}

required_dirs=("." "${package_dirs[@]}")

for dir in "${source_dirs[@]}"; do
  # A docs fa nincs a hatokorben.
  [[ "$dir" == docs || "$dir" == docs/* ]] && continue

  owner="$(owning_package "$dir")"
  # Csomagon kivuli forras (pl. gyoker szintu eslint.config.ts): az 1. szabaly fedi.
  [[ -z "$owner" ]] && continue
  # Maga a csomag gyokere: a 2. szabaly mar felvette.
  [[ "$dir" == "$owner" ]] && continue
  # A csomag sajat src/ teteje: kivetel, lasd a fejlecet.
  [[ "$dir" == "$owner/src" ]] && continue

  required_dirs+=("$dir")
done

mapfile -t required_dirs < <(printf '%s\n' "${required_dirs[@]}" | sort -u)

missing=()
for dir in "${required_dirs[@]}"; do
  [[ -f "$dir/CLAUDE.md" ]] || missing+=("$dir")
done

end_ts=$(date +%s)
duration=$((end_ts - start_ts))

# 1. blokk: fejlec.
echo "claude-md | ${duration}s"

# 2. blokk: osszegzes.
total="${#required_dirs[@]}"
missing_count="${#missing[@]}"
present=$((total - missing_count))
echo "${present}/${total} kotelezo helyen van CLAUDE.md, ${missing_count} hianyzik"

# 3. blokk: hibablokk, csak ha van hiany.
if [[ "$missing_count" -gt 0 ]]; then
  echo
  for dir in "${missing[@]}"; do
    echo "${dir}/CLAUDE.md hianyzik"
  done
  exit 1
fi
