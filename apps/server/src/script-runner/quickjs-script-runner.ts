import type { ScriptRunnerPort } from '@easter-workflow-builder/engine';
import { compileScript } from './compile-script.ts';
import { runScript } from './run-script.ts';

/**
 * A motor `scriptRunner` portjának QuickJS megvalósítása (SPEC-004 3.2,
 * SPEC-014 5.2, 5.4). A `satisfies` a port típusát a definíció helyén
 * ellenőrzi; az `engine-assembly` témája köti be a motorba
 * (`build-engine-dependencies.ts`).
 */
export const quickJsScriptRunner = {
  compile: compileScript,
  run: runScript,
} satisfies ScriptRunnerPort;
