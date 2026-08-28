/**
 * M-38: lépésenkénti kérésszám és időtartam -- összetett lépés (két láncolt
 * tool hívás). Az M-37 egyszerű, egy tool hívásos lépéséhez képest ez a mérés
 * azt mutatja meg, mennyivel nő a kérésszám és az időtartam egy tipikusnál
 * összetettebb agent lépésnél, hogy legyen szórás a lépésenkénti kérésráta
 * becsléséhez.
 *
 * Ugyanaz a `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` env kapcsoló, mint az
 * M-37-nél, a `minimax` provider végleges env blokkja szerint.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { CaseContext, CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';
import { NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE } from '../harness/sdk-constants.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface ParsedTransactionTiming {
  readonly timestampMs: number;
  readonly method: string;
  readonly requestPath: string;
}

/**
Egy proxy artifacts/*.json tranzakció fájl időzítés-adatainak beolvasása; `undefined`, ha nem elemezhető.
*/
function parseTransactionTiming(fullPath: string): ParsedTransactionTiming | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const timestampMs = typeof parsed['timestamp'] === 'string' ? Date.parse(parsed['timestamp']) : NaN;
  const method = typeof parsed['method'] === 'string' ? parsed['method'] : '';
  const requestPath = typeof parsed['path'] === 'string' ? parsed['path'] : '';
  return { timestampMs, method, requestPath };
}

/**
A tranzakció a mérési ablakba esik-e (1s tolerancia), és POST .../v1/messages hívás-e.
*/
function isMessagesRequestInWindow(
  timing: ParsedTransactionTiming,
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  if (
    Number.isNaN(timing.timestampMs) ||
    timing.timestampMs < windowStartMs - 1000 ||
    timing.timestampMs > windowEndMs + 1000
  ) {
    return false;
  }
  return timing.method === 'POST' && timing.requestPath.endsWith('/v1/messages');
}

/**
Hány POST .../v1/messages tranzakció esik a [windowStartMs, windowEndMs] ablakba, 1s tolerancia mellett.
*/
function countMessagesRequestsInWindow(artifactsDirectory: string, windowStartMs: number, windowEndMs: number): number {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDirectory);
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const timing = parseTransactionTiming(path.join(artifactsDirectory, entry));
    if (timing !== undefined && isMessagesRequestInWindow(timing, windowStartMs, windowEndMs)) {
      count += 1;
    }
  }
  return count;
}

async function runOnce(context: CaseContext, runId: string): Promise<readonly CaseRunOutcome[]> {
  const fetchTool = tool(
    'fetch_step_data',
    'Egy kulcshoz tartozó nyers adatot ad vissza, amit a process_step toolnak tovább kell adni.',
    { key: z.string() },
    (arguments_) => Promise.resolve({ content: [{ type: 'text', text: `nyers-adat-a-kulcshoz:${arguments_.key}` }] }),
  );
  const processTool = tool(
    'process_step',
    'Feldolgozza a fetch_step_data tool által visszaadott nyers adatot, és egy rövid összegzést ad.',
    { rawData: z.string() },
    (arguments_) => Promise.resolve({ content: [{ type: 'text', text: `feldolgozva: ${arguments_.rawData}` }] }),
  );
  const measureServer = createSdkMcpServer({ name: 'measure', tools: [fetchTool, processTool] });
  const base = buildBaseOptions(context);

  const startedAtMs = Date.now();
  const outcome = await executeQuery({
    ctx: context,
    caseId: 'M-38',
    runId,
    prompt:
      'Először hívd meg a mcp__measure__fetch_step_data toolt key="riport" argumentummal. ' +
      'Utána a kapott eredményt add át a mcp__measure__process_step toolnak rawData argumentumként. ' +
      'Végül egy mondatban foglald össze a végeredményt.',
    options: {
      ...base,
      maxTurns: 5,
      mcpServers: { measure: measureServer },
      allowedTools: ['mcp__measure__fetch_step_data', 'mcp__measure__process_step'],
      permissionMode: NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE,
      allowDangerouslySkipPermissions: true,
      env: { ...base.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
    },
  });
  const endedAtMs = Date.now();

  const artifactsDirectory = path.join(context.outDir, '..');
  const requestCount = countMessagesRequestsInWindow(artifactsDirectory, startedAtMs, endedAtMs);
  const durationMs = endedAtMs - startedAtMs;

  return [
    outcome,
    {
      runId: `${runId}-summary`,
      ok: true,
      note: `${String(requestCount)} POST /v1/messages kérés, ${String(durationMs)} ms időtartam`,
    },
  ];
}

export const M38: MeasurementCase = {
  id: 'M-38',
  title: 'Lépésenkénti kérésszám és időtartam -- összetett lépés (két láncolt tool hívás)',
  question: 'Task #31: kérésszám/időtartam szórása egy összetettebb agent lépésen',
  async run(context) {
    const runIds = ['a', 'b', 'c'];
    const outcomes: CaseRunOutcome[] = [];
    for (const runId of runIds) {
      // Szándékosan szekvenciális, lásd M-37.
      const result = await runOnce(context, runId);
      outcomes.push(...result);
    }
    return outcomes;
  },
};
