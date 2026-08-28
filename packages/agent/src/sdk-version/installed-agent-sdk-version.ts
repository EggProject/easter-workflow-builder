/**
 * A ténylegesen telepített Agent SDK verzió, szövegként.
 *
 * **Honnan jön az érték, és miért konstans.** A csomag `package.json`
 * fájljában az SDK **pontos verzióra pinelve** áll (nincs `^` és nincs `~`,
 * lásd `docs/research/2026-08-26-toolchain.md`), tehát a telepített verzió
 * definíció szerint azonos a pinnel. Az érték futásidejű kiolvasása a
 * `node_modules` alól nem járható út: az SDK `exports` térképe nem teszi
 * közzé a saját `package.json` fájlját, tehát egy
 * `require.resolve('@anthropic-ai/claude-agent-sdk/package.json')` hívás az
 * exports kikényszerítése miatt elhasalna, egy `node_modules` útvonalra
 * épített fájlolvasás pedig a csomagkezelő hoistolási döntésétől függene.
 *
 * A konstans ezért **nem kitalált szám**: a `package.json` pinjének másolata,
 * és az egyezést az `installed-agent-sdk-version.spec.ts` regressziós teszt
 * gépileg őrzi - egy SDK frissítés, ami elfelejti ezt a sort, a `bun run test`
 * kapun azonnal megbukik.
 *
 * **Ki fogyasztja.** A motor a `validateSdkVersionMatch` (SPEC-004 11.3
 * táblázat 17. sora) bemeneteként és a pillanatkép dokumentum `sdkVersionPin`
 * mezőjeként (SPEC-003 5.1) kéri. A motor viszont nem függ az Agent SDK-tól
 * (SPEC-004 17. szekció 58. kritérium), ezért az értéket nem ő olvassa ki,
 * hanem az összeállítás (`apps/server`, illetve a `createEngine`) adja át
 * neki - ez a konstans annak az összeállításnak az egyetlen, ellenőrzött
 * forrása.
 */
export const INSTALLED_AGENT_SDK_VERSION = '0.3.245';
