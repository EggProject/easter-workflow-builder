import type { DatabaseContext } from './database-port.ts';
import type { AgentQueryRunner } from './agent-query-runner-port.ts';
import type { ProviderDescriptorLookupPort } from './provider-descriptor-lookup-port.ts';
import type { ExpressionEvaluatorPort } from './expression-evaluator-port.ts';
import type { TemplateRendererPort } from './template-renderer-port.ts';
import type { EventPublisherPort } from './event-publisher-port.ts';
import type { ClockPort } from './clock-port.ts';
import type { IdGeneratorPort } from './id-generator-port.ts';
import type { ProcessEnvironmentPort } from './process-environment-port.ts';
import type { SkillLibraryPort } from './skill-library-port.ts';
import type { StructuredOutputSchemaCompilerPort } from './structured-output-schema-compiler-port.ts';
import type { ScriptRunnerPort } from './script-runner-port.ts';

/**
 * A motorba befecskendezett tizenkét port, a `createEngine(dependencies)`
 * paramétere (SPEC-004 3.1, 3.2). A tizenkettedik a `scriptRunner` (SPEC-014
 * 5.2, 5.8): a `script` node és a `join` `script` módjának JavaScript ága. Egyik mező sem opcionális és egyiknek
 * sincs alapértelmezett értéke: a motorban nincs olyan függőség, ami
 * "magától előkerül".
 */
export interface EngineDependencies {
  readonly database: DatabaseContext;
  readonly agentQueryRunner: AgentQueryRunner;
  readonly providerDescriptorLookup: ProviderDescriptorLookupPort;
  readonly expressionEvaluator: ExpressionEvaluatorPort;
  readonly templateRenderer: TemplateRendererPort;
  readonly eventPublisher: EventPublisherPort;
  readonly clock: ClockPort;
  readonly idGenerator: IdGeneratorPort;
  readonly processEnvironment: ProcessEnvironmentPort;
  readonly skillLibrary: SkillLibraryPort;
  readonly structuredOutputSchemaCompiler: StructuredOutputSchemaCompilerPort;
  readonly scriptRunner: ScriptRunnerPort;
}
