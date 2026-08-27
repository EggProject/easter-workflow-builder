import { describe, expect, it } from 'vitest';
import { defaultAgentToolDependencies } from './default-agent-tool-dependencies.ts';

describe('defaultAgentToolDependencies', () => {
  it('a Node beépített megvalósításait adja, és a folyamat környezetét', () => {
    expect(typeof defaultAgentToolDependencies.fetchFunction).toBe('function');
    expect(typeof defaultAgentToolDependencies.readFileFunction).toBe('function');
    expect(defaultAgentToolDependencies.environment).toBe(process.env);
  });
});
