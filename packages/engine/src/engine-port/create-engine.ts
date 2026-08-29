import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { INSTALLED_AGENT_SDK_VERSION, isSdkResultMessage } from '@easter-workflow-builder/agent';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { resolveConcurrencySuggestion } from '../capability-policy/resolve-concurrency-suggestion.ts';
import { resolveConnectionTestMode } from '../capability-policy/resolve-connection-test-mode.ts';
import type { ConnectionTestMode } from '../capability-policy/connection-test-mode.ts';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
import type { ConcurrencyLimitLookup } from '../concurrency-gate/concurrency-limit-lookup.ts';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import { buildProviderEnvironmentBlock } from '../provider-environment/build-provider-environment-block.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import { interruptRun as interruptRunTree } from '../run-interrupt/interrupt-run.ts';
import { shutdownActiveRuns } from '../run-interrupt/shutdown-active-runs.ts';
import { createRunSupervisor } from '../run-supervisor/create-run-supervisor.ts';
import { restartRun as restartRunFromOriginal } from '../run-supervisor/restart-run.ts';
import type { StartRunRequest, StartedRun } from '../run-supervisor/run-supervisor.ts';
import type { ApprovalDecisionInput } from './approval-decision-input.ts';
import type { ConcurrencySuggestion } from './concurrency-suggestion.ts';
import type { ConnectionTestResult } from './connection-test-result.ts';
import type { Engine } from './engine.ts';
import type { EngineDependencies } from './engine-dependencies.ts';
import type { InterruptSummary } from './interrupt-summary.ts';
import type { ShutdownSummary } from './shutdown-summary.ts';

/**
 * A kapcsolat teszt promptja (SPEC-004 11.3 táblázat 16. sora,
 * `testProviderConnection`). **Szándékosan minimális, nem felhasználói
 * szöveg**: a teszt kizárólag azt ellenőrzi, hogy a befecskendezett
 * `agentQueryRunner` port a leíróhoz tartozó env blokkal el tud-e indítani és
 * be tud-e fejezni egy `query()` hívást - a prompt tartalma emiatt lényegtelen,
 * a rövidség pedig minimálisra szorítja a valós hívás token- és időköltségét.
 */
const CONNECTION_TEST_PROMPT = 'ping';

/**
 * A `provider_concurrency_limit` tábla lekérdezését a `ConcurrencyLimitLookup`
 * alakra illeszti (SPEC-004 7.3 szekció, `concurrency-gate` téma). A
 * `readLimit` `Outcome` hibaágán (pl. lezárt adatbázis kapcsolat) a
 * szabályozó "nincs korlát" állapotot lát: a `ConcurrencyLimitLookup`
 * szerződése (SPEC-004 3.2) nem hordoz hibaágat, és egy hibás lekérdezés a
 * hívó minden más adatbázis műveletét is buktatná, tehát ez nem csendes
 * adatvesztés, csak a hibajelzés helye máshol van.
 */
function buildConcurrencyLimitLookup(dependencies: EngineDependencies): ConcurrencyLimitLookup {
  return (providerId) => {
    const limit = dependencies.database.concurrencyLimits.readLimit(providerId);
    // eslint-disable-next-line unicorn/no-null -- lásd a fenti indoklást: hibaágon a szabályozó a "nincs korlát" jelentésű `null`-t kapja
    return limit.kind === 'ok' ? limit.value : null;
  };
}

/**
 * A kapcsolat teszt üzenetfolyamának kimerítése (SPEC-004 5.2 5 ... 9. pont
 * mintája, leegyszerűsítve): a `result` üzenet `subtype` értéke dönt, ugyanaz
 * a "HTTP siker önmagában nem elég" elv, mint az `agent_step` lezárásánál
 * (F-6). A függvény sosem dob: a folyam olvasása közbeni kivételt elkapja és
 * `succeeded: false` eredménnyé alakítja.
 */
