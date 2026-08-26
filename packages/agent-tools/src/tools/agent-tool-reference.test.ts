import { describe, expect, it } from 'vitest';
import { agentToolReference } from './agent-tool-reference.ts';

describe('agentToolReference', () => {
  it('a szervernévvel együtt adja az eszköz teljes nevét', () => {
    expect(agentToolReference('web_search')).toBe('mcp__agent-tools__web_search');
  });
});
