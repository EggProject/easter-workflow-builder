/**
M-05: thinking bekapcsolva -- Q4 első fele.
*/
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';
import { THINKING_ADAPTIVE } from '../harness/sdk-constants.ts';

export const M05: MeasurementCase = {
  id: 'M-05',
  title: 'thinking bekapcsolva',
  question: 'Q4',
  async run(context) {
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-05',
      runId: 'a',
      prompt: DEFAULT_PROMPT,
      options: { ...buildBaseOptions(context), thinking: THINKING_ADAPTIVE },
    });
    return [outcome];
  },
};
