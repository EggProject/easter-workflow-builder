/**
 * M-20: a kontextusablak szerver oldali felső korlátja bináris kereséssel --
 * Q11 szerver oldali fele (nyitva maradt kérdés, kiértékelés 3. szekció 2.
 * pont). Ez a legdrágább eset: legfeljebb 8 kérés, minimális kimenő
 * max_tokens (CLAUDE_CODE_MAX_OUTPUT_TOKENS env), hogy a költséget a bemenet
 * mérete uralja, ne a kimenet.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseContext, CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

/** Legfeljebb ennyi kérést küldünk -- a feladatleírás szerinti kemény korlát. */
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
/** Ha a sikeres/hibás határ ennél szűkebb karakterre szűkül, nem érdemes több kérést elkölteni. */
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

/** A runner.ts által az executeQuery végén már lemezre írt meta.json startedAt/endedAt mezői. */
function readRunWindow(ctx: CaseContext, caseId: string, runId: string): RunWindow {
  const metaPath = join(ctx.outDir, caseId, `${runId}.meta.json`);
  const parsed: unknown = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (!isRecord(parsed) || typeof parsed.startedAt !== 'string' || typeof parsed.endedAt !== 'string') {
    throw new Error(`Váratlan meta.json alak: ${metaPath}`);
  }
  return { startedAtMs: Date.parse(parsed.startedAt), endedAtMs: Date.parse(parsed.endedAt) };
}

interface ProxyTransactionLite {
  readonly status: number;
  readonly inputTokens: number | null;
}

/**
 * A usage.input_tokens kiolvasása egy nem-stream válasz törzséből vagy a
 * stream SSE sorokból. Méréssel megállapítva (M-20 saját ellenőrzés): a
 * `message_start.message.usage.input_tokens` MiniMax ellen mindig 0
 * (helyőrző), a valós érték a záró `message_delta.usage.input_tokens`
 * mezőben jelenik meg -- ezt a mintát az M-15 is megerősítette.
 */
function extractInputTokens(responseBody: unknown, streamEvents: unknown): number | null {
  if (isRecord(responseBody) && isRecord(responseBody.usage) && typeof responseBody.usage.input_tokens === 'number') {
    return responseBody.usage.input_tokens;
  }
  if (!Array.isArray(streamEvents)) {
    return null;
  }
  let found: number | null = null;
  for (const ev of streamEvents) {
    if (!isRecord(ev) || typeof ev.raw !== 'string' || !ev.raw.startsWith('data:')) {
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(ev.raw.slice('data:'.length).trim());
    } catch {
      continue;
    }
    if (!isRecord(data)) {
      continue;
    }
    if (isRecord(data.usage) && typeof data.usage.input_tokens === 'number' && data.usage.input_tokens > 0) {
      found = data.usage.input_tokens;
    } else if (
      isRecord(data.message) &&
      isRecord(data.message.usage) &&
      typeof data.message.usage.input_tokens === 'number' &&
      data.message.usage.input_tokens > 0
    ) {
      found = data.message.usage.input_tokens;
    }
  }
  return found;
}

/** A proxy artifacts/*.json tranzakciói közül a POST .../v1/messages kérések, amik a megadott időablakban érkeztek. */
function readMessagesTransactionsInWindow(artifactsDir: string, window: RunWindow): ProxyTransactionLite[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsDir);
  } catch {
    return [];
  }
  const result: ProxyTransactionLite[] = [];
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
    const timestampMs = typeof parsed.timestamp === 'string' ? Date.parse(parsed.timestamp) : Number.NaN;
    const path = typeof parsed.path === 'string' ? parsed.path : '';
    const method = typeof parsed.method === 'string' ? parsed.method : '';
    if (
      Number.isNaN(timestampMs) ||
      timestampMs < window.startedAtMs - 1000 ||
      timestampMs > window.endedAtMs + 1000 ||
      method !== 'POST' ||
      !path.endsWith('/v1/messages')
    ) {
      continue;
    }
    const status = typeof parsed.responseStatus === 'number' ? parsed.responseStatus : -1;
    const inputTokens = extractInputTokens(parsed.responseBody, parsed.streamEvents);
    result.push({ status, inputTokens });
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

const INITIAL_STATE: SearchState = {
  requestsDone: 0,
  lowSuccessChars: 0,
  lowSuccessTokens: null,
  highFailChars: null,
  firstFailStatus: null,
  targetChars: INITIAL_TARGET_CHARS,
  converged: false,
};

function stateFilePath(ctx: CaseContext): string {
  return join(ctx.outDir, 'M-20', 'search-state.json');
}

