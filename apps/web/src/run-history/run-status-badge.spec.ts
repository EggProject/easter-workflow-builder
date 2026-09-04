import type { RunStatus } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { describeRunStatusBadge } from './run-status-badge.ts';

const ALL_STATUSES: readonly RunStatus[] = ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted'];

describe('describeRunStatusBadge', () => {
  it.each(ALL_STATUSES)('a(z) "%s" állapotra ad variánst és feliratot', (status) => {
    const descriptor = describeRunStatusBadge(status);
    expect(descriptor.label.length).toBeGreaterThan(0);
    expect(descriptor.variant.length).toBeGreaterThan(0);
  });

  it('a hat állapot felirata egyedi', () => {
    const labels = ALL_STATUSES.map((status) => describeRunStatusBadge(status).label);
    expect(new Set(labels).size).toBe(ALL_STATUSES.length);
  });
});
