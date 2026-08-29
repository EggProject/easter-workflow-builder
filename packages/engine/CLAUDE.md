# packages/engine

## Mi ez a mappa

DAG ütemező, node végrehajtók, hibakezelés és a párhuzamossági szabályozó: a workflow végrehajtó
motor (SPEC-004). A csomag **egy tárgykörű**, ezért a téma mappák közvetlenül a `src/` alatt
állnak, egy szint mélyen, tárgykör mappa nélkül (SPEC-004 12. szekció).

A csomag a PLAN-005 F3 fázisában épült fel, lépésenként egy-egy téma mappával. **Az F3 fázis
lezárult**, tíz téma áll készen: a kilenc befecskendezett port típusa és a motor hibaosztályainak
szótára (T-005-8), a motor eseményei (T-005-9), a végrehajtható gráf szerkezete a gráf alak
ellenőrzéseivel (T-005-10), az ág hatókör verem a kiegyensúlyozottság ellenőrzésével (T-005-11), a
háromszintű provider feloldás (T-005-12), a leírótól függő viselkedések (T-005-13), a
kötelező/tiltott env változók feldolgozása (T-005-14), a futás indítási validációja, ami az előző
hatot egyetlen `validateRun` menetbe fogja (T-005-15), és a futás kontextus összeállítása a
`steps` hivatkozás feloldásával (T-005-16). Az **F4 fázis** ehhez hozzátette a DAG ütemező
állapotgépét (`scheduling`, T-005-17) és a párhuzamossági szabályozót (`concurrency-gate`,
T-005-18). Az **F5 fázis** első lépése az agent lépés életciklusát adta (`agent-step`, T-005-19),
a második lépése a `node-executor` téma **első felét** (T-005-20): az öt nem-agent node típus
végrehajtóját (`start`, `branch`, `fan_out`, `loop`, `join` `merge`) és a köztük megosztott
infrastruktúrát. **A T-005-21 ehhez hozzátette a `node-executor` téma második felét**: az
`agent_step` és a `join` `ai_synthesis` végrehajtóját, a párhuzamossági hely kérésével és
felszabadításával. **A T-005-22 hozzátette a `human_approval` végrehajtóját**, a korlátlan és a
korlátos várakozással (5.8), plusz a döntésre várás `ApprovalWaitRegistry`-jét, ami a
`decideApproval` motor művelet (T-005-28, még nem létezik) felé nyitott felület. **A T-005-23
hozzátette a `sub_workflow` végrehajtóját**, az ancestry alapú rekurzióvédelemmel és a
`ChildWorkflowRunner` port alakú, motoron belüli függőséggel, amit a `run-supervisor` (T-005-25)
tölt majd ki. **A T-005-24 zárta le a `node-executor` témát és nyitotta meg az `error-policy`
témát**: az `error_handler` végrehajtója (8.2), a kimerítő diszpécser (`executeNode`), az
`on_error` útvonal és a `fail_run`/`fail_branch` politika tiszta döntő függvényei (8.1, 8.3), a
futás záró állapota (8.4), és a `backoffMs` lista hosszának futás indítási ellenőrzése
(`insufficient_backoff_list`). **A T-005-25 hozzátette a `run-supervisor` témát**: a futás
indításának SPEC-004 4.8 szerinti teljes menete, a háttérben futó léptető hurok a terminális
állapotig, a futás záró állapotának kiírása, és a `ChildWorkflowRunner` rekurzív implementációja.
**A T-005-26 hozzátette a `run-interrupt` témát**: a felhasználói megszakítás teljes menete (SPEC-004 9. szekció) - az élő `AgentQuery` objektumok nyilvántartása (`agent-query-registry.ts`), a
`requestStop()`/`interrupt()`/`completion` várakozás közös menete (`stop-and-await-run-tree.ts`) és
az `interruptRun` belépési pont, ami a `run-supervisor` aktív kézikönyveit a `rootRunId` szerint
szűkíti, majd a `packages/db` `run-recovery` témájának új `cancelRunTree` primitívjével egyetlen
tranzakcióban zár. **A T-005-27 két dolgot adott hozzá.** Először, a `run-interrupt` témát
bővítette a `shutdownActiveRuns` függvénnyel (`shutdown-active-runs.ts`, SPEC-004 10.2 szekció,
szabályos leállás): a `stopAndAwaitRunTree`-t (ÚJRAHASZNÁLVA a T-005-26 primitíváját) MINDEN aktív
futásra lefuttatja - nem `rootRunId` szerint szűkítve, mint az `interruptRun`, hanem a
`RunSupervisor.listActiveRuns()` TELJES listájára -, majd a `packages/db` `run-recovery` témájának
`recoverInterruptedRuns('graceful_shutdown')` hívásával zár. Másodszor, megnyitotta és egyben le is
zárta a spec 12. szekciójában felsorolt utolsó téma mappát, a `startup-recovery`-t: a
`runStartupRecovery` a `RunRecovery.recoverInterruptedRuns('startup_recovery')` hívást burkolja
(SPEC-004 10.1 szekció), plusz a `restartRun` motor műveletet a `run-supervisor` témába illesztette
(`restart-run.ts`, 9. szekció zárómondata) - lásd mindkettő részleteit lent. Ma tizennyolc téma áll
készen, a PLAN-005 F3-F7 fázisa szerinti teljes lista; a T-005-28 a `createEngine` összeállítást és
a `shutdown()`/`decideApproval()` metódust adja, ami a `shutdownActiveRuns`-ra és az
`ApprovalWaitRegistry`-re épít.

## Fájlok

