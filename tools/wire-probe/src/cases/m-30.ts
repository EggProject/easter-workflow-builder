/**
 * M-30: API_TIMEOUT_MS=3000000 hatása -- a felhasználó tényleges env
 * beállítása. Nem várjuk meg a teljes 3 000 000 ms-et: a hatás a kimenő
 * kérés `x-stainless-timeout` headerében (ha van ilyen, lásd M-01 header
 * leltár) vagy a meta.json-ban figyelhető meg ésszerű idő alatt.
 */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M30: MeasurementCase = {
  id: 'M-30',
  title: 'API_TIMEOUT_MS hatása',
  question: 'user env: API_TIMEOUT_MS',
  async run(context) {
    const base = buildBaseOptions(context);
    const a = await executeQuery({
      ctx: context,
      caseId: 'M-30',
      runId: 'a-base',
      prompt: DEFAULT_PROMPT,
      options: base,
    });
    const b = await executeQuery({
      ctx: context,
      caseId: 'M-30',
      runId: 'b-api-timeout-3000000',
      prompt: DEFAULT_PROMPT,
      options: { ...base, env: { ...base.env, API_TIMEOUT_MS: '3000000' } },
    });
    return [a, b];
  },
};
