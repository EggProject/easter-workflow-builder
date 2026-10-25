import { describe, expect, expectTypeOf, it } from 'vitest';
import { buildRunContext, type ExecutableGraph, type RunContext } from '@easter-workflow-builder/engine';
import { RUN_CONTEXT_VARIABLE_NAMES } from '@easter-workflow-builder/workflow-language';

/**
 * A `RunContext` változóneveinek sodródás elleni védelme (SPEC-010 11.2,
 * PLAN-010 T-010-15). A `workflow-language` L1 réteg, a motor L5: a CEL
 * környezet hét deklarált változója (`RUN_CONTEXT_VARIABLE_NAMES`) a motor
 * `RunContext` mezőlistájának szándékos duplikátuma, mert a csomag a motortól
 * nem függhet (SPEC-010 3.4). Az `apps/server` az egyetlen csomag, ahol a két
 * oldal egyszerre látszik (ugyanaz a minta, mint az `enum-drift-protection`
 * és a `node-config-drift-protection` témában).
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja**
 * (`.claude/CLAUDE.md` 5. szekció, megvalósítás nélküli regressziós teszt).
 *
 * **A típusszintű ág az erős védelem:** ha a motor a `RunContext` alakját
 * bővíti vagy szűkíti, vagy a konstansból egy név kiesik, a `bun run
 * typecheck` kapu fordítási hibával bukik. A futásidejű ág a motor valódi
 * `buildRunContext` függvényének kimenetét veti össze a konstanssal. A
 * végrehajtáskor mindkét irányt szándékos elrontással igazoltuk: a konstansból
 * törölt `'error'` és a `RunContext` egy új mezője egyaránt `TS2344` hibával
 * buktatta a `bun run typecheck` kaput, a visszaállítás után zöld lett.
 */
describe('a CEL környezet változónevei és a motor RunContext kulcsai kétirányban megegyeznek', () => {
  it('típusszinten: a konstans elemeinek uniója pontosan a keyof RunContext', () => {
    expectTypeOf<(typeof RUN_CONTEXT_VARIABLE_NAMES)[number]>().toEqualTypeOf<keyof RunContext>();
  });

  it('futásidőben: a buildRunContext kimenetének kulcsai pontosan a konstans elemei, ismétlés nélkül', () => {
    const graph = {
      nodesById: new Map(),
      outgoingEdges: new Map(),
      incomingEdges: new Map(),
    } satisfies ExecutableGraph;
    const context = buildRunContext({
      graph,
      executedInstances: [],
      instance: { nodeId: 'n1', branchContext: [] },
      input: {},
    });

    expect(new Set(Object.keys(context))).toStrictEqual(new Set(RUN_CONTEXT_VARIABLE_NAMES));
    expect(new Set(RUN_CONTEXT_VARIABLE_NAMES).size).toBe(RUN_CONTEXT_VARIABLE_NAMES.length);
    expect(Object.keys(context)).toHaveLength(RUN_CONTEXT_VARIABLE_NAMES.length);
  });
});