async function drainConnectionTestStream(
  messages: AsyncIterable<unknown>,
  mode: ConnectionTestMode,
): Promise<ConnectionTestResult> {
  try {
    let resultSubtype: string | undefined;
    for await (const message of messages) {
      if (isSdkResultMessage(message)) {
        resultSubtype = message.subtype;
      }
    }
    if (resultSubtype === undefined) {
      return { succeeded: false, mode, errorMessage: 'Az üzenetfolyam result üzenet nélkül ért véget' };
    }
    if (resultSubtype !== 'success') {
      return { succeeded: false, mode, errorMessage: `A result üzenet subtype értéke ${resultSubtype}` };
    }
    // eslint-disable-next-line unicorn/no-null -- a `ConnectionTestResult.errorMessage` mezője `string | null`, sikeres kapcsolat tesztnél a NULL a valódi "nincs hiba" érték
    return { succeeded: true, mode, errorMessage: null };
  } catch (error) {
    return { succeeded: false, mode, errorMessage: describeError(error) };
  }
}

/**
 * A motor összeállítása (SPEC-004 3.1, 3.2 szekció, PLAN-005 T-005-28): a
 * kilenc befecskendezett portból felépíti a motoron belüli, minden hívás
 * között megosztott állapotokat (`ConcurrencyGate`, `ApprovalWaitRegistry`,
 * `AgentQueryRegistry`, a `RunSupervisor`), és visszaadja a hét metódusú
 * `Engine` felületet.
 *
 * **Minden belső állapot EGYETLEN példányban jön létre, itt.** Két
 * `createEngine` hívás két, egymástól teljesen független motort ad - ugyanaz
 * a minta, mint a `createConcurrencyGate`/`createApprovalWaitRegistry`/
 * `createRunSupervisor` saját lezárásban élő állapota.
 *
 * **A `startRun`/`decideApproval`/`suggestedConcurrencyLimit` mind SZINKRON
 * belső munkát végeznek.** A `db` csomag minden művelete szinkron
 * (`better-sqlite3`), és a `ConcurrencyGate`/`ApprovalWaitRegistry` felülete
 * is szinkron visszahívásos (lásd a saját doksijukat); a `Promise` burkolást
 * kizárólag a SPEC-004 3.1 `Engine` szignatúrája kéri, mert a hívó
 * (`apps/server`, L6) HTTP kérés kiszolgálása közben amúgy is `await`-tel hívja
 * őket.
 */
