/** M-07: háttér modellhívások feltérképezése -- Q5. */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M07: MeasurementCase = {
  id: 'M-07',
  title: 'Háttér modellhívások',
  question: 'Q5',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const a = await executeQuery({ ctx, caseId: 'M-07', runId: 'a-base', prompt: DEFAULT_PROMPT, options: base });
    const b = await executeQuery({
      ctx,
      caseId: 'M-07',
      runId: 'b-disable-nonessential-traffic',
      prompt: DEFAULT_PROMPT,
      options: { ...base, env: { ...base.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' } },
    });
    const c = await executeQuery({
      ctx,
      caseId: 'M-07',
      runId: 'c-default-haiku-model',
      prompt: DEFAULT_PROMPT,
      options: { ...base, env: { ...base.env, ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M3' } },
    });
    const d = await executeQuery({
      ctx,
      caseId: 'M-07',
      runId: 'd-persist-session',
      prompt: DEFAULT_PROMPT,
      options: { ...base, persistSession: true },
    });
    return [a, b, c, d];
  },
};
