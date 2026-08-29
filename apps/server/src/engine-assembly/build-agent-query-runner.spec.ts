import { describe, expect, it } from 'vitest';
import { buildAgentQueryRunner } from './build-agent-query-runner.ts';

describe('buildAgentQueryRunner', () => {
  it('AgentQueryRunner alakú objektumot ad, valós SDK hívás nélkül (a query csak run()-on hívódna)', () => {
    const runner = buildAgentQueryRunner();
    expect(typeof runner.run).toBe('function');
  });
});
