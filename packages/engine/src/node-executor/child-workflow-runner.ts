import type { StartRunParentContext, WorkflowRunRecord } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';

/**
 * Egy al-workflow futás indításának kérése (SPEC-004 5.9 2. és 3. pont).
 *
 * **Ez szándékosan NEM a `db` csomag `StartRunInput` típusa.** A `StartRunInput`
 * két olyan kötelező mezőt hordoz (`providerId`, `graphSnapshotDocument`),
 * amit a `sub_workflow` végrehajtó nem tud és nem is szabad, hogy előállítson:
 * mindkettő a SPEC-004 4.8 menet 1 ... 5. lépésének eredménye (gráf olvasás,
 * háromszintű provider feloldás, gráf és provider validáció, a pillanatkép
 * dokumentum összeállítása). Ha a végrehajtó állítaná elő őket, a **szülő**
 * futás feloldását szivárogtatná át a gyerekbe, holott az 5.9 4. pontja
 * kifejezetten azt írja elő, hogy a gyerek a **saját** workflow provider
 * feloldását használja. Ezért a kérés csak azt a hármat tartalmazza, amit a
 * végrehajtó ténylegesen ismer, a többit a `ChildWorkflowRunner` implementációja
 * (a `run-supervisor`, T-005-25) vezeti le a 4.8 menet lefuttatásával.
 *
 * - `targetWorkflowId`: a `SubWorkflowNodeConfig.targetWorkflowId`, változatlanul.
 * - `input`: az `inputMapping` feloldott alakja, mező név -> érték. A kulcs a
 *   **gyerek** `start` node bemeneti mezője (5.9 2. pont), az érték a szülő
 *   kontextusából a `resolveStepReference`-szel kiolvasott kimenet.
 * - `parent`: a **szülő** futás `rootRunId`/`depth`/`workflowAncestry` hármasa,
 *   változatlanul, ahogy a `db` `StartRunParentContext` várja. A gyerek
 *   értékeit (azonos gyökér, `depth + 1`, bővített ancestry) a `startRun`
 *   vezeti le ebből, tehát a motorban nincs erre külön számítás.
 */
export interface ChildWorkflowRunRequest {
  readonly targetWorkflowId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly parent: StartRunParentContext;
}

/**
 * Egy lezárult al-workflow futás eredménye (SPEC-004 5.9 6. pont).
 *
 * - `run`: a gyerek futás **terminális** rekordja. A `status` mezője dönti el,
 *   hogy a szülő lépés `succeeded` vagy `sub_workflow_failed` osztállyal
 *   `failed` állapotban zár, és ugyanez a mező megy ki a
 *   `sub_workflow_finished` esemény payloadjában.
 * - `output`: a gyerek futás kimenete, amit a szülő lépés kimeneteként
 *   tárolunk. A spec ezt "a gyerek futás terminális node-jainak kimenete"
 *   néven nevezi meg, de a "terminális node kimenete" fogalomnak ebben a
 *   motorban **még nincs** megvalósítása: a lefutott példányok
 *   nyilvántartását (`ExecutedStepInstance` lista) és a terminális állapot
 *   megállapítását (`isRunTerminal`) a `run-supervisor` birtokolja, nem a
 *   `node-executor` réteg. A mező ezért `unknown`, és a kiszámítása a port
 *   implementációjának a felelőssége - lásd a `ChildWorkflowRunner`
 *   dokumentációját és a `packages/engine/CLAUDE.md` T-005-25-nek szóló
 *   emlékeztetőjét.
 */
export interface ChildWorkflowRunResult {
  readonly run: WorkflowRunRecord;
  readonly output: unknown;
}

/**
 * A `sub_workflow` végrehajtó **belső, motoron belüli** függősége: az a
 * képesség, hogy egy teljes gyerek futást el lehessen indítani és meg lehessen
 * várni (SPEC-004 5.9 3. és 6. pont).
 *
 * **Miért port alakú függőség, és miért nem a kilenc befecskendezett port
 * egyike.** A kilenc port (SPEC-004 3.2) külső rendszerekhez köt, és a
 * `createEngine` bemenete; ez viszont a motoron **belüli** kör feloldása: a
 * `run-supervisor` (T-005-25) hívja a `node-executor` réteget, és a
 * `sub_workflow` végrehajtónak vissza kell tudnia hívni a "futtass le egy
 * workflow-t" képességet, amit épp a `run-supervisor` nyújt. Ezt a kört egy
 * fordítási idejű import nem tudná feloldani (a `node-executor` nem
 * importálhatja a `run-supervisor`-t), egy paraméterként átadott függvény
 * viszont igen: a `run-supervisor` **önmagára hivatkozva** tölti ki, rekurzívan.
 *
 * **Miért két fázis, és nem egyetlen "futtasd le" függvény.** A `startChildRun`
 * a 4.8 menet 1 ... 7. lépését futtatja le (a gyerek futás sora létrejön,
 * `running` állapotba kerül, a `start` node ütemezve), és a **még futó**
 * gyerek rekordját adja vissza; az `awaitChildRun` ezután vár a terminális
 * állapotra. Egyetlen, csak a végén visszatérő függvény esetén a
 * `step_run.sub_workflow_run_id` oszlop és a `sub_workflow_started` esemény is
 * csak a gyerek befejeződése után íródhatna, tehát az élő nézet a "elindult"
 * és a "befejeződött" jelzést egyszerre kapná - ez pontosan az, amiért az
 * esemény létezik (SPEC-004 13. szekció). A kettéosztás emellett a
 * `run-supervisor` természetes szerkezetét követi (a T-005-23 elfogadási
 * kritériuma is három részt nevez meg: indítás, léptetés, terminális állapot).
 *
 * **Holtpont mentesség** (5.9 5. pont, 7.2 táblázat): a `sub_workflow` lépés
 * nem kér párhuzamossági helyet, tehát az `awaitChildRun` `await`-je alatt a
 * végrehajtó egyetlen erőforrást sem tart fogva, és a gyerek futás lépései
 * szabadon kaphatnak helyet ugyanabból a szabályozóból.
 */
export interface ChildWorkflowRunner {
  /**
   * A gyerek futás indítása a SPEC-004 4.8 **teljes** menetével (gráf olvasás,
   * provider feloldás, gráf és provider validáció, bemenet ellenőrzés,
   * pillanatkép, `startRun`, `markRunRunning`, a `start` node ütemezése). A
   * hibaága a szülő lépést `sub_workflow_failed` osztállyal zárja: egy el sem
   * indult gyerek ugyanúgy sikertelen al-workflow, mint egy elbukott.
   */
  readonly startChildRun: (request: ChildWorkflowRunRequest) => Promise<Outcome<WorkflowRunRecord>>;

  /**
   * Várakozás a már elindított gyerek futás terminális állapotára, és a
   * kimenetének visszaadása.
   */
  readonly awaitChildRun: (childRunId: string) => Promise<Outcome<ChildWorkflowRunResult>>;
}
