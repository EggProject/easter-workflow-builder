import type { AgentQuery, SdkResultMessage } from '@easter-workflow-builder/agent';
import { hasStructuredOutput, isSdkResultMessage, isSdkSystemInitMessage } from '@easter-workflow-builder/agent';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { describeError } from '@easter-workflow-builder/core';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import { buildProviderEnvironmentBlock } from '../provider-environment/build-provider-environment-block.ts';
import type { AgentStepExecution } from './agent-step-execution.ts';
import type { AgentStepOutcome } from './agent-step-outcome.ts';
import type { AgentStepRequest } from './agent-step-request.ts';
import type { AgentStreamMessage } from './agent-stream-message.ts';
import { buildAgentStepOptions } from './build-agent-step-options.ts';
import { readResultTelemetry } from './read-result-telemetry.ts';
import { resolveSessionBinding } from './resolve-session-binding.ts';
import type { SessionBinding } from './session-binding.ts';

// A `step_run` session oszlopainak értéke a `system` `init` üzenet
// feldolgozásakor (SPEC-004 6.3 táblázat): `isolated` módban a
// `resumed_from_session_id` NULL és a `forked_session` hamis, `continued`
// módban a folytatott session azonosítója és a `resolveForkSession` döntése.
interface SessionAttachment {
  readonly resumedFrom: string | null;
  readonly forked: boolean;
}

function toSessionAttachment(binding: SessionBinding): SessionAttachment {
  return binding.mode === 'isolated'
    ? // eslint-disable-next-line unicorn/no-null -- az `AttachSessionInput.resumedFrom` mezője `string | null`, és a NULL itt valós tárolt érték (SPEC-004 6.3 táblázat), nem helyőrző
      { resumedFrom: null, forked: false }
    : { resumedFrom: binding.resume, forked: binding.forkSession };
}

// Egy lépés eredmény összeállítása: az üzleti kimenetel mellé a `result`
// üzenetből kiolvasott számadatok kerülnek, hibás ágon is (SPEC-003 4.10).
function buildExecution(outcome: AgentStepOutcome, resultMessage: SdkResultMessage | undefined): AgentStepExecution {
  const telemetry = readResultTelemetry(resultMessage);
  return {
    outcome,
    resultSubtype: resultMessage?.subtype,
    numTurns: telemetry.numTurns,
    tokens: telemetry.tokens,
  };
}

// A futtatás megkezdése előtt keletkezett hiba: nincs `result` üzenet, tehát
// számadat sincs.
function preStreamFailure(errorKind: EngineErrorKind, errorMessage: string): Outcome<AgentStepExecution> {
  return { kind: 'ok', value: buildExecution({ status: 'failed', errorKind, errorMessage }, undefined) };
}

/**
 * A lépés zárásának feltétele (SPEC-004 5.2 9. pont): `succeeded` akkor és
 * csak akkor, ha a `result` üzenet `subtype` értéke `success`, **és** ha a
 * lépés strukturált kimenetet vár, a kimenet ténylegesen megérkezett. Ez az
 * F-6 közvetlen következménye: a HTTP siker önmagában nem jelent kitöltött
 * kimenetet, és nincs 400-as biztonsági háló.
 *
 * A `result` üzenet hiánya külön ág: a folyam kimerült anélkül, hogy a
 * futtatás eredményt adott volna, tehát a provider hívás nem ért célba
 * (`provider_call_failed`).
 */
function classifyResult(config: AgentStepConfig, resultMessage: SdkResultMessage | undefined): AgentStepOutcome {
  if (resultMessage === undefined) {
    return {
      status: 'failed',
      errorKind: 'provider_call_failed',
      errorMessage: formatEngineErrorMessage(
        'provider_call_failed',
        'Az agent üzenetfolyam result üzenet nélkül ért véget',
      ),
    };
  }

  if (resultMessage.subtype !== 'success') {
    return {
      status: 'failed',
      errorKind: 'agent_result_not_success',
      errorMessage: formatEngineErrorMessage(
        'agent_result_not_success',
        `Az agent futtatás result üzenetének subtype értéke ${resultMessage.subtype}`,
      ),
    };
  }

  if (config.structuredOutput !== null && !hasStructuredOutput(resultMessage)) {
    return {
      status: 'failed',
      errorKind: 'missing_structured_output',
      errorMessage: formatEngineErrorMessage(
        'missing_structured_output',
        'A lépés strukturált kimenetet vár, de a result üzenet nem hozott kimenetet',
      ),
    };
  }

  return { status: 'succeeded', output: resultMessage.structured_output };
}

