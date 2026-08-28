import { buildScopedKey } from './build-scoped-key.ts';
import type { ReadyInstance } from './ready-instance.ts';
import type { SchedulerState } from './scheduler-state.ts';

/**
 * A sor elején álló, futtathatóvá vált példány kivétele, szigorúan érkezési
 * sorrendben (SPEC-004 7.1): "Minden futtathatóvá vált lépés egy monoton
 * növekvő sorszámot kap a beérkezéskor, és a sor szigorúan e szerint ürül.
 * Nincs prioritás, nincs futásonkénti méltányossági szabály."
 *
 * A kivett példány kulcsa a futó példányok halmazába kerül, tehát a futás
 * ettől kezdve nem terminális (4.4 6. pont), amíg a példány valamelyik
 * `advanceScheduler` eseménnyel nem zár.
 *
 * Üres sorra `undefined` az eredmény. **Ez nem azonos a futás terminális
 * állapotával**: lehet, hogy nincs futtatható példány, de fut még valami. A
 * két feltételt az `isRunTerminal` együtt nézi.
 *
 * **Ez a függvény nem a párhuzamossági szabályozó.** A providerenkénti hely
 * kérés és felszabadítás a `concurrency-gate` téma dolga (7. szekció,
 * T-005-18); itt kizárólag az érkezési sorrend áll, ami a szabályozó bemenete.
 */
export function takeNextReadyInstance(
  state: SchedulerState,
): { readonly state: SchedulerState; readonly ready: ReadyInstance } | undefined {
  const [ready, ...remaining] = state.readyInstances;

  if (ready === undefined) {
    return undefined;
  }

  const runningInstanceKeys = new Set(state.runningInstanceKeys);
  runningInstanceKeys.add(buildScopedKey(ready.instance.nodeId, ready.instance.branchContext));

  return { state: { ...state, readyInstances: remaining, runningInstanceKeys }, ready };
}
