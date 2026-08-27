import type { Fact } from '@easter-workflow-builder/evidence';

/**
 * Kliens oldali párhuzamosság. Azért providerenkénti mező, mert a megfigyelt
 * egyidejű kérésszám közvetlenül a provider percenkénti kérés korlátjába számít bele.
 */
export interface ConcurrencyCapability {
  /**
  Az env változó, ami a kliens belső subagent párhuzamosságát korlátozza.
  */
  readonly subagentCapEnvVar: Fact<string | null>;
  /**
  A fenti env változó értéke, amivel a megfigyelés készült.
  */
  readonly measuredSubagentCap: Fact<number>;
  /**
   * A megfigyelt legnagyobb egyidejűleg nyitva lévő kimenő kérésszám egyetlen
   * `query()` alatt, a fenti korlát mellett. A subagentek kérésein felül az
   * orchestrátor saját kérése is beleszámít.
   */
  readonly observedMaxConcurrentRequests: Fact<number>;
}
