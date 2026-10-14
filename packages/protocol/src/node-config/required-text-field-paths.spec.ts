import { describe, expect, it } from 'vitest';
import { REQUIRED_TEXT_FIELD_PATHS } from './required-text-field-paths.ts';

describe('REQUIRED_TEXT_FIELD_PATHS', () => {
  it('a SPEC-008 5.4 táblázatának tizenhat mezőjét sorolja fel', () => {
    const { join, ...withoutJoin } = REQUIRED_TEXT_FIELD_PATHS;
    const paths = [...Object.values(withoutJoin), ...Object.values(join)].flat();

    expect(paths).toHaveLength(16);
  });

  it('a join merge módjának és az error_handler típusnak nincs kötelező szöveg mezője', () => {
    expect(REQUIRED_TEXT_FIELD_PATHS.join.merge).toEqual([]);
    expect(REQUIRED_TEXT_FIELD_PATHS.error_handler).toEqual([]);
  });
});
