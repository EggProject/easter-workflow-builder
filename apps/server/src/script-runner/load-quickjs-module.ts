import variant from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant, newVariant, type QuickJSWASMModule } from 'quickjs-emscripten-core';
import { resolveMemoryLimitMb } from './resolve-memory-limit-mb.ts';
import { SCRIPT_SANDBOX_LIMITS } from './script-sandbox-limits.ts';

/**
 * Friss, eldobható QuickJS WebAssembly modul saját, maximummal korlátozott
 * `WebAssembly.Memory`-val (SPEC-014 5.4 "Életciklus" és "Memória", user döntés
 * 2026-11-04: "friss motor lepesenkent"). A korlát a memória maximuma, nem a
 * `setMemoryLimit`, mert az ebben a buildben nem bájtkorlát (research
 * `2026-11-04-szkript-csomopont.md` Q-4); a maximumnál a foglalás megáll, és a
 * sandboxban `InternalError: out of memory` jön (Q-5). A memória a
 * `newVariant(variant, { wasmMemory })` úton jut a betöltőhöz (Q-5). Minden
 * hívás új modult és új memóriát ad, a lépés végén mindkettő eldobható.
 */
export async function loadQuickJsModule(memoryLimitMb: number | null): Promise<QuickJSWASMModule> {
  const wasmMemory = new WebAssembly.Memory({
    initial: SCRIPT_SANDBOX_LIMITS.initialPages,
    maximum: (resolveMemoryLimitMb(memoryLimitMb) * 2 ** 20) / SCRIPT_SANDBOX_LIMITS.wasmPageBytes,
  });
  return newQuickJSWASMModuleFromVariant(newVariant(variant, { wasmMemory }));
}
