import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import { findVisibleStepInstance } from '../run-context/find-visible-step-instance.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { buildFanOutItemContext } from './build-fan-out-item-context.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';

/**
 * Egy futtathatóvá vált `join` példány bemeneti listája: a beérkezett ágak
 * kimenetei, **elem sorrendben** (SPEC-004 5.6: "a bejövő ágak kimeneteinek
 * listája, a `fan_out` elem sorrendjében"). Ez a lista megy a `RunContext`
 * `joinInputs` mezőjébe (6.1) és a `join_resolved` esemény `inputCount`
 * mezőjébe (13. szekció).
 *
 * A bejárás külső ciklusa az elem sorszám, a belső a `join` bejövő él listája
 * a pillanatkép szerinti sorrendben, tehát több bejövő él mellett is
 * determinisztikus a sorrend. Csak a `live` jelölést hordozó ágak kerülnek be:
 * a halott ág nem "üres kimenet", hanem nem érkezett meg, és a
 * `dead` jelölés terjedése éppen azért van, hogy a `join` ne várjon rá
 * örökre (4.4 3. pont).
 *
 * **N = 0 és halott `fan_out` esetén üres a lista.** Az elsőt a 4.5 szekció
 * mondja ki szó szerint, a második pedig nem is jut végrehajtóig: a `join`
 * példány ilyenkor maga is halott (`resolveInstanceReadiness`).
 *
 * **Miért a lefutott példányok listájából jön a kimenet.** Az élen álló
 * jelölés a vezérlést hordozza, nem az adatot; a lépés kimenete a lefutott
 * példányok nyilvántartásában áll, amit a `run-context` téma is ugyanígy
 * olvas. A `findVisibleStepInstance` a 6.2 szekció előtag szabályát
 * alkalmazza, tehát a közvetlenül a `join`-ba kötött `fan_out` node kimenetét
 * is megtalálja, aminek a kontextusa a külső verem.
 */
export function collectJoinInputs(
  state: SchedulerState,
  topology: RunTopology,
  executedInstances: readonly ExecutedStepInstance[],
  joinInstance: StepInstanceReference,
): readonly unknown[] {
  const fanOutNodeId = topology.fanOutJoinPairing.joinToFanOut.get(joinInstance.nodeId);
  const expansion =
    fanOutNodeId === undefined
      ? undefined
      : state.fanOutExpansions.get(buildScopedKey(fanOutNodeId, joinInstance.branchContext));

  if (expansion === undefined || expansion.kind === 'dead') {
    return [];
  }

  const incoming = topology.graph.incomingEdges.get(joinInstance.nodeId) ?? [];
  const inputs: unknown[] = [];

  for (const itemIndex of expansion.items.keys()) {
    const itemContext = buildFanOutItemContext(joinInstance.branchContext, expansion.stepRunId, itemIndex);
    for (const edge of incoming) {
      const source =
        state.edgeMarks.get(buildScopedKey(edge.id, itemContext)) === 'live'
          ? findVisibleStepInstance(executedInstances, edge.sourceNodeId, itemContext)
          : undefined;
      if (source !== undefined) {
        inputs.push(source.output);
      }
    }
  }

  return inputs;
}
