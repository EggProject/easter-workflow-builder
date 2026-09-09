import { describe, expect, it } from 'vitest';
import { findNextEnabledIndex } from './find-next-enabled-index.ts';

describe('findNextEnabledIndex', () => {
  const plain = [{}, {}, {}];
  const withDisabled = [{}, { disabled: true }, {}, { disabled: true }];

  it('az első engedélyezett opció a -1 pozícióról előre lépve jön', () => {
    expect(findNextEnabledIndex(plain, -1, 1)).toBe(0);
  });

  it('az utolsó engedélyezett opció a lista végéről visszafelé lépve jön', () => {
    expect(findNextEnabledIndex(withDisabled, withDisabled.length, -1)).toBe(2);
  });

  it('előrefelé átugorja a letiltott opciót', () => {
    expect(findNextEnabledIndex(withDisabled, 0, 1)).toBe(2);
  });

  it('hátrafelé átugorja a letiltott opciót', () => {
    expect(findNextEnabledIndex(withDisabled, 2, -1)).toBe(0);
  });

  it('előrefelé körbeér a lista végén', () => {
    expect(findNextEnabledIndex(withDisabled, 2, 1)).toBe(0);
  });

  it('hátrafelé körbeér a lista elején', () => {
    expect(findNextEnabledIndex(withDisabled, 0, -1)).toBe(2);
  });

  it('üres listára -1 jön', () => {
    expect(findNextEnabledIndex([], -1, 1)).toBe(-1);
  });

  it('csupa letiltott listára -1 jön', () => {
    expect(findNextEnabledIndex([{ disabled: true }, { disabled: true }], -1, 1)).toBe(-1);
  });

  it('a `disabled: false` opció engedélyezettnek számít', () => {
    expect(findNextEnabledIndex([{ disabled: true }, { disabled: false }], -1, 1)).toBe(1);
  });
});
