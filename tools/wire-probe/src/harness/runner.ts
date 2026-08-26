/**
 * Közös futtató logika minden mérési eset számára: egy `query()` hívást
 * futtat le, rögzíti a teljes SDKMessage folyamot és egy meta.json-t.
 * Falóra-időkorlát AbortController-rel, retry nincs (SPEC-000 3. szekció).
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query, type Options, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { redactKnownSecrets } from '../proxy/mask.ts';
import type { CaseContext, CaseRunOutcome } from './types.ts';

const DEFAULT_TIMEOUT_MS = Number(process.env['WIRE_PROBE_TIMEOUT_MS'] ?? 60_000);

export interface ExecuteQueryParameters {
  readonly ctx: CaseContext;
  readonly caseId: string;
  readonly runId: string;
  readonly prompt: string | AsyncIterable<SDKUserMessage>;
  readonly options: Options;
  /**
  Egyedi időkorlát ehhez a futáshoz; ha nincs megadva, WIRE_PROBE_TIMEOUT_MS / 60s.
  */
  readonly timeoutMs?: number;
}

/**
 * Function-értékeket "[function]" placeholderré alakít, hogy az Options JSON-be
 * írható legyen. Emellett körkörös hivatkozásokat is placeholderré alakít: az
 * `mcpServers` mezőbe ténylegesen átadott, `createSdkMcpServer` által létrehozott
 * élő szerver objektum önmagára mutató (`root`) mezőt tartalmaz, amit a natív
 * `JSON.stringify` körkörös hivatkozásként hibával utasítana el (bug, javítva:
 * ez nem mérési eredmény, hanem a meta.json író kód hibája volt).
 */
function describeOptions(options: Options): unknown {
  const seen = new WeakSet<object>();
  return JSON.parse(
    JSON.stringify(options, (_key, value: unknown) => {
      if (typeof value === 'function') {
        return '[function]';
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[circular]';
        }
        seen.add(value);
      }
      return value;
    }),
  );
}

/**
 * Lefuttat egy `query()` hívást, és a `<outDir>/<caseId>/<runId>.sdk-messages.ndjson`
 * plusz `<outDir>/<caseId>/<runId>.meta.json` fájlokba írja az eredményt.
 * 400/429 válasz nem hiba: az a `result` üzenet subtype-jában vagy a
 * `errorMessage` mezőben jelenik meg, és a futás ennek ellenére "ok"-nak számít,
 * amíg a harness maga nem hibázott.
 */
export async function executeQuery(parameters: ExecuteQueryParameters): Promise<CaseRunOutcome> {
  const { ctx, caseId, runId, prompt, options } = parameters;
  const timeoutMs = parameters.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const caseDirectory = path.join(ctx.outDir, caseId);
  mkdirSync(caseDirectory, { recursive: true });
  const messagesPath = path.join(caseDirectory, `${runId}.sdk-messages.ndjson`);
  const metaPath = path.join(caseDirectory, `${runId}.meta.json`);
  writeFileSync(messagesPath, '', 'utf8');

  const abortController = new AbortController();
  const timer = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  const startedAt = new Date();
  let isTimedOut = false;
  let resultSubtype: string | undefined;
  let messageCount = 0;
  let harnessError: string | undefined;

  try {
    const stream = query({ prompt, options: { ...options, abortController } });
    for await (const message of stream) {
      messageCount += 1;
      appendFileSync(messagesPath, `${JSON.stringify(message)}\n`, 'utf8');
      if (message.type === 'result') {
        resultSubtype = message.subtype;
      }
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      isTimedOut = true;
    } else {
      harnessError = error instanceof Error ? error.message : String(error);
    }
  } finally {
    clearTimeout(timer);
  }

  const endedAt = new Date();
  const meta = {
    caseId,
    runId,
    sdkVersionPin: ctx.sdkVersion,
    model: options.model,
    proxyBaseUrl: ctx.proxyBaseUrl,
    proxyPort: ctx.proxyPort,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    timeoutMs,
    timedOut: isTimedOut,
    messageCount,
    resultSubtype,
    harnessError,
    options: describeOptions(options),
  };
  // A meta.json az Options.env-et is szó szerint kiírja (describeOptions), az
  // pedig a teljes process.env-et tartalmazza (buildBaseOptions) -- emiatt a
  // futtató környezet egyéb titkai (pl. GITHUB_TOKEN, GH_TOKEN a .cc-env-ből)
  // is a lemezre kerülnének a MINIMAX_API_KEY mellett, ha nem fésülnénk át.
  const otherKnownSecrets = [process.env['GITHUB_TOKEN'], process.env['GH_TOKEN']].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  const metaJson = redactKnownSecrets(JSON.stringify(meta, undefined, 2), [ctx.minimaxApiKey, ...otherKnownSecrets]);
  writeFileSync(metaPath, metaJson, 'utf8');

  const isOk = harnessError === undefined;
  let note: string;
  if (isTimedOut) {
    note = `timeout ${String(timeoutMs)}ms után megszakítva`;
  } else if (harnessError === undefined) {
    note = `result subtype: ${resultSubtype ?? 'nincs result üzenet'} (${String(messageCount)} SDKMessage)`;
  } else {
    note = `harness hiba: ${harnessError}`;
  }

  return { runId, ok: isOk, note };
}

/**
A SPEC-000 4. szekció "Közös alapbeállítása", a ctx-ből feltöltve.
*/
export function buildBaseOptions(context: CaseContext): Options {
  return {
    model: 'MiniMax-M3',
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    maxTurns: 1,
    includePartialMessages: true,
    persistSession: false,
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: context.proxyBaseUrl,
      ANTHROPIC_AUTH_TOKEN: context.minimaxApiKey,
    },
  };
}

/**
Rövid, tool nélkül megválaszolható alapprompt a SPEC-000 közös alapbeállításához.
*/
export const DEFAULT_PROMPT = 'Mennyi kettő meg kettő? Válaszolj egyetlen számjeggyel, magyarázat nélkül.';
