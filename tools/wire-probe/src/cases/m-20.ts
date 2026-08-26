/**
 * M-20: a kontextusablak szerver oldali felső korlátja bináris kereséssel --
 * Q11 szerver oldali fele (nyitva maradt kérdés, kiértékelés 3. szekció 2.
 * pont). Ez a legdrágább eset: legfeljebb 8 kérés, minimális kimenő
 * max_tokens (CLAUDE_CODE_MAX_OUTPUT_TOKENS env), hogy a költséget a bemenet
 * mérete uralja, ne a kimenet.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CaseContext, CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

/**
Legfeljebb ennyi kérést küldünk -- a feladatleírás szerinti kemény korlát.
*/
const MAX_REQUESTS = 8;
/**
 * A futtatókörnyezet egyetlen bash hívása korlátozott fali idejű -- egy nagy
 * (100K+ tokenes) kérés kiszolgálása több tíz másodperc is lehet, ezért a
 * bináris keresés állapotát lemezre írjuk, és egy invokáláson belül csak
 * addig folytatjuk, amíg ez a büdzsé engedi. A hívó (a mérési munkamenet)
 * több egymást követő `bun run probe M-20` hívással viheti tovább.
 */
const PER_INVOCATION_BUDGET_MS = 100_000;
/**
 * Kiinduló becslés kb. 150 000 tokenre, ~4 karakter/token közelítéssel. Ez
 * csak a payload MÉRETEZÉSÉHEZ kell (a tényleges token szám a válasz
 * usage.input_tokens mezőjéből jön minden lépés után), nem mérési állítás.
 */
const CHARS_PER_TOKEN_ESTIMATE = 4;
const INITIAL_TARGET_CHARS = 150_000 * CHARS_PER_TOKEN_ESTIMATE;
/**
Ha a sikeres/hibás határ ennél szűkebb karakterre szűkül, nem érdemes több kérést elkölteni.
*/
const CONVERGED_THRESHOLD_CHARS = 4000;
/**
 * A kimenő max_tokens minimális legyen, hogy az input domináljon a
 * költségben (a case saját döntése). FONTOS, méréssel felfedezett korlát:
 * 16-nál a CLI a levágott választ hibaként kezeli ("response exceeded the
 * output token maximum") és a TELJES kérést -- a nagy töltelék prompttal
 * együtt -- újraküldi, akár 4x is egyetlen probe alatt. 256 elég a rövid
 * "OK" válasznak a levágás nélkül, így nem indul retry-vihar.
 */
const MINIMAL_MAX_OUTPUT_TOKENS = '256';

const FILLER_PHRASE = 'wire-probe kontextusablak méréshez töltelék szöveg, ismétlődő tartalommal. ';

