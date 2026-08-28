import type { SchedulerState } from './scheduler-state.ts';

/**
 * A futás terminális állapota (SPEC-004 4.4 6. pont): "A futás akkor
 * terminális, ha nincs futtatható és nincs futó példány."
 *
 * A halott példányok nem számítanak: azok nem kerülnek a sorba, és `step_run`
 * sort sem kapnak (4.4 3. pont), tehát a halott ág terjedése önmagában nem
 * tartja életben a futást.
 *
 * A futás **záró állapotát** (`succeeded`, `failed`, `cancelled`) nem ez a
 * függvény dönti el, az az `error-policy` és a `run-supervisor` téma dolga
 * (8.4, T-005-24, T-005-25); itt kizárólag az a kérdés, van-e még dolga az
 * ütemezőnek.
 */
export function isRunTerminal(state: SchedulerState): boolean {
  return state.readyInstances.length === 0 && state.runningInstanceKeys.size === 0;
}
