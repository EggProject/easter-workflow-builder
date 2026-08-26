/**
 * M-26: CLAUDE_CODE_ALWAYS_ENABLE_EFFORT hatása -- a felhasználó tényleges
 * env beállítása kapcsolja be ezt, a leíró viszont az output_config/effort
 * mezőt kockázatosnak jelöli. Két futás, `Options.effort` beállítás NÉLKÜL
 * mindkettőben, hogy a kapcsoló önmagában mért hatása látszódjon.
 */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M26: MeasurementCase = {
  id: 'M-26',
  title: 'CLAUDE_CODE_ALWAYS_ENABLE_EFFORT hatása',
  question: 'user env: CLAUDE_CODE_ALWAYS_ENABLE_EFFORT',
  async run(context) {
    const base = buildBaseOptions(context);
    const a = await executeQuery({
      ctx: context,
      caseId: 'M-26',
      runId: 'a-base',
      prompt: DEFAULT_PROMPT,
      options: base,
    });
    const b = await executeQuery({
      ctx: context,
      caseId: 'M-26',
      runId: 'b-always-enable-effort',
      prompt: DEFAULT_PROMPT,
      options: { ...base, env: { ...base.env, CLAUDE_CODE_ALWAYS_ENABLE_EFFORT: '1' } },
    });
    return [a, b];
  },
};
