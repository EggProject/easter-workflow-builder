/**
 * M-33: promptCaching.mode -- implicit és explicit cache szétválasztási
 * kísérlet. Az SDK a system promptra és a tools tömbre automatikusan tesz
 * cache_control töréspontot (lásd M-01, M-15), ezt a harness nem tudja
 * kikapcsolni pontonként, csak egészben (DISABLE_PROMPT_CACHING). Új szög:
 * a felhasználói ÜZENET content blokkjára a streaming input módban MI magunk
 * is tehetünk explicit cache_control töréspontot (a Base64ImageBlockParam
 * mintájára a TextBlockParam is hordoz `cache_control` mezőt), függetlenül
 * attól, amit az SDK a system promptra tesz. Három futás: (a) explicit
 * user-szintű töréspont, cache bekapcsolva; (b) ugyanaz közvetlenül utána,
 * hogy legyen mit implicit módon újraolvasni; (c) ugyanaz
 * DISABLE_PROMPT_CACHING=1 mellett, hogy lássuk, a kapcsoló a MI general
 * cache_control blokkunkat is leveszi-e, nem csak az SDK sajátját.
 */
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

/** Minimum ~512 token, hogy a cache töréspont ténylegesen aktiválódjon (research 2. szekció). */
const FILLER = 'M-33 cache elválasztás mérés, egyedi ismétlődő töltelék szöveg minden futáshoz azonos. '.repeat(120);

async function* explicitBreakpointPrompt(): AsyncGenerator<SDKUserMessage> {
  yield {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: `${FILLER}\n\nVálaszolj egyetlen szóval: OK`, cache_control: { type: 'ephemeral' } }],
    },
    parent_tool_use_id: null,
  };
}

export const M33: MeasurementCase = {
  id: 'M-33',
  title: 'promptCaching.mode -- implicit és explicit szétválasztás',
  question: 'promptCaching.mode (nyitva maradt capability mező)',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const a = await executeQuery({
      ctx,
      caseId: 'M-33',
      runId: 'a-explicit-breakpoint-first',
      prompt: explicitBreakpointPrompt(),
      options: base,
    });
    const b = await executeQuery({
      ctx,
      caseId: 'M-33',
      runId: 'b-explicit-breakpoint-second',
      prompt: explicitBreakpointPrompt(),
      options: base,
    });
    const c = await executeQuery({
      ctx,
      caseId: 'M-33',
      runId: 'c-disable-prompt-caching',
      prompt: explicitBreakpointPrompt(),
      options: { ...base, env: { ...base.env, DISABLE_PROMPT_CACHING: '1' } },
    });
    return [a, b, c];
  },
};
