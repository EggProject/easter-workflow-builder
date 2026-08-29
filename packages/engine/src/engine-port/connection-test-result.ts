import type { ConnectionTestMode } from '../capability-policy/connection-test-mode.ts';

/**
 * Az `Engine.testProviderConnection` sikeres `Outcome` ágának értéke
 * (SPEC-004 3.1 `Engine` felület, 11.3 táblázat 16. sora, PLAN-005 T-005-28).
 *
 * **A `succeeded: boolean` hordozza a tényleges kimenetet, az `Outcome`
 * hibaágát ez a művelet gyakorlatilag sosem használja** - ugyanaz az elv,
 * mint az `ActiveRunHandle.completion`-nél ("SOSEM utasít el"): a kapcsolat
 * teszt saját hibái (hiányzó env, a `query()` hívás hibája, a folyam olvasása
 * közben dobott kivétel, hiányzó vagy nem `success` `result` üzenet) mind a
 * **sikeres** `Outcome` ágon, `succeeded: false` és `errorMessage` formában
 * érkeznek, hogy a hívó (a beállítás felület) egységesen olvashassa őket.
 *
 * A `mode` a `resolveConnectionTestMode` döntése: **diagnosztikai adat**, nem
 * vezérel eltérő viselkedést, mert a motorba befecskendezett
 * `AgentQueryRunner` port nem exponál modell-listázást (nincs
 * `supportedModels()` a porton, `@easter-workflow-builder/agent`
 * `AgentQuery` típusa) - mindkét mód ugyanazt a minimális `query()` hívást
 * futtatja, lásd `create-engine.ts` doksiját.
 */
export interface ConnectionTestResult {
  readonly succeeded: boolean;
  readonly mode: ConnectionTestMode;
  readonly errorMessage: string | null;
}
