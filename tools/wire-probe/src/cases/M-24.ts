/**
 * M-24: prompt cache írás igazolása stream nélküli móddal -- az M-15
 * kiegészítése (nyitva maradt kérdés, kiértékelés 3. szekció 6. pont).
 *
 * A telepített SDK Options típusa (sdk.d.ts) NEM tartalmaz `stream` mezőt:
 * az `includePartialMessages` csak azt szabályozza, hogy a kliens milyen
 * SDKMessage eseményeket ad ki, a drótra kiküldött kérés `stream` mezőjét
 * nem érinti. A `query()` minden kérést SSE streamként küld ki, ezt kliens
 * oldalról nem lehet kikapcsolni. Ez a case ezért nem tud ténylegesen
 * `stream: false` kérést kiváltani -- megismétli az M-15 mintáját, a kimenő
 * body `stream` mezőjének tényleges értékét és a válasz alakját (SSE
 * eseménysor vagy egyetlen JSON törzs) a mérési jegyzőkönyv a proxy
 * artefaktumból olvassa ki, megfigyelésként.
 */
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

const LONG_SYSTEM_APPEND = 'Ez egy hosszú, statikus kiegészítés a system prompthoz a cache mérés miatt. '.repeat(100);

export const M24: MeasurementCase = {
  id: 'M-24',
  title: 'Prompt cache írás igazolása stream nélküli móddal',
  question: 'promptCaching kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 6. pont)',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const withLongSystem: Options = {
      ...base,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: LONG_SYSTEM_APPEND },
    };

    const outcomes: CaseRunOutcome[] = [];
    outcomes.push(
      await executeQuery({ ctx, caseId: 'M-24', runId: 'a-first', prompt: DEFAULT_PROMPT, options: withLongSystem }),
    );
    // A második futás közvetlenül az első után megy, mert a cache-találat
    // mérése ettől függ (az M-15 mintája szerint).
    outcomes.push(
      await executeQuery({
        ctx,
        caseId: 'M-24',
        runId: 'b-second-immediately-after',
        prompt: DEFAULT_PROMPT,
        options: withLongSystem,
      }),
    );
    return outcomes;
  },
};