/**
 * Egyetlen beérkezett SDK üzenet feldolgozása (SPEC-004 5.2 6. és 7. pont).
 *
 * **A sorrend kötött**: előbb `appendSdkEvent` a `db` felé, csak utána
 * `eventPublisher.publish` az élő nézetnek. Az ok a spec szerint az, hogy
 * újracsatlakozáskor a kliens az adatbázisból pótol, tehát nem kaphat olyan
 * eseményt élőben, ami még nincs a naplóban.
 *
 * A hozzáfűzés `skipped` eredménye (a befagyasztott delta kapcsoló szűrte ki,
 * SPEC-003 6.6) **nem** akadályozza a kiadást: a kapcsoló az élő nézetre
 * nincs hatással (F-23), ezért a kiadás minden üzenetnél lefut.
 *
 * A `system` `init` üzenetből a session azonosító a `step_run` sorra íródik
 * (`attachSession`, SPEC-003 9.2).
 */
function handleStreamMessage(
  message: unknown,
  request: AgentStepRequest,
  dependencies: EngineDependencies,
  attachment: SessionAttachment,
): Outcome<void> {
  const appended = dependencies.database.events.appendSdkEvent({
    runId: request.runId,
    stepRunId: request.stepRunId,
    message,
  });
  if (appended.kind === 'error') {
    return appended;
  }

  const published: AgentStreamMessage = { runId: request.runId, stepRunId: request.stepRunId, message };
  dependencies.eventPublisher.publish(published);

  if (!isSdkSystemInitMessage(message)) {
    return { kind: 'ok', value: undefined };
  }

  const attached = dependencies.database.stepRuns.attachSession(request.stepRunId, {
    sessionId: message.session_id,
    resumedFrom: attachment.resumedFrom,
    forked: attachment.forked,
  });
  if (attached.kind === 'error') {
    return attached;
  }

  return { kind: 'ok', value: undefined };
}

/**
 * Az üzenetfolyam kimerítése (SPEC-004 5.2 5 ... 9. pont). A generátor
 * kimerítése egyben a folyam lezárási útja is: a motor nem hív `close()`
 * metódust az `AgentQuery` objektumon (O-2 nyitott kérdés, 52. elfogadási
 * kritérium).
 */
async function consumeStream(
  request: AgentStepRequest,
  dependencies: EngineDependencies,
  query: AgentQuery,
  attachment: SessionAttachment,
): Promise<Outcome<AgentStepExecution>> {
  let resultMessage: SdkResultMessage | undefined;

  try {
    for await (const message of query.messages) {
      const handled = handleStreamMessage(message, request, dependencies, attachment);
      if (handled.kind === 'error') {
        return handled;
      }
      if (isSdkResultMessage(message)) {
        resultMessage = message;
      }
    }
  } catch (error) {
    return {
      kind: 'ok',
      value: buildExecution(
        {
          status: 'failed',
          errorKind: 'provider_call_failed',
          errorMessage: formatEngineErrorMessage(
            'provider_call_failed',
            `Az agent üzenetfolyam olvasása megszakadt: ${describeError(error)}`,
          ),
        },
        resultMessage,
      ),
    };
  }

  return { kind: 'ok', value: buildExecution(classifyResult(request.config, resultMessage), resultMessage) };
}

