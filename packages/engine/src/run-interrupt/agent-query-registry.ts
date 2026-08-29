import type { AgentQuery } from '@easter-workflow-builder/agent';

/**
 * Az élő `AgentQuery` objektumok nyilvántartása (SPEC-004 9. szekció 3. pont,
 * PLAN-005 T-005-26). A `run-supervisor` `ActiveRunRegistry`-je a futás
 * HÁTTÉRFOLYAMATÁT tartja számon, de az `AgentQuery`-t magát nem látja: az az
 * `agent-step` téma `runAgentStep` függvényének belsejében él, a
 * `agentQueryRunner.run(...)` hívástól a lépés zárásáig. Ez a regiszter adja
 * a hidat: az `agent-step` téma minden agent lépéshez (`agent_step` ÉS `join`
 * `ai_synthesis`) a hívás UTÁN azonnal regisztrál, és a lépés zárásakor
 * (`finally` ágban, minden kimeneten) leiratkozik.
 *
 * **Miért `runId`, nem `rootRunId` szerint kulcsolt.** Egy adott lépéshez
 * tartozó `AgentQuery` a SAJÁT futásának (`step_run.run_id`, ami al-workflow
 * lépésnél a GYERMEK futás azonosítója, nem a gyökéré) azonosítóját ismeri;
 * a `rootRunId` -> tartozó `runId`-k leképezése a `run-supervisor`
 * `ActiveRunRegistry`-jének felelőssége (`ActiveRunHandle.rootRunId`). A
 * `listForRunIds` ezért egy már összeállított `runId` HALMAZT vár: a hívó
 * (`interrupt-run.ts`) előbb az `ActiveRunRegistry`-ből olvassa ki a fa
 * `runId`-jait, és csak azután kérdezi le ezt a regisztert - két, egymástól
 * független nyilvántartás, mindkettő a saját fogalmára szűkítve (SPEC-002 6.
 * szekció "A bontási kritérium" 1. pontja: a `rootRunId` fogalma nem ide, a
 * `run-supervisor` témába tartozik).
 *
 * **Miért `stepRunId` szerint kulcsolt beszúráskor.** Egy futáson belül több
 * agent lépés is élhet egyszerre (párhuzamos ágak), tehát a `runId` önmagában
 * nem egyedi; a `stepRunId` viszont igen, és ez a lépés zárásakor rendelkezésre
 * álló, természetes leiratkozási kulcs is (`AgentStepRequest.stepRunId`).
 */
export interface AgentQueryRegistry {
  /**
   * Egy élő `AgentQuery` felvétele. A hívó (`runAgentStep`) a
   * `agentQueryRunner.run(...)` sikeres visszatérése UTÁN, azonnal hívja.
   * Ugyanarra a `stepRunId`-ra ismételt hívás a korábbi bejegyzést lecseréli
   * (a gyakorlatban nem fordul elő: egy `step_run` sorhoz egy futtatás
   * tartozik).
   */
  register(runId: string, stepRunId: string, query: AgentQuery): void;

  /**
   * A `stepRunId`-hoz tartozó bejegyzés törlése. A hívó a lépés zárásakor,
   * `finally` ágban hívja, MINDEN kimeneten (siker, a lépés saját hibája,
   * vagy az `Outcome` adatbázis hibaága). Ismeretlen `stepRunId`-ra csendben
   * nem tesz semmit: ez nem programhiba, mert a `finally` ág akkor is lefut,
   * ha a `register` sosem futott (a `agentQueryRunner.run(...)` hibaágán a
   * hívó nem regisztrál, lásd `run-agent-step.ts`).
   */
  unregister(stepRunId: string): void;

  /**
   * A megadott `runId` HALMAZHOZ tartozó élő `AgentQuery` objektumok, a
   * regisztráció sorrendjében. A `runIds` szándékosan `ReadonlySet`, nem
   * tömb: a hívó (`interrupt-run.ts`) egy fa `runId`-jait gyűjti össze, ahol a
   * halmaz jelentése (nincs ismétlődés, gyors tagság ellenőrzés) a pontos
   * illeszkedés a feladathoz.
   */
  listForRunIds(runIds: ReadonlySet<string>): readonly AgentQuery[];
}

/**
 * A regiszter létrehozása. Belső állapota egy `stepRunId -> { runId, query }`
 * `Map`, lezárásban élő, ugyanaz a minta, mint a `concurrency-gate` és az
 * `approval-wait-registry` témában: a felület semmit nem szivárogtat ki a
 * belső térképből, és két teszt nem látja egymás állapotát.
 */
export function createAgentQueryRegistry(): AgentQueryRegistry {
  const entries = new Map<string, { readonly runId: string; readonly query: AgentQuery }>();

  function register(runId: string, stepRunId: string, query: AgentQuery): void {
    entries.set(stepRunId, { runId, query });
  }

  function unregister(stepRunId: string): void {
    entries.delete(stepRunId);
  }

  function listForRunIds(runIds: ReadonlySet<string>): readonly AgentQuery[] {
    const matches: AgentQuery[] = [];
    for (const entry of entries.values()) {
      if (runIds.has(entry.runId)) {
        matches.push(entry.query);
      }
    }
    return matches;
  }

  return { register, unregister, listForRunIds };
}
