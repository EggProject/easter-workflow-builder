import type { DatabaseContext, EngineDependencies } from '@easter-workflow-builder/engine';
import { buildAgentQueryRunner } from './build-agent-query-runner.ts';
import { buildProviderDescriptorLookup } from './build-provider-descriptor-lookup.ts';
import { createRejectingExpressionEvaluator } from './create-rejecting-expression-evaluator.ts';
import { createRejectingTemplateRenderer } from './create-rejecting-template-renderer.ts';
import { createNoopEventPublisher } from './create-noop-event-publisher.ts';
import { createSystemClock } from './create-system-clock.ts';
import { createRandomUuidIdGenerator } from './create-random-uuid-id-generator.ts';
import { createProcessEnvironmentReader } from './create-process-environment-reader.ts';

/**
 * A motor kilenc kötelező portjának összeállítása a szerver indulásakor
 * (SPEC-004 3.1, 3.2, `EngineDependencies`). A `database` az egyetlen port,
 * amit a hívó ad át (a nyitott `DatabaseContext`), a többi nyolcat ez a
 * függvény építi fel a valódi implementációkból. Az `expressionEvaluator`
 * és a `templateRenderer` ideiglenesen elutasító burkoló (lásd a saját
 * fájljuk doksiját), az `eventPublisher` ideiglenesen semmit sem tevő -
 * mindkettő dokumentált, nyitott hiány (lásd a záró jelentés hiánylistáját).
 */
export function buildEngineDependencies(database: DatabaseContext): EngineDependencies {
  return {
    database,
    agentQueryRunner: buildAgentQueryRunner(),
    providerDescriptorLookup: buildProviderDescriptorLookup(),
    expressionEvaluator: createRejectingExpressionEvaluator(),
    templateRenderer: createRejectingTemplateRenderer(),
    eventPublisher: createNoopEventPublisher(),
    clock: createSystemClock(),
    idGenerator: createRandomUuidIdGenerator(),
    processEnvironment: createProcessEnvironmentReader(),
  };
}
