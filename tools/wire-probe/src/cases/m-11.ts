/**
M-11: a [1m] suffix kezelése -- Q9.
*/
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';
import { MINIMAX_CLIENT_MODEL } from '../harness/minimax-model.ts';

export const M11: MeasurementCase = {
  id: 'M-11',
  title: '[1m] suffix kezelése',
  question: 'Q9',
  async run(context) {
    const base = buildBaseOptions(context);
    const withSuffix = await executeQuery({
      ctx: context,
      caseId: 'M-11',
      runId: 'a-with-suffix',
      prompt: DEFAULT_PROMPT,
      options: { ...base, model: MINIMAX_CLIENT_MODEL },
    });
    const withoutSuffix = await executeQuery({
      ctx: context,
      caseId: 'M-11',
      runId: 'b-without-suffix',
      prompt: DEFAULT_PROMPT,
      options: base,
    });
    return [withSuffix, withoutSuffix];
  },
};
