import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { mapOutcomeMessageToErrorCode } from '../error-mapping/map-outcome-message-to-error-code.ts';
import { createSaveMcpServerDefinitionHandler } from './save-mcp-server-definition.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

const github = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  envNames: ['GITHUB_TOKEN'],
  envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
};

function contextOf(parameters: Readonly<Record<string, string>>, body: unknown) {
  return { parameters, query: new URLSearchParams(), body };
}

describe('createSaveMcpServerDefinitionHandler', () => {
  it('létrehozza, majd teljesen lecseréli a definíciót, és a mentett rekordot adja vissza', async () => {
    const database = openMemoryDatabase();
    const handler = createSaveMcpServerDefinitionHandler(database);

    const created = await handler(contextOf({ name: 'github_ceg' }, github));
    expect(created).toStrictEqual({
      kind: 'ok',
      value: { status: 200, body: { name: 'github_ceg', definition: github } },
    });

    const replacement = { type: 'sse', url: 'https://x.test/sse', authEnvName: 'SSE_AUTH' };
    await handler(contextOf({ name: 'github_ceg' }, replacement));
    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([
      { name: 'github_ceg', definition: replacement },
    ]);
  });

  it.each([
    ['szabálytalan név', { name: 'git hub' }],
    ['fenntartott név: __proto__', { name: '__proto__' }],
    ['fenntartott név: constructor', { name: 'constructor' }],
    ['fenntartott név: prototype', { name: 'prototype' }],
    ['hiányzó név paraméter', {}],
  ])('%s: invalid_request, semmi nem íródik', async (_label, parameters) => {
    const database = openMemoryDatabase();

    const result = await createSaveMcpServerDefinitionHandler(database)(contextOf(parameters, github));

    expect(mapOutcomeMessageToErrorCode(result.kind === 'error' ? result.message : '')).toBe('invalid_request');
    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([]);
  });

  it.each([
    ['érték rekordot hordozó env mező', { ...github, env: { GITHUB_TOKEN: 'titok' } }],
    ['nem deklarált névre szóló hozzárendelés', { ...github, envBindings: { OTHER: 'GITHUB_TOKEN_CEG' } }],
    ['szabálytalan env változó név', { ...github, envNames: ['GITHUB-TOKEN'], envBindings: {} }],
    ['üres stdio command', { ...github, command: '  ' }],
    // eslint-disable-next-line unicorn/no-null -- az authEnvName a dróton valódi `null` értéket hordoz
    ['üres http url', { type: 'http', url: '', authEnvName: null }],
  ])('%s: invalid_request a mező útvonalával', async (_label, body) => {
    const database = openMemoryDatabase();

    const result = await createSaveMcpServerDefinitionHandler(database)(contextOf({ name: 'github' }, body));

    expect(mapOutcomeMessageToErrorCode(result.kind === 'error' ? result.message : '')).toBe('invalid_request');
    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([]);
  });

  it('a repository hibáját változatlanul továbbadja', async () => {
    const database = openMemoryDatabase();
    database.close();

    const result = await createSaveMcpServerDefinitionHandler(database)(contextOf({ name: 'github' }, github));

    expect(result.kind === 'error' ? result.message : '').toContain('(database_closed)');
  });
});
