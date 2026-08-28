import type { StepRunTokenUsage } from '@easter-workflow-builder/db';

/**
 * Amit a motor a `result` SDK üzenetből kiolvas a `step_run` sor számára
 * (SPEC-004 5.2 8. pont): a lefutott körök száma és a négy token oszlop.
 *
 * Mindkét mező elhagyható, és a hiány `undefined`, nem nulla: hiányzó mezőt
 * nem álcázunk valós adatnak, ugyanaz az elv, mint a `packages/db`
 * `normalizeSdkMessage` függvényében ("Nincs `?? 0` és nincs `?? ''`
 * alapérték"). A `StepRunTokenUsage` a négy oszlopot **együtt** kéri, ezért a
 * `tokens` mező is együtt van meg vagy hiányzik.
 *
 * **Költség mező itt nincs.** A `result` üzenet költség mezője first-party
 * árazással készül, ezért a motor nem olvassa és nem összegzi (F-8, 22. elfogadási kritérium); az érték a nyers `run_event` payloadban marad meg.
 */
export interface ResultTelemetry {
  readonly numTurns: number | undefined;
  readonly tokens: StepRunTokenUsage | undefined;
}