/** Az előző invokálás állapota, ha volt -- híján a friss kiindulás. */
function loadState(ctx: CaseContext): SearchState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(stateFilePath(ctx), 'utf8'));
    if (
      isRecord(parsed) &&
      typeof parsed.requestsDone === 'number' &&
      typeof parsed.lowSuccessChars === 'number' &&
      (typeof parsed.lowSuccessTokens === 'number' || parsed.lowSuccessTokens === null) &&
      (typeof parsed.highFailChars === 'number' || parsed.highFailChars === null) &&
      (typeof parsed.firstFailStatus === 'number' || parsed.firstFailStatus === null) &&
      typeof parsed.targetChars === 'number' &&
      typeof parsed.converged === 'boolean'
    ) {
      return {
        requestsDone: parsed.requestsDone,
        lowSuccessChars: parsed.lowSuccessChars,
        lowSuccessTokens: parsed.lowSuccessTokens,
        highFailChars: parsed.highFailChars,
        firstFailStatus: parsed.firstFailStatus,
        targetChars: parsed.targetChars,
        converged: parsed.converged,
      };
    }
  } catch {
    // nincs korábbi állapot, friss kiindulás
  }
  return INITIAL_STATE;
}

function saveState(ctx: CaseContext, state: SearchState): void {
  const dir = join(ctx.outDir, 'M-20');
  mkdirSync(dir, { recursive: true });
  writeFileSync(stateFilePath(ctx), JSON.stringify(state, null, 2), 'utf8');
}

export const M20: MeasurementCase = {
  id: 'M-20',
  title: 'Kontextusablak felső korlátja bináris kereséssel',
  question: 'Q11 szerver oldali fele (nyitva maradt kérdés, kiértékelés 3. szekció 2. pont)',
  async run(ctx) {
    const artifactsDir = join(ctx.outDir, '..');
    const base = buildBaseOptions(ctx);
    const options = {
      ...base,
      // [1m] suffix, hogy a kliens oldali 200K-s feltételezett kontextusablak
      // ne akadályozza a nagy prompt tényleges kiküldését (Q9 mérés szerint a
      // suffix nem jelenik meg a dróton, csak a kliens oldali tervezést hatja).
      model: 'MiniMax-M3[1m]',
      env: { ...base.env, CLAUDE_CODE_MAX_OUTPUT_TOKENS: MINIMAL_MAX_OUTPUT_TOKENS },
    };

    const outcomes: CaseRunOutcome[] = [];
    let state = loadState(ctx);
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
        ctx,
        caseId: 'M-20',
        runId,
        prompt: buildFillerPrompt(targetChars),
        options,
        timeoutMs: 90_000,
      });
      const window = readRunWindow(ctx, 'M-20', runId);
      const transactions = readMessagesTransactionsInWindow(artifactsDir, window);
      const failed = transactions.find((t) => t.status !== 200);
      const success = transactions.length > 0 && failed === undefined;
      const status = failed !== undefined ? failed.status : (transactions[0]?.status ?? null);
      const maxInputTokens = transactions.reduce<number | null>(
        (acc, t) => (t.inputTokens !== null && (acc === null || t.inputTokens > acc) ? t.inputTokens : acc),
        null,
      );

      outcomes.push({
        runId: outcome.runId,
        ok: outcome.ok,
        note: `${outcome.note}; targetChars=${String(targetChars)}; httpStatus=${String(status)}; measuredInputTokens=${String(maxInputTokens)}`,
      });

      let { lowSuccessChars, lowSuccessTokens, highFailChars, firstFailStatus } = state;
      let nextTargetChars: number;
      if (success) {
        lowSuccessChars = targetChars;
        lowSuccessTokens = maxInputTokens ?? lowSuccessTokens;
        nextTargetChars = highFailChars === null ? targetChars * 2 : Math.floor((targetChars + highFailChars) / 2);
      } else {
        if (firstFailStatus === null) {
          firstFailStatus = status;
        }
        highFailChars = targetChars;
        nextTargetChars = lowSuccessChars === 0 ? Math.floor(targetChars / 2) : Math.floor((lowSuccessChars + targetChars) / 2);
      }
      const converged = highFailChars !== null && lowSuccessChars > 0 && highFailChars - lowSuccessChars < CONVERGED_THRESHOLD_CHARS;

      state = {
        requestsDone: requestIndex,
        lowSuccessChars,
        lowSuccessTokens,
        highFailChars,
        firstFailStatus,
        targetChars: nextTargetChars,
        converged,
      };
      saveState(ctx, state);
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
