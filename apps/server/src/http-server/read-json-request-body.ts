import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A kérés törzsét olvassa be és JSON-ként próbálja értelmezni (SPEC-006
 * `http-server` téma, "a kérés törzs olvasás"). A bemenet `AsyncIterable<unknown>`,
 * nem `node:http` `IncomingMessage`: a Node stream async iterátora `any`
 * típusú darabokat ad, ez a szűkebb alak típusbiztosan fogadja, `as`
 * kényszerítés nélkül - a valós hívó (`create-http-server.ts`) a kérés
 * objektumot adja át, ami strukturálisan illeszkedik.
 *
 * Üres törzsre `undefined` értéket ad sikerként (SPEC-005 4.2 táblázat több
 * sora "üres törzs" kérést ír le, pl. `interruptRun`): ez nem hiba, csak
 * nincs mit értelmezni. Rosszul formázott JSON-ra `invalid_request`
 * hibaosztályú `Outcome` hibaágat ad (SPEC-006 16. elfogadási kritérium), a
 * nyers törzset a hibaüzenet NEM tartalmazza (a kérés törzse titkot is
 * hordozhat, azt nem visszhangozzuk).
 */
export async function readJsonRequestBody(source: AsyncIterable<unknown>): Promise<Outcome<unknown>> {
  const bufferChunks: Buffer[] = [];
  for await (const chunk of source) {
    if (Buffer.isBuffer(chunk)) {
      bufferChunks.push(chunk);
    }
  }
  const raw = Buffer.concat(bufferChunks).toString('utf8').trim();
  if (raw.length === 0) {
    return { kind: 'ok', value: undefined };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return { kind: 'ok', value: parsed };
  } catch {
    return { kind: 'error', message: 'A kérés törzse nem érvényes JSON (invalid_request).' };
  }
}
