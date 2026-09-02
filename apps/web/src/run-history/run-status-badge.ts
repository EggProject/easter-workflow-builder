import type { RunStatus } from '@easter-workflow-builder/protocol';
import type { BadgeVariant } from '@easter-workflow-builder/ui';

export interface RunStatusBadgeDescriptor {
  readonly variant: BadgeVariant;
  readonly label: string;
}

/**
 * A hat futás állapot magyar felirata és jelvény variánsa (SPEC-007 10.2 a
 * "tábla" sora, "állapot badge"). Kimerítő leképezés: egy hetedik érték
 * fordítási hibát ad.
 */
const RUN_STATUS_BADGE: Readonly<Record<RunStatus, RunStatusBadgeDescriptor>> = {
  pending: { variant: 'outline', label: 'várakozik' },
  running: { variant: 'info', label: 'fut' },
  succeeded: { variant: 'success', label: 'sikeres' },
  failed: { variant: 'danger', label: 'sikertelen' },
  cancelled: { variant: 'ink', label: 'megszakítva' },
  interrupted: { variant: 'warning', label: 'félbeszakítva' },
};

export function describeRunStatusBadge(status: RunStatus): RunStatusBadgeDescriptor {
  return RUN_STATUS_BADGE[status];
}
