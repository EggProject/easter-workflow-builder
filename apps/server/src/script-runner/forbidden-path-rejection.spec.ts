import { describe, expect, it } from 'vitest';
import { forbiddenPathRejection } from './forbidden-path-rejection.ts';

describe('forbiddenPathRejection', () => {
  it('Error nevű elutasítás a szkript saját útvonalával', () => {
    expect(forbiddenPathRejection('dev/zero')).toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal a tiltott /proc vagy /dev könyvtárba mutat: dev/zero',
    });
  });
});
