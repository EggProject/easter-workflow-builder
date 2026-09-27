import { describe, expect, it } from 'vitest';
import { resolveApprovalRevealAdjustment } from './run-view-approval-reveal-adjustment.ts';

const OWN_APPROVAL_SIZES: readonly number[] = [30, 70];
const OWN_LAYOUT_SIZES: readonly number[] = [40, 60];

/**
 * A belső és a külső arány mind a négy kombinációja (saját vagy nem saját).
 */
const STORED_COMBINATIONS: readonly {
  readonly name: string;
  readonly approval: readonly number[] | undefined;
  readonly layout: readonly number[] | undefined;
}[] = [
  { name: 'belső és külső saját', approval: OWN_APPROVAL_SIZES, layout: OWN_LAYOUT_SIZES },
  { name: 'csak a belső saját', approval: OWN_APPROVAL_SIZES, layout: undefined },
  { name: 'csak a külső saját', approval: undefined, layout: OWN_LAYOUT_SIZES },
  { name: 'egyik sem saját', approval: undefined, layout: undefined },
];

describe('resolveApprovalRevealAdjustment', () => {
  describe('vertical sáv: a külső és a belső elválasztó azonos tengelyen áll, mindkét arány számít', () => {
    it('mindkét arány saját: egyik elválasztó sem mozdul', () => {
      expect(resolveApprovalRevealAdjustment('vertical', OWN_APPROVAL_SIZES, OWN_LAYOUT_SIZES)).toBe(false);
    });

    it('csak a belső arány saját: a belső ideiglenesen enged (a külső adhat helyet)', () => {
      expect(resolveApprovalRevealAdjustment('vertical', OWN_APPROVAL_SIZES, undefined)).toBe(true);
    });

    it('csak a külső arány saját: a belső ideiglenesen enged (a régi, sávfüggetlen szabály öröksége)', () => {
      expect(resolveApprovalRevealAdjustment('vertical', undefined, OWN_LAYOUT_SIZES)).toBe(true);
    });

    it('egyik arány sem saját: a belső ideiglenesen enged', () => {
      expect(resolveApprovalRevealAdjustment('vertical', undefined, undefined)).toBe(true);
    });
  });

  describe('horizontal sáv: a külső más tengelyen áll, a belső mindig ideiglenesen enged', () => {
    for (const { name, approval, layout } of STORED_COMBINATIONS) {
      it(`${name}: a belső ideiglenesen enged`, () => {
        expect(resolveApprovalRevealAdjustment('horizontal', approval, layout)).toBe(true);
      });
    }
  });

  describe('tabs sáv: nincs is külső elválasztó, a belső mindig ideiglenesen enged', () => {
    for (const { name, approval, layout } of STORED_COMBINATIONS) {
      it(`${name}: a belső ideiglenesen enged`, () => {
        expect(resolveApprovalRevealAdjustment('tabs', approval, layout)).toBe(true);
      });
    }
  });
});
