/**
 * Közös futtató logika minden mérési eset számára: egy `query()` hívást
 * futtat le, rögzíti a teljes SDKMessage folyamot és egy meta.json-t.
 * Falóra-időkorlát AbortController-rel, retry nincs (SPEC-000 3. szekció).
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { query, type Options, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { redactKnownSecrets } from '../proxy/mask.ts';
import type { CaseContext, CaseRunOutcome } from './types.ts';

const DEFAULT_TIMEOUT_MS = Number(process.env.WIRE_PROBE_TIMEOUT_MS ?? 60_000);

export interface ExecuteQueryParams {
  readonly ctx: CaseContext;
  readonly caseId: string;
  readonly runId: string;
  readonly prompt: string | AsyncIterable<SDKUserMessage>;
  readonly options: Options;
  /** Egyedi időkorlát ehhez a futáshoz; ha nincs megadva, WIRE_PROBE_TIMEOUT_MS / 60s. */
  readonly timeoutMs?: number;
}

/** Function-értékeket "[function]" placeholderré alakít, hogy az Options JSON-be írható legyen. */
function describeOptions(options: Options): unknown {
  return JSON.parse(
    JSON.stringify(options, (_key, value: unknown) => (typeof value === 'function' ? '[function]' : value)),
  );
}

/**
 * Lefuttat egy `query()` hívást, és a `<outDir>/<caseId>/<runId>.sdk-messages.ndjson`
 * plusz `<outDir>/<caseId>/<runId>.meta.json` fájlokba írja az eredményt.
 * 400/429 válasz nem hiba: az a `result` üzenet subtype-jában vagy a
 * `errorMessage` mezőben jelenik meg, és a futás ennek ellenére "ok"-nak számít,
 * amíg a harness maga nem hibázott.
 */
export async function executeQuery(params: ExecuteQueryParams): Promise<CaseRunOutcome> {
  const { ctx, caseId, runId, prompt, options } = params;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const caseDir = join(ctx.outDir, caseId);
  mkdirSync(caseDir, { recursive: true });
  const messagesPath = join(caseDir, `${runId}.sdk-messages.ndjson`);
  const metaPath = join(caseDir, `${runId}.meta.json`);
  writeFileSync(messagesPath, '', 'utf8');

  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  const startedAt = new Date();
  let timedOut = false;
  let resultSubtype: string | null = null;
  let messageCount = 0;
  let harnessError: string | null = null;

  try {
    const stream = query({ prompt, options: { ...options, abortController } });
    for await (const message of stream) {
      messageCount += 1;
      appendFileSync(messagesPath, `${JSON.stringify(message)}\n`, 'utf8');
      if (message.type === 'result') {
        resultSubtype = message.subtype;
      }
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      timedOut = true;
    } else {
      harnessError = err instanceof Error ? err.message : String(err);
    }
  } finally {
    clearTimeout(timer);
  }

  const endedAt = new Date();
  const meta = {
    caseId,
    runId,
    sdkVersionPin: ctx.sdkVersion,
    model: options.model ?? null,
    proxyBaseUrl: ctx.proxyBaseUrl,
    proxyPort: ctx.proxyPort,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    timeoutMs,
    timedOut,
    messageCount,
    resultSubtype,
    harnessError,
    options: describeOptions(options),
  };
  const metaJson = redactKnownSecrets(JSON.stringify(meta, null, 2), [ctx.minimaxApiKey]);
  writeFileSync(metaPath, metaJson, 'utf8');

  const ok = harnessError === null;
  const note = timedOut
    ? `timeout ${String(timeoutMs)}ms után megszakítva`
    : harnessError !== null
      ? `harness hiba: ${harnessError}`
      : `result subtype: ${resultSubtype ?? 'nincs result üzenet'} (${String(messageCount)} SDKMessage)`;

  return { runId, ok, note };
}

/** A SPEC-000 4. szekció "Közös alapbeállítása", a ctx-ből feltöltve. */
export function buildBaseOptions(ctx: CaseContext): Options {
  return {
    model: 'MiniMax-M3',
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    maxTurns: 1,
    includePartialMessages: true,
    persistSession: false,
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: ctx.proxyBaseUrl,
      ANTHROPIC_AUTH_TOKEN: ctx.minimaxApiKey,
    },
  };
}

/** Rövid, tool nélkül megválaszolható alapprompt a SPEC-000 közös alapbeállításához. */
export const DEFAULT_PROMPT = 'Mennyi kettő meg kettő? Válaszolj egyetlen számjeggyel, magyarázat nélkül.';
