#!/usr/bin/env bash
# Kozos fuggvenyek a token takarekos wrapper scripteknek (SPEC-001 11. szekcio).
# Nem onallo script, hanem a tobbi wrapper `source`-olja.
set -euo pipefail

# A csonkolasi hatar: legfeljebb ennyi hibasort irunk ki a hibablokkban, az
# osszes csomag hibajat egyutt szamolva.
#
# Dokumentalt szabaly erre az ertekre NINCS, ezt kimondjuk. Az ertek projekt
# dontes, aminek a nagysagrendi keretet sajat meres adja (V-16, lasd
# docs/research/2026-08-26-spec001-ellenorzesek.md): egyetlen, egy okra
# visszavezetheto tipushiba a legnagyobb csomagban 90 hibasort general 22
# fajlban, atlagosan 170 karakteres sorokkal, azaz kb. 15 kB-ot. A gyokerok
# ilyenkor mar az ELSO hibasorbol azonosithato, mert a tsc uzenete megnevezi az
# elrontott tipust - a csonkolas tehat nem rontja a diagnosztizalhatosagot, es
# a wrapper amugy is kiirja a kimaradt hibak szamat es a teljes kimenet utjat.
# A hatar valodi feladata a TOBB oku hibak kimenetenek korlatozasa.
readonly WRAPPER_ERROR_LIMIT=50

# A turbo teljes JSON futas-osszegzoje ide kerul, a `.turbo/` mintat a gyoker
# .gitignore mar lefedi.
readonly WRAPPER_LOG_DIR=".turbo/wrapper-logs"

# repo gyoker: ez a fajl a tooling/scripts alatt el, a gyoker ket szinttel feljebb van.
wrapper_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

# Egy turbo taskot futtat, a teljes kimenetet fajlba menti, es kiirja a
# harom kotelezo blokkot (fejlec, osszegzes, hibablokk).
# Hasznalat: wrapper_run_turbo_task <task-nev>
wrapper_run_turbo_task() {
  local task_name="$1"
  local root_dir
  root_dir="$(wrapper_repo_root)"
  cd "$root_dir"

  mkdir -p "$WRAPPER_LOG_DIR"
  local full_log="$WRAPPER_LOG_DIR/${task_name}.log"
  local summary_json="$WRAPPER_LOG_DIR/${task_name}-summary.json"

  local start_ts
  start_ts=$(date +%s)

  # A helyi turbo binarist hivjuk kozvetlenul (node_modules/.bin), nem
  # bunx-szal, hogy ne fugjunk halozati elerhetosegtol vagy resolvertol.
  # --continue=always: minden csomagot lefuttat akkor is, ha egy masik hibazik,
  # igy a hibablokk a TELJES kepet mutatja, nem csak az elso hibas csomagot.
  # --output-logs=errors-only: a sikeres csomagok kimenete nem kerul a naplo elejere.
  local exit_code=0
  "$root_dir/node_modules/.bin/turbo" run "$task_name" --continue=always --summarize=true \
    --output-logs=errors-only >"$full_log" 2>&1 || exit_code=$?

  local end_ts
  end_ts=$(date +%s)
  local duration=$((end_ts - start_ts))

  # A turbo a futas vegen kiirja a JSON osszegzo elerhetoseget egy
  # "Summary:    <ut>" soron - ezt keressuk meg, nem talalgatjuk a fajlnevet.
  local summary_path
  summary_path=$(grep -m1 '^Summary:' "$full_log" | awk '{print $2}' || true)

  echo "${task_name} | ${duration}s"

  if [[ -z "$summary_path" || ! -f "$summary_path" ]]; then
    # A turbo run osszeomlott meg a taskgraf felepitese elott (pl. rossz
    # turbo.json), ilyenkor nincs JSON osszegzo - a nyers naplo vegevel adunk kepet.
    echo "osszegzo nem keszult, a nyers kimenet vege:"
    tail -n 20 "$full_log"
    exit "$exit_code"
  fi

  cp "$summary_path" "$summary_json"

  # A turbo JSON osszegzojeben a `success` csak a FRISSEN lefutott, hibatlan
  # taskokat szamolja, a cache-bol visszajatszott sikeres taskokat kulon,
  # `cached` alatt - ezert a sikeres oszlophoz a kettot osszeadjuk, hogy a
  # szam megegyezzen azzal, amit a turbo sajat szoveges "Tasks: N successful"
  # sora is mutatna.
  local fresh_success failed cached attempted
  fresh_success=$(jq -r '.execution.success' "$summary_json")
  failed=$(jq -r '.execution.failed' "$summary_json")
  cached=$(jq -r '.execution.cached' "$summary_json")
  attempted=$(jq -r '.execution.attempted' "$summary_json")
  local total_success=$((fresh_success + cached))

  echo "${total_success}/${attempted} sikeres, ${failed} hibas, ${cached} cache-bol"

  if [[ "$failed" -gt 0 ]]; then
    wrapper_print_errors "$summary_json" "$root_dir"
    echo
    echo "teljes kimenet: ${full_log}"
  fi

  exit "$exit_code"
}

