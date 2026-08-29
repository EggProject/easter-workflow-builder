import type { UnhandledErrorPolicy } from '@easter-workflow-builder/db';
import type { ProviderCapabilityDescriptor, ProviderId } from '@easter-workflow-builder/provider-capability';
import type { SessionBearingInstance } from '../agent-step/session-bearing-instance.ts';
import type { SessionSourceNodes } from '../agent-step/session-source-nodes.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import type { UnhandledErrorRecord } from '../error-policy/unhandled-error-record.ts';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import type { RunTopology } from '../scheduling/run-topology.ts';
import type { SchedulerState } from '../scheduling/scheduler-state.ts';

/**
 * Egy node **futás közben változatlan** végrehajtási terve: minden, amit a
 * `run-supervisor` a node bármelyik példányához előre ki tud számolni, a futás
 * indításakor, egyszer.
 *
 * - `config`: a validált, szűkített node config (4.7).
 * - `onUnhandledError`: ugyanaz a mező, `null` nélkül. A tárolt alak
 *   nullázható (SPEC-003 4.3), a `validateUnhandledErrorPolicy` viszont a
 *   futás indításakor már elutasította a `null` értéket, és a
 *   `resolveErrorRoute` nem nullázható paramétert vár - a szűkítés helye a
 *   `buildNodePlans`, hogy a hibakezelés útján ne keletkezzen holt ág.
 * - `providerId`: a háromszintű feloldás node-onkénti eredménye (11.1).
 * - `descriptor`: a `providerId`-hoz tartozó leíró, a `providerDescriptorLookup`
 *   porton át. Futásonként egyszer kérdezzük le, mert a leíró a futás alatt
 *   nem változhat (a pillanatkép be van fagyasztva).
 * - `availableBranchKeys`: a node ténylegesen bekötött, `on_error`-tól
 *   különböző kimenő éleinek `branch_key` értéke, a `branch` végrehajtó
 *   bemenete (`execute-branch.ts`).
 */
export interface NodePlan {
  readonly config: ExecutableNodeConfig;
  readonly onUnhandledError: UnhandledErrorPolicy;
  readonly providerId: ProviderId;
  readonly descriptor: ProviderCapabilityDescriptor<string, string>;
  readonly availableBranchKeys: readonly string[];
}

/**
 * Egy hibára futott lépés adatai, amiket az `on_error` élen elért
 * `error_handler` példány végrehajtása igényel (SPEC-004 8.2 bevezető). A
 * kulcs, ami alatt áll, a **kezelő** példány kulcsa (`buildScopedKey`), mert
 * a kezelő végrehajtásakor pontosan az áll rendelkezésre.
 *
 * A `failedInstance` azért kell, mert egy sikeres újrapróbálkozás után a
 * vezérlés a **megismételt node** saját kimenő élein megy tovább (8.2 5. pont),
 * tehát a kezelő lefutása után ezt a példányt kell újra sorba állítani.
 *
 * Az `escapeEdgeIds` a hibára futott példány `on_error` élei: azok, amik a
 * hiba pillanatában `live` jelölést kaptak. A többi kimenő él jelölése ekkor
 * **elhalasztódik** (`failure_escaped`), és ha a hiba útja újrapróbálkozás
 * nélkül zárul, ez a halmaz mondja meg, mely éleket kell kihagyni a záró
 * `dead` jelölésből (`failure_settled`, `advance-run.ts`
 * `settleDeferredFailure`).
 */
export interface PendingFailure {
  readonly failedInstance: StepInstanceReference;
  readonly errorKind: EngineErrorKind;
  readonly errorMessage: string;
  readonly attempt: number;
  readonly escapeEdgeIds: ReadonlySet<string>;
}

/**
 * Egy futás **memóriában élő** végrehajtási állapota. A `scheduling` téma
 * tiszta reducerével szemben ez szándékosan **mutálható**: a léptető hurok
 * egyetlen futást vezet, és az állapot a hurok lezárásában él - ugyanaz a
 * megfontolás, mint a `concurrency-gate` esetén, csak ott a megosztás, itt a
 * hurok ciklikus természete indokolja (`packages/engine/CLAUDE.md`).
 *
 * - `executedInstances`: a lefutott példányok, **időrendben**; a `steps`
 *   hivatkozás feloldás (6.2) és a `join` bemenetek (5.6) forrása.
 * - `sessionInstances`: azoknak a lefutott példányoknak a szűrése, amiknek a
 *   `step_run` sorára SDK session azonosító került (6.3).
 * - `unhandledErrors`: a kezeletlen hibák, **a bekövetkezés sorrendjében**;
 *   a futás záró állapotának bemenete (8.4).
 * - `pendingFailures`: kezelő példány kulcsa -> a hozzá vezető hiba adatai.
 * - `retryAttempts`: példány kulcsa -> a következő végrehajtás `attempt`
 *   sorszáma. Csak akkor van bejegyzés, ha a példány újrapróbálkozás alatt áll
 *   (8.2 4. pont); egyébként az `attempt` az első kísérlet.
 * - `failRunRequested`: kezeletlen hiba `fail_run` politikával (8.3). A hurok
 *   ettől kezdve nem indít új lépést, és a futás `failed` állapotban zár.
 * - `stopRequested`: KÜLSŐ leállítás (`ActiveRunHandle.requestStop`). A hurok
 *   nem indít új lépést, és a záró állapot írását a leállítást kérőre hagyja.
 */
export interface RunExecution {
  readonly runId: string;
  readonly topology: RunTopology;
  readonly nodePlans: ReadonlyMap<string, NodePlan>;
  readonly sessionSourceNodes: SessionSourceNodes;
  readonly runInput: unknown;
  scheduler: SchedulerState;
  readonly executedInstances: ExecutedStepInstance[];
  readonly sessionInstances: SessionBearingInstance[];
  readonly unhandledErrors: UnhandledErrorRecord[];
  readonly pendingFailures: Map<string, PendingFailure>;
  readonly retryAttempts: Map<string, number>;
  failRunRequested: boolean;
  stopRequested: boolean;
}
