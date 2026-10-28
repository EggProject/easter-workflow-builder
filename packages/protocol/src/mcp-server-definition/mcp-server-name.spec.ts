import { describe, expect, it } from 'vitest';
import { McpServerNameSchema } from './mcp-server-name.ts';

describe('McpServerNameSchema', () => {
  it.each(['github', 'github_ceg', 'GitHub-2', '-x', '_'])('elfogadja: %s', (name) => {
    expect(McpServerNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(['', 'git hub', 'github.ceg', 'gitHub/ceg', 'ékezet', 'a__b:c'])('elutasítja: %j', (name) => {
    expect(McpServerNameSchema.safeParse(name).success).toBe(false);
  });
});
