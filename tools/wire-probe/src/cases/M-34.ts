/**
 * M-34: toolChoice.rejectionBehaviour -- közvetlen HTTP hívás (Node natív
 * `fetch`, nem az SDK), a proxyn keresztül, hogy a nyers tranzakció
 * automatikusan, maszkolva rögzüljön (lásd tools/wire-probe/src/proxy.ts).
 * Az SDK sosem küld `tool_choice: {type:'any'}` vagy `{type:'tool',...}`
 * értéket (M-03, M-17: 79/79 kérésben csak `auto` vagy hiányzik), ezért ezt
 * a bemenetet csak a kliens megkerülésével lehet előállítani.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';

interface DirectCallResult {
  readonly status: number;
  readonly bodyText: string;
}

async function callMessages(ctx: { readonly proxyBaseUrl: string; readonly minimaxApiKey: string }, body: unknown): Promise<DirectCallResult> {
  const response = await fetch(`${ctx.proxyBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ctx.minimaxApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const bodyText = await response.text();
  return { status: response.status, bodyText };
}

const NOOP_TOOL = { name: 'noop', description: 'Nem csinál semmit, csak a tool_choice kikényszerítéshez kell.', input_schema: { type: 'object', properties: {} } };

export const M34: MeasurementCase = {
  id: 'M-34',
  title: 'toolChoice.rejectionBehaviour közvetlen HTTP hívással',
  question: 'toolChoice.rejectionBehaviour (nyitva maradt capability mező)',
  async run(ctx) {
    const caseDir = join(ctx.outDir, 'M-34');
    mkdirSync(caseDir, { recursive: true });

    const anyResult = await callMessages(ctx, {
      model: 'MiniMax-M3',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Mondj egy szót.' }],
      tools: [NOOP_TOOL],
      tool_choice: { type: 'any' },
    });
    writeFileSync(join(caseDir, 'a-tool-choice-any.json'), JSON.stringify(anyResult, null, 2), 'utf8');

    const toolResult = await callMessages(ctx, {
      model: 'MiniMax-M3',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Mondj egy szót.' }],
      tools: [NOOP_TOOL],
      tool_choice: { type: 'tool', name: 'noop' },
    });
    writeFileSync(join(caseDir, 'b-tool-choice-tool.json'), JSON.stringify(toolResult, null, 2), 'utf8');

    const outcomes: CaseRunOutcome[] = [
      { runId: 'a-tool-choice-any', ok: true, note: `HTTP ${String(anyResult.status)}` },
      { runId: 'b-tool-choice-tool', ok: true, note: `HTTP ${String(toolResult.status)}` },
    ];
    return outcomes;
  },
};
