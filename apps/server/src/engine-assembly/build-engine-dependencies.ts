import type { ClockPort, DatabaseContext, EngineDependencies } from '@easter-workflow-builder/engine';
import type { StreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildAgentQueryRunner } from './build-agent-query-runner.ts';
import { buildProviderDescriptorLookup } from './build-provider-descriptor-lookup.ts';
import { createRejectingExpressionEvaluator } from './create-rejecting-expression-evaluator.ts';
import { createRejectingTemplateRenderer } from './create-rejecting-template-renderer.ts';
import { createRealEventPublisher } from './create-real-event-publisher.ts';
import { createRandomUuidIdGenerator } from './create-random-uuid-id-generator.ts';
import { createProcessEnvironmentReader } from './create-process-environment-reader.ts';

/**
 * A motor kilenc kötelező portjának összeállítása a szerver indulásakor
 * (SPEC-004 3.1, 3.2, `EngineDependencies`). A `database` és a `clock` a
 * hívó (`continue-startup-with-database.ts`) által átadott, MÁR LÉTEZŐ
 * példány - a `clock`-ot azért kapja kívülről, nem itt építi fel, mert
 * ugyanazt az órát használja a `stream-connection` réteg életben tartó
 * időzítése is (egyetlen időforrás). A `registry` a `stream-registry`
 * példánya: az `eventPublisher` port ezen keresztül szól a nyitott `/events`
 * kapcsolatoknak (SPEC-006 6.5 "jelzés és lecsapolás" minta).
 *
 * Az `expressionEvaluator` és a `templateRenderer` a SPEC-004 O-1 szerinti,
 * kimondottan elutasító burkoló (lásd a saját fájljuk doksiját).
 */
export function buildEngineDependencies(
  database: DatabaseContext,
  registry: StreamRegistry,
  clock: ClockPort,
): EngineDependencies {
  return {
    database,
    agentQueryRunner: buildAgentQueryRunner(),
    providerDescriptorLookup: buildProviderDescriptorLookup(),
    expressionEvaluator: createRejectingExpressionEvaluator(),
    templateRenderer: createRejectingTemplateRenderer(),
    eventPublisher: createRealEventPublisher(registry, clock),
    clock,
    idGenerator: createRandomUuidIdGenerator(),
    processEnvironment: createProcessEnvironmentReader(),
  };
}
