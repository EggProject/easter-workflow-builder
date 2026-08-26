/** M-14: az anthropic-beta header leltára -- Q12. */
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M14: MeasurementCase = {
  id: 'M-14',
  title: 'anthropic-beta header leltár',
  question: 'Q12',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const outcomes: CaseRunOutcome[] = [];
    outcomes.push(
      await executeQuery({ ctx, caseId: 'M-14', runId: 'a-base', prompt: DEFAULT_PROMPT, options: base }),
    );
    outcomes.push(
      await executeQuery({
        ctx,
        caseId: 'M-14',
        runId: 'b-disable-experimental-betas',
        prompt: DEFAULT_PROMPT,
        options: { ...base, env: { ...base.env, CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1' } },
      }),
    );
    outcomes.push(
      await executeQuery({
        ctx,
        caseId: 'M-14',
        runId: 'c-enable-tool-search-false',
        prompt: DEFAULT_PROMPT,
        options: { ...base, env: { ...base.env, ENABLE_TOOL_SEARCH: 'false' } },
      }),
    );
    return outcomes;
  },
};