function buildFillerPrompt(targetChars: number): string {
  const repeatCount = Math.ceil(targetChars / FILLER_PHRASE.length);
  const filler = FILLER_PHRASE.repeat(repeatCount).slice(0, targetChars);
  return `${filler}\n\nA fenti szöveg töltelék, hagyd figyelmen kívül. Válaszolj pontosan ezzel az egy szóval: OK`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface RunWindow {
  readonly startedAtMs: number;
  readonly endedAtMs: number;
}

/**
A runner.ts által az executeQuery végén már lemezre írt meta.json startedAt/endedAt mezői.
*/
function readRunWindow(context: CaseContext, caseId: string, runId: string): RunWindow {
  const metaPath = path.join(context.outDir, caseId, `${runId}.meta.json`);
  const parsed: unknown = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (!isRecord(parsed) || typeof parsed['startedAt'] !== 'string' || typeof parsed['endedAt'] !== 'string') {
    throw new Error(`Váratlan meta.json alak: ${metaPath}`);
  }
  return { startedAtMs: Date.parse(parsed['startedAt']), endedAtMs: Date.parse(parsed['endedAt']) };
}

interface ProxyTransactionLite {
  readonly status: number;
  readonly inputTokens: number | undefined;
}

/**
Egy SSE `data:` sor JSON-ra parszolva, ha érvényes; `undefined`, ha nem.
*/
function parseStreamEventData(event: unknown): Record<string, unknown> | undefined {
  if (!isRecord(event) || typeof event['raw'] !== 'string' || !event['raw'].startsWith('data:')) {
    return undefined;
  }
  try {
    const data: unknown = JSON.parse(event['raw'].slice('data:'.length).trim());
    return isRecord(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

/**
A pozitív usage.input_tokens kiolvasása egy SSE `data:` esemény törzséből, akár a legfelső, akár a `message` mezőn keresztül.
*/
function extractPositiveInputTokensFromStreamData(data: Record<string, unknown>): number | undefined {
  if (
    isRecord(data['usage']) &&
    typeof data['usage']['input_tokens'] === 'number' &&
    data['usage']['input_tokens'] > 0
  ) {
    return data['usage']['input_tokens'];
  }
  if (
    isRecord(data['message']) &&
    isRecord(data['message']['usage']) &&
    typeof data['message']['usage']['input_tokens'] === 'number' &&
    data['message']['usage']['input_tokens'] > 0
  ) {
    return data['message']['usage']['input_tokens'];
  }
  return undefined;
}

/**
 * A usage.input_tokens kiolvasása egy nem-stream válasz törzséből vagy a
 * stream SSE sorokból. Méréssel megállapítva (M-20 saját ellenőrzés): a
 * `message_start.message.usage.input_tokens` MiniMax ellen mindig 0
 * (helyőrző), a valós érték a záró `message_delta.usage.input_tokens`
 * mezőben jelenik meg -- ezt a mintát az M-15 is megerősítette.
 */
function extractInputTokens(responseBody: unknown, streamEvents: unknown): number | undefined {
  if (
    isRecord(responseBody) &&
    isRecord(responseBody['usage']) &&
    typeof responseBody['usage']['input_tokens'] === 'number'
  ) {
    return responseBody['usage']['input_tokens'];
  }
  if (!Array.isArray(streamEvents)) {
    return undefined;
  }
  let found: number | undefined;
  for (const event of streamEvents) {
    const data = parseStreamEventData(event);
    if (data === undefined) {
      continue;
    }
    found = extractPositiveInputTokensFromStreamData(data) ?? found;
  }
  return found;
}

interface ParsedMessagesTransaction {
  readonly timestampMs: number;
  readonly method: string;
  readonly requestPath: string;
  readonly status: number;
  readonly inputTokens: number | undefined;
}

/**
Egy proxy artifacts/*.json tranzakció fájl beolvasása; `undefined`, ha nem elemezhető.
*/
function parseMessagesTransactionFile(fullPath: string): ParsedMessagesTransaction | undefined {
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
  const requestPath = typeof parsed['path'] === 'string' ? parsed['path'] : '';
  const method = typeof parsed['method'] === 'string' ? parsed['method'] : '';
  const status = typeof parsed['responseStatus'] === 'number' ? parsed['responseStatus'] : -1;
  const inputTokens = extractInputTokens(parsed['responseBody'], parsed['streamEvents']);
  return { timestampMs, method, requestPath, status, inputTokens };
}

/**
A tranzakció a megadott mérési ablakba esik-e (1s tolerancia), és POST .../v1/messages hívás-e.
*/
function isMessagesRequestInWindow(transaction: ParsedMessagesTransaction, window: RunWindow): boolean {
  if (
    Number.isNaN(transaction.timestampMs) ||
    transaction.timestampMs < window.startedAtMs - 1000 ||
    transaction.timestampMs > window.endedAtMs + 1000
  ) {
    return false;
  }
  return transaction.method === 'POST' && transaction.requestPath.endsWith('/v1/messages');
}

/**
A proxy artifacts/*.json tranzakciói közül a POST .../v1/messages kérések, amik a megadott időablakban érkeztek.
*/
function readMessagesTransactionsInWindow(artifactsDirectory: string, window: RunWindow): ProxyTransactionLite[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDirectory);
  } catch {
    return [];
  }
  const result: ProxyTransactionLite[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const transaction = parseMessagesTransactionFile(path.join(artifactsDirectory, entry));
    if (transaction === undefined || !isMessagesRequestInWindow(transaction, window)) {
      continue;
    }
    result.push({ status: transaction.status, inputTokens: transaction.inputTokens });
  }
  return result;
}

interface SearchState {
  readonly requestsDone: number;
  readonly lowSuccessChars: number;
  readonly lowSuccessTokens: number | null;
  readonly highFailChars: number | null;
  readonly firstFailStatus: number | null;
  readonly targetChars: number;
  readonly converged: boolean;
}

// A harom `null` mezo a `search-state.json` lemezre irt, korabbi futasok kozott
// megmarado allapot resze: a `loadState` beolvaso ellenorzese (lentebb) explicit
// `=== null`-t var, ha meg nincs meghatarozott ertek, tehat ez a "nincs meg
// meghatarozva" szandekos, tipusosan ertelmezett jelolese, nem placeholder.
/* eslint-disable unicorn/no-null -- lasd a SearchState mezok dokumentaciojat feljebb */
const INITIAL_STATE: SearchState = {
  requestsDone: 0,
  lowSuccessChars: 0,
  lowSuccessTokens: null,
  highFailChars: null,
  firstFailStatus: null,
  targetChars: INITIAL_TARGET_CHARS,
  converged: false,
};
/* eslint-enable unicorn/no-null */

function stateFilePath(context: CaseContext): string {
  return path.join(context.outDir, 'M-20', 'search-state.json');
}

/**
Az előző invokálás állapota, ha volt -- híján a friss kiindulás.
*/
function loadState(context: CaseContext): SearchState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(stateFilePath(context), 'utf8'));
    if (
      isRecord(parsed) &&
      typeof parsed['requestsDone'] === 'number' &&
      typeof parsed['lowSuccessChars'] === 'number' &&
      (typeof parsed['lowSuccessTokens'] === 'number' || parsed['lowSuccessTokens'] === null) &&
      (typeof parsed['highFailChars'] === 'number' || parsed['highFailChars'] === null) &&
      (typeof parsed['firstFailStatus'] === 'number' || parsed['firstFailStatus'] === null) &&
      typeof parsed['targetChars'] === 'number' &&
      typeof parsed['converged'] === 'boolean'
    ) {
      return {
        requestsDone: parsed['requestsDone'],
        lowSuccessChars: parsed['lowSuccessChars'],
        lowSuccessTokens: parsed['lowSuccessTokens'],
        highFailChars: parsed['highFailChars'],
        firstFailStatus: parsed['firstFailStatus'],
        targetChars: parsed['targetChars'],
        converged: parsed['converged'],
      };
    }
  } catch {
    // nincs korábbi állapot, friss kiindulás
  }
  return INITIAL_STATE;
}

