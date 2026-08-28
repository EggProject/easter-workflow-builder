/**
 * M-37: lépésenkénti kérésszám és időtartam -- egyszerű lépés (egy tool hívás).
 *
 * A `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` a `minimax` provider végleges,
 * kötelező env blokkjának tagja
 * (`packages/provider-minimax/src/environment/required-environment.ts`), ezért ez
 * a mérés is ezzel fut: a mért kérésszám a termékben ténylegesen kimenő
 * kérésszámot tükrözi, nem a cím generáló háttérkéréssel megnövelt SPEC-000
 * alapbeállítást.
 *
 * A "lépés" itt egy workflow motor szintű agent lépést jelent: egyetlen `query()`
 * hívás, ami pontosan egy in-process tool hívást kényszerít ki, majd lezár.
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
  const echoTool = tool(
    'echo_value',
    'Visszaadja a kapott értéket, változatlanul.',
    { value: z.string() },
    (arguments_) => Promise.resolve({ content: [{ type: 'text', text: arguments_.value }] }),
  );
  const measureServer = createSdkMcpServer({ name: 'measure', tools: [echoTool] });
  const base = buildBaseOptions(context);

  const startedAtMs = Date.now();
  const outcome = await executeQuery({
    ctx: context,
    caseId: 'M-37',
    runId,
    prompt:
      'Hívd meg a mcp__measure__echo_value toolt value="alma" argumentummal, majd írd le egy szóban az eredményt.',
    options: {
      ...base,
      maxTurns: 3,
      mcpServers: { measure: measureServer },
      allowedTools: ['mcp__measure__echo_value'],
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

export const M37: MeasurementCase = {
  id: 'M-37',
  title: 'Lépésenkénti kérésszám és időtartam -- egyszerű lépés (egy tool hívás)',
  question: 'Task #31: hány kérést generál egy tipikus, egy tool hívást tartalmazó agent lépés',
  async run(context) {
    const runIds = ['a', 'b', 'c'];
    const outcomes: CaseRunOutcome[] = [];
    for (const runId of runIds) {
      // Szándékosan szekvenciális: ez a kérésszám/időtartam alapmérés, nem a
      // konkurrencia mérés (az M-39 feladata).
      const result = await runOnce(context, runId);
      outcomes.push(...result);
    }
    return outcomes;
  },
};
