/**
M-06: thinking kikapcsolva, két úton -- Q4 második fele.
*/
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';
import { THINKING_DISABLED } from '../harness/sdk-constants.ts';

export const M06: MeasurementCase = {
  id: 'M-06',
  title: 'thinking kikapcsolva',
  question: 'Q4',
  async run(context) {
    const base = buildBaseOptions(context);
    const explicit = await executeQuery({
      ctx: context,
      caseId: 'M-06',
      runId: 'a-explicit-disabled',
      prompt: DEFAULT_PROMPT,
      options: { ...base, thinking: THINKING_DISABLED },
    });
    const environmentZero = await executeQuery({
      ctx: context,
      caseId: 'M-06',
      runId: 'b-max-thinking-tokens-env',
      prompt: DEFAULT_PROMPT,
      options: { ...base, env: { ...base.env, MAX_THINKING_TOKENS: '0' } },
    });
    return [explicit, environmentZero];
  },
};
