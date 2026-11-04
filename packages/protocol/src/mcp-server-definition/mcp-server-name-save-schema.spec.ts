import { describe, expect, it } from 'vitest';
import { McpServerNameSaveSchema } from './mcp-server-name-save-schema.ts';

describe('McpServerNameSaveSchema', () => {
  it.each(['github', 'GitHub-2', '_', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__'])(
    'elfogadja: %s',
    (name) => {
      expect(McpServerNameSaveSchema.safeParse(name).success).toBe(true);
    },
  );

  it.each(['__proto__', 'constructor', 'prototype'])('elutasítja a fenntartott nevet: %s', (name) => {
    expect(McpServerNameSaveSchema.safeParse(name).success).toBe(false);
  });

  it.each(['', 'git hub', 'github.ceg'])('elutasítja a névszabálynak nem megfelelő nevet: %j', (name) => {
    expect(McpServerNameSaveSchema.safeParse(name).success).toBe(false);
  });
});
