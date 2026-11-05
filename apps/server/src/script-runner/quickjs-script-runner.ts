import type { ScriptRunnerPort } from '@easter-workflow-builder/engine';
import { compileScript } from './compile-script.ts';
import { createChildProcessScriptRun } from './create-child-process-script-run.ts';
import { spawnScriptChild } from './spawn-script-child.ts';

/**
 * A motor `scriptRunner` portjának QuickJS megvalósítása (SPEC-004 3.2,
 * SPEC-014 5.2, 5.4). A futtatás lépésenként külön operációs rendszer
 * folyamatban (SPEC-017 4.1); a fordítási ellenőrzés a szerver folyamatában,
 * mert szkript kódot nem futtat (SPEC-017 4.6). A `satisfies` a port típusát a
 * definíció helyén ellenőrzi; az `engine-assembly` témája köti be a motorba
 * (`build-engine-dependencies.ts`).
 */
export const quickJsScriptRunner = {
  compile: compileScript,
  run: createChildProcessScriptRun(spawnScriptChild),
} satisfies ScriptRunnerPort;
