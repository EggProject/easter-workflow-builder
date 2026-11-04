import type { Outcome } from '@easter-workflow-builder/core';
import { describeErrorType } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '@easter-workflow-builder/engine';
import type { QuickJSHandle } from 'quickjs-emscripten-core';
import { describeSandboxError } from './describe-sandbox-error.ts';
import { disposeQuietly } from './dispose-quietly.ts';
import { loadQuickJsModule } from './load-quickjs-module.ts';
import { SCRIPT_FILE_NAME } from './script-file-name.ts';
import { SCRIPT_SANDBOX_LIMITS } from './script-sandbox-limits.ts';
import { wrapScriptSource } from './wrap-script-source.ts';

/**
 * A JavaScript szkript fordítási ellenőrzése futtatás nélkül, a futás
 * indításakor (SPEC-014 5.7 `script_compile_failed`, 5.8). Saját, eldobott
 * modulon fut (SPEC-014 5.4 "Életciklus"), a `null` memória korláttal (a
 * rendszermemória, legfeljebb a modul plafonja). A fordítás a
 * `evalCode(..., { compileOnly: true })` úton mellékhatás nélküli (research
 * `2026-11-04-szkript-csomopont.md` Q-7); a sikeres fordítás bytecode handle-je
 * a lebontásban szabadul fel. A stack korlát ugyanaz, mint a futtatásnál, így a
 * mély forrás elemzés a gazdára jutó `RangeError`-ral bukik (Q-6), ami szintén
 * fordítási hiba.
 */
export async function compileScript(source: string): Promise<Outcome<void>> {
  try {
    // eslint-disable-next-line unicorn/no-null -- a port `memoryLimitMb` mezőjének üres értéke a `null` (SPEC-014 5.3), a fordítás ugyanazt az alapértéket kapja
    const quickJs = await loadQuickJsModule(null);
    const runtime = quickJs.newRuntime();
    runtime.setMaxStackSize(SCRIPT_SANDBOX_LIMITS.maxStackSizeBytes);
    const context = runtime.newContext();
    const handles: QuickJSHandle[] = [];
    try {
      const compiled = context.evalCode(wrapScriptSource(source), SCRIPT_FILE_NAME, { compileOnly: true });
      if (compiled.error !== undefined) {
        handles.push(compiled.error);
        return compileFailure(`A JavaScript szkript nem fordul le: ${describeSandboxError(context, compiled.error)}`);
      }
      handles.push(compiled.value);
      return { kind: 'ok', value: undefined };
    } finally {
      disposeQuietly(handles, context, runtime);
    }
  } catch (error) {
    return compileFailure(`A JavaScript szkript fordítása a gazda oldalon megszakadt (${describeErrorType(error)})`);
  }
}

function compileFailure(detail: string): Outcome<void> {
  return { kind: 'error', message: formatEngineErrorMessage('script_compile_failed', detail) };
}
