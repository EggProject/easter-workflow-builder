import { describe, expect, it } from 'vitest';
import { findUnsupportedAgentDefinitionFields } from './find-unsupported-agent-definition-fields.ts';

describe('findUnsupportedAgentDefinitionFields', () => {
  it('a memory mező és a nem szöveg elemű mcpServers lista útvonalát adja (O-53)', () => {
    expect(
      findUnsupportedAgentDefinitionFields({
        agents: {
          a: { description: 'd', prompt: 'p', memory: 'user' },
          b: { description: 'd', prompt: 'p', mcpServers: ['lepes', { sajat: { command: 'x' } }] },
          c: { description: 'd', prompt: 'p', mcpServers: ['lepes'] },
          d: 'nem rekord',
        },
      }),
    ).toStrictEqual([
      ['agents', 'a', 'memory'],
      ['agents', 'b', 'mcpServers'],
    ]);
  });

  it('a nem rekord lépés és agents, valamint a nem tömb mcpServers nem ad útvonalat', () => {
    expect(findUnsupportedAgentDefinitionFields(undefined)).toStrictEqual([]);
    expect(findUnsupportedAgentDefinitionFields({ agents: 'hibas' })).toStrictEqual([]);
    expect(findUnsupportedAgentDefinitionFields({ agents: { a: { mcpServers: 'nem tomb' } } })).toStrictEqual([]);
  });
});
