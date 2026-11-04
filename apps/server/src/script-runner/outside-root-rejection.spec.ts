import { describe, expect, it } from 'vitest';
import { outsideRootRejection } from './outside-root-rejection.ts';

describe('outsideRootRejection', () => {
  it('a szkript útvonalát mondja', () => {
    expect(outsideRootRejection('../x')).toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal a hozzáférés gyökerén kívülre mutat: ../x',
    });
  });
});
