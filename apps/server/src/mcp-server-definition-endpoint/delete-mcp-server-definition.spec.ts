/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { mapOutcomeMessageToErrorCode } from '../error-mapping/map-outcome-message-to-error-code.ts';
import { createDeleteMcpServerDefinitionHandler } from './delete-mcp-server-definition.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function contextOf(parameters: Readonly<Record<string, string>>) {
  return { parameters, query: new URLSearchParams(), body: undefined };
}

const remote = { type: 'http', url: 'https://x.test/mcp', authEnvName: null } as const;

describe('createDeleteMcpServerDefinitionHandler', () => {
  it('törli a definíciót, 204 üres törzzsel', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'remote', definition: remote }));

    const result = await createDeleteMcpServerDefinitionHandler(database)(contextOf({ name: 'remote' }));

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 204, body: undefined } });
    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([]);
  });

  /**
   * O-43 (a), AC17 szerver oldala: a hivatkozó lépés nem akadályozza a
   * törlést, valós `:memory:` adatbázison, a gráf a hivatkozással együtt
   * változatlan marad.
   */
  it('egy lépés hivatkozása mellett is töröl (O-43)', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'remote', definition: remote }));
    const workflow = okOrThrow(database.workflows.createWorkflow({ name: 'W', description: null, providerId: null }));
    const config = {
      type: 'agent_step',
      onUnhandledError: 'fail_run',
      promptTemplate: 'x',
      providerId: null,
      modelId: null,
      effort: null,
      thinking: null,
      allowedTools: [],
      disallowedTools: [],
      permissionMode: null,
      maxTurns: null,
      maxBudgetUsd: null,
      systemPrompt: null,
      agents: {},
      skills: null,
      mcpServers: {},
      mcpServerReferences: { remote: { envBindings: {}, authEnvName: 'REMOTE_AUTH' } },
      cwd: null,
      additionalDirectories: [],
      sandbox: null,
      sessionMode: 'isolated',
      structuredOutput: null,
    } as const;
    okOrThrow(
      database.workflows.replaceGraph(workflow.id, [{ id: 'a1', label: 'A', positionX: 0, positionY: 0, config }], []),
    );

    const result = await createDeleteMcpServerDefinitionHandler(database)(contextOf({ name: 'remote' }));

    expect(result.kind).toBe('ok');
    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([]);
    expect(okOrThrow(database.workflows.readGraph(workflow.id)).nodes.map((node) => node.config)).toStrictEqual([
      config,
    ]);
  });

  it.each([
    ['nem létező név', { name: 'nincs' }],
    ['hiányzó név paraméter', {}],
  ])('%s: not_found', async (_label, parameters) => {
    const result = await createDeleteMcpServerDefinitionHandler(openMemoryDatabase())(contextOf(parameters));
    expect(mapOutcomeMessageToErrorCode(result.kind === 'error' ? result.message : '')).toBe('not_found');
  });
});