| Mappa                   | Felelősség                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine-port/`          | a kilenc befecskendezett port típusa és az összefogó `EngineDependencies` (SPEC-004 3.2, 3.3). **Típus-only, nincs `.spec.ts`** (SPEC-002 6.3 pont)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `engine-error/`         | a motor hibaosztályainak `EngineErrorKind` uniója (nyitott, később bővülhet), az `isEngineErrorKind` guard és a `formatEngineErrorMessage` hibaüzenet formázó (F-24 konvenció), mindkettő saját `.spec.ts` párral                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `engine-event/`         | a 13, motor eredetű `run_event` `kind` payload alakja (egy fájl egy payload típus), az összefogó `EngineEvent` diszkriminált unió és a `writeEngineEvent` motor esemény író, ami a `database.events.appendEngineEvent`-et hívja, `occurredAtMs`-t a `clock` portból számítva (SPEC-004 13. szekció, PLAN-005 T-005-9). A `StepStartedPayload` az öt kötelező mező mellett a SPEC-004 11.3 táblázat három opcionális jelölő mezőjét is hordozza (`strategyUnproven`, `modelIdentifierUnproven`, `serverToolAvailabilityUnproven`), amiket a `capability-policy` téma `unknown` ágai töltenek (T-005-13). Az `EngineEvent['kind']` unió pontosan 13 tagú tesztje és a `writeEngineEvent` `.spec.ts`-e valós `:memory:` adatbázis ellen fut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `run-graph/`            | a pillanatkép átindexelése `ExecutableGraph` alakra (`buildExecutableGraph`), a visszaél keresés (`findLoopBackEdges`), a kör keresés a visszaélek elhagyása után (`detectGraphCycle`), a `loop` node alakjának két ellenőrzése (`validateLoopBackEdgeBody`, `validateLoopBranchEdges`) és az elérhetőség számítás (`computeReachableNodeIds`), a SPEC-004 4.1 és 4.6 szekciója szerint (PLAN-005 T-005-10). Tiszta függvények, a téma egyetlen sora sem érint adatbázist. Az `executable-graph.ts` **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `branch-scope/`         | a hatókör verem két alakja (`branch-scope.ts` a futáskori, `static-scope-stack.ts` a futás indítás előtti, validációs), a `validateScopeBalance` kiegyensúlyozottság ellenőrzés és a belőle levezetett `FanOutJoinPairing` (SPEC-004 4.3 és 4.5, PLAN-005 T-005-11). Tiszta függvény, adatbázis nélkül. A három típusfájl **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `capability-policy/`    | a SPEC-004 11.3 táblázat leírótól függő viselkedései, viselkedésenként egy tiszta függvényben, plusz a döntések eredmény típusai (PLAN-005 T-005-13). Ami itt áll, a táblázat sorszámával: 1. `resolveStructuredOutputStrategy`, 3. `validateMaxTurnsFloor`, 4. `validateForcedToolChoiceRisk`, 5. `resolveModelWireIdentifier`, 6. `requireModelSelection`, 7. `validateModelId`, 8. `resolveThinkingMode`, 9. `resolveEffortInclusion`, 12. `resolveDisallowedServerTools`, 13. `shouldIncludePartialMessages`, 14. `resolveConcurrencySuggestion`, 15. `RATE_LIMIT_RETRY_POLICY`, 16. `resolveConnectionTestMode`, 17. `validateSdkVersionMatch`. A 10. és a 11. sor a `provider-environment` témáé, a 2. sor az `agent-step` témáé, lásd "Szabályok". Az öt eredmény típusfájl **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `provider-resolution/`  | a `resolveEffectiveProvider` háromszintű provider feloldás: lépés felülírás > workflow felülírás > globális alapértelmezés, egyik hiányában sem `no_default_provider` hiba (SPEC-004 11.1, PLAN-005 T-005-12). Tiszta függvény, egyetlen node/lépés szintű hívás; a több node-ra való végigfuttatás a `run-validation` téma dolga (T-005-15). Nincs önálló leíró kereső wrapper, lásd "Szabályok"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `run-validation/`       | a futás indítási validációja: a SPEC-004 4.7 táblázat mind a tíz ellenőrzése (`validateStartNode`, `validateEdgeEndpoints`, `validateNodeReachability`, `validateImplementedNodeTypes`, `validateBranchEdgeKeys`, `validateDefaultBranchKey`, `validateErrorHandlerEdges`, `validateNodeConfigs`, `validateUnhandledErrorPolicy`, `validateJoinMergeSettings`), a 4.2 fenntartott `branch_key` szabálya (`validateReservedBranchKeys`), a 8.2 3. pontjának `backoffMs` hossz ellenőrzése (`validateErrorHandlerBackoff`, T-005-24), a 4.8 2. lépésének node-onkénti provider feloldása (`resolveNodeProviders`), és az ezeket a `run-graph` és a `branch-scope` téma ellenőrzéseivel egyetlen menetbe fogó `validateRun` (PLAN-005 T-005-15). Az `executable-node-config.ts` és a `validated-run.ts` **típus-only**; az előbbi mégis kap `.spec.ts`-t, mert a garanciája fordítási idejű, lásd "Szabályok". **A SPEC-004 11.2 provider validáció bedrótozása itt tudatosan nem történt meg**, lásd ugyanott                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `run-context/`          | a `RunContext` összeállítása (`buildRunContext`) és a `steps` hivatkozás feloldása ős példányokra, a SPEC-004 6.1 és 6.2 szekciója szerint (PLAN-005 T-005-16). A feloldás két segéddel dolgozik: a `collectAncestorNodeIds` a gráfbeli ős halmazt adja a bejövő él térképen visszafelé haladva, a `findVisibleStepInstance` az ág kontextus előtag feltételt és a legbelső példány kiválasztását. A `findVisibleStepInstance` a példány típusában **generikus** (`StepInstanceReference` megszorítással), mert ugyanezt a szabályt az `agent-step` téma is használja, session azonosítót hordozó sorokon (T-005-19); a duplikálás helyett a típusparaméter tartja egy helyen az előtag szabályt. Az egyetlen node hivatkozást feloldó, `unresolvable_step_reference` hibát adó `resolveStepReference` külön exportált függvény, mert azt a `sub_workflow` `inputMapping` feloldása hívja majd (5.9 2. pont, T-005-23). Tiszta függvények, adatbázis nélkül. A `run-context.ts`, a `step-instance-ref.ts` és az `executed-step-instance.ts` **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `provider-environment/` | a SPEC-004 11.3 táblázat 10. és 11. sora: a `buildProviderEnvironmentBlock` a lépés kimenő `Options.env` blokkját állítja össze a `requiredEnv[]` és a `disallowedEnv[]` leíró mezőből, a `processEnvironment` porton át (PLAN-005 T-005-14). A `resolveRequiredEnvironmentValue` egyetlen `requiredEnv` bejegyzést old fel: `literal` forrásnál a leíró `literalValue` mezőjét, `process_env_passthrough` forrásnál a port olvasott értékét adja, hiányzó változóra `missing_provider_env` hibával, kizárólag a névvel. A `disallowedEnv[]` neve a feloldás **előtt** kizár, hogy egy tiltott, de hiányzó változó se okozzon hibát. Tiszta függvény, adatbázis és esemény nélkül: sem üzenetben, sem eseményben nem ad vissza env **értéket**, csak nevet (17. szekció 33. és 64. kritérium)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `scheduling/`           | a DAG ütemező tiszta, memóriában élő állapotgépe (SPEC-004 4.4, 4.5, 4.6, 7.1, PLAN-005 T-005-17). A `SchedulerState` hét nyilvántartása fogja össze az élenkénti `live` és `dead` jelöléseket, a `fan_out` kibontásokat, a `loop` lefutásszámokat, az érkezési sorban álló és a futó példányokat. Az egyetlen léptető az `advanceScheduler`, ami három esemény fajtát ismer (`node_completed`, `fan_out_expanded`, `loop_advanced`); a bootstrap az `enqueueStartInstance`, a sor ürítése a `takeNextReadyInstance`, a terminális állapot az `isRunTerminal`. A négy olvasó (`resolveInstanceReadiness`, `resolveLoopIteration`, `resolveFanOutItem`, `collectJoinInputs`) a végrehajtó rétegnek ad választ. Adatbázist nem érint, portot nem hív: a determinizmus a hívások sorrendjéből jön, nem az órából. A hét típusfájl (`edge-mark`, `instance-readiness`, `fan-out-expansion`, `ready-instance`, `run-topology`, `scheduler-state`, `scheduling-event`) **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `concurrency-gate/`     | a providerenkénti, minden futásra közös, szigorúan érkezési sorrendű párhuzamossági szabályozó (SPEC-004 7.1 ... 7.3, PLAN-005 T-005-18). A `createConcurrencyGate` egyetlen paramétere a `ConcurrencyLimitLookup`, tehát a téma egyetlen sora sem érint adatbázist, és nincs benne párhuzamossági szám. A hely kérése (`requestSlot`) és felszabadítása (`releaseSlot`) a felület, plusz két számláló olvasó a diagnosztikának. A `concurrency-gate.ts` és a `concurrency-limit-lookup.ts` **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `agent-step/`           | az agent lépés életciklusa (SPEC-004 5.2), a session modell (6.3, 6.4) és a kimenő SDK `Options` összeállítása (PLAN-005 T-005-19). Négy csoport: a session forrás halmaz (`collectSessionSourceNodes`) és a `resolveForkSession` gráf bejárása; a futáskori session feloldás (`findNearestAncestorSession`, `resolveSessionBinding`); a leírótól függő döntések egy menetben (`validateAgentStepCapabilities`), az `Options` összeállítása (`buildAgentStepOptions`) a `Stop` hookkal (`buildStopHookMatcher`); és a teljes futtatás (`runAgentStep`) a `result` üzenet számadatainak kiolvasásával (`readResultTelemetry`). A tíz típusfájl **típus-only, nincs `.spec.ts`**. A `runAgentStep` `.spec.ts`-e valós `:memory:` adatbázis ellen fut, és az SDK üzeneteket a commitolt `agent-step-messages-fixture.json` fájlból olvassa. **A téma nem kér párhuzamossági helyet és nem vált `step_run` állapotot**, lásd "Szabályok"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `node-executor/`        | a diszpécser és a tíz végrehajtható node típus végrehajtója (SPEC-004 5. szekció, PLAN-005 T-005-20 ... T-005-24). **T-005-20 az első felét adta**: az öt nem-agent típus (`start`, `branch`, `fan_out`, `loop`, `join` `merge`) és a köztük megosztott infrastruktúra - a hat portot összefogó `NodeExecutorPorts`, a `step_run`-hoz kötött, node típustól független adatokat hordozó `NodeExecutionInstance`, a `run-supervisor`-nak szánt `NodeExecutionOutcome`, az esemény írás+kiadás egyben (`emitEngineEvent`) és a közös nyitó/záró menet (`beginStepRun`, `finishStepRunSucceeded`, `finishStepRunFailed`). **A T-005-21 hozzáadta a második felet**: az `agent_step` (`execute-agent-step.ts`) és a `join` `ai_synthesis` (`execute-join-ai-synthesis.ts`) végrehajtóját, a köztük megosztott `agent-node-lifecycle.ts` belső menettel (a SPEC-004 5.2 teljes tíz pontja, a hely kérésével és felszabadításával, 7.2). **A T-005-22 hozzáadta a `human_approval` végrehajtóját** (`execute-human-approval.ts`, 5.8 szekció) és a döntésre várás regiszterét (`approval-wait-registry.ts`, `ApprovalWaitRegistry`/`createApprovalWaitRegistry`) - egyik sem kér párhuzamossági helyet (7.2). **A T-005-23 hozzáadta a `sub_workflow` végrehajtóját** (`execute-sub-workflow.ts`, 5.9 szekció), az ancestry alapú rekurzióvédelem tiszta függvényét (`detect-workflow-recursion.ts`) és a `ChildWorkflowRunner` port alakú, motoron BELÜLI függőséget (`child-workflow-runner.ts`, **típus-only, nincs `.spec.ts`**) - ez sem kér párhuzamossági helyet (7.2). **A T-005-24 zárta le a témát**: az `error_handler` végrehajtója (`execute-error-handler.ts`, 8.2 szekció), a `NodeExecutionOutcome` két új ága (`retry_scheduled`, `retry_exhausted`), a minden lehetséges függőséget összefogó `NodeExecutorDependencies` és a hozzá tartozó `ExecuteNodeRequest` (mindkettő **típus-only, nincs `.spec.ts`**), végül a kimerítő diszpécser (`execute-node.ts`), ami mind a tíz végrehajtható node típusra a saját `execute-*` függvényét hívja |
| `error-policy/`         | a hibakezelés döntő függvényei (SPEC-004 8.1 ... 8.4, PLAN-005 T-005-24). A `resolveErrorRoute` a 8.1 hiba útját és a 8.3 politikát adja egyetlen `ErrorRoute` értékben (`handled` menekülő élekkel, `fail_run`, `fail_branch`); a `resolveRetryDecision` a 8.2 kísérlet vezérlését (`handledErrorKinds` szűrés, kísérletszám, `backoffMs` elem); a `resolveRunCompletion` a 8.4 záró állapotát (`succeeded`, vagy `failed` az ELSŐ kezeletlen hiba osztályával és az elhalt ágak számával). **Tiszta függvények**: a téma egyetlen sora sem érint adatbázist, nem hív portot, nem szakít meg futó lépést és nem ír `step_run` sort - csak kimondja a döntést. A négy típusfájl (`error-route`, `retry-decision`, `unhandled-error-record`, `run-completion`) **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `run-supervisor/`       | a futás életciklusa (SPEC-004 4.8, 4.4 ... 4.6, 8.4, PLAN-005 T-005-25). A `createRunSupervisor` az egyetlen belépési pont: `startRun` (a 4.8 menet hét lépése), háttérben futó léptető hurok (`advanceRun`), és a `ChildWorkflowRunner` két metódusa, **önmagára hivatkozva**. A 4.8 lépései külön, önmagukban futtatható függvények: `collectRunInputs` (1. lépés), `buildSnapshotDocument` (5. lépés), `buildNodePlans` + `validateProviderCapabilities` + `validateRunInput` egyetlen menetben (`prepareRun`, 3. és 4. lépés), plusz a gyerek futás kimenete (`collectTerminalOutput`, `buildChildResult`) és az aktív futások nyilvántartása (`ActiveRunRegistry`). A `run-supervisor.ts` és a `run-execution.ts` **típus-only, nincs `.spec.ts`** **A `restartRun` (`restart-run.ts`) a T-005-27 óta**: a motor `restartRun` művelete (SPEC-004 3.1, 9. szekció zárómondata) - a `Pick<RunSupervisor, 'startRun'>`-t kapja, az eredeti futás `workflowId`-jét és `input`-ját `database.runs.getRun`-nal olvassa ki, és a `startRun`-t hívja ÚJRA, `restartedFromRunId`-vel kiegészítve; a workflow AKTUÁLIS gráfját nem kell külön beolvasnia, mert a `startRun` amúgy is mindig frissen olvassa (lásd "Szabályok")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `run-interrupt/`        | a felhasználói megszakítás teljes menete (SPEC-004 9. szekció, PLAN-005 T-005-26). Az `AgentQueryRegistry` (`agent-query-registry.ts`) egy élő, `stepRunId` kulcsú `Map`: a `register`/`unregister` a `runAgentStep` (`agent-step` téma) `finally` ágán fut, a `listForRunIds` a megszakítandó fa `AgentQuery` objektumait adja. A `stopAndAwaitRunTree` a közös menet: `requestStop()` minden kézikönyvön, `interrupt()` minden érintett élő `AgentQuery`-n, majd az összes `completion` megvárása. Az `interruptRun` a belépési pont: a cél `runId`-ból olvassa ki a `rootRunId`-t, a `run-supervisor` `listActiveRuns()` listáját erre szűkíti, lefuttatja a `stopAndAwaitRunTree` menetet, majd a `database.recovery.cancelRunTree(rootRunId)` egyetlen tranzakcióban zár. A `shutdownActiveRuns` (`shutdown-active-runs.ts`, T-005-27) a szabályos leállás analóg belépési pontja: a `run-supervisor` `listActiveRuns()` TELJES listáját (nem egy fára szűkítve) futtatja végig a `stopAndAwaitRunTree` menetén, majd a `database.recovery.recoverInterruptedRuns('graceful_shutdown')` GLOBÁLIS hatókörű hívást zár le - lásd "Szabályok" a `reason` paraméterezés indoklásáért. Mind a négy fájl kap `.spec.ts`-t, valós `:memory:` adatbázissal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `startup-recovery/`     | **nincs saját táblája és nincs önálló implementációja, VÉKONY burkoló téma** (SPEC-004 10.1 szekció, PLAN-005 T-005-27, AC-53). A `runStartupRecovery` (`run-startup-recovery.ts`) a MÁR KÉSZ `db` `RunRecovery.recoverInterruptedRuns('startup_recovery')` hívást burkolja. A téma két regressziós tesztet ad: `engine-never-opens-database.spec.ts` (implementáció nélküli, gépi bizonyíték arra, hogy a `packages/engine/src` alatt egyetlen termékkód fájl sem hivatkozik a `db` kapcsolat-nyitó függvényére) és `graceful-shutdown-startup-recovery-equivalence.spec.ts` (a `run-interrupt` `shutdownActiveRuns` és a `runStartupRecovery` UGYANAZON kiinduló állapoton lefuttatva azonos futás/lépés végállapotot ad, a `run_interrupted` esemény `reason` mezőjén kívül minden azonos, SPEC-004 10.2 szekció "nem kell külön ágat karbantartani", AC-54). Ez a `packages/engine/src` alatti 18., egyben utolsó téma mappa (SPEC-004 12. szekció).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Függőségi irány

Az `engine` L5 réteg (SPEC-002 4. szekció,
`tooling/scripts/src/dependency-graph/package-layer.ts`). A csomag ténylegesen a `core` (az
`Outcome` miatt), a `db` (a `database` port `DatabaseContext` típusa miatt), az `agent` (az
`agentQueryRunner` port `AgentQueryRunner` **típusa** miatt, SPEC-004 3.3), a `provider-capability`
(a `providerDescriptorLookup` port `ProviderId` és `ProviderCapabilityDescriptor` típusa miatt, L1,
szigorúan csökkenő él, SPEC-004 3.2 "Miért nem függ a motor a `provider-registry` csomagtól") és a
`typeguards` (az `isEngineErrorKind` guard `isString` hívása miatt, ugyanaz a minta, mint a
`packages/db` és a `packages/agent` csomagban) csomagtól függ. A `logger` a `package.json`-ban
deklarálva marad (SPEC-002 szerinti előírt függés), de a kódban egyelőre nem használt: ez nem lint
hiba, mert a projektnek nincs "deklarált, de importálatlan workspace függőség" tiltó szabálya, csak
a fordított irány számít hibának, amikor egy import nincs deklarálva (11. szekció "A workspace
függőségek deklarálatlansága"). Nem függ a `provider-registry` csomagtól és nem függ az Agent
SDK-tól (SPEC-004 12. szekció, 56-58. elfogadási kritérium).

**Ellentmondás a SPEC-002-ben, lezárva (2026-08-27).** A SPEC-002 4. szekció "Rétegbesorolás,
mind a 25 csomagra" táblázata korábban az `engine`-t és az `agent`-et **azonos** L4 rétegbe
sorolta, miközben a szöveges indoklás azt sugallta, hogy az `engine` szigorúan az `agent` fölött
áll - a két állítás ellentmondott egymásnak. A user döntése ezt lezárta: **az `engine` az
`agent` fölött van**, mert a végrehajtó motor ütemezi a lépéseket és hívja az Agent SDK
adaptert. A tényleges, `package.json`-ban is meglévő `engine -> agent` függés nem változott, a
SPEC-002 réteg táblázata igazodott hozzá: az `engine` L5 rétegre, a rá épülő `apps/server` -
mert a `server` az `engine`-től is függ - L6 rétegre került. A `bun run check:graph` ez után
nulla eltérést ad. Részletek:
[`../../docs/research/2026-08-27-spec002-migracio-zaras.md`](../../docs/research/2026-08-27-spec002-migracio-zaras.md),
"Lezárás, 2026-08-27" szakasz.

## Szabályok

Ha újabb téma mappa kerül a csomagba, ez a táblázat és a `bun run docs:check` ellenőrzése
ugyanabban a commitban bővül (SPEC-002 6.7).

**A `provider-resolution` téma nem kap önálló leíró kereső wrappert.** A SPEC-004 12. szekció
táblázata a témát "a háromszintű provider feloldás és a leíró keresés portja" néven nevezi meg, de
a leíró keresést a T-005-8-ban már meglévő `providerDescriptorLookup: (providerId: ProviderId) =>
ProviderCapabilityDescriptor<string, string>` port önmagában, hozzáadott logika nélkül elvégzi: a
hívás egy közvetlen függvényhívás, nincs mit köré csomagolni. Egy `lookup-provider-descriptor.ts`
fájl ezért csak a port nevét ismételné meg új néven, ami a "Minimum kód" elv (gyökér `CLAUDE.md`
2.) szerint felesleges egyszer használt absztrakció. A leírót ténylegesen a `capability-policy`
téma (T-005-13) és a `run-validation` téma (T-005-15) hívja majd, közvetlenül a porton keresztül,
a `resolveEffectiveProvider` eredményével. Hasonlóképp ez a téma **nem** jár be egy teljes
`ExecutableGraph`-ot node-onként: a SPEC-004 4.8 2. lépésének ("Provider feloldás minden node-ra")
orchesztrálása a `run-validation` téma (T-005-15) felelőssége, ami node-onként egyszer hívja meg
ezt a téma egyetlen, tiszta függvényét.

**Az `EngineErrorKind` unió szándékosan nyitott.** A motor hátralévő fázisai (F4-F7) új
hibaosztályt vehetnek fel, ha a spec további részének átfésülése során hiányzó eset derül ki; ez
természetes növekedés, nem hiba. Egy bővítéskor az `isEngineErrorKind` guard
`ENGINE_ERROR_KIND_KEYS` rekordja és a hozzá tartozó `.spec.ts` teszt listája is kötelezően bővül,
mert a `Record<EngineErrorKind, true>` annotáció ezt fordítási hibával kikényszeríti.

**A `run-graph` téma határa.** A téma a gráf **alakjáról** dönt, a futásról nem, és csak a
SPEC-004 4.6 szekció négy lépését végzi el. Ami tudatosan kimarad: a `dangling_edge` és az
`unreachable_node` hibaág (a `run-validation` téma dolga, T-005-15; ide a `computeReachableNodeIds`
nyers halmaza tartozik), a hatókör verem és a fan-out/join párosítás (`branch-scope` téma,
T-005-11), és a node config vizsgálata (a `SnapshotNode.config` `unknown` marad, a node típusa a
típusos `type` mezőből jön).

**A `branch-scope` téma két alakja.** A `BranchScope` a **futáskori** verem (SPEC-004 4.3 szó
szerinti alakja), amiben a bejegyzést nyitó lépés `stepRunId` értéke áll; ezt a `run-context` és a
`scheduling` téma tölti majd fel (T-005-16, T-005-17). A `StaticScopeFrame` ugyanannak a veremnek a
**futás indítás előtti** alakja: ott még nincs `step_run` sor (SPEC-004 4.8, "Az 1 ... 5. lépés
egyetlen adatot sem ír"), ezért a keret a hatókört nyitó gráf csomópont azonosítóját hordozza. A
két alak ugyanazt a fogalmat írja le, más életciklusban, ezért a validáció nem tudja a futáskori
típust használni.

**Két értelmezési döntés a hatókör bejárásban**, mindkettő a SPEC-004 szövegéből vezetve, mert a
spec nem mondja ki tételesen:

- A terminális node ellenőrzése **kizárólag a `fan_out` keretet** nézi, ahogy a 4.5 szekció írja, a
  `loop` keretet nem. A visszaél elhagyása után a ciklustörzs visszaélt kibocsátó node-ja
  terminálisnak látszana, nyitott `loop` kerettel, holott a ciklus a saját `exit` ágán szabályosan
  zár. Ugyanezért áll a terminális jelző a **teljes** kimenő él listán, a visszaéleket is
  beleértve: a visszaél futásidőben valódi folytatás (4.6).
- A `fan_out` node `on_error` éle **nem** kap új hatókör keretet, minden más kimenő éle igen. A 4.4 5. pontja szerint a hibára futó példány az `on_error` élére tesz `live` jelölést, tehát nem bomlik
  elemekre és nem is nyit hatókört; keret nélkül a hibaág vissza tud találkozni a `join` utáni
  ágakkal, kerettel viszont minden ilyen gráf `unbalanced_fan_out_scope` hibát adna.

**A `capability-policy` téma határa és három értelmezési döntése.** A téma a SPEC-004 11.3
táblázatának tizenhat leírótól függő sorából tizennégyet valósít meg; a maradék kettő és a
táblázat 2. sora szándékosan máshova tartozik:

- a kötelező env blokk (10. sor) és a tiltott env változók levétele (11. sor) a
  `provider-environment` téma dolga (T-005-14), mert azok a `processEnvironment` porton át
  olvasnak, nem tiszta leíró döntések;
- a `Stop` hook összeállítása (2. sor) nem leíró mező, hanem a kiválasztott stratégia
  következménye, ezért az `Options` összeállításához tartozik (`agent-step` téma, T-005-19).

A három értelmezési döntés, mindegyik a spec szövegéből vezetve:

- **A 15. sor (429 kezelés) konstans, nem elágazó függvény.** A motor nem lát HTTP választ, mert
  a kérést az `agentQueryRunner` port mögött az SDK indítja, tehát a leíró `known` ága sem tudna
  más motor viselkedést előírni, mint az `unknown` ága. Egy leíróból olvasó elágazás itt olyan ág
  lenne, ami sosem fut másképp, amit a 100 százalékos lefedettségi küszöb miatt tilos bevezetni.
  A döntést ezért a `RATE_LIMIT_RETRY_POLICY` konstans és a hozzá tartozó regressziós teszt
  őrzi.
- **A 16. sor a `modelsEndpoint.directHttpReachable` mezőt nem olvassa.** Nem elhagyás, hanem
  következmény: a motor egyetlen hálózati kapcsolatot sem nyit (7. elfogadási kritérium), tehát
  egy közvetlen, SDK-n kívüli HTTP út járhatósága a motornak nem választható menet. A mező a
  kapcsolat teszt diagnosztikájának marad, a döntést egyedül a `calledBySdk` viszi.
- **Az 1. sor akkor is `structured_output_strategy_unsupported` hibát ad, ha a leíró a kért
  stratégiát egyáltalán nem írja le.** A táblázat mezője (`structuredOutput.strategies[].usable`)
  indexelést tartalmaz, tehát a kiválasztás ennek a viselkedésnek a része, és bizonyíték nélkül a
  motor nem állíthatja, hogy a stratégia működik ezzel a providerrel (11.2, a tippelés tilalma).

A `StepStartedPayload` három opcionális jelölő mezője (`strategyUnproven`,
`modelIdentifierUnproven`, `serverToolAvailabilityUnproven`) ennek a témának az `unknown` ágaiból
származik, és a T-005-9-ben jelzett, tervezett bővítés beváltása. Az utolsó szándékosan logikai,
nem névlista: a bizonytalanság éppen azt jelentheti, hogy a tool nevek sem ismertek.

**A `run-validation` téma határa: a SPEC-004 11.2 provider validáció bedrótozása egy későbbi
lépésre vár.** A SPEC-004 4.8 3. lépése a gráf validációt és a provider validációt egyetlen
blokként nevezi meg, és a `capability-policy` téma (T-005-13) a leírótól függő ellenőrzéseket már
megírta. A `validateRun` mégis csak a **gráf** oldalt drótozza be, plusz a 4.8 2. lépésének
provider **feloldását**; a leíró alapú ellenőrzések (`validateModelId`, `resolveThinkingMode`,
`resolveEffortInclusion`, `resolveStructuredOutputStrategy`, `validateMaxTurnsFloor`,
`validateForcedToolChoiceRisk`, `validateSdkVersionMatch`) hívása a **T-005-19 `agent-step`
lépésre** marad. Az indok nem a lépés mérete: ezek a függvények nem `Outcome<void>` ellenőrzések,
hanem **döntéseket** adnak vissza (`CapabilityFieldInclusion`, `StructuredOutputStrategyDecision`,
`ModelIdentifierDecision`, `DisallowedServerToolsDecision`), amiket az `Options` objektum
összeállítása fogyaszt, és amikből a `StepStartedPayload` három `unproven` jelölője származik. Ha
a validáció most lefuttatná őket, az eredményt vagy eldobná (és a T-005-19 mindent újraszámolna,
két, egymástól elcsúszható hívási úttal), vagy a `ValidatedRun` hordozná az egész `Options`
előképet, ami az `agent-step` téma felelőssége.

**A T-005-19 óta megvan a hozzá tartozó tiszta függvény** (`validateAgentStepCapabilities`), ami a
leíró alapú tíz ellenőrzést egyetlen menetben futtatja és a döntéseket adja vissza. A szárazon
futtatás helye viszont **nem** a `validateRun`: annak a szignatúrája ma a pillanatkép dokumentum
és a két provider azonosító, és a leíró kereséséhez a `providerDescriptorLookup` portot is meg
kellene kapnia, amit a `run-supervisor` téma (T-005-25) amúgy is birtokol, mert az futtatja a
SPEC-004 4.8 teljes menetét. **A drótozás a T-005-25 óta megtörtént**, pontosan oda: a
`validateRun` után, minden `agent_step` és `ai_synthesis` módú node-ra egy
`validateAgentStepCapabilities` hívás, plusz a `validateSdkVersionMatch` a telepített SDK
verzióval (63. elfogadási kritérium), a `validateProviderCapabilities` egyetlen menetében, a futás
létrehozása előtt. Egy leíró szintű hiba (például ismeretlen `modelId`) innentől a futás
indítását buktatja meg, nem az érintett lépést; a nyitott átvezetés lezárva.

**Az `agent-step` téma határa és öt tervezési döntése.** A téma egyetlen agent lépés
végrehajtásáról szól, és szándékosan **nem** ismer sem node típust, sem párhuzamossági helyet:

- **A hely kérése és felszabadítása nem itt van** (SPEC-004 5.2 1. és 10. pont). A hely nem
  `agent_step` specifikus fogalom: ugyanaz vonatkozik az `ai_synthesis` módú `join` node-ra, és a
  `human_approval`, valamint a `sub_workflow` lépésre az a szabály, hogy **nem** foglal helyet
  (7.2) - a döntés tehát a `node-executor` rétegé, ami minden node típust ismer. A `runAgentStep`
  azt feltételezi, hogy a hely már megvan, és a felszabadítás a hívó `finally` ágán történik
  (T-005-21). Ebből következik, hogy a téma a `concurrency-gate` témát **nem importálja**.
- **A `step_run` sor létrehozása és az állapotváltás sincs itt.** A `createStepRun`, a
  `markStepRunning`, a `step_started` és a `step_finished` esemény, majd a záró
  `markStepSucceeded`/`markStepFailed` az 5. szekció közös kerete, minden node típusra azonos. A
  `runAgentStep` az `AgentStepExecution` értékkel mondja meg, mi kerüljön a záró tranzakcióba,
  beleértve a négy token oszlopot, ami hibás ágon is kimehet (SPEC-003 4.10).
- **A visszatérési érték két szintű, és ennek oka van.** Az `Outcome` **hibaága kizárólag
  adatbázis hibát** jelent; a lépés saját hibái (renderelés, env, session, provider hívás,
  `subtype`, hiányzó strukturált kimenet) a **sikeres** ágon, az `AgentStepOutcome` `failed`
  variánsában érkeznek, a hibaosztály nevével együtt. Enélkül a hibás lépés token adatai
  elvesznének, és a hívónak az `Outcome` üzenetéből kellene visszafejtenie a
  `step_run.error_kind` értékét. Ugyanezért ad a `validateAgentStepCapabilities` is saját alakot
  `Outcome` helyett: a hívott `capability-policy` függvények mindegyike pontosan egy hibaosztályt
  ad, tehát a név a hívás helyén ismert, visszafejtés nélkül.
- **Mi számít session forrásnak.** Minden node, ami agent lépést futtat: az `agent_step` és az
  `ai_synthesis` módú `join`. Az `isolated` módú lépés **is** forrás, mert az SDK minden `query()`
  híváshoz session azonosítót ad (F-16), amit a motor a `system` `init` üzenetből a `step_run`
  sorra ír (6.3); a `sessionMode` nem azt dönti el, keletkezik-e session, hanem azt, hogy a lépés
  `resume`-mal indul-e. A `resolveForkSession` első feltétele ezért mindig a **legközelebbi**
  forráshoz méri a `fan_out` mélységet: egy fan-out hatókörön belüli forrást folytató lépés nem
  forkol, mert elemenként külön session keletkezett.
- **A 6.4 második feltételének mérése a különböző `continued` node-ok száma, nem a gráfbeli utaké.**
  A 6.4 vezérelve az, hogy "a folytatandó session azonosítót ... egynél több lépés **példány**
  folytathatja"; két út ugyanahhoz az egy `continued` node-hoz (rombusz alak) továbbra is egyetlen
  példány, tehát nincs mit forkolni, az útszámlálás kombinatorikus robbanása pedig elmarad. A
  bejárás statikusan **felülbecsül** (nem tudja, melyik `branch` ág fut le), és ez a helyes irány:
  a fork az eredeti sessiont érintetlenül hagyja, a fork elmaradása viszont két párhuzamos
  folytatót engedne ugyanarra a sessionre.

**Amit az `agent-step` téma szándékosan nem tesz az `Options` objektumba: az `mcpServers` és az
`agentTools`.** A tárolt `StorableMcpServer` alak titok helyett env változó **nevet** hordoz, az
`agentTools` pedig saját folyamatban futó eszközöket kapcsol be, amiknek a példányosítása a tool
csomagokban él; a motor egyiktől sem függ, és nem is függhet (SPEC-004 12. szekció függőségi
iránya). A két mező bekötése az összeállítás (`apps/server`) dolga lesz; a motorban kitalált alakot
nem építünk. Ugyanígy nyitva marad a strukturált kimenet **séma szerinti** ellenőrzése (SPEC-004 17. szekció 21. kritérium "illeszkedik a sémára" fordulata): a motorban nincs JSON Schema
validátor, és a portlista zárt (3.2), tehát a `runAgentStep` ma a kimenet **meglétét** ellenőrzi
(`hasStructuredOutput`, F-6). Ez nem elfogadott végállapot, hanem megnevezett hiány.

**A `validateRun` az első hibánál megáll, nem gyűjt hibalistát.** A SPEC-004 egyetlen helyen sem
mondja ki, melyik a kettő közül, ezért ez **tervezési döntés, nem mérésből jövő szám**: az
ellenőrzések egymás előfeltételei (a `dangling_edge` után az elérhetőségi bejárás, a
`malformed_node_config` után a config szintű ellenőrzések értelmezhetetlenek lennének), és az
`Outcome` alak eleve egyetlen üzenetet hordoz. Ha a szerkesztőnek valaha teljes hibalista kell, az
külön felület lesz, nem ennek a függvénynek a bővítése.

**Minden node kap feloldott providert, nem csak az agent jellegűek.** A pillanatkép dokumentum
`SnapshotNode.effectiveProviderId` mezője kötelező és nullázhatatlan, node típustól függetlenül
(SPEC-003 5.1), ezért a `resolveNodeProviders` a gráf minden node-jára lefuttatja a feloldást. A
nem agent jellegű node-oknál (start, branch, fan_out, loop, human_approval, error_handler,
sub_workflow, `join` `merge`) nincs lépés szintű felülírás, tehát rájuk a workflow és a globális
szint dönt. Ebből következik, hogy hiányzó globális alapértelmezés akkor is `no_default_provider`
hibát ad, ha a gráfban egyetlen agent lépés sincs; ez összhangban áll a SPEC-003 4.13
szekcióval, ami a hiányt a **futás indításának** feltételeként fogalmazza meg.

**Az `executable-node-config.spec.ts` a repó egyetlen `.spec.ts` fájlja egy típus-only fájl
mellett.** A konvenció szerint típus-only fájlhoz nem készül teszt (SPEC-002 6.3), itt viszont
pontosan a típus a viselkedés: az `ExecutableNodeConfig` garanciája fordítási idejű. A teszt
`@ts-expect-error` direktívákkal áll, ami akkor **bukik**, ha a megjelölt sor mégis lefordul
("Unused '@ts-expect-error' directive"), tehát a `bun run typecheck` kapu azonnal pirosra vált, ha
a `script` ágak visszakerülnek az unióba. A `@ts-expect-error` a `ban-ts-comment` szabály alatt
leírással megengedett, ezért minden direktíva mellett ott az indok.

**A `run-context` téma három értelmezési döntése.** A SPEC-004 6.2 szekció két feltételt szab a
`steps` rekordra ("az ág kontextusa a jelenlegi példány kontextusának előtagja" **és** "a node a
jelenlegi node egyik gráfbeli őse"), de nem mondja meg, hogyan mérjük őket:

- **Az előtag egyezés a hatókör bejegyzés mind a három mezőjét hasonlítja**, a `kind` és a
  diszkrimináló szám (`itemIndex`, `iteration`) mellett a `stepRunId` értéket is. A `stepRunId`
  nélkül két **különböző** `fan_out` node azonos sorszámú eleme azonos kontextusnak látszana: egy
  `f1 -> A -> j1 -> f2 -> B -> j2` alakú gráfban az `A` és a `B` verme egyaránt egyetlen `fan_out`
  keret, azonos `itemIndex` értékkel is előfordulhat, `A` kimenete mégsem címezhető `B`-ből (6.2
  zárómondata). A keretet a hatókört nyitó lépés egyszer állítja elő, és a leszármazottak másolják,
  ezért a hatókörön belül a `stepRunId` minden példányban azonos; iterációnként új `step_run` sor
  keletkezik (4.6), de az azonos iterációban futott példányok kerete így is egyezik.
- **A gráfbeli ős halmazt lokális, visszafelé haladó bejárás adja**, nem a `run-graph` téma
  `computeReachableNodeIds` függvénye. Az utóbbi az élek irányában számol, tehát csak úgy adná meg
  ugyanezt, ha a gráf minden node-jára külön lefutna; a bejövő él térképen egyetlen menet elég. A
  bejárás a **teljes** élhalmazon megy, a visszaéleket is követve: ez nem tágítja a láthatóságot,
  mert a ciklustörzs kölcsönös ős viszonyát az előtag feltétel `iteration` összehasonlítása
  metszi le.
- **Az `item` mező a hívótól érkezik, nem a veremből.** A `BranchScope` alakja a 4.3 szekcióban szó
  szerint áll, és a `fan_out` keret az elem **értékét** nem hordozza, csak az `itemIndex`
  sorszámot; a spec pedig sehol nem mondja ki, hogy a `fan_out` node kimenete maga a kiértékelt
  lista lenne. Az értéket tehát vagy megtippelnénk a `fan_out` node kimenetének alakjáról, vagy a
  hívótól kérjük. A `joinInputs` és az `error` mező ugyanígy bemenet, ott viszont maga a spec köti
  őket node típushoz (5.6, 8.2). Az `itemIndex` és az `iteration` ezzel szemben számított érték, és
  a 6.1 szó szerinti megfogalmazása szerint a **legbelső azonos fajtájú** keretből jön, nem a verem
  tetejéről: egy `fan_out` hatókörben nyitott `loop` esetén a tetőn `loop` keret áll, az
  `itemIndex` mégis látszik.

**A `scheduling` téma három értelmezési döntése.** A SPEC-004 4.4 ... 4.6 szekciója a jelöléseket
prózában írja le, és három ponton nem mondja meg, melyik **ág kontextusban** áll a jelölés. A
három döntés mindegyike ugyanabból az elvből jön: **meg nem nyílt hatókörbe nem kerül jelölés.**

- **Hibára futó vagy halott `fan_out` és `loop` példány a törzs éleit jelöletlenül hagyja.** A 4.4 3. és 5. pontja "minden kimenő élre `dead` jelölést" mond, de a `fan_out` és a `loop` törzs éle a
  cél példányt egy hatókör bejegyzéssel együtt azonosítja, amit a hatókört **nyitó lépés futásának
  azonosítója** alkot (4.3). Ilyen lépés futás halott vagy hibára futott példánynál nincs, tehát a
  jelölés kontextusa sem előállítható. Nem is hiányzik: a hatókör kiegyensúlyozottság (4.5)
  garantálja, hogy a törzs node-jai kizárólag a hatókörön belülről kapnak jelölést, tehát ott
  egyetlen példány sem vár hiába. A `join` az egyetlen kivétel, mert az a **külső** veremben fut;
  ezért kap a halott `fan_out` példány `dead` kibontás bejegyzést, amiből a `join` példány
  halottságát a `resolveInstanceReadiness` közvetlenül olvassa.
- **A folytatódó `loop` lefutás az `exit` élét jelöletlenül hagyja.** A 4.6 4. pontja `dead`
  jelölést mond rá, de az iterációnkénti jelölés nem végleges, a `dead` jelölés viszont a 4.4 3. pontja szerint **azonnal** halottá tenné a ciklus utáni node-ot, jóval azelőtt, hogy a ciklus
  ténylegesen kilépne ugyanezen az élen. Az `exit` ág sorsa csak a kilépő lefutáskor dől el
  véglegesen. A tükörkép esete a kilépő lefutás `continue` éle: az az iteráció hatóköre soha nem
  nyílt meg, tehát a fenti elv szerint marad jelöletlen.
- **A visszaélen érkező `dead` jelölés nem indít újabb lefutást.** A 4.6 "A visszaél nem vár"
  bekezdése szerint a visszaélek külön-külön indítanak egy újabb lefutást, de ez csak a `live`
  jelölésre igaz: a törzs egy halott ágából érkező `dead` jelölés a már lefutott `loop` példányt
  sem újra nem indítja, sem halottá nem teszi, hiszen a belépő élein `live` jelölés áll. A
  jelölés maga bekerül a nyilvántartásba, csak a cél példány kiértékelése marad el.

**A `join` bemeneteinek forrása a lefutott példányok listája, nem az él.** Az élen álló jelölés a
vezérlést hordozza, adatot nem: a lépés kimenete az `ExecutedStepInstance` listában áll, amit a
`run-context` téma is ugyanígy olvas. A `collectJoinInputs` ezért a `findVisibleStepInstance`
függvényt hívja, tehát a 6.2 előtag szabálya érvényes rá, és nem kellett kitalálni, mi egy
`fan_out` node "elemenkénti kimenete" (5. szekció táblázata csak a `start` node kimenetét nevezi
meg). A `RunContext.item` mező értéke ezzel szemben az ütemező `fanOutItems` nyilvántartásából jön
(`resolveFanOutItem`), mert azt a `fan_out` végrehajtója a kibontáskor átadja.

**Az érkezési sorszám nem port.** A SPEC-004 7.1 "monoton növekvő sorszámot" ír elő, de az nem idő
és nem azonosító, hanem kizárólag a futtathatóvá válások **sorrendje**, ami magukból a hívásokból
adódik. Ezért a `SchedulerState` belső számlálója adja, nem a `clock` vagy az `idGenerator` port; a 36. elfogadási kritérium ("nincs `Date.now()`, `Math.random()` a motorban") így is teljesül, és a
determinizmus a 14.2 szekció értelmében megmarad.

**A `concurrency-gate` téma négy tervezési döntése.** A SPEC-004 7. szekciója a szabályozó
viselkedését írja le, a felületét nem, ezért a négy döntés indoklása itt áll:

- **A kiosztás szinkron visszahívás, nem `Promise`.** A `requestSlot` az `onGranted` függvényt vagy
  azonnal, még a saját visszatérése előtt hívja meg, vagy később, egy `releaseSlot` hívás
  belsejéből, szintén szinkron módon. Így a téma tesztje egyetlen időzítőt, mikrotask ürítést és
  valós időt sem használ, tehát a 14.2 szekció determinizmus követelménye a felület alakjából
  következik, nem a teszt fegyelméből. A hívó oldalán ez egyetlen sor áthidalás egy `await`
  pontig, és a `Promise` az `agent-step` réteg fogalma marad. Egy `Promise<void>` alakú felület
  ugyanezt csak mikrotask ürítéssel engedné megfigyelni, ami törékenyebb és az ütemezésre bízná a
  sorrendet.
- **A korlát lekérdezés függvény, nem a létrehozáskor átvett térkép.** A SPEC-003 11. szekciója
  szerint a beállított érték "azonnal érvénybe lép", a motor viszont egyetlen `createEngine`
  híváskor jön létre: egy befagyasztott térkép a korlát változását szerverújraindításig
  visszatartaná. Ebből következik, hogy a szabályozó minden döntés előtt újra kérdez, tehát egy
  futás közben **csökkentett** korlát mellett a felszabaduló hely nem feltétlenül megy tovább;
  erre külön teszteset áll. A lekérdezés **nem tizedik port** (a lista zárt, SPEC-004 3.2), hanem a
  `createConcurrencyGate` paramétere, amit a hívó a már meglévő `database` portból állít elő.
- **Ismeretlen azonosító felszabadítása hibaág (`unknown_concurrency_slot`), nem csendes
  visszatérés.** A kétszeres felszabadítás pontosan így néz ki, és az következménye az lenne, hogy
  a szabályozó a korlát fölé enged egy lépést, csendben. A hívási minta (`requestSlot`, majd
  minden ágon egyszeri `releaseSlot`) mellett ez a hibaág valódi programhibát jelez, nem szokásos
  útvonalat. Ami **nem** hiba: a még sorban álló, helyet nem kapott kérés felszabadítása, mert az a
  megszakítás útja (9. szekció 2. pont, "a sorban álló lépései kiesnek"); ilyenkor a bejegyzés
  kiesik a sorból, és a visszahívása soha nem fut le.
- **Állapotot tartó lezárás, nem tiszta reducer, mint a `scheduling` témában.** Az ütemező
  állapotát egyetlen futás léptetése birtokolja, a szabályozó viszont **minden futás által osztott
  egyetlen objektum**, és a felszabaduló helyet egy másik futás várakozójának kell átadnia; ehhez
  értesítés kell, amit tiszta függvény nem tud kiadni. A közös sort a `Map` beszúrási sorrendje
  adja, ezért itt nincs külön érkezési sorszám mező: a kiszolgálás providerenként a legrégebbi
  várakozót viszi, tehát egy telített provider soha nem tartja fel a szabadat.

**A kimerítő diszpécser (T-005-24) és a paraméterlistája.** A T-005-20 ... T-005-23 szándékosan
nem írta meg a diszpécsert, mert a `switch(config.type)` szerkezetnek a
`switch-exhaustiveness-check` szabály miatt kimerítőnek kell lennie az `ExecutableNodeConfig`
unión, és addig hiányzott ág. A T-005-24 óta mind a tíz ág készen áll, tehát az `execute-node.ts`
megvan. Három tervezési döntés áll mögötte:

- **A diszkrimináns a kérés LEGFELSŐ szintjén van** (`ExecuteNodeRequest.kind`, `'node'` vagy
  `'error_handler'`), nem csak a `config.type` mezőn. Az `error_handler` az egyetlen node típus,
  aminek a végrehajtásához a hibát adó MÁSIK lépés három adata is kell (`failedErrorKind`,
  `failedAttempt`, `retryStepRunInput`, SPEC-004 8.2 bevezető); ha ezek a közös részben állnának,
  opcionálisak lennének, és a diszpécsernek egy hiányzó-érték ágat kellene kezelnie, ami a hívási
  szerződés szerint sosem fut. A TypeScript viszont **nem szűkít beágyazott diszkriminánsra**: a
  `request.config.type` vizsgálata a `request` unióját nem szűkíti (mérés: a fordító `TS2339