# A hibas taskok logFile-jait vegigolvassa, es kiirja a hibasorokat a
# csonkolasi hatarig.
wrapper_print_errors() {
  local summary_json="$1"
  local root_dir="$2"

  local -a log_files
  mapfile -t log_files < <(jq -r '.tasks[] | select(.execution.exitCode != 0) | .logFile' "$summary_json")

  local printed=0
  local remaining=$WRAPPER_ERROR_LIMIT
  local total_more=0

  for rel_log in "${log_files[@]}"; do
    local abs_log="${root_dir}/${rel_log}"
    [[ -f "$abs_log" ]] || continue

    local lines
    # A repo-gyoker abszolut ut elotagjat levagjuk: rovidebb, olvashatobb
    # sorok, kevesebb token a hivo agentnek.
    lines=$(wrapper_extract_error_lines "$abs_log" | sed "s|${root_dir}/||g")
    [[ -z "$lines" ]] && continue

    local count
    count=$(printf '%s\n' "$lines" | wc -l | tr -d ' ')

    if [[ "$remaining" -gt 0 ]]; then
      printf '%s\n' "$lines" | head -n "$remaining"
      local shown=$((count < remaining ? count : remaining))
      remaining=$((remaining - shown))
      total_more=$((total_more + count - shown))
    else
      total_more=$((total_more + count))
    fi
    printed=$((printed + count))
  done

  if [[ "$total_more" -gt 0 ]]; then
    echo "... es meg ${total_more} hiba (lasd a teljes kimenetet)"
  fi
}

# Egy log fajlbol normalizalt "fajl:sor:oszlop szabaly uzenet" sorokat allit
# elo. Tobb formatumot probal (ESLint stylish, tsc klasszikus), es ha
# egyiket sem ismeri fel, nyers "error"/"✖" sorokat ad vissza tartalek gyanant.
wrapper_extract_error_lines() {
  local log_file="$1"

  # ESLint stylish: egy abszolut-ut fejlecsor utan behuzott "sor:oszlop  error  uzenet  szabaly" sorok.
  local eslint_lines
  eslint_lines=$(awk '
    /^\// { file=$0; next }
    /^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+(error|warning)[[:space:]]/ {
      line=$0
      sub(/^[[:space:]]+/, "", line)
      split(line, parts, /[[:space:]]+/)
      pos=parts[1]
      sev=parts[2]
      rule=parts[length(parts)]
      msg=""
      for (i = 3; i < length(parts); i++) { msg = msg parts[i] " " }
      printf "%s:%s %s %s\n", file, pos, rule, msg
    }
  ' "$log_file")
  if [[ -n "$eslint_lines" ]]; then
    printf '%s\n' "$eslint_lines"
    return
  fi

  # tsc klasszikus formatum: "fajl(sor,oszlop): error TSxxxx: uzenet"
  local tsc_lines
  tsc_lines=$(grep -E '^[^ ].*\([0-9]+,[0-9]+\): error TS[0-9]+:' "$log_file" | sed -E \
    's/^(.*)\(([0-9]+),([0-9]+)\): error (TS[0-9]+): (.*)$/\1:\2:\3 \4 \5/' || true)
  if [[ -n "$tsc_lines" ]]; then
    printf '%s\n' "$tsc_lines"
    return
  fi

  # Tartalek: barmilyen mas eszkoz kimenete (pl. egy build plugin uncaught
  # kivetele) - a hiba/fail szot tartalmazo sorokat adjuk vissza, DE a V8/Node
  # stack trace keret-sorait ("    at fuggvenynev (fajl:sor:oszlop)" vagy
  # "    at fajl:sor:oszlop", a szabvanyos Error.stack alak, forras:
  # https://v8.dev/docs/stack-trace-api) kiszurjuk. Ezek a sorok gyakran maguk
  # is tartalmazzak az "error"/"fail" szot egy fuggveny- vagy fajlnevben (pl.
  # "aggregateBindingErrorsIntoJsError"), tehat a naiv grep nelkuluk a teljes
  # nyers stack trace-t a konzolra irna - a CLAUDE.md szerint a wrapper csak
  # osszegzest ad, a teljes kimenet (stack trace-szel egyutt) a naplofajlban
  # marad, aminek utjat a hivo mindig megkapja hiba eseten.
  grep -iE 'error|fail' "$log_file" \
    | grep -vE '(^|: )[[:space:]]*at [A-Za-z0-9_#.<>]+ \(.*:[0-9]+:[0-9]+\)[[:space:]]*\{?$|(^|: )[[:space:]]*at .*:[0-9]+:[0-9]+\)?[[:space:]]*$' \
    || true
}
