/**
 * M-22: a CLAUDE_CODE_MAX_OUTPUT_TOKENS felső korlátja MiniMax ellen -- Q11
 * kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 4. pont).
 * Növekvő értékek, rövid választ kiváltó prompttal: minket a kimenő
 * `max_tokens` mező értéke és a HTTP kód érdekel, nem a tényleges generálás.
 */
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

/**
 * A MiniMax-M3 dokumentált ajánlott (131072) és max (524288) kimenő token
 * értéke a research modelltáblázatából
 * (docs/research/2026-08-26-agent-sdk-minimax.md:138). A 4096 és 32000 a
 * kliens alapértéke alatti/körüli összehasonlító pont.
 */
const OUTPUT_TOKEN_VALUES: readonly string[] = ['4096', '32000', '131072', '524288'];

export const M22: MeasurementCase = {
  id: 'M-22',
  title: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS felső korlátja',
  question: 'Q11 kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 4. pont)',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const outcomes: CaseRunOutcome[] = [];
    for (const value of OUTPUT_TOKEN_VALUES) {
      outcomes.push(
        await executeQuery({
          ctx,
          caseId: 'M-22',
          runId: `max-output-tokens-${value}`,
          prompt: DEFAULT_PROMPT,
          options: { ...base, env: { ...base.env, CLAUDE_CODE_MAX_OUTPUT_TOKENS: value } },
        }),
      );
    }
    return outcomes;
  },
};
