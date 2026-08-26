/**
 * M-31: CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3 -- a felhasználó tényleges env
 * beállítása. Négy triviális, programozottan definiált subagentet indítunk
 * egyetlen prompttal, és megnézzük, hány egyidejű (időben átfedő) POST
 * /v1/messages kérés megy ki a proxyn a cap alatt.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { CaseContext, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';
import { NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE } from '../harness/sdk-constants.ts';

const SUBAGENT_IDS = ['echo-a', 'echo-b', 'echo-c', 'echo-d'] as const;

function buildAgents(): Record<string, AgentDefinition> {
  const agents: Record<string, AgentDefinition> = {};
  for (const id of SUBAGENT_IDS) {
    agents[id] = {
      description: `Triviális visszhang subagent, azonosító: ${id}. Csak akkor hívd, ha explicit név szerint kérik.`,
      prompt: 'Válaszolj egyetlen mondattal arra a kérdésre, amit a felhasználó feltesz. Ne hívj más toolt.',
      model: 'inherit',
    };
  }
  return agents;
}

const PROMPT =
  'Indítsd el mind a négy subagentet -- echo-a, echo-b, echo-c és echo-d -- egyetlen üzenetben, ' +
  'egyszerre, a Task toollal. Mindegyiknek add oda ugyanazt a feladatot: "Mennyi 3 meg 4? ' +
  'Válaszolj egy számjeggyel." Ne várd meg egymás után őket, egy lépésben hívd meg mind a négyet.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface Interval {
  readonly startMs: number;
  readonly endMs: number;
}

interface ParsedTransactionTiming {
  readonly timestampMs: number;
  readonly durationMs: number;
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
  const durationMs = typeof parsed['durationMs'] === 'number' ? parsed['durationMs'] : 0;
  const requestPath = typeof parsed['path'] === 'string' ? parsed['path'] : '';
  const method = typeof parsed['method'] === 'string' ? parsed['method'] : '';
  return { timestampMs, durationMs, method, requestPath };
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
A proxy artifacts/*.json tranzakcióinak POST .../v1/messages időintervallumai a megadott ablakban.
*/
function readMessageIntervalsInWindow(
  artifactsDirectory: string,
  windowStartMs: number,
  windowEndMs: number,
): Interval[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDirectory);
  } catch {
    return [];
  }
  const result: Interval[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const timing = parseTransactionTiming(path.join(artifactsDirectory, entry));
    if (timing === undefined || !isMessagesRequestInWindow(timing, windowStartMs, windowEndMs)) {
      continue;
    }
    result.push({ startMs: timing.timestampMs, endMs: timing.timestampMs + timing.durationMs });
  }
  return result;
}

/**
Sweep-line: a legtöbb egyidejűleg nyitva lévő intervallum száma.
*/
function maxOverlap(intervals: readonly Interval[]): number {
  const events: [number, 1 | -1][] = [];
  for (const iv of intervals) {
    events.push([iv.startMs, 1], [iv.endMs, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let max = 0;
  for (const [, delta] of events) {
    current += delta;
    max = Math.max(max, current);
  }
  return max;
}

export const M31: MeasurementCase = {
  id: 'M-31',
  title: 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS konkurrens subagentekkel',
  question: 'user env: CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
  async run(context: CaseContext) {
    const base = buildBaseOptions(context);
    const startedAtMs = Date.now();
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-31',
      runId: 'a',
      prompt: PROMPT,
      options: {
        ...base,
        agents: buildAgents(),
        maxTurns: 20,
        permissionMode: NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE,
        allowDangerouslySkipPermissions: true,
        env: { ...base.env, CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '3' },
      },
      timeoutMs: 3 * 60_000,
    });
    const endedAtMs = Date.now();
    const artifactsDirectory = path.join(context.outDir, '..');
    const intervals = readMessageIntervalsInWindow(artifactsDirectory, startedAtMs, endedAtMs);
    const maxConcurrent = maxOverlap(intervals);
    return [
      outcome,
      {
        runId: 'concurrency-summary',
        ok: true,
        note: `${String(intervals.length)} POST /v1/messages kérés az ablakban, legnagyobb egyidejű darabszám: ${String(maxConcurrent)}`,
      },
    ];
  },
};
