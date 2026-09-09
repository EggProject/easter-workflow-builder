import type { StepRunStatus } from '@easter-workflow-builder/protocol';
import type { BadgeVariant } from '@easter-workflow-builder/ui';

export interface StepRunStatusBadgeDescriptor {
  readonly variant: BadgeVariant;
  readonly label: string;
}

/**
 * A nyolc lépés futás állapot magyar felirata és jelvény variánsa (SPEC-008
 * 6.2 táblázat, AC21). Kimerítő leképezés, a `run-history/run-status-badge.ts`
 * mintájára: egy kilencedik érték fordítási hibát ad. A szín önmagában nem
 * hordoz információt - a `waiting_approval` és az `interrupted` ugyanazt a
 * `warning` variánst kapja, a `failed` és a `rejected` ugyanazt a `danger`
 * variánst, de a felirat mindig megkülönbözteti őket (SPEC-008 6.2 "nem
 * szín, hanem szöveg és forma együtt").
 */
const STEP_RUN_STATUS_BADGE: Readonly<Record<StepRunStatus, StepRunStatusBadgeDescriptor>> = {
  pending: { variant: 'outline', label: 'várakozik' },
  running: { variant: 'info', label: 'fut' },
  waiting_approval: { variant: 'warning', label: 'jóváhagyásra vár' },
  succeeded: { variant: 'success', label: 'sikeres' },
  failed: { variant: 'danger', label: 'sikertelen' },
  rejected: { variant: 'danger', label: 'elutasítva' },
  cancelled: { variant: 'ink', label: 'megszakítva' },
  interrupted: { variant: 'warning', label: 'félbeszakítva' },
};

export function describeStepRunStatusBadge(status: StepRunStatus): StepRunStatusBadgeDescriptor {
  return STEP_RUN_STATUS_BADGE[status];
}
