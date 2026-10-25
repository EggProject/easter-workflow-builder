import type { ClockPort, DatabaseContext, EngineDependencies } from '@easter-workflow-builder/engine';
import {
  createCelExpressionEvaluator,
  createMustacheTemplateRenderer,
} from '@easter-workflow-builder/workflow-language';
import type { StreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildAgentQueryRunner } from './build-agent-query-runner.ts';
import { buildProviderDescriptorLookup } from './build-provider-descriptor-lookup.ts';
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
 * Az `expressionEvaluator` a CEL, a `templateRenderer` a Mustache port a
 * `workflow-language` csomagból (SPEC-010 3.1). A két csomagbeli alak és a
 * motor portja szerkezetileg egyezik: az értékadás itt, `as` nélkül fordul,
 * tehát egy eltérést a `typecheck` kapu jelez.
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
    expressionEvaluator: createCelExpressionEvaluator(),
    templateRenderer: createMustacheTemplateRenderer(),
    eventPublisher: createRealEventPublisher(registry, clock),
    clock,
    idGenerator: createRandomUuidIdGenerator(),
    processEnvironment: createProcessEnvironmentReader(),
  };
}