function saveState(context: CaseContext, state: SearchState): void {
  const directory = path.join(context.outDir, 'M-20');
  mkdirSync(directory, { recursive: true });
  writeFileSync(stateFilePath(context), JSON.stringify(state, undefined, 2), 'utf8');
}

/**
 * Egy próba (`targetChars` méretű kérés) eredményéből számolja a bináris
 * keresés következő állapotát: sikeres próbánál az alsó határt tolja fel,
 * hibásnál a felső határt tolja le, és eldönti, konvergált-e.
 */
function computeNextState(
  state: SearchState,
  requestIndex: number,
  targetChars: number,
  isSuccess: boolean,
  status: number | null,
  maxInputTokens: number | undefined,
): SearchState {
  let { lowSuccessChars, lowSuccessTokens, highFailChars, firstFailStatus } = state;
  let nextTargetChars: number;
  if (isSuccess) {
    lowSuccessChars = targetChars;
    lowSuccessTokens = maxInputTokens ?? lowSuccessTokens;
    nextTargetChars = highFailChars === null ? targetChars * 2 : Math.floor((targetChars + highFailChars) / 2);
  } else {
    firstFailStatus ??= status;
    highFailChars = targetChars;
    nextTargetChars =
      lowSuccessChars === 0 ? Math.floor(targetChars / 2) : Math.floor((lowSuccessChars + targetChars) / 2);
  }
  const isConverged =
    highFailChars !== null && lowSuccessChars > 0 && highFailChars - lowSuccessChars < CONVERGED_THRESHOLD_CHARS;

  return {
    requestsDone: requestIndex,
    lowSuccessChars,
    lowSuccessTokens,
    highFailChars,
    firstFailStatus,
    targetChars: nextTargetChars,
    converged: isConverged,
  };
}

