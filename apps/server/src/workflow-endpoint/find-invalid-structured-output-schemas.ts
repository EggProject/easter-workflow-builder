import type { StructuredOutputSchemaCompilerPort } from '@easter-workflow-builder/engine';
import type { ReplaceGraphRequest } from '@easter-workflow-builder/protocol';

/**
 * Egy elutasított séma mezőútja a kérés törzsében, a `zodErrorToProtocolErrorBody`
 * bemenetének alakjában.
 */
interface InvalidSchemaIssue {
  readonly path: readonly PropertyKey[];
}

/**
 * A strukturált kimenet sémájának mentéskori ellenőrzése (SPEC-015 5.7, O-2
 * user döntés): minden `agent_step` és `join` `ai_synthesis` csomópont sémája
 * ugyanazzal a fordítóval fordul le, mint a futás indításakor
 * (`createStructuredOutputSchemaCompiler`, a motor
 * `validateStructuredOutputSchemas` függvénye), tehát a két ellenőrzés nem
 * tud elsodródni. A nem fordítható séma mezőútja `nodes.<index>.config.structuredOutput.schema`,
 * illetve a `join` alobjektumán `nodes.<index>.config.settings.structuredOutput.schema`.
 */
export function findInvalidStructuredOutputSchemas(
  nodes: ReplaceGraphRequest['nodes'],
  compiler: StructuredOutputSchemaCompilerPort,
): readonly InvalidSchemaIssue[] {
  return nodes.flatMap((node, index): readonly InvalidSchemaIssue[] => {
    const { config } = node;
    if (config.type === 'agent_step') {
      return config.structuredOutput !== null && compiler.compile(config.structuredOutput.schema).kind === 'error'
        ? [{ path: ['nodes', index, 'config', 'structuredOutput', 'schema'] }]
        : [];
    }
    if (config.type === 'join' && config.mode === 'ai_synthesis') {
      return config.settings.structuredOutput !== null &&
        compiler.compile(config.settings.structuredOutput.schema).kind === 'error'
        ? [{ path: ['nodes', index, 'config', 'settings', 'structuredOutput', 'schema'] }]
        : [];
    }
    return [];
  });
}
