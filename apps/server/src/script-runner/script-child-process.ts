import type { SandboxRunRequest } from './sandbox-run-request.ts';

/**
 * A szülő oldali nézet egy szkript folyamatra (SPEC-017 4.1): a Node
 * `ChildProcess` ennek az alaknak megfelel (`spawn-script-child.ts`), a teszt
 * hamis folyamatot is adhat. Az `exit` a kilépési kódot vagy a leállító jelzést
 * adja (Node `child_process` doksi, `'exit'` esemény).
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface ScriptChildProcess {
  on(event: 'error', listener: (error: Error) => void): unknown;
  once(event: 'message', listener: (message: unknown) => void): unknown;
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  send(message: SandboxRunRequest): boolean;
  kill(signal: 'SIGKILL'): boolean;
}
