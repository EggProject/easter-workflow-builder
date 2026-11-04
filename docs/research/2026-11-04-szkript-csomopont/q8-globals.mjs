// Q-8: egy friss kontextus globális objektumának saját kulcsai (Object.getOwnPropertyNames és
// Reflect.ownKeys), a futtató unit tesztjének kiinduló listája.
import { loadModule, log } from './common.mjs';
const QuickJS = await loadModule();
const runtime = QuickJS.newRuntime();
const context = runtime.newContext();
// Minden handle felszabadítva: egy elhagyott handle a runtime lebontásakor assertet ad (Q-2).
const evalDump = (code) => {
  const h = context.unwrapResult(context.evalCode(code));
  const v = context.dump(h);
  h.dispose();
  return v;
};
const names = evalDump('Object.getOwnPropertyNames(globalThis)');
const symbols = evalDump('Reflect.ownKeys(globalThis).filter((k) => typeof k === "symbol").map(String)');
const probes = evalDump(
  'JSON.stringify({ console: typeof console, fetch: typeof fetch, require: typeof require, process: typeof process, setTimeout: typeof setTimeout, eval: typeof eval, Function: typeof Function, WebAssembly: typeof WebAssembly, std: typeof std, os: typeof os, SharedArrayBuffer: typeof SharedArrayBuffer, Atomics: typeof Atomics, WeakRef: typeof WeakRef, FinalizationRegistry: typeof FinalizationRegistry, queueMicrotask: typeof queueMicrotask })',
);
log('Q-8', { count: names.length, names: [...names].sort(), symbols, probes: JSON.parse(probes) });
context.dispose();
runtime.dispose();
