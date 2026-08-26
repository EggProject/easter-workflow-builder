/** M-01: alap body és header leltár -- ez a referencia futás minden további eset diffjéhez. */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M01: MeasurementCase = {
  id: 'M-01',
  title: 'Alap body és header leltár',
  question: 'Q3 (részben) -- referencia futás minden további eset diffjéhez',
  async run(ctx) {
    const outcome = await executeQuery({
      ctx,
      caseId: 'M-01',
      runId: 'a',
      prompt: DEFAULT_PROMPT,
      options: buildBaseOptions(ctx),
    });
    return [outcome];
  },
};
