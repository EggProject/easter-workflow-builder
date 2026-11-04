// Q-9: a saját WebAssembly.Memory megengedett tartománya a pinelt modulon (SPEC-014 5.4 "Memória",
// a user döntése 2026-11-04: lépésenként friss modul, beállítható korlát). A modul import szekciója
// a memóriára minimumot és maximumot deklarál; a mérés azt nézi, melyik lapszám (64 KiB) példányosít.
import variant from '@jitl/quickjs-wasmfile-release-sync';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { totalmem } from 'node:os';
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';
import { log } from './common.mjs';

// Az import szekció memória bejegyzésének korlátai a bináris formátum szerint (LEB128).
const wasmPath = createRequire(import.meta.url).resolve('@jitl/quickjs-wasmfile-release-sync/wasm');
const bytes = readFileSync(wasmPath);
let p = 8;
const uleb = () => {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = bytes[p++];
    result += (byte & 127) * 2 ** shift;
    shift += 7;
  } while (byte & 128);
  return result;
};
const name = () => {
  const n = uleb();
  p += n;
};
let declared;
while (p < bytes.length) {
  const id = bytes[p++];
  const size = uleb();
  const end = p + size;
  if (id === 2) {
    const count = uleb();
    for (let i = 0; i < count; i++) {
      name();
      name();
      const kind = bytes[p++];
      if (kind === 0) uleb();
      else if (kind === 1) {
        p++;
        const flags = uleb();
        uleb();
        if (flags & 1) uleb();
      } else if (kind === 2) {
        const flags = uleb();
        const min = uleb();
        const max = flags & 1 ? uleb() : undefined;
        declared = { minPages: min, maxPages: max };
      } else if (kind === 3) p += 2;
    }
  }
  p = end;
}
log('q9-declared', { ...declared, totalmemMb: totalmem() / 2 ** 20 });

for (const [initial, maximum] of [
  [128, 128],
  [255, 255],
  [256, 256],
  [256, 32768],
  [256, 32769],
  [256, 65536],
]) {
  let outcome;
  try {
    const memory = new WebAssembly.Memory({ initial, maximum });
    const QuickJS = await newQuickJSWASMModuleFromVariant(newVariant(variant, { wasmMemory: memory }));
    const context = QuickJS.newContext();
    const result = context.evalCode('1 + 1');
    outcome = { ok: context.dump(context.unwrapResult(result)) };
    context.dispose();
  } catch (error) {
    outcome = { error: `${error.name}: ${String(error.message).slice(0, 160)}` };
  }
  log('q9-instantiate', { initial, maximum, maxMb: (maximum * 65536) / 2 ** 20, ...outcome });
}
