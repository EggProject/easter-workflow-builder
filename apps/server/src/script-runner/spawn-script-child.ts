import { fork } from 'node:child_process';
import process from 'node:process';
import { buildScriptChildEnvironment } from './build-script-child-environment.ts';
import type { ScriptChildProcess } from './script-child-process.ts';

const SCRIPT_CHILD_ENTRY = new URL('script-child-entry.ts', import.meta.url);

/**
 * Egy szkript folyamat indítása (SPEC-017 4.1, 4.3) `child_process.fork`-kal:
 *
 * - `execArgv: []`: az alapérték a szülő `process.execArgv`-je (Node
 *   `child_process` doksi), benne a `--env-file-if-exists=.env` kapcsolóval,
 *   amitől a gyerek a titkokat újra betöltené (mérve: research
 *   `2026-11-05-szkript-kulon-folyamat.md` 3. szekció).
 * - `env`: csak a `buildScriptChildEnvironment` nevei.
 * - `stdio`: a három szabványos csatorna eldobva, csak az IPC csatorna él; a
 *   szkript nem ír naplót (SPEC-014 5.4 "Globális nevek").
 * - `serialization: 'json'`: a kérés és a válasz JSON érték.
 */
export function spawnScriptChild(): ScriptChildProcess {
  return fork(SCRIPT_CHILD_ENTRY, [], {
    env: buildScriptChildEnvironment(process.env),
    execArgv: [],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    serialization: 'json',
  });
}