export function createEngine(dependencies: EngineDependencies): Engine {
  const concurrencyGate = createConcurrencyGate(buildConcurrencyLimitLookup(dependencies));
  const approvalRegistry = createApprovalWaitRegistry();
  const agentQueryRegistry = createAgentQueryRegistry();

  const runSupervisor = createRunSupervisor({
    ports: dependencies,
    concurrencyGate,
    approvalRegistry,
    agentQueryRegistry,
    installedAgentSdkVersion: INSTALLED_AGENT_SDK_VERSION,
  });

  function startRun(request: StartRunRequest): Promise<Outcome<StartedRun>> {
    return Promise.resolve(runSupervisor.startRun(request));
  }

  function interruptRun(runId: string): Promise<Outcome<InterruptSummary>> {
    return interruptRunTree(runId, {
      database: dependencies.database,
      runSupervisor,
      agentQueryRegistry,
      approvalRegistry,
    });
  }

  /**
   * A `decideApproval` motor művelet (SPEC-004 5.8 utolsó pontja, 3.1
   * `Engine` felület): a `db` `approvals.decideApproval(...)` MÁR elvégzi a
   * `step_run` `waiting_approval -> succeeded`/`rejected` átmenetét egy
   * tranzakcióban (`human-approval-repository.ts`); ez a művelet SIKER esetén
   * hívja a `approvalRegistry.notifyDecided(...)`-t, ami feloldja a
   * `execute-human-approval.ts` `waitForDecision` várakozását - a végrehajtó
   * ezután saját maga olvassa vissza a sort és zárja az esemény írást
   * (`step_finished`, `approval_decided`, lásd ott). Hibaág (`not_found`
   * vagy `already_decided`) esetén nem hívunk `notifyDecided`-et, mert nincs
   * mit közölni: a `human_approval` lépés változatlanul vár.
   */
  function decideApproval(input: ApprovalDecisionInput): Promise<Outcome<void>> {
    const decided = dependencies.database.approvals.decideApproval(input);
    if (decided.kind === 'error') {
      return Promise.resolve(decided);
    }
    approvalRegistry.notifyDecided(input.stepRunId, input.decision);
    return Promise.resolve({ kind: 'ok', value: undefined });
  }

  function restartRun(runId: string): Promise<Outcome<StartedRun>> {
    return restartRunFromOriginal(runId, { database: dependencies.database, runSupervisor });
  }

  /**
   * A párhuzamossági javaslat (SPEC-004 7.3 szekció, 11.3 táblázat 14. sora):
   * a leíróból olvas, a beállított korlátot NEM módosítja és nem is olvassa -
   * az a `provider_concurrency_limit` tábla, a `concurrency-gate` téma dolga.
   */
  function suggestedConcurrencyLimit(providerId: ProviderId): ConcurrencySuggestion {
    const descriptor = dependencies.providerDescriptorLookup(providerId);
    const suggestedLimit = resolveConcurrencySuggestion(descriptor.concurrency.measuredMaxConcurrentSteps);
    const note =
      suggestedLimit === undefined
        ? 'Erre a providerre nincs mért párhuzamossági javaslat.'
        : 'A javasolt érték mérési ALSÓ KORLÁT, nem a provider tényleges határa; a mért tartományon túlra a motor nem extrapolál (SPEC-004 7.3).';
    return { suggestedLimit, note };
  }

  /**
   * A kapcsolat teszt (SPEC-004 11.3 táblázat 16. sora): a
   * `resolveConnectionTestMode` döntése (`sdk_model_list` vagy
   * `minimal_query`) itt kizárólag DIAGNOSZTIKAI adat, a `ConnectionTestResult
   * .mode` mezőben - a tényleges hívás MINDKÉT ágon ugyanaz a minimális
   * `query()` hívás, mert a motorba befecskendezett `AgentQueryRunner` port
   * nem exponál modell-listázást (nincs `supportedModels()` metódus a porton,
   * `@easter-workflow-builder/agent` `AgentQuery` típusa, SPEC-004 3.3). Ez
   * tudatos egyszerűsítés, nem elfogadott végállapot - lásd
   * `packages/engine/CLAUDE.md` "Szabályok" szakaszát.
   */
  async function testProviderConnection(providerId: ProviderId): Promise<Outcome<ConnectionTestResult>> {
    const descriptor = dependencies.providerDescriptorLookup(providerId);
    const mode = resolveConnectionTestMode(descriptor.modelsEndpoint);

    const environmentBlock = buildProviderEnvironmentBlock(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      dependencies.processEnvironment,
    );
    if (environmentBlock.kind === 'error') {
      return { kind: 'ok', value: { succeeded: false, mode, errorMessage: environmentBlock.message } };
    }

    const query = dependencies.agentQueryRunner.run({
      prompt: CONNECTION_TEST_PROMPT,
      options: { env: environmentBlock.value },
    });
    if (query.kind === 'error') {
      return { kind: 'ok', value: { succeeded: false, mode, errorMessage: query.message } };
    }

    return { kind: 'ok', value: await drainConnectionTestStream(query.value.messages, mode) };
  }

  /**
   * A szabályos leállás (SPEC-004 10.2 szekció): a `shutdownActiveRuns`
   * (T-005-27) minden aktív futáson lefuttatja a megszakítás menetét, majd a
   * `db` réteg GLOBÁLIS hatókörű helyreállítását zárja - lásd
   * `run-interrupt/shutdown-active-runs.ts` doksiját.
   */
  async function shutdown(): Promise<Outcome<ShutdownSummary>> {
    const recovered = await shutdownActiveRuns({
      database: dependencies.database,
      runSupervisor,
      agentQueryRegistry,
      approvalRegistry,
    });
    if (recovered.kind === 'error') {
      return recovered;
    }
    return { kind: 'ok', value: { interruptedRunCount: recovered.value.recoveredRunCount } };
  }

  return {
    startRun,
    interruptRun,
    decideApproval,
    restartRun,
    suggestedConcurrencyLimit,
    testProviderConnection,
    shutdown,
  };
}
