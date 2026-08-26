/**
M-02: az outputFormat drótalakja -- Q1.
*/
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

/**
Kétmezős séma: egy string és egy number mező, ahogy a SPEC-000 M-02 előírja.
*/
const SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    count: { type: 'number' },
  },
  required: ['label', 'count'],
} satisfies Record<string, unknown>;

export const M02: MeasurementCase = {
  id: 'M-02',
  title: 'outputFormat drótalakja',
  question: 'Q1',
  async run(context) {
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-02',
      runId: 'a',
      prompt: DEFAULT_PROMPT,
      options: {
        ...buildBaseOptions(context),
        outputFormat: { type: 'json_schema', schema: SCHEMA },
      },
    });
    return [outcome];
  },
};
