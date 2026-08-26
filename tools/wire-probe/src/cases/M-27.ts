/** M-27: CLAUDE_CODE_DISABLE_FAST_MODE hatása -- a felhasználó tényleges env beállítása. */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M27: MeasurementCase = {
  id: 'M-27',
  title: 'CLAUDE_CODE_DISABLE_FAST_MODE hatása',
  question: 'user env: CLAUDE_CODE_DISABLE_FAST_MODE',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const a = await executeQuery({ ctx, caseId: 'M-27', runId: 'a-base', prompt: DEFAULT_PROMPT, options: base });
    const b = await executeQuery({
      ctx,
      caseId: 'M-27',
      runId: 'b-disable-fast-mode',
      prompt: DEFAULT_PROMPT,
      options: { ...base, env: { ...base.env, CLAUDE_CODE_DISABLE_FAST_MODE: '1' } },
    });
    return [a, b];
  },
};
