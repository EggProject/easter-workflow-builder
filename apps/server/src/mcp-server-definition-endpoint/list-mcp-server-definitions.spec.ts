/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createListMcpServerDefinitionsHandler } from './list-mcp-server-definitions.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

const context = { parameters: {}, query: new URLSearchParams(), body: undefined };

describe('createListMcpServerDefinitionsHandler', () => {
  it('üres listán üres tömböt ad', async () => {
    const result = await createListMcpServerDefinitionsHandler(openMemoryDatabase())(context);
    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: [] } });
  });

  it('a mentett definíciókat név szerint rendezve adja', async () => {
    const database = openMemoryDatabase();
    const remote = { type: 'http', url: 'https://x.test/mcp', authEnvName: null } as const;
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'remote', definition: remote }));
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'github', definition: remote }));

    const result = await createListMcpServerDefinitionsHandler(database)(context);

    expect(result).toStrictEqual({
      kind: 'ok',
      value: {
        status: 200,
        body: [
          { name: 'github', definition: remote },
          { name: 'remote', definition: remote },
        ],
      },
    });
  });

  it('a repository hibáját változatlanul továbbadja', async () => {
    const database = openMemoryDatabase();
    database.close();

    const result = await createListMcpServerDefinitionsHandler(database)(context);

    expect(result.kind === 'error' ? result.message : '').toContain('(database_closed)');
  });
});
