/** M-15: prompt caching drótalak -- descriptor kiegészítő mező. */
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

const LONG_SYSTEM_APPEND = 'Ez egy hosszú, statikus kiegészítés a system prompthoz a cache mérés miatt. '.repeat(100);

export const M15: MeasurementCase = {
  id: 'M-15',
  title: 'Prompt caching drótalak',
  question: 'promptCaching (descriptor kiegészítő mező)',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    // Az `: Options` annotáció kontextusos típusból narrow-olja a systemPrompt
    // literál mezőit, `as` típuskényszerítés nélkül.
    const withLongSystem: Options = {
      ...base,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: LONG_SYSTEM_APPEND },
    };

    const outcomes: CaseRunOutcome[] = [];
    outcomes.push(
      await executeQuery({
        ctx,
        caseId: 'M-15',
        runId: 'a-first',
        prompt: DEFAULT_PROMPT,
        options: withLongSystem,
      }),
    );
    // A második futás közvetlenül az első után megy, mert a cache-találat
    // mérése ettől függ (SPEC-000 M-15).
    outcomes.push(
      await executeQuery({
        ctx,
        caseId: 'M-15',
        runId: 'b-second-immediately-after',
        prompt: DEFAULT_PROMPT,
        options: withLongSystem,
      }),
    );
    outcomes.push(
      await executeQuery({
        ctx,
        caseId: 'M-15',
        runId: 'c-cache-disabled',
        prompt: DEFAULT_PROMPT,
        options: { ...withLongSystem, env: { ...withLongSystem.env, DISABLE_PROMPT_CACHING: '1' } },
      }),
    );
    return outcomes;
  },
};
