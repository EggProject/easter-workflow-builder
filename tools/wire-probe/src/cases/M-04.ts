/** M-04: az output_config és az effort kapcsolata -- Q3 másik fele. */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';
import { EFFORT_HIGHEST, EFFORT_LOWEST } from '../harness/sdk-constants.ts';

export const M04: MeasurementCase = {
  id: 'M-04',
  title: 'output_config és effort kapcsolata',
  question: 'Q3',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const low = await executeQuery({
      ctx,
      caseId: 'M-04',
      runId: 'a-effort-low',
      prompt: DEFAULT_PROMPT,
      options: { ...base, effort: EFFORT_LOWEST },
    });
    const high = await executeQuery({
      ctx,
      caseId: 'M-04',
      runId: 'b-effort-high',
      prompt: DEFAULT_PROMPT,
      options: { ...base, effort: EFFORT_HIGHEST },
    });
    return [low, high];
  },
};
