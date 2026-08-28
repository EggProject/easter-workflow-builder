import type { Outcome } from '@easter-workflow-builder/core';
import type { AppSettingsRecord, WorkflowGraph, WorkflowRecord } from '@easter-workflow-builder/db';

/**
 * A futás indításához beolvasott három adat (SPEC-004 4.8 1. lépés): a
 * workflow fejléce (a pillanatkép `workflow` blokkjához és a workflow szintű
 * provider felülíráshoz), a gráfja, és a globális beállítás (a provider
 * alapértelmezéshez).
 */
export interface RunInputs {
  readonly workflow: WorkflowRecord;
  readonly graph: WorkflowGraph;
  readonly settings: AppSettingsRecord;
}

/**
 * A három olvasás eredményének összefűzése: az **első** hibaág megy tovább,
 * különben a három érték egy struktúrában.
 *
 * **Miért nem maga hívja a repositoryt.** A három olvasás hibaága ugyanabból
 * az okból (nem létező workflow, korrupt sor) jönne, tehát ha a függvény maga
 * hívná őket, a második és a harmadik hibaág soha nem futna le: az elsőnél már
 * kilépnénk. A 100 százalékos, kizárás nélküli lefedettségi küszöb mellett
 * pontosan az a fajta ág, amit tilos bevezetni (`.claude/CLAUDE.md` 5. szekció).
 * Így viszont mindhárom ág elérhető és tesztelhető, a hívási helyen pedig
 * egyetlen elágazás marad, aminek mindkét kimenete előfordul.
 */
export function collectRunInputs(
  workflow: Outcome<WorkflowRecord>,
  graph: Outcome<WorkflowGraph>,
  settings: Outcome<AppSettingsRecord>,
): Outcome<RunInputs> {
  if (workflow.kind === 'error') {
    return workflow;
  }
  if (graph.kind === 'error') {
    return graph;
  }
  if (settings.kind === 'error') {
    return settings;
  }
  return { kind: 'ok', value: { workflow: workflow.value, graph: graph.value, settings: settings.value } };
}
