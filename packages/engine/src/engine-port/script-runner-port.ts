import type { Outcome } from '@easter-workflow-builder/core';
import type { ScriptRunRequest } from './script-run-request.ts';
import type { ScriptRunResult } from './script-run-result.ts';

/**
 * A JavaScript szkript futtató port (SPEC-004 3.2 táblázat, `scriptRunner` sor;
 * SPEC-014 5.2, 5.4, 5.8). A `script` node és a `join` `script` módjának
 * `runtime: 'javascript'` ágát ezen át fordítja és futtatja a motor; a CEL ág a
 * meglévő `expressionEvaluator` porton megy. A motor a nyelvet és a sandboxot nem
 * ismeri, a megvalósítás az `apps/server` oldalon áll (QuickJS WebAssembly).
 *
 * - `compile`: a futás indításakor, a forrás szintaktikai ellenőrzése futtatás
 *   nélkül; a hibája `script_compile_failed` osztállyal utasítja el az indítást.
 *   `Promise`, mert a SPEC-014 5.4 szerint a fordítás is saját, eldobott
 *   WebAssembly modulon fut, és a modul példányosítása a telepített
 *   `quickjs-emscripten-core` 0.32.0 forrása szerint aszinkron
 *   (`newQuickJSWASMModuleFromVariant`; research `2026-11-04-szkript-csomopont.md`
 *   T-015-4 szekció).
 * - `run`: egy szkript lépés lefuttatása; a hibaág nem kivétel, hanem a
 *   `ScriptRunResult` saját ága.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface ScriptRunnerPort {
  compile(source: string): Promise<Outcome<void>>;
  run(request: ScriptRunRequest): Promise<ScriptRunResult>;
}
