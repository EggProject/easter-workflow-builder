#!/usr/bin/env bash
# A T-015-2 próbáinak sorrendi futtatása; minden próba külön Node folyamat, mert egy próba a
# WebAssembly modult szándékosan hibára futtatja. A MEASUREMENT sorokat a kimenet.jsonl gyűjti.
# Előfeltétel: a könyvtárban `bun add quickjs-emscripten-core@0.32.0 @jitl/quickjs-wasmfile-release-sync@0.32.0`.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
run() { timeout 150 node "$@" 2>/dev/null | grep '^MEASUREMENT ' | sed 's/^MEASUREMENT //'; }
{
  printf '{"id":"env","node":"%s","quickjs-emscripten-core":"%s","variant":"%s"}\n' "$(node --version)" \
    "$(node -p "JSON.parse(require('node:fs').readFileSync('node_modules/quickjs-emscripten-core/package.json', 'utf8')).version")" \
    "$(node -p "require('@jitl/quickjs-wasmfile-release-sync/package.json').version")"
  run q1-cpu-loop.mjs
  for m in A B C; do run q2-host-promise.mjs "$m"; done
  run q2b-after-abort.mjs
  run q3-microtask-loop.mjs
  run q3b-then-chain.mjs
  run q3c-leak-repeat.mjs
  run q3d-fresh-module.mjs
  run q4-memory-limit.mjs
  for l in 16 128 -1; do for s in array string; do run q4b-limit-effect.mjs "$l" "$s"; done; done
  for l in 16 128; do run q4b-limit-effect.mjs "$l" smallobjects; done
  run q4c-usage.mjs
  for c in 128 256; do for s in array string uncaught; do run q5-wasm-memory-cap.mjs "$c" "$s"; done; done
  run q6-recursion.mjs default
  for sz in 524288 327680 262144 131072 65536; do run q6-recursion.mjs "$sz"; done
  for sz in 131072 65536 32768 16384 8192; do for hd in 0 2000 5000; do run q6b-recursion-margin.mjs "$sz" "$hd"; done; done
  run q9-memory-bounds.mjs
  run q7-compile.mjs
  run q8-globals.mjs
} > kimenet.jsonl
