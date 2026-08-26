/**
 * M-21: a CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1 tényleges hatása -- Q5
 * kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 3. pont). Egyetlen
 * env eltérés az alaphoz képest, egy futás.
 */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M21: MeasurementCase = {
  id: 'M-21',
  title: 'CLAUDE_CODE_DISABLE_TERMINAL_TITLE hatása',
  question: 'Q5 kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 3. pont)',
  async run(context) {
    const base = buildBaseOptions(context);
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-21',
      runId: 'a',
      prompt: DEFAULT_PROMPT,
      options: { ...base, env: { ...base.env, CLAUDE_CODE_DISABLE_TERMINAL_TITLE: '1' } },
    });
    return [outcome];
  },
};
