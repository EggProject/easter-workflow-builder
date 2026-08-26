/**
 * Token-takarékos összefoglaló a mérési artefaktumokból. Esetenként egy sor:
 * lefutott-e, mi volt a HTTP státusz, kimentek-e a kritikus body mezők, és mi
 * volt a result message subtype. Nyers JSON tartalmat sosem ír ki.
 *
 * A per-eset HTTP-szintű adatok (státusz, kritikus mezők, anthropic-beta) a
 * proxy `artifacts/*.json` tranzakcióiból jönnek, időablak-korrelációval: egy
 * tranzakció ahhoz a harness futáshoz tartozik, aminek [startedAt, endedAt]
 * intervallumába esik az időbélyege.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const artifactsDir = process.env['WIRE_PROBE_ARTIFACTS_DIR'] ?? join(moduleDir, '..', 'artifacts');
const harnessDir = process.env['WIRE_PROBE_OUT_DIR'] ?? join(artifactsDir, 'harness');

const CRITICAL_BODY_FIELDS: readonly string[] = ['output_config', 'thinking', 'tool_choice', 'context_management'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface ProxyTransactionSummary {
  readonly timestampMs: number;
  readonly status: number;
  readonly criticalFields: readonly string[];
  readonly anthropicBeta: string | null;
}

/** A proxy artifacts/*.json tranzakcióinak beolvasása (a harness alkönyvtár nélkül). */
function readProxyTransactions(): ProxyTransactionSummary[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDir);
  } catch {
    return [];
  }
  const transactions: ProxyTransactionSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const fullPath = join(artifactsDir, entry);
    if (statSync(fullPath).isDirectory()) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch {
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    const timestampMs = typeof parsed['timestamp'] === 'string' ? Date.parse(parsed['timestamp']) : Number.NaN;
    const status = typeof parsed['responseStatus'] === 'number' ? parsed['responseStatus'] : -1;
    const requestBody = parsed['requestBody'];
    const criticalFields = isRecord(requestBody)
      ? CRITICAL_BODY_FIELDS.filter((field) => field in requestBody)
      : [];
    const requestHeaders = parsed['requestHeaders'];
    let anthropicBeta: string | null = null;
    if (isRecord(requestHeaders)) {
      for (const [name, value] of Object.entries(requestHeaders)) {
        if (name.toLowerCase() === 'anthropic-beta' && typeof value === 'string') {
          anthropicBeta = value;
        }
      }
    }
    transactions.push({ timestampMs, status, criticalFields, anthropicBeta });
  }
  return transactions;
}

interface HarnessRunSummary {
  readonly caseId: string;
  readonly runId: string;
  readonly ok: boolean;
  readonly timedOut: boolean;
  readonly resultSubtype: string | null;
  readonly messageCount: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
}

/** A harness <caseId>/<runId>.meta.json fájljainak beolvasása. */
function readHarnessRuns(): HarnessRunSummary[] {
  let caseDirs: string[];
  try {
    caseDirs = readdirSync(harnessDir);
  } catch {
    return [];
  }
  const runs: HarnessRunSummary[] = [];
  for (const caseId of caseDirs) {
    const caseDirPath = join(harnessDir, caseId);
    if (!statSync(caseDirPath).isDirectory()) {
      continue;
    }
    for (const fileName of readdirSync(caseDirPath)) {
      if (!fileName.endsWith('.meta.json')) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(join(caseDirPath, fileName), 'utf8'));
      } catch {
        continue;
      }
      if (!isRecord(parsed)) {
        continue;
      }
      const runId = typeof parsed['runId'] === 'string' ? parsed['runId'] : fileName;
      const ok = parsed['harnessError'] === null || parsed['harnessError'] === undefined;
      const timedOut = parsed['timedOut'] === true;
      const resultSubtype = typeof parsed['resultSubtype'] === 'string' ? parsed['resultSubtype'] : null;
      const messageCount = typeof parsed['messageCount'] === 'number' ? parsed['messageCount'] : 0;
      const startedAtMs = typeof parsed['startedAt'] === 'string' ? Date.parse(parsed['startedAt']) : Number.NaN;
      const endedAtMs = typeof parsed['endedAt'] === 'string' ? Date.parse(parsed['endedAt']) : Number.NaN;
      runs.push({ caseId, runId, ok, timedOut, resultSubtype, messageCount, startedAtMs, endedAtMs });
    }
  }
  return runs;
}

function isNonNull(value: string | null): value is string {
  return value !== null;
}

function formatRunLine(run: HarnessRunSummary, transactions: readonly ProxyTransactionSummary[]): string {
  const related = transactions.filter((t) => t.timestampMs >= run.startedAtMs && t.timestampMs <= run.endedAtMs);
  const statuses = [...new Set(related.map((t) => t.status))].join(',') || 'nincs proxy tranzakció';
  const criticalSeen = [...new Set(related.flatMap((t) => t.criticalFields))].join(',') || '-';
  const betaValues = [...new Set(related.map((t) => t.anthropicBeta).filter(isNonNull))].join(' | ') || '-';
  const okLabel = run.timedOut ? 'TIMEOUT' : run.ok ? 'ok' : 'HIBA';
  return (
    `${run.caseId}/${run.runId}: [${okLabel}] HTTP=${statuses} kritikus_mezők=[${criticalSeen}] ` +
    `anthropic-beta=[${betaValues}] result=${run.resultSubtype ?? '-'} ` +
    `(${String(run.messageCount)} üzenet, ${String(related.length)} proxy tranzakció)`
  );
}

function main(): void {
  const transactions = readProxyTransactions();
  const runs = readHarnessRuns();

  if (runs.length === 0) {
    console.log(`Nincs rögzített harness futás a ${harnessDir} alatt.`);
  } else {
    const sorted = [...runs].sort((a, b) => a.startedAtMs - b.startedAtMs);
    for (const run of sorted) {
      console.log(formatRunLine(run, transactions));
    }
  }
  console.log('---');
  console.log(`Proxy tranzakciók összesen: ${String(transactions.length)} (${artifactsDir})`);
}

main();