export const M20: MeasurementCase = {
  id: 'M-20',
  title: 'Kontextusablak felső korlátja bináris kereséssel',
  question: 'Q11 szerver oldali fele (nyitva maradt kérdés, kiértékelés 3. szekció 2. pont)',
  async run(context) {
    const artifactsDirectory = path.join(context.outDir, '..');
    const base = buildBaseOptions(context);
    const options = {
      ...base,
      // [1m] suffix, hogy a kliens oldali 200K-s feltételezett kontextusablak
      // ne akadályozza a nagy prompt tényleges kiküldését (Q9 mérés szerint a
      // suffix nem jelenik meg a dróton, csak a kliens oldali tervezést hatja).
      model: 'MiniMax-M3[1m]',
      env: { ...base.env, CLAUDE_CODE_MAX_OUTPUT_TOKENS: MINIMAL_MAX_OUTPUT_TOKENS },
    };

    const outcomes: CaseRunOutcome[] = [];
    let state = loadState(context);
    const invocationStartedMs = Date.now();

    while (
      state.requestsDone < MAX_REQUESTS &&
      !state.converged &&
      Date.now() - invocationStartedMs < PER_INVOCATION_BUDGET_MS
    ) {
      const requestIndex = state.requestsDone + 1;
      const targetChars = state.targetChars;
      const runId = `probe-${String(requestIndex)}-chars${String(targetChars)}`;
      const outcome = await executeQuery({
        ctx: context,
        caseId: 'M-20',
        runId,
        prompt: buildFillerPrompt(targetChars),
        options,
        timeoutMs: 90_000,
      });
      const window = readRunWindow(context, 'M-20', runId);
      const transactions = readMessagesTransactionsInWindow(artifactsDirectory, window);
      const failed = transactions.find((t) => t.status !== 200);
      const isSuccess = transactions.length > 0 && failed === undefined;
      // A `status` a SearchState.firstFailStatus mezobe kerulhet (lentebb),
      // aminek a lemezre irt allapot-kontraktusa `number | null`.
      // eslint-disable-next-line unicorn/no-null -- lasd a SearchState mezok dokumentaciojat
      const status = failed === undefined ? (transactions[0]?.status ?? null) : failed.status;
      let maxInputTokens: number | undefined;
      for (const t of transactions) {
        if (t.inputTokens !== undefined && (maxInputTokens === undefined || t.inputTokens > maxInputTokens)) {
          maxInputTokens = t.inputTokens;
        }
      }

      outcomes.push({
        runId: outcome.runId,
        ok: outcome.ok,
        note: `${outcome.note}; targetChars=${String(targetChars)}; httpStatus=${String(status)}; measuredInputTokens=${String(maxInputTokens)}`,
      });

      state = computeNextState(state, requestIndex, targetChars, isSuccess, status, maxInputTokens);
      saveState(context, state);
    }

    if (state.requestsDone >= MAX_REQUESTS || state.converged) {
      outcomes.push({
        runId: 'summary',
        ok: true,
        note: `legnagyobb sikeres usage.input_tokens=${String(state.lowSuccessTokens)}; első hibás kérés HTTP státusz=${String(state.firstFailStatus)}; kérések összesen=${String(state.requestsDone)}; konvergált=${String(state.converged)}`,
      });
    } else {
      outcomes.push({
        runId: 'partial',
        ok: true,
        note: `az invokáláson belüli fali idő büdzsé (${String(PER_INVOCATION_BUDGET_MS)}ms) elfogyott, ${String(state.requestsDone)}/${String(MAX_REQUESTS)} kérés kész -- futtasd újra a case-t a folytatáshoz`,
      });
    }

    return outcomes;
  },
};
