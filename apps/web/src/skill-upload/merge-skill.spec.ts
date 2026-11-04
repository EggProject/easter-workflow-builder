import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { mergeSkill } from './merge-skill.ts';

const ALFA: SkillSummary = { name: 'alfa', description: 'Az alfa skill.', sizeBytes: 100, modifiedAtMs: 1 };
const BETA: SkillSummary = { name: 'beta', description: 'A béta skill.', sizeBytes: 200, modifiedAtMs: 2 };
const GAMMA: SkillSummary = { name: 'gamma', description: 'A gamma skill.', sizeBytes: 300, modifiedAtMs: 3 };

describe('mergeSkill', () => {
  it('az új skillt név szerinti helyre illeszti', () => {
    expect(mergeSkill([ALFA, GAMMA], BETA)).toEqual([ALFA, BETA, GAMMA]);
  });

  it('az azonos nevű sort lecseréli, a lista hossza nem nő', () => {
    const replaced: SkillSummary = { ...BETA, description: 'Cserélt leírás.', sizeBytes: 999 };

    expect(mergeSkill([ALFA, BETA, GAMMA], replaced)).toEqual([ALFA, replaced, GAMMA]);
  });

  it('üres listába és a lista végére is beilleszt, és a bemenetet nem módosítja', () => {
    const original: readonly SkillSummary[] = [ALFA];

    expect(mergeSkill([], ALFA)).toEqual([ALFA]);
    expect(mergeSkill(original, GAMMA)).toEqual([ALFA, GAMMA]);
    expect(original).toEqual([ALFA]);
  });

  it('a kötőjeles és számos nevet UTF-16 kódegység sorrendben rendezi', () => {
    const dashed: SkillSummary = { ...ALFA, name: 'alfa-2' };
    const digit: SkillSummary = { ...ALFA, name: 'alfa2' };

    expect(mergeSkill([digit, ALFA], dashed).map((skill) => skill.name)).toEqual(['alfa', 'alfa-2', 'alfa2']);
  });
});
