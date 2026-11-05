import type { ScriptRunRequest, ScriptRunResult } from '@easter-workflow-builder/engine';
import { buildSandboxRunRequest } from './build-sandbox-run-request.ts';
import { isScriptRunResult } from './is-script-run-result.ts';
import type { ScriptChildProcess } from './script-child-process.ts';
import { scriptTimedOutResult } from './script-timed-out-result.ts';

/**
 * A `scriptRunner` port `run` művelete külön operációs rendszer folyamaton
 * (SPEC-017 4.1, 4.4; user döntés 2026-11-04: "Külön folyamatban fusson").
 * Lépésenként új folyamat; a szülő a kérést az IPC csatornán küldi, és az első
 * esemény dönt:
 *
 * - a folyamat válasza: a lépés eredménye (a nem várt alakú válasz
 *   `script_evaluation_failed`);
 * - a határidő (`deadlineMs`, a lépés indulásától): `script_timed_out`;
 * - a motor jele (megszakítás, `fail_run`, leállás): `aborted`, a szkript
 *   kódjától függetlenül azonnal, CPU kötött ciklus alatt is (SPEC-014 7.2 T-5);
 * - a folyamat kilépése válasz nélkül (összeomlás, memória kifogyás):
 *   `script_evaluation_failed` a kilépési kóddal vagy a jelzéssel;
 * - az indítás vagy a csatorna hibája: `script_evaluation_failed`.
 *
 * Minden ágon a folyamat `SIGKILL`-t kap, ami nem kapható el és nem hagyható
 * figyelmen kívül (signal(7)); a már kilépett folyamatra a Node nem küld
 * jelzést. A döntés után érkező események hatástalanok.
 */
export function createChildProcessScriptRun(
  spawnChild: () => ScriptChildProcess,
): (request: ScriptRunRequest) => Promise<ScriptRunResult> {
  return async (request) => {
    if (request.signal.aborted) {
      return { kind: 'aborted' };
    }
    const sandboxRequest = buildSandboxRunRequest(request, Date.now());
    const child = spawnChild();
    return new Promise((resolve) => {
      let isDecided = false;
      const timer = setTimeout(
        () => {
          decide(scriptTimedOutResult(sandboxRequest.timeoutMs));
        },
        Math.max(sandboxRequest.deadlineMs - Date.now(), 0),
      );
      const onAbort = (): void => {
        decide({ kind: 'aborted' });
      };
      function decide(result: ScriptRunResult): void {
        if (isDecided) {
          return;
        }
        isDecided = true;
        clearTimeout(timer);
        request.signal.removeEventListener('abort', onAbort);
        child.kill('SIGKILL');
        resolve(result);
      }
      request.signal.addEventListener('abort', onAbort, { once: true });
      child.on('error', (error) => {
        decide(failure(`a szkript folyamata nem indult el vagy a csatornája hibát adott (${error.name})`));
      });
      child.once('exit', (code, signal) => {
        const cause = signal === null ? `kilépési kód: ${String(code)}` : `jelzés: ${signal}`;
        decide(failure(`a szkript folyamata válasz nélkül leállt (${cause})`));
      });
      child.once('message', (message) => {
        decide(isScriptRunResult(message) ? message : failure('a szkript folyamata nem a várt alakú választ adta'));
      });
      child.send(sandboxRequest);
    });
  };
}

function failure(message: string): ScriptRunResult {
  return { kind: 'failed', errorKind: 'script_evaluation_failed', message };
}
