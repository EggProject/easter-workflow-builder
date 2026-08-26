/**
M-08: env kapcsoló mátrix -- Q6.
*/
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

/**
Futásonként egyetlen env eltérés az M-01 alaphoz képest, a SPEC-000 M-08 szerint.
*/
const ENV_DELTAS: Readonly<Record<string, string>> = {
  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  ENABLE_TOOL_SEARCH: 'false',
  DISABLE_PROMPT_CACHING: '1',
  MAX_THINKING_TOKENS: '0',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
};

export const M08: MeasurementCase = {
  id: 'M-08',
  title: 'Env kapcsoló mátrix',
  question: 'Q6',
  async run(context) {
    const base = buildBaseOptions(context);
    const outcomes: CaseRunOutcome[] = [];
    for (const [environmentVariable, value] of Object.entries(ENV_DELTAS)) {
      outcomes.push(
        await executeQuery({
          ctx: context,
          caseId: 'M-08',
          runId: environmentVariable,
          prompt: DEFAULT_PROMPT,
          options: { ...base, env: { ...base.env, [environmentVariable]: value } },
        }),
      );
    }
    return outcomes;
  },
};
