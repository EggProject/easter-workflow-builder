import { describe, expect, it } from 'vitest';
import { resolveApprovalRevealAdjustment } from './run-view-approval-reveal-adjustment.ts';

const OWN_APPROVAL_SIZES: readonly number[] = [30, 70];
const OWN_LAYOUT_SIZES: readonly number[] = [40, 60];

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

  describe('horizontal sáv: a külső más tengelyen áll, csak a belső (látható) arány számít', () => {
    it('a belső arány saját: a belső nem mozdul, függetlenül a külső aránytól (saját külső arány mellett)', () => {
      expect(resolveApprovalRevealAdjustment('horizontal', OWN_APPROVAL_SIZES, OWN_LAYOUT_SIZES)).toBe(false);
    });

    it('a belső arány saját: a belső nem mozdul, függetlenül a külső aránytól (külső arány nélkül is)', () => {
      expect(resolveApprovalRevealAdjustment('horizontal', OWN_APPROVAL_SIZES, undefined)).toBe(false);
    });

    it('a belső arány nem saját: a belső ideiglenesen enged, függetlenül a külső aránytól (saját külső arány mellett)', () => {
      expect(resolveApprovalRevealAdjustment('horizontal', undefined, OWN_LAYOUT_SIZES)).toBe(true);
    });

    it('a belső arány nem saját: a belső ideiglenesen enged, függetlenül a külső aránytól (külső arány nélkül is)', () => {
      expect(resolveApprovalRevealAdjustment('horizontal', undefined, undefined)).toBe(true);
    });
  });

  describe('tabs sáv: nincs is külső elválasztó, csak a belső (látható) arány számít', () => {
    it('a belső arány saját: a belső nem mozdul, függetlenül a külső aránytól (saját külső arány mellett)', () => {
      expect(resolveApprovalRevealAdjustment('tabs', OWN_APPROVAL_SIZES, OWN_LAYOUT_SIZES)).toBe(false);
    });

    it('a belső arány saját: a belső nem mozdul, függetlenül a külső aránytól (külső arány nélkül is)', () => {
      expect(resolveApprovalRevealAdjustment('tabs', OWN_APPROVAL_SIZES, undefined)).toBe(false);
    });

    it('a belső arány nem saját: a belső ideiglenesen enged, függetlenül a külső aránytól (saját külső arány mellett)', () => {
      expect(resolveApprovalRevealAdjustment('tabs', undefined, OWN_LAYOUT_SIZES)).toBe(true);
    });

    it('a belső arány nem saját: a belső ideiglenesen enged, függetlenül a külső aránytól (külső arány nélkül is)', () => {
      expect(resolveApprovalRevealAdjustment('tabs', undefined, undefined)).toBe(true);
    });
  });
});