Property 'extra' does not exist` hibát adott egy ilyen alakra). Ezért a `kind` mező a legfelső
  szinten áll, a `'node'` ág configja pedig `Exclude<ExecutableNodeConfig, ErrorHandlerNodeConfig>`,
  amin a `switch` kilenc ággal (a `join` két módjával) kimerítő.
- **A függőségek egyetlen objektumban** (`NodeExecutorDependencies`): a `ports` mező a teljes
  `EngineDependencies` (a kilenc port, ami szerkezetileg bővebb a hat portos
  `NodeExecutorPorts`-nál, tehát mindkét fajta végrehajtó megkapja), plusz a három motoron belüli
  együttműködő (`concurrencyGate`, `approvalRegistry`, `childWorkflowRunner`). Minden ág csak a
  szükséges részhalmazt adja tovább: a szabályozót kizárólag az `agent_step` és a `join`
  `ai_synthesis` (7.2), a regisztert kizárólag a `human_approval`, a gyerek futtatót kizárólag a
  `sub_workflow`.
- **A diszpécser nem `async`.** Öt végrehajtó szinkron, öt `Promise`-t ad; a szinkron ágakat egy
  `async` burkoló egy mikrotaszkkal késleltetné, és a `require-await` szabály miatt egy felesleges
  `await`-et is igényelne. A `Promise.resolve(...)` burkolás pontosan azt fejezi ki, ami történik.

**A T-005-21 megoldása: az `agent_step` és a `join` `ai_synthesis` a `beginStepRun`-t NEM
használja.** A `beginStepRun` (lásd lent) a `createStepRun`, a `markStepRunning` és a
`step_started` esemény hármasát egyetlen, oszthatatlan lépésben futtatja - ez a T-005-20 öt
node típusának megfelel, mert egyiknél sincs közbeékelt lépés a kettő között. Az `agent_step`
életciklusa viszont a SPEC-004 5.2 1. pontja szerint **kötött sorrendet** ír elő: `createStepRun`
(`pending`) → **hely kérése a szabályozótól** → csak ezután `markStepRunning` → `step_started`. A
hely kérése tehát a `createStepRun` és a `markStepRunning` közé ékelődik, amit a `beginStepRun`
összevont felülete nem enged meg. Az `agent-node-lifecycle.ts` ezért **közvetlenül** hívja a
`ports.database.stepRuns.createStepRun`/`markStepRunning` primitíveket (ugyanazokat, amiket a
`beginStepRun` belsőleg is hív) és az `emitEngineEvent` segédet, a hely kérésével a kettő között -
ez nem a közös nyitó menet **újraírása**, csak más sorrendű összerakása, mert a végrehajtott
adatbázis-hívások és az esemény írás útja változatlan (`.claude/CLAUDE.md` 5. szekció "Csak azt
írod át, amit muszáj"). A `beginStepRun` fájl maga **változatlan** marad, mert a többi öt
végrehajtó a régi, összevont sorrendet helyesen használja.

**A közös `NodeExecutorPorts`/`NodeExecutionInstance`/`NodeExecutionOutcome` hármas.** Mind az öt
(és a T-005-21-ben még kettő) végrehajtó ugyanazt a hat portot kapja (`database`, `clock`,
`idGenerator`, `eventPublisher`, `expressionEvaluator`, `templateRenderer`) és ugyanazokat a
`step_run`-hoz kötött szerkezeti adatokat (`runId`, `instance`, `parentStepRunId`, `iteration`,
`attempt`, `providerId`) - ezt fogja össze a `NodeExecutorPorts`, illetve a
`NodeExecutionInstance`, hogy a paraméterlista ne duplikálódjon fájlonként
(`node-executor-ports.ts`, `node-executor-instance.ts`, mindkettő típus-only). A
`NodeExecutionInstance.iteration` mező **kétféleképp** töltendő ki a hívó által: az öt közül
négynél a 4.3 szekció általános szabálya szerint (a legfelső `loop` hatókör bejegyzés száma), a
`loop` node saját sorára viszont a 4.6 1. pontja szerint (a példány addigi lefutásainak száma,
`resolveLoopIteration`-ből) - ez a téma nem dönti el, melyik jelentés érvényes, csak felhasználja
a kapott értéket (lásd `execute-loop.ts` doksiját).

A `NodeExecutionOutcome` (`node-executor-outcome.ts`) a `run-supervisor`-nak szánt kimenet: **nem**
maga a `SchedulingEvent`, mert a node-executor réteg szándékosan nem kapja meg a teljes
`ExecutableGraph`-ot (a `branch` node kimenő éleinek `branch_key` listáját paraméterként kapja,
nem a gráfból olvassa - lásd `execute-branch.ts` doksiját). A `succeeded` ág
`selectedBranchKey: string | null` mezője a döntés: `null` = "minden `on_error`-tól különböző
kimenő él `live`" (a `start`, a `join` `merge` módja - a legtöbb típusnál ez az eset, SPEC-004 4.4 4. pont), nem `null` = a `branch` node ténylegesen választott kulcsa. A `fan_out_expanded` és a
`loop_advanced` ág közvetlenül megfelel a `scheduling` téma `SchedulingEvent` ugyanilyen nevű
ágainak. A `failed` ág **nem** dönt `on_error`/`fail_run`/`fail_branch` kérdésben - az a jövőbeli
`error-policy` téma (T-005-24) dolga, ez a téma csak a `step_run` `failed` lezárását és a
hibaosztályt adja vissza (SPEC-004 5. szekció "Közös szabályok").

**A közös nyitó/záró menet.** A `beginStepRun` (`createStepRun` + `markStepRunning` +
`step_started` esemény) és a `finishStepRunSucceeded`/`finishStepRunFailed` (záró `markStep*` +
`step_finished` esemény) egy-egy megosztott függvény, hogy az öt `execute-*` fájl ne ismételje meg
a SPEC-004 5. szekció "Közös szabályok minden végrehajtóra" pontját. Az `emitEngineEvent` a motor
esemény kiadásának egyetlen útja: előbb `writeEngineEvent` a `db` felé, utána
`eventPublisher.publish` az élő nézetnek, ugyanabban a sorrendben, mint az 5.2 6. pont az SDK
üzeneteknél (újracsatlakozáskor a kliens az adatbázisból pótol). Több hibaágú végrehajtóban
(`branch`, `fan_out`, `loop`) egyetlen `failBranch`/`failFanOut`/`failLoop` helyi segédfüggvény
zárja le mindegyik saját hibaosztályt, hogy a `finishStepRunFailed` esetleges DB hibája ne
duplikálódjon annyi, egyenként tesztelendő ágba, ahány hibaosztálya van a végrehajtónak.

**A node kimenet (`step_run.output`) öt döntése, mert a SPEC-004 5. szekció táblázata csak a
`start` és a `join` `merge` sorára nevez meg konkrét kimenetet:**

| Típus          | Kimenet                              | Indok                                                                                   |
| -------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `start`        | a futás bemenete                     | SPEC-004 5. szekció 1. sora, szó szerint                                                |
| `branch`       | `null`                               | vezérlést hordoz, adatot nem; a spec nem nevez meg kimenetet erre a sorra               |
| `fan_out`      | a kiértékelt elemlista               | ez a kibontás tényleges eredménye, nem csak vezérlési döntés, ezért érdemes megőrizni   |
| `loop`         | `null`                               | ugyanaz az indok, mint a `branch`-nél; a döntés a `shouldContinue` mezőben van, nem itt |
| `join` `merge` | a bemenetek listája, elem sorrendben | SPEC-004 5.6 szekció, szó szerint                                                       |

**A `fan_out` `branchLabelTemplate` renderelt szövege eldobódik.** A séma egyik táblája sem
tárolja (sem a `FanOutExpandedPayload`, ami csak `itemCount`-ot hordoz, sem a `step_run`), ezért az
`execute-fan-out.ts` a renderelést kizárólag **validációként** használja: minden elemre sikerül-e
a renderelés, `template_render_failed`-et adva, ha bármelyik elhasal. Ez a SPEC-004 5. szekció 4. sorának expliciten megengedett olvasata ("döntsd el és dokumentáld, mire használod az
eredményt, ha a séma nem tárolja").

**A `step_run.result_subtype` és `num_turns` mező írási útja lezárva (T-005-21).** A `db` csomag
`StepRunRepository.MarkStepSucceededInput`/`MarkStepFailedInput` típusa **bővült** egy opcionális
`resultSubtype?: string` és `numTurns?: number` mezővel (nem sémaváltoztatás, a `result_subtype` és
a `num_turns` oszlop már létezett, csak a repository TypeScript felülete nem engedte írni őket,
lásd `packages/db/CLAUDE.md`). A `node-executor` téma `finishStepRunSucceeded`/
`finishStepRunFailed` segédje ugyanezt a két opcionális mezőt kapta, és a `agent-node-lifecycle.ts`
tölti ki a `runAgentStep` `AgentStepExecution.resultSubtype`/`.numTurns` értékéből, ugyanazzal a
feltételes szétterítés mintával, mint a token összesítésnél (`...(execution.tokens !== undefined &&
{ tokens: execution.tokens })`). A T-005-20 öt node típusát ez nem érinti: egyiknek sincs
`resultSubtype`/`numTurns` adata, a mező mindkét záró segédnél opcionális maradt.

**A T-005-21 négy további tervezési döntése.**

- **A `ports` paraméter típusa `EngineDependencies`, nem egy új, `NodeExecutorPorts`-ból
  származtatott bővítés.** Az `agent-node-lifecycle.ts` a `runAgentStep`-et hívja, ami a teljes
  kilenc portot várja (`EngineDependencies`). Egy `NodeExecutorPorts & { agentQueryRunner,
processEnvironment }` alakú bővítés a `runAgentStep` hívásához úgyis fel kellene vegye a
  kilencedik, `providerDescriptorLookup` mezőt is - ez a téma viszont nem keres leírót (a hívó,
  a jövőbeli `run-supervisor`, már feloldva adja át), tehát egy ilyen bővítés szó szerint ugyanazt
  a kilenc mezőt írná le, mint az `EngineDependencies`, csak új néven. A meglévő típus
  újrahasználata a "Minimum kód" elv szerint helyesebb egy szerkezetileg azonos duplikátumnál.
- **A hely felszabadítása sima `try/finally`-ban áll, `return`-nel a `finally` ágban.** A projekt
  ESLint szabálykészlete nem tartalmaz `js.configs.recommended`-et (csak `typescript-eslint`,
  `unicorn`, `import-x`, `sonarjs` recommended preseteket, lásd `tooling/eslint-config`
  `base.ts`), tehát a `no-unsafe-finally` szabály **nincs bekötve**. Egy `Promise.prototype
