/** M-17: szerver oldali tool (web search) -- descriptor kiegészítő mező (serverTools). */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

export const M17: MeasurementCase = {
  id: 'M-17',
  title: 'Szerver oldali tool',
  question: 'serverTools (descriptor kiegészítő mező)',
  async run(ctx) {
    const outcome = await executeQuery({
      ctx,
      caseId: 'M-17',
      runId: 'a',
      prompt: 'Keress rá webes keresővel, hogy mennyi ma a Bitcoin árfolyama dollárban.',
      options: { ...buildBaseOptions(ctx), maxTurns: 3, allowedTools: ['WebSearch'] },
    });
    return [outcome];
  },
};
