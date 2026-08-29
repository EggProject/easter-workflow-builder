/**
 * A `node:http` `IncomingMessage.url`/`.method` mezője a Node típusdefiníciója
 * szerint `string | undefined`, jóllehet a szabályos `'request'` esemény
 * kezelőjében (amit a `createHttpServer` regisztrál, `CONNECT` metódusra
 * `'connect'` esemény jönne, nem `'request'`) mindkettő mindig kitöltött
 * string. Ez a függvény önmagában, közvetlen egységteszttel bizonyítja mindkét
 * `undefined` ágat, hogy a hívó oldalon (`create-http-server.ts`) egyetlen,
 * elágazás nélküli függvényhívás maradjon - a 100 százalékos, kizárás
 * nélküli lefedettségi küszöb miatt (`.claude/CLAUDE.md` 5. szekció).
 */
export interface NormalizedRequest {
  readonly method: string;
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
}

export function normalizeIncomingRequest(url: string | undefined, method: string | undefined): NormalizedRequest {
  const parsedUrl = new URL(url ?? '/', 'http://localhost');
  return { method: method ?? '', pathname: parsedUrl.pathname, searchParams: parsedUrl.searchParams };
}
