#!/usr/bin/env bash
# Token takarekos ellenorzo: van-e CLAUDE.md ott, ahol a projekt szabalya
# szerint kotelezo. Csak osszegzest es a hianyzo helyeket irja ki.
#
# ============================ A KIKENYSZERITETT SZABALY ======================
#
# A gyoker CLAUDE.md eloirja: "CLAUDE.md kizarolag a csomag gyokereben kell,
# arrol hogy mirol szol a csomag; alkonyvtarakba nem kell". A ket mondat egyutt
# a kovetkezo, mechanikusan ellenorizheto szabalyt adja.
#
# KOTELEZO a CLAUDE.md:
#
#   1. A repo gyokereben.
#   2. Minden workspace csomag gyokereben, azaz minden konyvtarban, ami sajat
#      package.json fajlt tartalmaz. Ez fedi a SPEC-001 14. szekcio
#      "Alkalmazas", "Csomag", "Eszkoz" es "Merooeszkoz" sorait.
#
# NEM kotelezo, es miert:
#
#   - Egyetlen csomagon BELULI alkonyvtarban sem, forrasfajlt tartalmazo
#     mappaban sem (pl. `src/<tema>/`). A felelosseget a csomag szintu
#     CLAUDE.md mar leirja, egy alkonyvtarbeli peldany csak megismetelne. A
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

required_dirs=("." "${package_dirs[@]}")

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