.finally()` callback-alapú, `let`-tel áthidalt változat TypeScript-hibát adna (`This comparison
appears to be unintentional`), mert a fordító a zárt függvényen belüli újraértékadást nem
  követi a narrowing-nál - a sima `try/finally` ezt elkerüli, és pontosan azt fejezi ki, amit a
  SPEC-004 5.2 10. pontja kér: a hely **minden** ágon felszabadul, a `runAgentStep` saját
  `Outcome` hibaágán is.
- **A `CreateStepRunInput.modelId`/`.sessionMode`/`.structuredOutputStrategy` mező a `config`-ból
  jön, nem a `validateAgentStepCapabilities` döntéseiből.** A `step_run` sor létrehozása (`pending`
  állapotban) megelőzi a leírótól függő döntések számítását a kódban, és a `config.modelId`
  (`string | null`) mindig elérhető, akkor is, ha a döntés kudarcot vall (pl. `unknown_model_id`) -
  a `decisions.model.outgoingModel` viszont csak sikeres döntés esetén létezik, és az a **kimenő,
  kliens** azonosító, nem szükségszerűen ugyanaz, mint a config wire azonosítója (11.3 táblázat 5.
  sora). A `step_run.model_id` oszlop a config szintű, stabil azonosítót tükrözi.
- **A `join_resolved` esemény a záráskor MINDIG íródik, sikeres és hibás lezáráskor egyaránt.** A
  SPEC-004 5. szekció táblázata "`join_resolved` esemény"-t ír a `join` sorára, feltétel nélkül; az
  esemény a join **vezérlési szemantikáját** jelzi (hány ág futott be, milyen módban), nem az agent
  lépés saját sikerét. Az `execute-join-ai-synthesis.ts` ezért a `step_finished` esemény **mellett**
  mindig kiadja, amíg a `runAgentNodeLifecycle` maga `Outcome`-szinten sikeresen visszatér (a
  `runAgentStep` saját, adatbázis hibát jelentő `Outcome` hibaága esetén nincs érvényes `stepRun`,
  amire hivatkozni lehetne, ezért ott a `join_resolved` sem íródik, ugyanúgy, ahogy a `step_finished`
  sem).

**A `human_approval` végrehajtó és az `ApprovalWaitRegistry` négy tervezési döntése (T-005-22).**
A SPEC-004 5.8 szekció leírja a jóváhagyás várakozás **viselkedését**, de nem a motor belső
szerkezetét, amivel egy async node-executor egy KÜLSŐ, jövőbeli döntésre vár - ezek a döntések itt
állnak:

- **A regiszter a `node-executor` témán belüli fájl-csoport, nem önálló téma mappa.** A PLAN-005 F7
  fázisa "pontosan 18 téma mappát" ír elő a `packages/engine/src` alatt (Definition of Done 1.
  pont), és ez a 18 már a hátralévő lépésekkel (`sub_workflow`, `error-policy`, `run-supervisor`,
  `run-interrupt`, `startup-recovery`, a `createEngine` összeállítás) pontosan kitelik. Egy önálló
  `approval-wait-registry` téma 19-re vinné a számot, tehát az `approval-wait-registry.ts` a
  `node-executor` téma két új fájlja (`approval-wait-registry.ts`,
  `approval-wait-registry.spec.ts`) - ugyanaz a hely, mint az `execute-human-approval.ts`.
- **A regiszter felülete `Promise` alapú, nem szinkron visszahívás, mint a `concurrency-gate`.** A
  `waitForDecision(stepRunId): Promise<ApprovalDecision>` és a `notifyDecided(stepRunId, decision):
