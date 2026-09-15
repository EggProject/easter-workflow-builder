import { describe, expect, it } from 'vitest';
import { AgentToolIdSchema } from './agent-tool-id.ts';

describe('AgentToolIdSchema', () => {
  it('mind a három eszköz azonosítót elfogadja', () => {
    expect(AgentToolIdSchema.safeParse('web_search').success).toBe(true);
    expect(AgentToolIdSchema.safeParse('web_fetch').success).toBe(true);
    expect(AgentToolIdSchema.safeParse('understand_image').success).toBe(true);
  });

  it('ismeretlen azonosítót elutasít', () => {
    expect(AgentToolIdSchema.safeParse('unknown_tool').success).toBe(false);
  });
});
