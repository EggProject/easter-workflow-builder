import { describe, expect, it } from 'vitest';
import { EnvironmentVariableNameSchema } from './environment-variable-name.ts';

describe('EnvironmentVariableNameSchema', () => {
  it.each(['GITHUB_TOKEN', 'GITHUB_TOKEN_CEG', '_PRIVATE', 'http_proxy', 'A1'])('elfogadja: %s', (name) => {
    expect(EnvironmentVariableNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(['', '1TOKEN', 'GITHUB-TOKEN', 'A B', 'A=B', 'ÁRVÍZ', 'A\n'])('elutasítja: %j', (name) => {
    expect(EnvironmentVariableNameSchema.safeParse(name).success).toBe(false);
  });
});
