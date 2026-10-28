import type { ClockPort, DatabaseContext, EngineDependencies } from '@easter-workflow-builder/engine';
import type { ServerLogger } from '@easter-workflow-builder/logger';
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
import { createSkillLibraryReader } from './create-skill-library-reader.ts';
import { reportUnexpectedLanguageError } from './report-unexpected-language-error.ts';

/**
 * A motor tíz kötelező portjának összeállítása a szerver indulásakor
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
 * tehát egy eltérést a `typecheck` kapu jelez. Mindkét port a
 * `reportUnexpectedLanguageError` burkolón át jut a motorhoz: a csomag tartalék
 * ágának kivétel típusát a `logger` naplózza (SPEC-010 O-22).
 *
 * A `skillLibrary` port a skill könyvtár abszolút gyökerét kapja (SPEC-009
 * 5.1), ugyanazt, amit a skill végpontok kezelnek.
 */
export function buildEngineDependencies(
  database: DatabaseContext,
  registry: StreamRegistry,
  clock: ClockPort,
  logger: ServerLogger,
  skillLibraryRootDirectory: string,
): EngineDependencies {
  const celEvaluator = createCelExpressionEvaluator();
  const mustacheRenderer = createMustacheTemplateRenderer();
  return {
    database,
    agentQueryRunner: buildAgentQueryRunner(),
    providerDescriptorLookup: buildProviderDescriptorLookup(),
    expressionEvaluator: {
      compile: (expression) =>
        reportUnexpectedLanguageError(celEvaluator.compile(expression), 'expression_compile', logger),
      evaluate: (expression, context) =>
        reportUnexpectedLanguageError(celEvaluator.evaluate(expression, context), 'expression_evaluate', logger),
    },
    templateRenderer: {
      compile: (template) =>
        reportUnexpectedLanguageError(mustacheRenderer.compile(template), 'template_compile', logger),
      render: (template, context) =>
        reportUnexpectedLanguageError(mustacheRenderer.render(template, context), 'template_render', logger),
    },
    eventPublisher: createRealEventPublisher(registry, clock),
    clock,
    idGenerator: createRandomUuidIdGenerator(),
    processEnvironment: createProcessEnvironmentReader(),
    skillLibrary: createSkillLibraryReader(skillLibraryRootDirectory),
  };
}
