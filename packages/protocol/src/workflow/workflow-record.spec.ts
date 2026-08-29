/* eslint-disable unicorn/no-null -- a WorkflowSummary/Detail és a Create/UpdateWorkflowRequest nullázható mezői (description, providerId) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import {
  CreateWorkflowRequestSchema,
  ListWorkflowsQuerySchema,
  UpdateWorkflowRequestSchema,
  WorkflowDetailSchema,
  WorkflowSummarySchema,
} from './workflow-record.ts';

const VALID_RECORD = {
  id: 'wf-1',
  name: 'Első workflow',
  description: null,
  providerId: 'minimax',
  createdAtMs: 1,
  updatedAtMs: 2,
};

describe('WorkflowSummarySchema', () => {
  it('elfogadja az érvényes rekordot', () => {
    expect(WorkflowSummarySchema.safeParse(VALID_RECORD).success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    expect(WorkflowSummarySchema.safeParse({ ...VALID_RECORD, extra: true }).success).toBe(false);
  });
});

describe('WorkflowDetailSchema', () => {
  it('elfogadja az érvényes rekordot', () => {
    expect(WorkflowDetailSchema.safeParse(VALID_RECORD).success).toBe(true);
  });
});

describe('CreateWorkflowRequestSchema', () => {
  it('elfogadja a name, description, providerId mezőt', () => {
    const outcome = CreateWorkflowRequestSchema.safeParse({
      name: 'Új workflow',
      description: null,
      providerId: null,
    });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja, ha a description mező hiányzik', () => {
    expect(CreateWorkflowRequestSchema.safeParse({ name: 'x', providerId: null }).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    expect(
      CreateWorkflowRequestSchema.safeParse({ name: 'x', description: null, providerId: null, extra: 1 }).success,
    ).toBe(false);
  });
});

describe('UpdateWorkflowRequestSchema', () => {
  it('elfogadja az üres törzset (minden mező elhagyható)', () => {
    expect(UpdateWorkflowRequestSchema.safeParse({}).success).toBe(true);
  });

  it('elfogadja a részleges frissítést', () => {
    expect(UpdateWorkflowRequestSchema.safeParse({ name: 'Új név' }).success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    expect(UpdateWorkflowRequestSchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});

describe('ListWorkflowsQuerySchema', () => {
  it('elfogadja a kötelező limit mezőt', () => {
    expect(ListWorkflowsQuerySchema.safeParse({ limit: 20 }).success).toBe(true);
  });

  it('elutasítja a hiányzó limitet', () => {
    expect(ListWorkflowsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('elutasítja a nem pozitív limitet', () => {
    expect(ListWorkflowsQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(ListWorkflowsQuerySchema.safeParse({ limit: 20, extra: 1 }).success).toBe(false);
  });
});
