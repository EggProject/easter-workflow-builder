import { describe, expect, it } from 'vitest';
import { NodeTypeSchema } from './node-type.ts';

describe('NodeTypeSchema', () => {
  it('a SPEC-003 4.3 táblázatának mind a tíz típusát elfogadja', () => {
    const types = [
      'start',
      'agent_step',
      'branch',
      'fan_out',
      'join',
      'loop',
      'human_approval',
      'error_handler',
      'sub_workflow',
      'script',
    ];
    for (const type of types) {
      expect(NodeTypeSchema.safeParse(type).success).toBe(true);
    }
    expect(types).toHaveLength(10);
  });

  it('ismeretlen típust elutasít', () => {
    expect(NodeTypeSchema.safeParse('unknown_type').success).toBe(false);
  });
});
