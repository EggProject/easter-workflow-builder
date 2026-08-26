/**
 * M-31: CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3 -- a felhasználó tényleges env
 * beállítása. Négy triviális, programozottan definiált subagentet indítunk
 * egyetlen prompttal, és megnézzük, hány egyidejű (időben átfedő) POST
 * /v1/messages kérés megy ki a proxyn a cap alatt.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

/** A proxy artifacts/*.json tranzakcióinak POST .../v1/messages időintervallumai a megadott ablakban. */
function readMessageIntervalsInWindow(artifactsDir: string, windowStartMs: number, windowEndMs: number): Interval[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDir);
  } catch {
    return [];
  }
  const result: Interval[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(artifactsDir, entry), 'utf8'));
    } catch {
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    const timestampMs = typeof parsed['timestamp'] === 'string' ? Date.parse(parsed['timestamp']) : Number.NaN;
    const durationMs = typeof parsed['durationMs'] === 'number' ? parsed['durationMs'] : 0;
    const path = typeof parsed['path'] === 'string' ? parsed['path'] : '';
    const method = typeof parsed['method'] === 'string' ? parsed['method'] : '';
    if (Number.isNaN(timestampMs) || timestampMs < windowStartMs - 1000 || timestampMs > windowEndMs + 1000) {
      continue;
    }
    if (method !== 'POST' || !path.endsWith('/v1/messages')) {
      continue;
    }
    result.push({ startMs: timestampMs, endMs: timestampMs + durationMs });
  }
  return result;
}

/** Sweep-line: a legtöbb egyidejűleg nyitva lévő intervallum száma. */
function maxOverlap(intervals: readonly Interval[]): number {
  const events: Array<[number, 1 | -1]> = [];
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
  async run(ctx: CaseContext) {
    const base = buildBaseOptions(ctx);
    const startedAtMs = Date.now();
    const outcome = await executeQuery({
      ctx,
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
    const artifactsDir = join(ctx.outDir, '..');
    const intervals = readMessageIntervalsInWindow(artifactsDir, startedAtMs, endedAtMs);
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
