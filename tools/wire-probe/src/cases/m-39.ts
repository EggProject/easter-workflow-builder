/**
 * M-39: egyidejű lépések rate limitig -- konkurrencia ramp egyetlen fokozata.
 *
 * A SPEC-000 7. szekciója ("Ha a mérés alatt nem keletkezik 429-es válasz")
 * eredetileg kimondta, hogy szándékos rate limit kimerítést nem végzünk. Ez a
 * mérés (Task #31) tudatosan felülírja ezt a döntést: a cél most kifejezetten
 * annak megállapítása, hány egyidejű, önálló `query()` hívás (workflow motor
 * szintű agent lépés) fér bele a MiniMax rate limitjébe, mielőtt 429 jön.
 *
 * A `WIRE_PROBE_M39_STAGE_SIZE` env változó adja meg, hány egyidejű lépés
 * induljon ebben a fokozatban (alapértelmezés: 4). A ramp fokozatainak
 * sorozata és a leállási feltétel (első 429, vagy a sandbox memóriakorlátja)
 * a hívó bash szkript felelőssége, nem ezé a case-é -- egy fokozat egy
 * `node src/probe.ts M-39` hívás, hogy egy esetleges OOM csak azt a fokozatot
 * vigye el, a korábbi fokozatok artefaktumait ne.
 *
 * A lépés maga a lehető legegyszerűbb: `DEFAULT_PROMPT`, `maxTurns: 1`, tool
 * nélkül, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` mellett -- ez pontosan
 * egy POST /v1/messages kérést generál lépésenként (lásd M-37/M-38 mérése),
 * így az egyidejű lépésszám közvetlenül az egyidejű kérésszámmal egyezik.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CaseContext, CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringRecord(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!isRecord(value)) {
    return result;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      result[key] = entry;
    }
  }
  return result;
}

interface MessageTransactionSummary {
  readonly status: number;
  readonly responseHeaders: Readonly<Record<string, string>>;
  readonly responseBody: unknown;
  readonly fullPath: string;
}

interface ParsedTransaction {
  readonly timestampMs: number;
  readonly method: string;
  readonly requestPath: string;
  readonly responseStatus: number;
  readonly responseHeaders: unknown;
  readonly responseBody: unknown;
}

/**
Egy proxy artifacts/*.json tranzakció fájl teljes beolvasása; `undefined`, ha nem elemezhető.
*/
function parseTransaction(fullPath: string): ParsedTransaction | undefined {
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
  const responseStatus = typeof parsed['responseStatus'] === 'number' ? parsed['responseStatus'] : 0;
  return {
    timestampMs,
    method,
    requestPath,
    responseStatus,
    responseHeaders: parsed['responseHeaders'],
    responseBody: parsed['responseBody'],
  };
}

/**
A tranzakció a mérési ablakba esik-e (1s tolerancia), és POST .../v1/messages hívás-e.
*/
function isMessagesRequestInWindow(
  transaction: ParsedTransaction,
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  if (
    Number.isNaN(transaction.timestampMs) ||
    transaction.timestampMs < windowStartMs - 1000 ||
    transaction.timestampMs > windowEndMs + 1000
  ) {
    return false;
  }
  return transaction.method === 'POST' && transaction.requestPath.endsWith('/v1/messages');
}

/**
Minden POST .../v1/messages tranzakció a [windowStartMs, windowEndMs] ablakban, 1s tolerancia mellett.
*/
function readMessagesTransactionsInWindow(
  artifactsDirectory: string,
  windowStartMs: number,
  windowEndMs: number,
): readonly MessageTransactionSummary[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDirectory);
  } catch {
    return [];
  }
  const result: MessageTransactionSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const fullPath = path.join(artifactsDirectory, entry);
    const transaction = parseTransaction(fullPath);
    if (transaction === undefined || !isMessagesRequestInWindow(transaction, windowStartMs, windowEndMs)) {
      continue;
    }
    result.push({
      status: transaction.responseStatus,
      responseHeaders: toStringRecord(transaction.responseHeaders),
      responseBody: transaction.responseBody,
      fullPath,
    });
  }
  return result;
}

export const M39: MeasurementCase = {
  id: 'M-39',
  title: 'Egyidejű lépések rate limitig -- konkurrencia ramp egyetlen fokozata',
  question: 'Task #31: hány egyidejű agent lépésnél jelenik meg az első 429',
  async run(context: CaseContext) {
    const stageSize = Number(process.env['WIRE_PROBE_M39_STAGE_SIZE'] ?? 4);
    const base = buildBaseOptions(context);
    const options = {
      ...base,
      maxTurns: 1,
      env: { ...base.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
    };

    const startedAtMs = Date.now();
    const settled = await Promise.allSettled(
      Array.from({ length: stageSize }, async (_unused, index) =>
        executeQuery({
          ctx: context,
          caseId: 'M-39',
          runId: `stage${String(stageSize)}-${String(index)}`,
          prompt: DEFAULT_PROMPT,
          options,
          timeoutMs: 45_000,
        }),
      ),
    );
    const endedAtMs = Date.now();

    const outcomes: CaseRunOutcome[] = settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        runId: `stage${String(stageSize)}-${String(index)}-rejected`,
        ok: false,
        note: `promise rejected: ${String(result.reason)}`,
      };
    });

    const artifactsDirectory = path.join(context.outDir, '..');
    const transactions = readMessagesTransactionsInWindow(artifactsDirectory, startedAtMs, endedAtMs);
    const rateLimited = transactions.filter((t) => t.status === 429);

    if (rateLimited.length > 0) {
      const evidencePath = path.join(context.outDir, 'M-39', `stage-${String(stageSize)}-first-429.json`);
      writeFileSync(
        evidencePath,
        JSON.stringify(
          {
            status: rateLimited[0]?.status,
            responseHeaders: rateLimited[0]?.responseHeaders,
            responseBody: rateLimited[0]?.responseBody,
          },
          undefined,
          2,
        ),
        'utf8',
      );
    }

    const statusList = transactions.map((t) => t.status).join(',');
    outcomes.push({
      runId: `stage-${String(stageSize)}-summary`,
      ok: rateLimited.length === 0,
      note:
        `fokozat mérete: ${String(stageSize)}, ${String(transactions.length)} POST /v1/messages kérés ` +
        `${String(endedAtMs - startedAtMs)} ms alatt, státuszkódok: [${statusList}]` +
        (rateLimited.length > 0 ? ` -- 429 ESZLELVE ${String(rateLimited.length)}x` : ''),
    });

    return outcomes;
  },
};
