/* eslint-disable unicorn/no-null -- a szintetikus konfigurációk nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { resolveBranchIterationListKind } from './branch-iteration-list-kind.ts';

const FAN_OUT_CONFIG: WorkflowNodeInput['config'] = {
  type: 'fan_out',
  itemsExpression: 'items',
  branchLabelTemplate: '{{item}}',
  onUnhandledError: null,
};

const LOOP_CONFIG: WorkflowNodeInput['config'] = {
  type: 'loop',
  maxIterations: 3,
  continueExpression: 'i < 3',
  onUnhandledError: null,
};

const START_CONFIG: WorkflowNodeInput['config'] = { type: 'start', inputFields: [], onUnhandledError: null };

describe('resolveBranchIterationListKind', () => {
  it('a fan_out konfigurációra a fan_out fajtát adja', () => {
    expect(resolveBranchIterationListKind(FAN_OUT_CONFIG)).toBe('fan_out');
  });

  it('a loop konfigurációra a loop fajtát adja', () => {
    expect(resolveBranchIterationListKind(LOOP_CONFIG)).toBe('loop');
  });

  it('a többi típusra nincs tételes lista', () => {
    expect(resolveBranchIterationListKind(START_CONFIG)).toBeUndefined();
  });
});
