import { StepRunStatusSchema } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { describeStepRunStatusBadge } from './step-run-status-badge.ts';

describe('describeStepRunStatusBadge', () => {
  it('mind a nyolc StepRunStatus értékre ad leírót, üres felirat nélkül', () => {
    for (const status of StepRunStatusSchema.options) {
      const descriptor = describeStepRunStatusBadge(status);
      expect(descriptor.label.length).toBeGreaterThan(0);
    }
  });

  it('a failed és a rejected eltérő feliratot kap, holott azonos a variánsa', () => {
    const failed = describeStepRunStatusBadge('failed');
    const rejected = describeStepRunStatusBadge('rejected');
    expect(failed.variant).toBe(rejected.variant);
    expect(failed.label).not.toBe(rejected.label);
  });

  it('a waiting_approval és az interrupted eltérő feliratot kap, holott azonos a variánsa', () => {
    const waitingApproval = describeStepRunStatusBadge('waiting_approval');
    const interrupted = describeStepRunStatusBadge('interrupted');
    expect(waitingApproval.variant).toBe(interrupted.variant);
    expect(waitingApproval.label).not.toBe(interrupted.label);
  });
});
