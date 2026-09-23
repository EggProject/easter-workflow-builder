import type { AgentQueryRegistry } from './agent-query-registry.ts';

/**
 * A megszakítás EGYETLEN, mindenhol újrahasznosított elemi lépése: a megadott
 * `runId` halmazhoz tartozó, éppen élő `AgentQuery` objektumokon lefuttatja az
 * SDK `interrupt()` hívását (SPEC-004 9. szekció 3. pont).
 *
 * **Miért önálló fájl, és nem a `stopAndAwaitRunTree` belseje.** Két, egymástól
 * eltérő menetnek van szüksége pontosan erre a lépésre, és csak erre:
 *
 * - a KÜLSŐ megszakítás és a szabályos leállás (`stopAndAwaitRunTree`), ami a
 *   hívás körül `requestStop()`-ot és `completion` várakozást is végez;
 * - a `fail_run` hibapolitika (`run-supervisor/advance-run.ts`), ami a 8.3
 *   táblázat "a motor megszakítja a többi futó lépést" követelményét
 *   teljesíti. Ott a `stopAndAwaitRunTree` egészét **nem lehet** hívni:
 *   egyrészt a hurok a SAJÁT `completion` Promise-át várná meg, ami holtpont
 *   (a `completion` épp az a Promise, amit a hurok kilépése old fel),
 *   másrészt a `fail_run` záró állapota `failed`, nem `cancelled`, tehát a
 *   DB oldali zárás a MEGLÉVŐ `resolveRunCompletion`/`markRunFailed` úton
 *   marad, nem a `cancelRunTree`-n.
 *
 * A folyam kimerítése és a beérkezett üzenetek beírása ETTŐL a ponttól a
 * `runAgentStep` meglévő ciklusában magától megtörténik (9. szekció 4. pont) -
 * ez a függvény nem avatkozik bele, csak a jelzést adja, és megvárja, hogy
 * mindegyik jelzés nyugtázódjon.
 *
 * **Amit szándékosan NEM tesz.** Nem éri el azt az agent lépést, ami a
 * hívás pillanatában még párhuzamossági helyre vár, tehát még nem hívta meg a
 * `agentQueryRunner.run(...)`-t és nincs a regiszterben: annak nincs mit
 * megszakítani, hanem ki kell venni a sorból. A külső megszakítás és a
 * szabályos leállás ezt a `stopAndAwaitRunTree` 2. pontjában teszi meg, a
 * `fail_run` ág a léptető hurokban, mindkettő EZEN hívás előtt
 * (`ConcurrencyGate.denyWaitingForRunIds`): fordított sorrendben a megszakított
 * lépés felszabaduló helyét a sorban álló testvér kapná meg.
 */
export async function interruptLiveAgentQueries(
  runIds: ReadonlySet<string>,
  agentQueryRegistry: AgentQueryRegistry,
): Promise<void> {
  const liveQueries = agentQueryRegistry.listForRunIds(runIds);
  await Promise.all(liveQueries.map((query) => query.interrupt()));
}
