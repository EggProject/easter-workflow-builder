import type { Outcome } from '@easter-workflow-builder/core';
import type { RunCompletion } from '../error-policy/run-completion.ts';

/**
 * Egy **aktív** (még nem terminális) futás háttérfolyamatának kézikönyve.
 *
 * A `startRun` a 4.8 menet 7. lépése után visszatér, a futás léptetése viszont
 * ettől kezdve háttérben megy. Ez a struktúra az egyetlen fogódzó ehhez a
 * háttérfolyamathoz, és két jövőbeli téma épül rá:
 *
 * - a `run-interrupt` (T-005-26): a 9. szekció 2. pontja szerint a
 *   megszakításnak **azonnal** meg kell akadályoznia, hogy a futásból újabb
 *   lépés induljon; erre való a `requestStop`. A fa többi tagját (az
 *   al-workflow futásait) az azonos `rootRunId` alapján a
 *   `RunSupervisor.listActiveRuns` adja (9. szekció 3. pont).
 * - a `createEngine` `shutdown` művelete (T-005-28): a 10.2 szabályos leállás
 *   ugyanezt a két lépést végzi minden aktív futáson, majd megvárja a
 *   `completion` teljesülését.
 *
 * A `completion` a futás léptetésének eredménye. **Nem utasít el**: minden
 * hibaág `Outcome` értékként érkezik, tehát az `await` sosem dob.
 */
export interface ActiveRunHandle {
  readonly runId: string;

  /**
   * A futás fájának gyökere (SPEC-003 4.8). Egy megszakítás a **teljes** fát
   * viszi, tehát a `run-interrupt` ezzel a mezővel szűr.
   */
  readonly rootRunId: string;

  readonly workflowId: string;

  readonly completion: Promise<Outcome<RunCompletion>>;

  /**
   * A léptető hurok **nem indít több új lépést**; a már futók befejeződnek, és
   * a hurok a terminális állapot elérésekor **nem** írja ki a futás záró
   * állapotát.
   *
   * A záró állapot írásának elhagyása szándékos: a megszakítás (9. szekció 5. pont) és a szabályos leállás (10.2) a futást és minden nem terminális
   * lépését **egyetlen tranzakcióban** zárja le, a `db` oldalon. Ha a hurok is
   * írna, két, egymással versenyző állapotváltás keletkezne ugyanarra a sorra.
   */
  readonly requestStop: () => void;

  readonly isStopRequested: () => boolean;
}

/**
 * Az aktív futások nyilvántartása. A `run-supervisor` egyetlen példányban
 * hozza létre, és minden elindított futáshoz felvesz egy kézikönyvet, amit a
 * futás terminális állapotában (a `completion` teljesülésekor) el is távolít.
 *
 * **Miért nem marad benn a lezárult futás.** A motor egyetlen, hosszan futó
 * folyamatban él; egy sosem ürülő térkép a lefutott futások számával nőne. A
 * `sub_workflow` gyerek futásának megvárása ezért **nem** ebből a
 * nyilvántartásból dolgozik: azt a `run-supervisor` külön, a `awaitChildRun`
 * hívásakor ürülő térképe tartja (`create-run-supervisor.ts`).
 */
export interface ActiveRunRegistry {
  register(handle: ActiveRunHandle): void;
  release(runId: string): void;
  get(runId: string): ActiveRunHandle | undefined;
  list(): readonly ActiveRunHandle[];
}

/**
 * A nyilvántartás létrehozása. Az állapot egy lezárásban élő `Map`, ugyanaz a
 * minta, mint a `createConcurrencyGate` és a `createApprovalWaitRegistry`
 * esetén: a felület semmit nem szivárogtat ki a belső térképből, és két teszt
 * nem látja egymás állapotát.
 */
export function createActiveRunRegistry(): ActiveRunRegistry {
  const handles = new Map<string, ActiveRunHandle>();

  return {
    register: (handle) => {
      handles.set(handle.runId, handle);
    },
    release: (runId) => {
      handles.delete(runId);
    },
    get: (runId) => handles.get(runId),
    list: () => handles.values().toArray(),
  };
}
