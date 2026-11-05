import type { ScriptRunResult } from '@easter-workflow-builder/engine';
import { isSandboxRunRequest } from './is-sandbox-run-request.ts';
import { runScript } from './run-script.ts';

/**
 * A szkript folyamat oldala az IPC csatornán (SPEC-017 4.1, 4.2). Pontosan
 * egy kérést fogad, lefuttatja (`runScript`), a választ visszaküldi, és a
 * küldés után kilép. A Node `process` objektuma ennek az alaknak megfelel
 * (`script-child-entry.ts`); a teszt hamis csatornát ad.
 *
 * - Ha a folyamat nem IPC csatornával indult (nincs `send`), azonnal kilép 1
 *   kóddal: kérést sem kaphatna.
 * - A csatorna lezárásakor (a szülő kilépett vagy összeomlott, Node `process`
 *   doksi `'disconnect'` esemény; mérve: research
 *   `2026-11-05-szkript-kulon-folyamat.md` 3. szekció) a folyamat kilép, hogy
 *   ne maradjon árva.
 * - A csatorna esemény a CPU kötött szkript alatt nem sülhet el, ezért a
 *   szkript interrupt kezelője a szülő azonosítójának változását is figyeli
 *   (`ppid`, az indításkor rögzítve; a Node minden olvasáskor újra lekérdezi,
 *   mérve: research `2026-11-05-szkript-kulon-folyamat.md` 3.2).
 * - A nem a kérés alakú üzenetre `script_evaluation_failed` a válasz.
 */
export interface ScriptChildChannel {
  readonly ppid: number;
  readonly send?: ((message: ScriptRunResult, callback: (error: Error | null) => void) => boolean) | undefined;
  once(event: 'message', listener: (message: unknown) => void): unknown;
  once(event: 'disconnect', listener: () => void): unknown;
  exit(code: number): void;
}

export function serveScriptChild(channel: ScriptChildChannel): void {
  const { send } = channel;
  if (send === undefined) {
    channel.exit(1);
    return;
  }
  const parentPid = channel.ppid;
  const isParentGone = (): boolean => channel.ppid !== parentPid;
  channel.once('disconnect', () => {
    channel.exit(0);
  });
  channel.once('message', (message) => {
    void answer(message, isParentGone).then((result) => {
      send.call(channel, result, () => {
        channel.exit(0);
      });
    });
  });
}

async function answer(message: unknown, isParentGone: () => boolean): Promise<ScriptRunResult> {
  if (!isSandboxRunRequest(message)) {
    return {
      kind: 'failed',
      errorKind: 'script_evaluation_failed',
      message: 'a szkript folyamata nem a várt alakú kérést kapta',
    };
  }
  return runScript(message, isParentGone);
}
