import type { Fact } from '../evidence/fact/fact.ts';

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
  /**
   * A workflow motor lépésenkénti, szerver oldali párhuzamossági korlátjára vonatkozó
   * javaslat -- nem a kliens belső subagent korlátja, ami a fenti három mező témája.
   * A `minimax` providernél ez a szám **alsó korlát**: a mérés során a mérőgép szabad
   * memóriája fogyott el, nem a MiniMax korlátja lépett életbe, ezért a tényleges,
   * biztonságosan kihasználható felső határ ennél magasabb is lehet.
   */
  readonly measuredMaxConcurrentSteps: Fact<number>;
}