/**
 * Egy agent lépés teljes futtatása (SPEC-004 5.2 2 ... 9. pont): a prompt
 * renderelése, a session kötés feloldása, az `Options` összeállítása, a
 * futtatás elindítása és az üzenetfolyam feldolgozása.
 *
 * **Amit nem csinál, és miért.**
 *
 * - **Nem kér és nem szabadít fel párhuzamossági helyet** (5.2 1. és 10. pont).
 *   A hely fogalma nem `agent_step` specifikus: ugyanaz a szabály vonatkozik az
 *   `ai_synthesis` módú `join` node-ra is, és a `human_approval`, valamint a
 *   `sub_workflow` lépésre az a szabály, hogy **nem** foglal helyet (7.2) -
 *   tehát a döntés a végrehajtó rétegé, ami minden node típust ismer. Ez a
 *   függvény azt feltételezi, hogy a hely már megvan, és a felszabadítás a
 *   hívó `finally` ágán történik (T-005-21, `node-executor`).
 * - **Nem hoz létre `step_run` sort és nem vált állapotot.** A `createStepRun`,
 *   a `markStepRunning`, a `step_started` és a `step_finished` esemény, majd a
 *   záró `markStepSucceeded`/`markStepFailed` a végrehajtó réteg közös kerete
 *   (5. szekció közös szabályai). Ez a függvény az `AgentStepExecution`
 *   értékkel adja meg, mi kerüljön abba a záró tranzakcióba.
 * - **Nem számolja ki a leírótól függő döntéseket**: azokat a hívó a
 *   `validateAgentStepCapabilities` függvénnyel állítja elő, mert a
 *   `step_started` esemény jelölői már a futtatás előtt kellenek
 *   (`AgentStepRequest.decisions`).
 *
 * **A visszatérési érték két szintje.** Az `Outcome` **hibaága kizárólag
 * adatbázis hibát** jelent (esemény hozzáfűzés vagy session csatolás): olyat,
 * amiről nem a lépés tehet, és amitől a záró tranzakció sem futtatható le. A
 * lépés saját hibái (renderelés, env, session, provider hívás, `subtype`,
 * hiányzó strukturált kimenet) a **sikeres** ágon, az `AgentStepExecution`
 * `outcome` mezőjében érkeznek, a hibaosztály nevével együtt, mert azok mellé
 * a token adatok is kimehetnek.
 */
export async function runAgentStep(
  request: AgentStepRequest,
  dependencies: EngineDependencies,
): Promise<Outcome<AgentStepExecution>> {
  const prompt = dependencies.templateRenderer.render(request.config.promptTemplate, request.runContext);
  if (prompt.kind === 'error') {
    return preStreamFailure(
      'template_render_failed',
      formatEngineErrorMessage('template_render_failed', `A lépés prompt sablonja nem renderelhető: ${prompt.message}`),
    );
  }

  const environmentBlock = buildProviderEnvironmentBlock(
    request.descriptor.requiredEnv,
    request.descriptor.disallowedEnv,
    dependencies.processEnvironment,
  );
  if (environmentBlock.kind === 'error') {
    return preStreamFailure('missing_provider_env', environmentBlock.message);
  }

  const sessionBinding = resolveSessionBinding({
    graph: request.graph,
    sessionSourceNodes: request.sessionSourceNodes,
    instance: request.instance,
    sessionMode: request.config.sessionMode,
    sessionInstances: request.sessionInstances,
  });
  if (sessionBinding.kind === 'error') {
    return preStreamFailure('no_resumable_session', sessionBinding.message);
  }

  const query = dependencies.agentQueryRunner.run({
    prompt: prompt.value,
    options: buildAgentStepOptions({
      config: request.config,
      decisions: request.decisions,
      environmentBlock: environmentBlock.value,
      sessionBinding: sessionBinding.value,
    }),
  });
  if (query.kind === 'error') {
    return preStreamFailure(
      'provider_call_failed',
      formatEngineErrorMessage('provider_call_failed', `Az agent futtatás nem indult el: ${query.message}`),
    );
  }

  return consumeStream(request, dependencies, query.value, toSessionAttachment(sessionBinding.value));
}
