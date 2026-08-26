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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const artifactsDirectory = process.env['WIRE_PROBE_ARTIFACTS_DIR'] ?? path.join(moduleDirectory, '..', 'artifacts');
const harnessDirectory = process.env['WIRE_PROBE_OUT_DIR'] ?? path.join(artifactsDirectory, 'harness');

const CRITICAL_BODY_FIELDS: readonly string[] = ['output_config', 'thinking', 'tool_choice', 'context_management'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface ProxyTransactionSummary {
  readonly timestampMs: number;
  readonly status: number;
  readonly criticalFields: readonly string[];
  readonly anthropicBeta: string | undefined;
}

/**
A requestHeaders objektumból az anthropic-beta header értékét olvassa ki, ha van.
*/
function parseAnthropicBetaHeader(requestHeaders: unknown): string | undefined {
  if (!isRecord(requestHeaders)) {
    return undefined;
  }
  let anthropicBeta: string | undefined;
  for (const [name, value] of Object.entries(requestHeaders)) {
    if (typeof value === 'string' && name.toLowerCase() === 'anthropic-beta') {
      anthropicBeta = value;
    }
  }
  return anthropicBeta;
}

/**
Egy proxy artifacts/*.json tranzakció fájl beolvasása és összefoglalása; `undefined`, ha nem elemezhető.
*/
function parseProxyTransactionFile(fullPath: string): ProxyTransactionSummary | undefined {
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
  const status = typeof parsed['responseStatus'] === 'number' ? parsed['responseStatus'] : -1;
  const requestBody = parsed['requestBody'];
  const criticalFields = isRecord(requestBody)
    ? CRITICAL_BODY_FIELDS.filter((field) => Object.hasOwn(requestBody, field))
    : [];
  const anthropicBeta = parseAnthropicBetaHeader(parsed['requestHeaders']);
  return { timestampMs, status, criticalFields, anthropicBeta };
}

/**
A proxy artifacts/*.json tranzakcióinak beolvasása (a harness alkönyvtár nélkül).
*/
function readProxyTransactions(): ProxyTransactionSummary[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDirectory);
  } catch {
    return [];
  }
  const transactions: ProxyTransactionSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const fullPath = path.join(artifactsDirectory, entry);
    if (statSync(fullPath).isDirectory()) {
      continue;
    }
    const transaction = parseProxyTransactionFile(fullPath);
    if (transaction !== undefined) {
      transactions.push(transaction);
    }
  }
  return transactions;
}

interface HarnessRunSummary {
  readonly caseId: string;
  readonly runId: string;
  readonly ok: boolean;
  readonly timedOut: boolean;
  readonly resultSubtype: string | undefined;
  readonly messageCount: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
}

/**
Egy harness <caseId>/<runId>.meta.json fájl beolvasása és összefoglalása; `undefined`, ha nem elemezhető.
*/
function parseHarnessMetaFile(
  caseId: string,
  caseDirectoryPath: string,
  fileName: string,
): HarnessRunSummary | undefined {
  if (!fileName.endsWith('.meta.json')) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path.join(caseDirectoryPath, fileName), 'utf8'));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const runId = typeof parsed['runId'] === 'string' ? parsed['runId'] : fileName;
  // A `null` és a `undefined` egyaránt "nincs harness hiba"-t jelent: a
  // runner.ts korábban `null`-t írt, a jelenlegi verzió `undefined`-et (ami
  // JSON.stringify-kor hiányzó kulcsként jelenik meg) -- mindkét alak érvényes.
  const isOk = parsed['harnessError'] === null || parsed['harnessError'] === undefined;
  const isTimedOut = parsed['timedOut'] === true;
  const resultSubtype = typeof parsed['resultSubtype'] === 'string' ? parsed['resultSubtype'] : undefined;
  const messageCount = typeof parsed['messageCount'] === 'number' ? parsed['messageCount'] : 0;
  const startedAtMs = typeof parsed['startedAt'] === 'string' ? Date.parse(parsed['startedAt']) : NaN;
  const endedAtMs = typeof parsed['endedAt'] === 'string' ? Date.parse(parsed['endedAt']) : NaN;
  return { caseId, runId, ok: isOk, timedOut: isTimedOut, resultSubtype, messageCount, startedAtMs, endedAtMs };
}

/**
A harness <caseId>/<runId>.meta.json fájljainak beolvasása.
*/
function readHarnessRuns(): HarnessRunSummary[] {
  let caseDirectories: string[];
  try {
    caseDirectories = readdirSync(harnessDirectory);
  } catch {
    return [];
  }
  const runs: HarnessRunSummary[] = [];
  for (const caseId of caseDirectories) {
    const caseDirectoryPath = path.join(harnessDirectory, caseId);
    if (!statSync(caseDirectoryPath).isDirectory()) {
      continue;
    }
    for (const fileName of readdirSync(caseDirectoryPath)) {
      const run = parseHarnessMetaFile(caseId, caseDirectoryPath, fileName);
      if (run !== undefined) {
        runs.push(run);
      }
    }
  }
  return runs;
}

function isDefined(value: string | undefined): value is string {
  return value !== undefined;
}

/**
A `timedOut` / `ok` mezőkből a rövid állapotcímke, beágyazott feltétel nélkül.
*/
function runStatusLabel(run: HarnessRunSummary): string {
  if (run.timedOut) {
    return 'TIMEOUT';
  }
  return run.ok ? 'ok' : 'HIBA';
}

function formatRunLine(run: HarnessRunSummary, transactions: readonly ProxyTransactionSummary[]): string {
  const related = transactions.filter((t) => t.timestampMs >= run.startedAtMs && t.timestampMs <= run.endedAtMs);
  const statuses = [...new Set(related.map((t) => t.status))].join(',') || 'nincs proxy tranzakció';
  const criticalSeen = [...new Set(related.flatMap((t) => t.criticalFields))].join(',') || '-';
  const betaValues = [...new Set(related.map((t) => t.anthropicBeta).filter(isDefined))].join(' | ') || '-';
  return (
    `${run.caseId}/${run.runId}: [${runStatusLabel(run)}] HTTP=${statuses} kritikus_mezők=[${criticalSeen}] ` +
    `anthropic-beta=[${betaValues}] result=${run.resultSubtype ?? '-'} ` +
    `(${String(run.messageCount)} üzenet, ${String(related.length)} proxy tranzakció)`
  );
}

function main(): void {
  const transactions = readProxyTransactions();
  const runs = readHarnessRuns();

  if (runs.length === 0) {
    console.log(`Nincs rögzített harness futás a ${harnessDirectory} alatt.`);
  } else {
    const sorted = runs.toSorted((a, b) => a.startedAtMs - b.startedAtMs);
    for (const run of sorted) {
      console.log(formatRunLine(run, transactions));
    }
  }
  console.log('---');
  console.log(`Proxy tranzakciók összesen: ${String(transactions.length)} (${artifactsDirectory})`);
}

main();
