/**
 * M-34: toolChoice.rejectionBehaviour -- közvetlen HTTP hívás (Node natív
 * `fetch`, nem az SDK), a proxyn keresztül, hogy a nyers tranzakció
 * automatikusan, maszkolva rögzüljön (lásd tools/wire-probe/src/proxy.ts).
 * Az SDK sosem küld `tool_choice: {type:'any'}` vagy `{type:'tool',...}`
 * értéket (M-03, M-17: 79/79 kérésben csak `auto` vagy hiányzik), ezért ezt
 * a bemenetet csak a kliens megkerülésével lehet előállítani.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { MINIMAX_WIRE_MODEL } from '../harness/minimax-model.ts';

interface DirectCallResult {
  readonly status: number;
  readonly bodyText: string;
}

async function callMessages(
  context: { readonly proxyBaseUrl: string; readonly minimaxApiKey: string },
  body: unknown,
): Promise<DirectCallResult> {
  const response = await fetch(`${context.proxyBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': context.minimaxApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const bodyText = await response.text();
  return { status: response.status, bodyText };
}

/**
 * A Flash mindig gondolkodik (docs/research/2026-10-27-flash-es-haiku.md 2. szekció): egy 16 tokenes
 * keretet a gondolkodás teljesen elfogyaszt, és a válaszban sosem jelenik meg tool_use blokk
 * (docs/research/2026-10-28-flash-meresek.md 3. szekció, M-34). A keret ezért nagyobb.
 */
const MAX_TOKENS = 512;

const NOOP_TOOL = {
  name: 'noop',
  description: 'Nem csinál semmit, csak a tool_choice kikényszerítéshez kell.',
  input_schema: { type: 'object', properties: {} },
};

export const M34: MeasurementCase = {
  id: 'M-34',
  title: 'toolChoice.rejectionBehaviour közvetlen HTTP hívással',
  question: 'toolChoice.rejectionBehaviour (nyitva maradt capability mező)',
  async run(context) {
    const caseDirectory = path.join(context.outDir, 'M-34');
    mkdirSync(caseDirectory, { recursive: true });

    const anyResult = await callMessages(context, {
      model: MINIMAX_WIRE_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: 'Mondj egy szót.' }],
      tools: [NOOP_TOOL],
      tool_choice: { type: 'any' },
    });
    writeFileSync(path.join(caseDirectory, 'a-tool-choice-any.json'), JSON.stringify(anyResult, undefined, 2), 'utf8');

    const toolResult = await callMessages(context, {
      model: MINIMAX_WIRE_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: 'Mondj egy szót.' }],
      tools: [NOOP_TOOL],
      tool_choice: { type: 'tool', name: 'noop' },
    });
    writeFileSync(
      path.join(caseDirectory, 'b-tool-choice-tool.json'),
      JSON.stringify(toolResult, undefined, 2),
      'utf8',
    );

    const outcomes: CaseRunOutcome[] = [
      { runId: 'a-tool-choice-any', ok: true, note: `HTTP ${String(anyResult.status)}` },
      { runId: 'b-tool-choice-tool', ok: true, note: `HTTP ${String(toolResult.status)}` },
    ];
    return outcomes;
  },
};
