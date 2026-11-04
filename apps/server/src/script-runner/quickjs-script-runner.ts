import type { ScriptRunnerPort } from '@easter-workflow-builder/engine';
import { compileScript } from './compile-script.ts';
import { runScript } from './run-script.ts';

/**
 * A motor `scriptRunner` portjának QuickJS megvalósítása (SPEC-004 3.2,
 * SPEC-014 5.2, 5.4). A `satisfies` a port típusát a definíció helyén
 * ellenőrzi; az `engine-assembly` bekötése a PLAN-015 T-015-5 lépése (research
 * `2026-11-04-szkript-csomopont.md` 7.2).
 */
export const quickJsScriptRunner = {
  compile: compileScript,
  run: runScript,
} satisfies ScriptRunnerPort;
