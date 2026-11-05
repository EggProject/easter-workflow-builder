import path from 'node:path';
import type { ScriptRunRequest } from '@easter-workflow-builder/engine';
import type { SandboxRunRequest } from './sandbox-run-request.ts';
import { SCRIPT_SANDBOX_LIMITS } from './script-sandbox-limits.ts';

/**
 * A motor kérésének leképezése a szkript folyamat kérésére (SPEC-017 4.2): az
 * időkorlát `null` értéke 60 000 ms (SPEC-014 5.4 "Időkorlát"), a határidő a
 * `startedAtMs` pillanattól számít (a folyamat indítása is beleszámít), a fájl
 * gyökér `path.resolve` alakja a szerver munkakönyvtárához képest (O-5), a
 * futás kontextus a hét név JSON szövege. A `signal` nem megy át: a külső
 * leállítás a folyamat megölése (SPEC-017 4.4).
 */
export function buildSandboxRunRequest(request: ScriptRunRequest, startedAtMs: number): SandboxRunRequest {
  const timeoutMs = request.timeoutMs ?? SCRIPT_SANDBOX_LIMITS.defaultTimeoutMs;
  const { input, steps, item, itemIndex, iteration, joinInputs, error } = request.runContext;
  return {
    source: request.source,
    contextJson: JSON.stringify({ input, steps, item, itemIndex, iteration, joinInputs, error }),
    root: path.resolve(request.cwd ?? process.cwd()),
    timeoutMs,
    deadlineMs: startedAtMs + timeoutMs,
    memoryLimitMb: request.memoryLimitMb,
    fetchResponseLimitMb: request.fetchResponseLimitMb,
    fileReadLimitMb: request.fileReadLimitMb,
  };
}