void` pár szándékosan **más** mintát követ, mint a `ConcurrencyGate.requestSlot` szinkron
  `onGranted` visszahívása: a hívó (`execute-human-approval.ts`) `Promise.race`-ben áll a
  `ClockPort.sleep`-pel, ami már eleve `Promise`-t ad, tehát egy szinkron visszahívásos felület
  csak egy extra `new Promise` csomagolást tenne a hívó oldalára, a `concurrency-gate` doksija által
  leírt előny (nulla mikrotask, közvetlenül megfigyelhető sorrend) nélkül, mert itt úgyis két
  `Promise` versenyzik egymással. A belső állapot (`stepRunId -> feloldó függvény` `Map`) viszont
  ugyanazt a mintát követi: egyetlen, a hívó által létrehozott és megosztott lezárás, nem
  modulszintű mutable változó (`approval-wait-registry.ts` doksija).
- **A `Promise.race` megszakítási mechanizmusa mindkét irányban véglegesen lezárja a vesztes ágat.**
  Ha a döntés nyer, a `controller.abort()` szól a `sleep`-nek; a `sleep` esetleges emiatti
  elutasítását egy belső `try/catch` nyeli el, mert ez az ág csakis a saját `abort()` hívásunk
  következménye lehet (a döntés már megnyerte a versenyt, az értéke úgysem kerül felhasználásra).
  Ha a `sleep` nyer, a `registry.cancelWait(stepRunId)` törli a várakozó bejegyzést, hogy az ne
  maradjon örökre egy sosem beérkező (vagy már elkésett) döntésre várva. A `catch` blokk
  szándékosan nem tesz feltételezést arról, hogy egy jövőbeli valós `ClockPort.sleep` megszakításkor
  elutasít-e vagy felold: mindkét esetben helyesen viselkedik, unhandled rejection nélkül - ezt a
  `execute-human-approval.spec.ts` "a döntés ELŐBB érkezik" tesztje egy ténylegesen elutasító hamis
  `sleep`-pel fedi, hogy a `catch` ág ne csak típusilag, de ténylegesen is lefusson (100 százalékos,
  kizárás nélküli lefedettség).
- **A `NodeExecutionOutcome` bővült egy `approval_decided` ággal**
  (`{ kind: 'approval_decided', stepRun, decision: ApprovalDecision }`, `node-executor-outcome.ts`).
  Az `approved` eset NEM a meglévő `succeeded` ágba illeszkedik (`selectedBranchKey: 'approved'`
  formában), és a `rejected` eset NEM a `failed` ágba (a `step_run.status` `rejected`, nem
  `failed`): egyetlen közös ág írja le mindkét kimenetet, mert a `step_run` állapotváltást nem ez a
  végrehajtó hajtja végre (azt a `db.approvals.decideApproval(...)` már elvégezte), ez a réteg csak
  visszaolvassa és jelzi. A `execute-human-approval.ts` **nem** kapja meg, van-e kimenő `rejected`
  `branch_key` él a gráfban (SPEC-004 5.8 utolsó pontja): a `decision` mezőt egyszerűen visszaadja,
  az élválasztást és a hibapolitika (8.3, `approval_rejected` osztály) alkalmazását a hívóra
  (jövőbeli `run-supervisor`, T-005-25) bízva - ugyanaz az elv, mint a `failed` ág `on_error`/
  `fail_run`/`fail_branch` döntésénél.

**Emlékeztető, ami a T-005-28-ra (a `decideApproval` motor művelet, a `createEngine` összeállítása)
vár.** A `db.approvals.decideApproval(...)` hívás és a hozzá tartozó `notifyDecided` hívás **ebben
a lépésben még nem létezik** - az `execute-human-approval.spec.ts` a jövőbeli hívó helyett egy
teszt-only wrappert épít (`registryDecidingImmediately`), ami a `waitForDecision` regisztráció után
egy mikrotaszkban azonnal meghívja a `notifyDecided`-et. Éles futásban a `decideApproval` motor
művelet felelőssége, hogy a `db.approvals.decideApproval(...)` **sikere UTÁN** hívja meg a
`registry.notifyDecided(stepRunId, decision)`-t, ugyanazon a regiszter példányon, amit a
`node-executor` réteg a `waitForDecision`-höz használt - enélkül egy `timeoutMs: null` (korlátlan)
`human_approval` lépés örökre várna. Ugyanígy nyitva marad a `step_finished` esemény írása a
döntés-érkezés útvonalon: a SPEC-004 5. szekció "Közös szabályok" pontja minden lépés zárásához
`step_finished` eseményt ír elő, de a `human_approval` döntés-érkezés esetén a tényleges
állapotváltás (`markStepSucceeded`/`markStepRejected`) a `db.approvals.decideApproval(...)` belseje,
nem ez a végrehajtó - a SPEC-004 5.8 utolsó pontja csak az `approval_decided` esemény írását nevezi
meg erre az útvonalra. Ez a `step_finished` esemény írásának útja ezért a T-005-28 nyitott
átvezetése, nem elfogadott végállapot.

**A `sub_workflow` végrehajtó és a `ChildWorkflowRunner` szerződés (T-005-23).** A SPEC-004 5.9
szekció leírja az al-workflow hívás **viselkedését**, de nem azt, hogyan tud egy `node-executor`
függvény egy teljes gyerek futást lefuttatni, amikor a "futtass le egy workflow-t" képesség épp a
`run-supervisor` (T-005-25) témájáé, ami viszont **hívja** ezt a réteget. Ez valódi körkörös
függőség, és a feloldása a `ChildWorkflowRunner` (`child-workflow-runner.ts`):

- **Nem a kilenc befecskendezett port egyike.** A kilenc port (SPEC-004 3.2) külső rendszerhez köt
  és a `createEngine` bemenete; ez motoron **belüli** függőség, amit az `executeSubWorkflow`
  harmadik paraméterként kap, ahogy a `human_approval` az `ApprovalWaitRegistry`-t. A `packages/db`
  `DatabaseContext` port ebbe nem szól bele.
- **Két fázis, nem egy.** A felület `startChildRun(request)` és `awaitChildRun(childRunId)` párra
  bomlik. Egyetlen, csak a végén visszatérő "futtasd le" függvény esetén a
  `step_run.sub_workflow_run_id` oszlop és a `sub_workflow_started` esemény is csak a gyerek
  befejeződése után íródhatna, tehát az élő nézet az "elindult" és a "befejeződött" jelzést
  egyszerre kapná - pontosan azt veszítenénk el, amiért az esemény létezik (13. szekció).
- **A kérés alakja szűkebb, mint a `db` `StartRunInput`.** A `ChildWorkflowRunRequest` három mezőt
  hordoz: `targetWorkflowId`, `input` (az `inputMapping` feloldott alakja) és `parent` (a **szülő**
  futás `rootRunId`/`depth`/`workflowAncestry` hármasa, változatlanul). A `providerId` és a
  `graphSnapshotDocument` **szándékosan nincs benne**: mindkettő a 4.8 menet 1 ... 5. lépésének
  eredménye, és ha a végrehajtó állítaná elő őket, a szülő provider feloldása szivárogna át a
  gyerekbe, holott az 5.9 4. pontja a gyerek **saját** feloldását írja elő. Így a szivárgás
  típusszinten lehetetlen, nem csak konvenció szerint tilos.
- **A `ChildWorkflowRunResult.output` mező `unknown`, és a kiszámítása a port implementációjáé.**
  A spec a szülő lépés kimenetét "a gyerek futás terminális node-jainak kimenete" néven nevezi meg,
  de a "terminális node kimenete" fogalomnak ma **nincs** megvalósítása a motorban: a lefutott
  példányok nyilvántartását (`ExecutedStepInstance` lista) és a terminális állapot megállapítását
  (`isRunTerminal`) a `run-supervisor` birtokolja, nem a `node-executor` réteg. A végrehajtó ezért
  nem számol kimenetet, csak továbbadja azt, amit a port ad.

**A `ChildWorkflowRunner` valós implementációja a T-005-25 óta megvan**, rekurzívan: a
`run-supervisor` önmagát adja át `ChildWorkflowRunner`-ként az `executeSubWorkflow` hívásnál. A
két metódus dolga tételesen:

1. `startChildRun(request)`: a SPEC-004 4.8 menet **teljes** 1 ... 7. lépése a
   `request.targetWorkflowId` workflow-ra (`readGraph`, `readSettings`, node-onkénti provider
   feloldás, gráf és provider validáció, a `request.input` ellenőrzése a gyerek `start` node
   `inputFields` listája ellen, pillanatkép összeállítás, `startRun` a `request.parent`
   kontextussal, `markRunRunning`, a `start` node ütemezése), majd a **még futó** gyerek
   `WorkflowRunRecord` visszaadása. Az 1 ... 5. lépés egyetlen adatot sem ír, tehát egy érvénytelen
   gyerek workflow nem hoz létre `workflow_run` sort; a hibaág üzenete a szülő lépés
   `sub_workflow_failed` hibaüzenetébe kerül.
2. `awaitChildRun(childRunId)`: a gyerek futás léptetése a terminális állapotig, majd a terminális
   `WorkflowRunRecord` és a futás kimenete (`output`) visszaadása. A kimenet fogalmát a
   `collectTerminalOutput` dönti el, lásd a `run-supervisor` téma 3. tervezési döntését.

A `run-supervisor` az `executeSubWorkflow` hívásakor a **saját** `ExecutableGraph`-ját és lefutott
példány listáját adja át (`ExecuteSubWorkflowInput.graph`, `.executedInstances`), mert az
`inputMapping` hivatkozásai a **szülő** kontextusba mutatnak. A `sub_workflow` lépés
`ConcurrencyGate`-et nem kap és helyet nem kér (7.2): ezt a hívónak sem szabad megkerülnie, mert
egy egy helyes szabályozó mellett a gyerek lépései különben soha nem jutnának helyhez
(holtpont, `execute-sub-workflow.spec.ts` "holtpont mentesség" tesztje).

**Az `error-policy` téma határa és négy tervezési döntése (T-005-24).** A SPEC-004 8. szekciója a
hibakezelés **viselkedését** írja le, a motor belső felületét nem:

- **A téma dönt, nem hajt végre.** A `resolveErrorRoute` `fail_run` ága nem szakít meg egyetlen
  futó lépést sem, csak kimondja, hogy meg kell szakítani; a testvér ágak tényleges megállítása a
  `run-supervisor` (T-005-25) és a `run-interrupt` (T-005-26) dolga. Ugyanígy a
  `resolveRunCompletion` nem hívja a `markRunFailed`-et, csak a négy mezőt adja vissza, amit az
  `markRunFailed` és a `RunFinishedPayload` vár.
- **A 8.1 és a 8.3 egyetlen függvény, nem kettő.** A "van-e menekülő él" kérdés és a
  "`fail_run` vagy `fail_branch`" kérdés egyetlen döntési fa két ága; két külön függvény esetén a
  második bemenete az első kimenete lenne, tehát a hívónak kellene összefűznie őket, ami a
  sorrendet kód helyett konvencióra bízná.
- **Az `escapeKey` paraméter, nem két majdnem azonos függvény.** A 8.1 `on_error` élt keres bármely
  node-on, a 8.2 2. pontja `exhausted` élt az `error_handler` node-on; a két szabály alakja azonos
  (a menekülő él `live`, minden más `dead`, hiányában a politika), csak a keresett `branch_key`
  különbözik. Egy `FailureEscapeKey` paraméter ezt egy helyen tartja.
- **Az `onUnhandledError` paraméter NEM nullázható.** A tárolt alak `UnhandledErrorPolicy | null`
  (SPEC-003 4.3), de a `null` értéket a `validateUnhandledErrorPolicy` már elutasította a futás
  indításakor. Ha a függvény mégis fogadná, egy olyan ága keletkezne, ami a validáció után sosem
  fut - a 100 százalékos, kizárás nélküli lefedettségi küszöb mellett tilos (`.claude/CLAUDE.md` 5. szekció). A szűkítés így a hívóé.

**Miért van `missing_backoff` ág a `RetryDecision` unióban.** A `backoffMs[attempt - 1]` olvasás a
`noUncheckedIndexedAccess` fordítói kapcsoló mellett `number | undefined` típusú, és a `!`
non-null assertion tiltott. A hiányzó elem éles futásban nem fordulhat elő, mert a
`validateErrorHandlerBackoff` (`insufficient_backoff_list`) a futás indítását elutasítja; a tiszta
függvény viszont önmagában is hívható rossz configgal, tehát az ág **valóban elérhető és
tesztelhető**, nem "lehetetlen esetre írt hibakezelés". A végrehajtó ezt az ágat
`insufficient_backoff_list` osztályú `failed` lezárásra képezi le, tehát a hibaosztály neve
mindkét úton azonos.

**Az `error_handler` végrehajtó három döntése (T-005-24).**

- **A végrehajtó nem deríti ki, melyik lépés hibázott.** Azt a hívó tudja, mert ő futtatta a
  hibára futó példányt és ő vezette a vezérlést az `on_error` élen ide (8.1 1. pont). A három
  bemeneti mező közül a `retryStepRunInput` a hibát adó lépés **kész** `CreateStepRunInput`-ja,
  nem a `StepRunRecord`-ja: az utóbbi `nodeType`, `sessionMode` és `structuredOutputStrategy`
  mezője `string` típusú (a tárolt alak), a `CreateStepRunInput` viszont szűkített uniót vár,
  tehát a visszaalakítás három typeguardot és három olyan hibaágat igényelne, ami a repository
  felületén át sosem fordulhat elő.
- **A `NodeExecutionOutcome` két új ágat kapott.** A `retry_scheduled` a megismételt node
  `pending` sorát hordozza (`retryStepRun`), a `retry_exhausted` pedig azért külön ág a `failed`
  mellett, mert a menekülő él kulcsa itt `exhausted`, nem `on_error` - a hívónak más
  `escapeKey`-jel kell hívnia a `resolveErrorRoute`-ot. Az `unhandled_error_kind` és az
  `insufficient_backoff_list` viszont a meglévő `failed` ágon megy, mert azokra a szokásos 8.1
  útvonal érvényes.
- **A backoff várakozás `AbortSignal`-ja ma egy soha meg nem szakított vezérlő jele.** A
  `ClockPort.sleep` szerződése kötelezően kér jelet, a futás megszakítása viszont a
  `run-interrupt` téma dolga (9. szekció, T-005-26). Megnevezett hiány, nem elfogadott végállapot.

**A hibakezelés oldaláról a T-005-25-re bízott három pont, lezárva.**

1. **A `failed` kimenet után** a `resolveErrorRoute`-ot kell hívni a node configjának
   `onUnhandledError` mezőjével (a `null` szűkítése a hívóé, lásd fent) és `escapeKey: 'on_error'`
   értékkel; `retry_exhausted` kimenet után ugyanezt `escapeKey: 'exhausted'` értékkel. A
   `handled` ág `liveEdgeIds` halmaza közvetlenül a `SchedulingEvent` `node_completed`
   `liveEdgeIds` mezője; a `fail_branch` ághoz **üres** `liveEdgeIds` tartozik (minden kimenő él
   `dead`, 8.3); a `fail_run` ág a futás azonnali leállítása, tehát a szabályozóból ki kell venni
   a futás sorban álló lépéseit és meg kell szakítani a futó lépéseit (9. szekció menete), majd
   `markRunFailed`.
2. **Minden `fail_run`/`fail_branch` döntéshez egy `UnhandledErrorRecord` bejegyzés jár**, a
   bekövetkezés sorrendjében; a futás végén ezt a listát kell a `resolveRunCompletion` bemenetének
   adni, és az eredményt a `markRunSucceeded`/`markRunFailed` hívásra, valamint a `run_finished`
   esemény payloadjára képezni. **Új futás állapot nem jön létre**: `partially_succeeded` nincs
   (44. elfogadási kritérium).
3. **A megismételt lépés `step_run` sorát a T-005-25 óta a `run-supervisor` írja**, a szokásos
   `executeNode` úton; az `error_handler` végrehajtója csak a `nextAttempt` értéket adja vissza
   (`retry_scheduled.nextAttempt`). A T-005-24 óta nyitva állt szerkezeti kérdés ezzel lezárult;
   az indoklás a `run-supervisor` téma 2. tervezési döntésénél áll.

**A `run-supervisor` téma (T-005-25) és a kilenc tervezési döntése.** A téma köti össze az összes
korábbi témát egyetlen működő futás életciklussá, ezért itt a legtöbb a döntés, amit a SPEC-004
nem mond ki tételesen.

**1. A háttérfolyamat nyilvántartása: `ActiveRunRegistry` és `ActiveRunHandle`.** A `startRun` a
4.8 menet 7. lépése után **azonnal** visszatér, mert a hívó (a HTTP réteg) nem várhat percekig; a
léptetés innentől háttérben megy, és az előrehaladást az `eventPublisher` port közvetíti. A
háttérfolyamathoz egyetlen fogódzó van, az `ActiveRunHandle`:

| Mező                | Mit ad                                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| `runId`             | a futás azonosítója                                                             |
| `rootRunId`         | a futás fájának gyökere (SPEC-003 4.8), az al-workflow futásokkal közös         |
| `workflowId`        | a futó workflow                                                                 |
| `completion`        | `Promise<Outcome<RunCompletion>>`, a léptetés eredménye; **soha nem utasít el** |
| `requestStop()`     | a hurok nem indít több lépést, és a záró állapotot **nem** ő írja               |
| `isStopRequested()` | a jelzés olvasása                                                               |

**Amit a T-005-26 (megszakítás) ebből használ, lezárva.** A 9. szekció 2. pontja ("a szabályozó
ebből a futásból többé nem enged induló lépést, és a sorban álló lépései kiesnek") pontosan a
`requestStop()`; a 3. pontja ("minden élő agent lépéshez tartozó `AgentQuery` objektumon
`interrupt()` a futás fáján") a `listActiveRuns()` `rootRunId` szerinti szűrésével kapja meg a fa
tagjait, majd az `agent-query-registry.ts` (`run-interrupt` téma) `listForRunIds`-jével az azokhoz
tartozó élő `AgentQuery` objektumokat. A `requestStop()` **szándékosan nem** ír záró állapotot: az 5. pont szerint a `db` oldal egyetlen tranzakcióban zár (futás `cancelled`, minden nem terminális
lépés `cancelled`, `run_finished` esemény), tehát ha a hurok is írna, két, egymással versenyző
állapotváltás keletkezne ugyanarra a sorra. Az élő `AgentQuery` objektumok nyilvántartása
(korábban itt nyitott pont) a `run-interrupt` téma `AgentQueryRegistry`-je: a `runAgentStep`
(`agent-step` téma) regisztrálja `agentQueryRunner.run(...)` sikere után, azonnal, és `finally`
ágon iratkozik le minden kilépési úton, lásd a `run-interrupt/` sor és "Szabályok" lent.

**Amit a T-005-28 (`createEngine`, `shutdown`) ebből használ.** A 10.2 szabályos leállás ugyanaz a
két lépés minden aktív futáson (`listActiveRuns()` -> `requestStop()`), majd a `completion`
megvárása; a `decideApproval` motor művelet pedig ugyanazt az `approvalRegistry` példányt kapja,
amit a `RunSupervisorDependencies` már megkövetel.

**2. A retry duplikáció feloldása: a `step_run` sort a hívó írja.** A T-005-24 nyitva hagyott
kérdése (`packages/engine/CLAUDE.md` korábbi "Nyitott átvezetés" pontja) **lezárva**, a második
irányban: az `error_handler` végrehajtója **nem hoz létre** sort a megismételt lépéshez, csak a
`nextAttempt` sorszámot adja vissza (`NodeExecutionOutcome.retry_scheduled`). A `run-supervisor`
az `applyRetryScheduled` menetben a hibát adó **példányt** teszi vissza az érkezési sorba
(`enqueueReadyInstance`), és a `retryAttempts` térképbe írja a következő `attempt` értéket; a sor
így a szokásos `executeNode` úton, a közös `beginStepRun` menetben keletkezik. Két oka van ennek
az iránynak: (a) a másik irány (a végrehajtók közös nyitó menete kapna "már létező sorral indulj"
utat) mind a tíz `execute-*` fájlt és a `beginStepRun` szignatúráját érintette volna, (b) a
`CreateStepRunInput` node típustól függő mezőit (`nodeType`, `modelId`, `sessionMode`,
`structuredOutputStrategy`) a `run-supervisor` nem tudná kitalálni, a végrehajtó viszont igen. A
SPEC-004 8.2 4. pontja passzív alakban fogalmaz ("a hibát adó node új `step_run` sort **kap**"),
tehát egyik irányt sem zárja ki. Futtatott bizonyíték: a `create-run-supervisor.spec.ts`
"az újrapróbálkozás pontosan EGY új step_run sort hoz létre attempt + 1 értékkel" tesztje.

**3. A gyerek futás kimenete (`ChildWorkflowRunResult.output`).** A T-005-23 a fogalmat nyitva
hagyta; a `collectTerminalOutput` dönti el: **terminális node az, aminek a gráfban nincs kimenő
éle** (nem a `SchedulerState` dönti el, tehát a fogalom két különböző lefutás után is ugyanaz).
Egyetlen terminális node esetén a kimenet **maga az az érték**, amit a node utolsó lefutott
példánya adott - így a szülő kifejezései a szokásos `steps['al-workflow']` alakban érik el, felesleges
közbenső szint nélkül. Több terminális node esetén rekord, node azonosító -> kimenet, mert egyetlen
érték kiválasztása a több közül kitalált szabály lenne. Le nem futott terminális node nem kerül a
rekordba (egyetlen terminális node esetén `undefined`), és ugyanannak a node-nak több lefutásából
az **utolsó** marad - ugyanaz a "későbbi elem a frissebb lefutás" szabály, amit az
`ExecutedStepInstance` lista és a `findVisibleStepInstance` döntetlen szabálya is használ.

**4. A telepített SDK verzió a `RunSupervisorDependencies` mezője, nem import.** A
`validateSdkVersionMatch` (11.3 táblázat 17. sora) és a pillanatkép dokumentum `sdkVersionPin`
mezője (SPEC-003 5.1) is ezt kéri, a motor viszont nem függ az Agent SDK-tól (58. elfogadási
kritérium), tehát nem kérdezheti le. Az érték egyetlen ellenőrzött forrása a
`@easter-workflow-builder/agent` csomag `INSTALLED_AGENT_SDK_VERSION` konstansa, aminek az
egyezését a csomag `package.json` pinjével egy regressziós teszt őrzi; a motor ezt paraméterként
kapja, tehát a teszt mindkét ágat (egyező és eltérő verzió) közvetlenül elő tudja idézni.

**5. A 11.2 provider validáció bedrótozása megtörtént.** A T-005-19 óta nyitott átvezetés lezárva:
a `validateProviderCapabilities` a futás indításakor, a futás létrehozása ELŐTT végigfut minden
`agent_step` és `ai_synthesis` módú `join` node-on, a node-jára feloldott provider leírójával, és
két ellenőrzést futtat (`validateSdkVersionMatch`, majd a lépéshez kötött tíz sort egy menetben
adó `validateAgentStepCapabilities`). A számított döntéseket **szándékosan eldobja**: azok a lépés
végrehajtásakor, az `Options` összeállításával egy menetben születnek újra (`agent-node-lifecycle`),
és mivel tiszta függvényről van szó, a kétszeri futtatás ugyanazt adja. Egy leíró szintű hiba
(például ismeretlen `modelId`) innentől a **futás indítását** buktatja meg, nem az érintett lépést.

**6. Az ideiglenes pillanatkép dokumentum: a `buildSnapshotDocument` kétszer fut.** A 4.8 sorrend
kötött, de körkörös: a gráf validáció (3. lépés) a **dokumentumot** kapja bemenetként
(`validateRun`), a node-onkénti provider feloldás viszont ugyanannak a validációnak a
mellékterméke. A `validateRun` a dokumentum `effectiveProviderId` mezőjét nem olvassa (a saját
doksija mondja ki), ezért előbb egy ideiglenes dokumentum épül, amiben minden node a **futás
szintű** providert (workflow felülírás vagy globális alapértelmezés) kapja, majd a validáció után
a végleges dokumentum a valódi térképpel. Az ideiglenes dokumentum sosem kerül adatbázisba: a
`startRun` a másodikat kapja. Ebből következik, hogy a futás szintű feloldás **előre** fut, és
egy hiányzó globális alapértelmezés (`no_default_provider`) már itt megbuktatja az indítást.

**7. Tiszta összefűző függvények a nem elérhető ágak helyett.** Három helyen (`collectRunInputs`,
`prepareRun`, `buildChildResult`) a `run-supervisor` **nem** ágaztat közvetlenül a
részeredményekre, hanem egy tiszta függvénynek adja át őket. Az ok mindhárom helyen ugyanaz: a
hibaágak éles futásban egyetlen közös okból (nem létező workflow, korrupt sor, belső
ellentmondás) jönnének, tehát az elsőnél kilépve a többi **soha nem futna le**, és a 100
százalékos, kizárás nélküli lefedettségi küszöb mellett pontosan az a fajta ág, amit tilos
bevezetni. Így a hívási helyen egyetlen elágazás marad, aminek mindkét kimenete előfordul, a
belső ágak pedig az összefűző függvény saját tesztjében, kézzel összerakott bemenettel érhetők el.
Ugyanez az elv áll a `buildNodePlans` két hibaága mögött is.

**8. Az `EngineErrorKind` új tagja: `run_execution_failed`.** A léptetés közben kétféle, nem lépés
szintű hiba fordulhat elő: egy végrehajtó `Outcome` hibaága (adatbázis hiba, ami nem a lépés saját
hibaága), és a futás állapotának belső ellentmondása - ma egyetlen ilyen van, egy `error_handler`
példány, ami **nem** `on_error` élen vált futtathatóvá, tehát nincs hozzá hibakontextus (a 4.7
validáció csak az `on_error` élek CÉLJÁT köti `error_handler` node-hoz, a fordítottját nem).
Mindkét esetben a motor **nem talál ki** hibaosztályt és kísérletszámot: a futást `failed`
állapotba viszi ezzel a megnevezett osztállyal, és a hívó az EREDETI üzenetet kapja vissza. Az
`abortRun` a két írás eredményét szándékosan nem ágaztatja el: ha az adatbázis maga a hibaforrás,
a lezárás sem sikerülhet, a bennragadt `running` futást pedig az indulási helyreállítás
(T-005-27) viszi `interrupted` állapotba.

**9. Három meglévő típus szűkült vagy bővült ebben a lépésben.** Mindhárom a hívó holt ágainak
elkerülése miatt: a `FailureEscapeKey` felvette a `rejected` értéket (a `human_approval`
elutasításának útja szó szerint ugyanaz a döntési fa, csak a menekülő él kulcsa más, 5.8 utolsó
pontja); a `RunCompletion` **diszkriminált unió** lett, mert a lapos alakban a `markRunFailed`
hívás előtt egy `?? ''` jellegű, sosem futó szűkítés kellett volna; a `scheduling` téma pedig
kapott egy `enqueueReadyInstance` belépési pontot, mert a megismételt példány nem jelölésből válik
futtathatóvá (az `enqueueStartInstance` ma ezt hívja, a `start` node gyökér kontextusú példányát
előállítva).

**A `run_started` esemény két útja.** A **sort** a `db` írja, a futás beszúrásával azonos
tranzakcióban (SPEC-004 4.8 6. lépés, 13. szekció "a `startRun` tranzakciójában"), ezért a motor
ezt az egy eseményt **nem** a `writeEngineEvent` úton adja ki, csak az `eventPublisher` porton -
különben két `run_started` sor keletkezne ugyanarra a futásra. Hogy az élőben látott és az
adatbázisból visszaolvasott alak egyezzen (ez az újracsatlakozás alapfeltétele, 5.2 6. pont), a
`db` oldali payload ebben a lépésben a SPEC-004 13. szekció táblázatához igazodott: `workflowId`,
`providerId`, `graphSnapshotHash`, `persistedStreamDeltas` - a `runId` nem ismétlődik benne, azt a
`run_event.run_id` oszlop hordozza.

**A `fail_run` "azonnalisága" ebben a lépésben.** A 8.3 táblázat szerint `fail_run` mellett "a
motor megszakítja a többi futó lépést". A megszakítás (az SDK `interrupt()` hívása) a 9. szekció
menete, ami a `run-interrupt` téma dolga (T-005-26), ezért ez a lépés a saját hatáskörében annyit
tesz, hogy **új lépést nem indít**, és a már futókat megvárja. A futás záró állapota így is
`failed`, és a `create-run-supervisor.spec.ts` "fail_run" tesztje futtatva igazolja, hogy a
hibázó ág utáni node **nem kap `step_run` sort**, míg `fail_branch` mellett a testvér ág
végigfut. Ez megnevezett hiány, nem elfogadott végállapot.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

**`skipLibCheck: true` a `tsconfig.json`-ban.** A `db` csomag forrás szinten fogyasztott (a `db`
`exports` mezője a `./src/index.ts`-re mutat), tehát a `database` port `DatabaseContext` típusán
át a `db` teljes forrásfája, a `drizzle-orm` importjával együtt, bekerül az `engine` TypeScript
programjába is. A `drizzle-orm@0.45.2` egymás között típushibás dialektus deklarációi enélkül a
`typecheck` kapun buknának; ugyanaz a felsőáramú hiba, amit a `packages/db/tsconfig.json` már
dokumentál (11. szekció, gyökér `.claude/CLAUDE.md`).

**A `run-interrupt` téma (T-005-26) négy tervezési döntése.**

- **A `pending -> cancelled` átmenetnek nincs külön kódág.** A SPEC-004 9. szekció "Megszakítás
  indulás előtt" bekezdése szerint egy sosem futott `pending` futásnak nincs mit megszakítani SDK
  oldalon, de ezt a `cancelRunTree` `WHERE status IN ('pending', 'running')` feltétele önmagában
  lefedi: egy `pending` futásnak nincs aktív kézikönyve, tehát a `listActiveRuns()` szűrése üres
  listát ad rá, a `stopAndAwaitRunTree` azonnal visszatér, és a DB zárás önmagában viszi
  `cancelled`-be a sort. Egy külön "ha pending" ág itt sosem futna le ténylegesen eltérő módon, a
  100 százalékos, kizárás nélküli lefedettségi küszöb (`.claude/CLAUDE.md` 5. szekció) miatt nem is
  íródott meg.
- **A `Query.close()` metódust ez a téma sosem hívja** (O-2 nyitott kérdés, SPEC-004 9. szekció "A
  `Query.close()` metódust nem hívjuk" bekezdése). A folyam lezárását kizárólag a `runAgentStep`
  stream-kiürítő ciklusának természetes kimerülése végzi; a `stopAndAwaitRunTree` kizárólag
  `interrupt()`-et hív az `AgentQuery`-n.
- **A `packages/db` `run-recovery` témája bővült, nem új témával.** A `cancelRunTree(rootRunId)` a
  `recoverInterruptedRuns` tömeges `UPDATE ... WHERE status IN (...)` mintáját követi,
  `root_run_id` szerint szűkítve (a `workflow_run_root_idx` index), egyetlen tranzakcióban: a fa
  minden nem terminális futása és lépése `cancelled`, futásonként egy `run_finished` esemény. Séma
  változás nem történt, ez repository felület bővítés (`packages/db/CLAUDE.md` `run-recovery` sor).
- **Ismert, ebben a témában szándékosan lefedetlen két él.** (1) Egy `human_approval` lépésnek
  nincs `AgentQuery`-je, tehát erre a mechanizmusra nem szakítható meg - a döntésre várás
  `ApprovalWaitRegistry` témája (`node-executor`) más eszköz. (2) Egy `concurrency-gate`
  párhuzamossági helyre váró, még el sem indult lépés `interrupt()`-je nem old fel várakozó
  Promise-t, mert a gate sorból való eltávolítás ma nem jelez a várakozónak; ez korlátlan
  (`null`) párhuzamossági korláttal nem exponálódik, tehát a meglévő teszt eszköztárral nem
  reprodukálható. Mindkettő megnevezett hiány, nem elfogadott végállapot.

**A `startup-recovery` téma és a bővített `run-interrupt` (T-005-27) tervezési döntései.**

- **Nincs új `interruptRunTree(rootRunId)` a `db` rétegben, a meglévő `recoverInterruptedRuns`
  bővült egy `reason: RunInterruptedReason` (`'startup_recovery' | 'graceful_shutdown'`)
  paraméterrel.** A SPEC-004 10.2 szekció szó szerint kimondja: "A szabályos és a durva leállás
  ugyanoda érkezik... nem kell külön ágat karbantartani. Ez szándékos." A szabályos leállás
  (`shutdownActiveRuns`) és az indulási helyreállítás (`runStartupRecovery`) ugyanazon,
  GLOBÁLIS hatókörű `UPDATE ... WHERE status IN ('pending', 'running')` mintát futtatja, csak a
  `run_interrupted` esemény `payload.reason` mezője tér el. Egy külön `interruptRunTree` metódus
  szó szerint megismételte volna a `recoverInterruptedRuns` törzsét egyetlen literál különbséggel,
  ami a "Minimum kód" elvvel (`.claude/CLAUDE.md` 5. szekció) ütközne. **Ez eltérés a feladat
  példaként adott javaslatától** (`interruptRunTree(rootRunId)`), mert az a `rootRunId` szerinti
  SZŰKÍTETT hatókört sugallna, holott a szabályos leállás - a `cancelRunTree`-vel ellentétben -
  szándékosan NEM egy fára szűkül, hanem minden aktív futásra (lásd alább).
- **A `shutdownActiveRuns` a `run-supervisor.listActiveRuns()` TELJES listáját állítja meg, nem
  egy `rootRunId` szerint szűkített részhalmazt**, mert a szerver leállása minden futó munkát
  érint, nem egyet - ez a lényegi különbség a felhasználói `interruptRun`-hoz (egy fára szűkített)
  képest, és ez a különbség indokolja, hogy a `run-interrupt` témán belül két, egymástól eltérő
  hatókörű belépési pont él egymás mellett, nem egy közös függvény elágazással.
- **A `database.recovery.recoverInterruptedRuns('graceful_shutdown')` hívás a `db` réteg
  hatókörén (minden `pending`/`running` sor) fut, FÜGGETLENÜL attól, mely futásokat követte
  nyomon a `runSupervisor.listActiveRuns()`.** A `graceful-shutdown-startup-recovery-equivalence.spec.ts`
  külön teszttel bizonyítja, hogy egy a `runSupervisor`-ban NEM nyomon követett ("elárvult") sor
  is `interrupted`-be kerül - ugyanaz a viselkedés, mint `runStartupRecovery`-nél, ami sosem lát
  élő kézikönyvet.
- **A `startup-recovery` téma VÉKONY burkoló, nincs saját logikája.** A `runStartupRecovery`
  egyetlen sorban hívja a `database.recovery.recoverInterruptedRuns('startup_recovery')`-t; a
  téma két önálló hozzáadott értéke a `engine-never-opens-database.spec.ts` (gépi bizonyíték a
  "a motor egyetlen sora sem nyit adatbázist" AC-ra, forráskód-vizsgálattal, nem futásidejű
  teszttel) és az egyenértékűségi teszt.
- **A `restartRun` (`run-supervisor/restart-run.ts`) nem olvas gráfot közvetlenül, hanem
  ÚJRAHASZNÁLJA a `RunSupervisor.startRun`-t** az eredeti futás `workflowId`-jével és
  `input`-jával, kiegészítve a `restartedFromRunId` mezővel. A `startRun` (SPEC-004 4.8 menet 1.
  lépése) MINDIG a workflow JELENLEGI gráfját olvassa, tehát az "aktuális gráf pillanatképe" AC
  ingyen teljesül, nem kell duplikálni a gráf-olvasó és pillanatkép-építő logikát.
- **Az eredeti futás `not_found` hibaágát a `db` réteg saját, változatlan `Outcome`-ja adja, nincs
  hozzá új `EngineErrorKind`** - ugyanaz a minta, mint az `interruptRun` cél-futás beolvasásánál.
  Ezzel szemben **`malformed_restart_source_input` ÚJ hibaosztály lett**, mert a `db` réteg
  `WorkflowRunRecord.input: unknown` mezője sosem kényszeríti ki a rekord alakot, míg a motor
  `StartRunRequest.input: Readonly<Record<string, unknown>>` igen - ez valódi, tesztelhető típusrés
  a két réteg között (nem korrupt adatra írt, sosem futó ág), ezért kapott önálló hibaosztályt az
  `isRecord` typeguard hamis ágán.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md), 3.2, 3.3 és 12. szekció
- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md), 11.2 és 11.3 szekció
- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md), 5.2, 6.3 és 6.4 szekció
- [`../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../docs/research/2026-08-26-agent-sdk-minimax.md), 1. szekció (az `Options` mezői, a `Stop` hook és a `HookCallbackMatcher` alakja)
- [`../../docs/plan/PLAN-005-vegrehajto-motor.md`](../../docs/plan/PLAN-005-vegrehajto-motor.md), T-005-8
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
