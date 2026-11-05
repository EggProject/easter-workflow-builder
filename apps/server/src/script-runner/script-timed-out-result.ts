import type { ScriptRunResult } from '@easter-workflow-builder/engine';

/**
 * A lépés időkorlát eredménye (SPEC-014 5.7 `script_timed_out`). Két helyen
 * keletkezik ugyanazzal a mondattal: a szkript folyamatában (az interrupt
 * kezelő vagy a gazda oldali határidő) és a szülőben, amikor a határidőn a
 * folyamatot megöli (SPEC-017 4.4).
 */
export function scriptTimedOutResult(timeoutMs: number): ScriptRunResult {
  return {
    kind: 'failed',
    errorKind: 'script_timed_out',
    message: `a szkript nem fejeződött be ${String(timeoutMs)} ms alatt`,
  };
}
