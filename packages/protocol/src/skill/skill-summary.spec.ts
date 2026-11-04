import { describe, expect, it } from 'vitest';
import { SkillSummarySchema } from './skill-summary.ts';

const VALID = { name: 'pdf-tools', description: 'PDF', sizeBytes: 12, modifiedAtMs: 1_700_000_000_000 };

describe('SkillSummarySchema', () => {
  it('az érvényes sort elfogadja', () => {
    expect(SkillSummarySchema.safeParse(VALID)).toMatchObject({ success: true, data: VALID });
  });

  it('ismeretlen kulcsot elutasít (strictObject)', () => {
    expect(SkillSummarySchema.safeParse({ ...VALID, path: '/titkos' }).success).toBe(false);
  });

  it.each([-1, 1.5])('a negatív vagy tört méretet (%s) elutasítja', (sizeBytes) => {
    expect(SkillSummarySchema.safeParse({ ...VALID, sizeBytes }).success).toBe(false);
  });
});
