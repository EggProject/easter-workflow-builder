# Helyi indítás és a kimenő SDK környezet: mérések és források

Dátum: 2026-10-26. Fej: `origin/main` `ba6d424`. Node `v26.7.0` (`node --version`), Bun `1.4.0`
(`bun --version`), `@anthropic-ai/claude-agent-sdk` `0.3.245` (pinelve, `apps/server/package.json`).
A SPEC-012 és a PLAN-013 bemenete. **Valódi provider hívás (MiniMax, Anthropic) egyik mérésben
sem történt**: a mérések helyi folyamatok és egy hamis CLI végrehajtható ellen futottak.

A mérési azonosítók a `main` (`M-135`) és a `feat/spec-009-beallitasok` branch (`M-140`) legnagyobb
azonosítója után folytatódnak, hogy ne ütközzenek.

## 1. M-141: a szerver build nélkül elindul a pinelt Node alatt

**Módszer.** A worktree gyökeréből, üres környezettel (`env -i PATH=... HOME=...`):
`node apps/server/src/main.ts`, majd a hat kötelező szerver env változóval
(`EASTER_SERVER_PORT=3001`, `EASTER_LOG_DIRECTORY`, `EASTER_LOG_ROTATION_SIZE`,
`EASTER_LOG_ROTATION_FREQUENCY`, `EASTER_LOG_RETAINED_FILE_COUNT`,
`EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS`) és egy ideiglenes `EASTER_DB_FILE` értékkel háttérben,
utána `curl`, végül `SIGINT`. A számértékek a mérés kedvéért beírt értékek, nem javaslatok.

**Eredmény.**

- Env nélkül: `fatal: A(z) "EASTER_SERVER_PORT" kötelező env változó hiányzik vagy üres
(missing_env_variable).`, kilépési kód `1`.
- A hat változóval: `GET /api/providers` HTTP `200`, a két provider listája; `GET /api/settings`
  törzse `{"defaultProviderId":null,"persistStreamDeltas":false}`.
- `node -e "console.log(process.features.typescript)"` kimenete `strip`.

**Forrás a viselkedéshez.** A Node TypeScript dokumentációja szerint a típustörlés a `v25.2.0` óta
stabil, és alapból be van kapcsolva (`--no-strip-types` kapcsolja ki); a `node_modules` alatti
TypeScript fájlt a Node elutasítja
(<https://nodejs.org/docs/latest-v26.x/api/typescript.html>). A workspace csomagok a
`node_modules`-ban szimbolikus linkek, a mérés szerint a feloldás ennek ellenére működik (a valódi
útvonal a `packages/` alatt van). Ez utóbbi magyarázat **nem ellenőrzött** forrásból, csak a mért
eredmény áll.

## 2. M-142: az `EASTER_LOG_DIRECTORY` értéke fájl útvonal, nem könyvtár

**Módszer.** Az M-141 futás `EASTER_LOG_DIRECTORY=<tmp>/logs` értékkel, utána `ls <tmp>`.

**Eredmény.** A napló a `<tmp>/logs.1.log` fájlba került; `<tmp>/logs` könyvtár nem jött létre.

**Forrás.** A `buildLogRotationOptions` a változó értékét a `pino-roll` `file` mezőjébe teszi
(`packages/logger/src/log-rotation/build-log-rotation-options.ts:34`). A `pino-roll` README-je a
`file` mezőt a napló fájl útvonalaként írja le ("Absolute or relative path to the log file"; a
telepített `pino-roll@4.0.0` README 41. sora, és
<https://github.com/mcollina/pino-roll/blob/main/README.md>). A változó neve tehát félrevezető; a
`.env.example` és a `README.md` ezt ki kell mondja (SPEC-012 O-19).

## 3. M-143: a megadott `Options.env` az alfolyamat teljes környezete

**Módszer.** Repón kívüli, eldobható próba (a szöveg alább, hogy újra előállítható legyen): a
telepített SDK `query()` függvénye egy hamis CLI végrehajtható ellen
(`pathToClaudeCodeExecutable`, sdk.d.ts:1777), ami a kapott környezet változóneveit fájlba írja és
azonnal kilép. Két változat: `env: { PROBE_OUT: ... }` (a mai `claude-subscription` blokk
alakja, egy jelölő változóval) és `env: { ...process.env, PROBE_OUT: ... }`.

```js
// fake-cli.mjs (futtatható): a kapott env neveit írja ki, értéket nem
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.PROBE_OUT, JSON.stringify(Object.keys(process.env).sort()));
process.exit(0);
// probe.mjs: query({ prompt: 'x', options: { env, pathToClaudeCodeExecutable: '<fake-cli.mjs>' } })
```

**Eredmény.**

| Változat                     | Nevek száma | `PATH` | `HOME` | `CLAUDE*` nevek                                                                                                       |
| ---------------------------- | ----------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| csak a blokk                 | 3           | nincs  | nincs  | `CLAUDE_AGENT_SDK_VERSION`, `CLAUDE_CODE_ENTRYPOINT`                                                                  |
| `process.env` plusz a jelölő | 35          | van    | van    | `CLAUDE_AGENT_SDK_VERSION`, `CLAUDE_CODE_CERT_STORE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_TMPDIR`, `CLAUDE_TMPDIR` |

A blokk változatban az alfolyamat a jelölőn kívül csak a két, az SDK által pótolt változót kapta.

**Források.**

- A telepített `sdk.d.ts` 1482-1498. sora: "When set, this value REPLACES the subprocess
  environment entirely ... it is not merged with `process.env`. Spread `process.env` yourself if the
  subprocess still needs inherited variables like `PATH`, `HOME`".
- A futásidejű `sdk.mjs`: `Cn=ne?{...ne}:{...process.env}`, utána csak a
  `CLAUDE_CODE_ENTRYPOINT` és a `CLAUDE_AGENT_SDK_VERSION` pótlása (a mért 3 név pontosan ez).
- A hivatalos TypeScript referencia `env` sora: "When set, this replaces the subprocess
  environment instead of merging with `process.env`, so pass `{ ...process.env, YOUR_VAR: 'value'
}` to keep inherited variables like `PATH`"
  (<https://code.claude.com/docs/en/agent-sdk/typescript>).
- A CHANGELOG `0.2.113`: "**Breaking**: `options.env` once again replaces `process.env` for the
  CLI subprocess instead of overlaying it", és `0.3.149`: "corrected the `Options.env` docs to
  state that the value replaces the subprocess environment"
  (<https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md>).

**Amit a mérés NEM igazol.** Hogy a valódi CLI `PATH` és `HOME` nélkül elbukik-e, és ha igen,
milyen üzenettel: ehhez a valódi CLI kellene, ami a `claude-subscription` providernél valódi
hitelesítést és hívást jelent. Ez a SPEC-012 valódi próbájának része (5. szekció), user engedéllyel.

## 4. A hitelesítési precedencia (a tiltott változó lista forrása)

Elsődleges forrás: <https://code.claude.com/docs/en/authentication>, "Authentication precedence".
A sorrend: (1) felhő provider, ha `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` vagy
`CLAUDE_CODE_USE_FOUNDRY` be van állítva; (2) `ANTHROPIC_AUTH_TOKEN`; (3) `ANTHROPIC_API_KEY`; (4)
`apiKeyHelper` (beállítás fájl, nem env); (5) `CLAUDE_CODE_OAUTH_TOKEN`; (6) Anthropic profil és
federáció (`ANTHROPIC_PROFILE`, illetve együtt `ANTHROPIC_FEDERATION_RULE_ID` és
`ANTHROPIC_ORGANIZATION_ID`, a "Named profile" és "Federation variables" sor szerint a `/login`
felett); (7) a `/login` előfizetéses OAuth hitelesítése.

Megerősítések:

- <https://code.claude.com/docs/en/env-vars>: az `ANTHROPIC_API_KEY` sora "When set, this key is
  used instead of your Claude Pro, Max, Team, or Enterprise subscription even if you are logged
  in"; a `CLAUDE_CODE_OAUTH_TOKEN` sora "Alternative to `/login` for SDK and automated
  environments".
- <https://code.claude.com/docs/en/llm-gateway-connect>: "With `ANTHROPIC_AUTH_TOKEN`, the variable
  takes precedence immediately."
- Független: <https://github.com/anthropics/claude-code/issues/39126> ugyanezt a sorrendet idézi
  (felhő provider, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `apiKeyHelper`, előfizetés).

Az env-vars oldal további provider választó változókat is felsorol (`CLAUDE_CODE_USE_ANTHROPIC_AWS`,
`CLAUDE_CODE_USE_MANTLE`, `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`). Hogy ezek a precedencia 1. szintjén
állnak-e, a precedencia lap nem mondja ki: **nem ellenőrzött**.

## 5. Env fájl betöltés és indítás

- `--env-file` (Node `v20.6.0` óta, `v24.10.0` óta nem kísérleti) és `--env-file-if-exists` (Node
  `v22.9.0` óta): a fájlt az aktuális könyvtárhoz képest olvassa, és ha egy változó a környezetben
  és a fájlban is szerepel, **a környezeté nyer**
  (<https://nodejs.org/docs/latest-v26.x/api/cli.html#--env-filefile>). A
  `process.loadEnvFile(path)` (`v20.12.0` óta, `v24.10.0` óta nem kísérleti) a programból hívható
  párja (<https://nodejs.org/docs/latest-v26.x/api/process.html>). Mindkettő beépített, új
  függőség nem kell. Második független megerősítés ebben a munkamenetben nem készült: **egy
  hivatalos forrás**.
- Vite: a `.env`, `.env.local`, `.env.[mode]` fájlokat az `envDir` (alapból a projekt gyökere)
  alól tölti, a futáskor már létező környezeti változók a legerősebbek
  (<https://github.com/vitejs/vite/blob/v8.2.2/docs/guide/env-and-mode.md>, 67-79. sor). Az
  `apps/web/vite.config.ts` a `loadEnv(mode, process.cwd(), '')` hívással az ÖSSZES változót
  betölti a config folyamatba (a `''` előtag), a kliensnek viszont csak a `VITE_` előtagú jut.
- Turborepo: alapból `strict` env mód, a task csak a `globalEnv`, `env` és passthrough listákban
  nevesített változókat látja, plusz egy beépített rendszer listát (`HOME`, `PATH`, ...)
  (<https://turborepo.com/docs/crafting-your-repository/using-environment-variables>,
  <https://turborepo.com/docs/reference/configuration>). A gyökér `turbo.json` `globalPassThroughEnv`
  listájában ma nyolc név áll, `EASTER_*` közülük csak az `EASTER_DB_FILE`.

## 6. M-144: a `bun run` munkakönyvtára

**Módszer.** Eldobható workspace `/tmp` alatt, a gyökérben és egy `pkg` csomagban `"w": "pwd"`
script: `bun run w` a gyökérben, a csomagban, és `bun run --filter p w` a gyökérből.

**Eredmény.** Gyökér: a gyökér könyvtár; csomagban és `--filter` alatt: a csomag könyvtára. A
szerver `repoRootDirectory` bemenete a `process.cwd()` (`apps/server/src/main.ts:4`), és ebből
származik az alapértelmezett adatbázis útvonal (`.data/easter-workflow-builder.sqlite`,
`apps/server/src/startup-sequence/run-startup-sequence.ts:47-50`). Egy `apps/server` csomag
scriptből indított szerver tehát az `apps/server/.data/` alá nyitná az adatbázist.

## 7. A MiniMax kulcs neve: a leíró és a kód eltérése

- A `minimax` leíró `ANTHROPIC_AUTH_TOKEN` követelménye `process_env_passthrough` forrású
  (`packages/provider-minimax/src/environment/required-environment.ts:17-25`), a `purpose` szöveg
  szerint "A MINIMAX_API_KEY process env változó értéke megy Bearer tokenként".
- A feloldás viszont a követelmény saját NEVÉT olvassa a folyamat környezetéből
  (`packages/engine/src/provider-environment/resolve-required-environment-value.ts:31`), tehát a
  szerver környezetében `ANTHROPIC_AUTH_TOKEN` néven kell állnia a kulcsnak; `MINIMAX_API_KEY`
  néven a lépés `missing_provider_env` hibát adna.
- A SPEC-000 leíró táblája is a `MINIMAX_API_KEY` névből való átvezetést írja
  (`docs/spec/SPEC-000-provider-wire-measurement.md:720`).
- A user munkapéldányának `.env` fájljában (csak a változónevek olvasva, érték nélkül) egyetlen név
  áll: `MINIMAX_API_KEY`.
- **A `tools/wire-probe` ugyanezt a nevet olvassa** (`tools/wire-probe/src/harness/environment.ts:13-33`,
  `src/proxy.ts:39`). **Lezárva (SPEC-012 O-20, user döntés 2026-10-26):** a mérő eszköz is az
  `ANTHROPIC_AUTH_TOKEN` nevet olvassa, a `.env` fájlban egyetlen név marad; a `tools/wire-probe/**` a
  lefedettségből kizárt mérő eszköz (`vitest.config.ts:109`). A végrehajtás a PLAN-013 T-013-12 lépése.

## 8. A kapcsolat teszt kimenő opciói

A `testProviderConnection` a `query()` hívásnak kizárólag az `env` mezőt adja
(`packages/engine/src/engine-port/create-engine.ts:195-198`), a promptja `'ping'` (`:33`): nincs
`model`, nincs `maxTurns`, nincs `maxBudgetUsd`. Egy valódi kapcsolat teszt tehát a CLI
alapértelmezett modelljével és korlát nélkül fut; a SPEC-012 valódi próbája ezért alapból nem hívja
(O-17).

## 9. A költség becslés a két providernél

A `result.total_cost_usd` a `minimax` providernél nem a valós költség, hanem az SDK tartalék
díjtételével számolt becslés, előfizetésnél listaáras becslés
(`docs/research/2026-09-23-sdk-koltseg-becsles.md` 1. szekció). Az M-13 triviális prompttal
`0.213 USD` becsült értéket jelentett (`docs/research/2026-08-26-spec000-kiertekeles.md:783-784`).
A `maxBudgetUsd` a d.ts szerint akkor állítja meg a futást, ha a keret már túllépve ("The query will
stop if this budget is exceeded", sdk.d.ts:1727-1730), tehát az első kört nem előzi meg.

## 10. A forrásolt alapértékek (SPEC-012 O-10, user döntés 2026-10-26)

A user döntése: "de akkor keress forrást! legyen default érték beállítva!". Minden változóhoz elsődleges
forrást kerestem az alapértékre; a keresés eredménye az alábbi táblázat. **Ahol a forrás hiányzott, szám
nem született** (10.5 ... 10.7); a hat ilyen változót a user második döntése ("webes keresés! mi az
ajánlás!") a 13. szekció iparági ajánlásaival zárta le, a táblázat ezt tükrözi. A források elérése:
2026-10-26.

| Változó                                | Alapérték               | Forrás                                                                  | Megerősítések száma |
| -------------------------------------- | ----------------------- | ----------------------------------------------------------------------- | ------------------- |
| `EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS` | `15000`                 | 10.1                                                                    | elsődleges plusz 2  |
| `EASTER_SERVER_PORT`                   | `3001`                  | user termékdöntés (10.2)                                                | belső, user döntés  |
| `VITE_API_ORIGIN`                      | `http://localhost:5173` | Vite `server.host` és `server.port` alapértéke, user port döntés (10.3) | elsődleges plusz 1  |
| `VITE_STREAM_ORIGIN`                   | `http://127.0.0.1:3001` | a szerver `127.0.0.1` bind címe a kódban, user port döntés (10.2, 10.4) | belső               |
| `EASTER_LOG_ROTATION_SIZE`             | `10m`                   | 13.1 (10.5: a `pino-roll` nem ad alapértéket)                           | elsődleges plusz 2  |
| `EASTER_LOG_ROTATION_FREQUENCY`        | `604800000`             | 13.1 (10.5: a `pino-roll` nem ad alapértéket)                           | elsődleges plusz 2  |
| `EASTER_LOG_RETAINED_FILE_COUNT`       | `4`                     | 13.1 (10.5: a `pino-roll` nem ad alapértéket)                           | elsődleges plusz 2  |
| `EASTER_LOG_DIRECTORY`                 | `.data/logs/server`     | user döntés 2026-10-26 (13.1; 10.7: nincs külső forrás)                 | belső, user döntés  |
| `VITE_LIST_LIMIT`                      | `100`                   | 13.2 (10.6: szabvány nincs)                                             | elsődleges plusz 2  |
| `VITE_STREAM_REPLAY_LIMIT`             | `100`                   | 13.3 (10.6: szabvány nincs)                                             | elsődleges plusz 2  |

### 10.1 Az SSE életben tartó komment időköze: 15 másodperc

- **Elsődleges:** WHATWG HTML Living Standard, 9.2.7 "Authoring notes" (Last Updated 26 October 2026,
  <https://html.spec.whatwg.org/multipage/server-sent-events.html>): "Legacy proxy servers are known to,
  in certain cases, drop HTTP connections after a short timeout. To protect against such proxy servers,
  authors can include a comment line (one starting with a ':' character) every 15 seconds or so."
- **Megerősítés 1:** az `axum` `KeepAlive::interval` dokumentációja: "Customize the interval between
  keep-alive messages. Default is 15 seconds."
  (<https://docs.rs/axum/latest/axum/response/sse/struct.KeepAlive.html>).
- **Megerősítés 2:** az `sse-starlette` `EventSourceResponse` `ping` paraméterének alapértéke 15
  másodperc (`DEFAULT_PING_INTERVAL = 15`, <https://github.com/sysid/sse-starlette/blob/main/sse_starlette/sse.py>,
  <https://pypi.org/project/sse-starlette/3.6.0/>).
- **Pontosítás.** A szabvány mondata irányérték ("or so"), nem kötelező szám; a `15000` ezredmásodperc a
  szabvány szövegének szó szerinti átírása. A SPEC-006 M-13 és M-14 a Node időkorlátairól szól, erre a
  kérdésre nem felel, ezért a SPEC-006 "nincs forrásunk" állítása a WHATWG szakasz nélkül született.
  A szabvány a "legacy proxy" esetre ajánlja; hogy a helyi (proxy nélküli) használatban szükséges-e, nem
  állítjuk.

### 10.2 A szerver portja: 3001

User termékdöntés 2026-09-05 (`.claude/CLAUDE.md` 11. szekció, SPEC-008 3., SPEC-006 O-1). Külső forrás
nincs, és nem is kell: a döntés maga a forrás.

### 10.3 A Vite dev szerver origin: `http://localhost:5173`

- **Elsődleges:** <https://vite.dev/config/server-options>: `server.host` "Default: `'localhost'`",
  `server.port` "Default: `5173`".
- **Megerősítés (a telepített forrás):** `vite@8.2.2`, `dist/node/chunks/node.js:691` (`const
DEFAULT_DEV_PORT = 5173;`) és `:26727-26729` (`port: DEFAULT_DEV_PORT`, `host: "localhost"`).
- **Nem ellenőrzött:** a Vite dokumentáció szerint a `localhost` feloldott címe eltérhet attól, amire a
  böngésző csatlakozik; az `Origin` fejlécet a böngésző a címsorban álló gazdanévből képezi. A literál
  végső értékét a T-013-7 a futó dev szerveren mért `Origin` fejléccel igazolja.

### 10.4 A szerver bind címe

`apps/server/src/startup-sequence/continue-startup-with-database.ts:74`:
`server.listen(config.port, '127.0.0.1', ...)`; a SPEC-006 3.5 2. pontja kimondja. A `VITE_STREAM_ORIGIN`
alapértéke ezért `127.0.0.1`, nem `localhost`: a Node 17 óta a `localhost` feloldási sorrendje a rendszer
szerinti, és egy csak IPv4 címre kötő szerverhez az IPv6 elsőbbség hibát adhat. Ez utóbbi mondat
**nem ellenőrzött** ebben a környezetben (a Vite dokumentációja a `dns.setDefaultResultOrder` hatását
említi, <https://vite.dev/config/server-options> "server.host" megjegyzése); a `127.0.0.1` választás a bind
címhez igazodik, nem erre a mondatra.

### 10.5 A `pino-roll` nem ad alapértéket a `size`, a `frequency` és a `limit.count` mezőre

- **Elsődleges:** <https://github.com/mcollina/pino-roll/blob/main/README.md>: a `size?`, `frequency?`,
  `limit?` mező opcionális, "Default:" sor csak az `extension` (`.log`) és a `symlink` (`false`) mellett
  áll. A README `frequency: 'daily'` értéke a használati példában áll, nem alapérték.
- **Megerősítés 1:** <https://www.npmjs.com/package/pino-roll> (4.0.0), ugyanaz a README.
- **Megerősítés 2 (a telepített forrás, `pino-roll@4.0.0`):** `lib/utils.js:11-14` a `parseSize(undefined)`
  `null`-t ad, `:29-46` a `parseFrequency(undefined)` `null`-t ad, `pino-roll.js:86` a `validateLimitOptions`
  csak megadott `limit`-et ellenőriz, `:111` (`if (frequencySpec)`) az időalapú ütemezés, `:119` (`if (maxSize)`)
  a méret figyelés és `:157` (`if (limit)`) a régi fájlok törlése csak megadott értéknél fut. **Elhagyott mező tehát "nincs ilyen szempontú rotáció, nincs törlés"**, szám nélkül.
- **Mellékes lelet.** A telepített `parseFrequency` (`lib/utils.js:29-46`) csak a `daily`, `hourly` és szám
  értéket ismeri, a `weekly` értékre kivételt dob; a GitHub `main` README-je már említi a `weekly` értéket
  (a 4.0.0 npm README nem). A `server-config.ts` doc kommentje a `'weekly'` értéket is felsorolja
  (`apps/server/src/server-config/server-config.ts`, `readRotationFrequency` fölött): ez a telepített
  verzióra **nem ellenőrzött**, és a forrás szerint nem igaz. A SPEC-012 nem érinti, jelzés a usernek.
- **Eredmény:** a `pino-roll` nem ad alapértéket. **Lezárva a 13.1 szekcióban** (user döntés 2026-10-26: iparági ajánlás, forrással).

### 10.6 A lista és a visszajátszás lapmérete: nincs forrás

- **A projekt saját forrásai:** SPEC-005 F-19 és O-2 ("a számot a kliens nevezi meg; a szerverben és a
  protokollban nincs szállított érték"), SPEC-003 O-2 ("egy valós futás eseményméret eloszlásának mérése"),
  SPEC-007 O-6. Egyik sem ad számot, a mérés nem készült el.
- **Szabvány vagy hivatalos ajánlás:** nem találtam olyat, ami lapméretet ír elő. A JSON:API cursor
  pagination profil kimondja, hogy a szerver választja az alapértelmezett lapméretet
  (<https://jsonapi.org/profiles/ethanresnick/cursor-pagination/>: "the server MUST choose a 'default page
  size'"); a Google AIP-158 ugyanezt ("the API chooses an appropriate default, which the API should
  document", a példában 50, maximum 1000, <https://google.aip.dev/158>); a belgif minta sémája "minimum,
  maximum and default values should be determined during API design", példa érték 20
  (<https://github.com/belgif/openapi-common/blob/main/src/test/openapi/Pagination.yaml>). A szervezeti
  útmutatók eltérő számokat adnak (api.gov.au `limit` 10, <https://api.gov.au/sections/pagination.html>;
  NationalBankBelgium `limit` 10, <https://github.com/NationalBankBelgium/REST-API-Design-Guide/wiki/Pagination-Rules-and-metadata>).
  Ezek más szolgáltatások saját döntései, egymásnak ellentmondanak, és nem a mi adatméretünkre szólnak.
- **Miért nem választunk belőlük:** a `GET /api/workflows` kezelő a `limit` darabszámnál levágja a listát
  (`apps/server/src/workflow-endpoint/list-workflows.ts:35`), nincs lapozás; egy indoklás nélküli kis szám
  csendben elrejtene munkafolyamatokat.
- **Eredmény:** szabvány vagy hivatalos ajánlás nincs. **Lezárva a 13.2 és 13.3 szekcióban** (user döntés 2026-10-26: iparági ajánlás, forrással).

### 10.7 A napló útvonal előtag: nincs külső forrás

A `pino-roll` `file` mezőjének nincs alapértéke (10.5, a README szerint a `file` a kötelező mező). A projekt
belső precedense az adatbázis fejlesztői alapértéke a gitből kizárt `.data/` alatt (SPEC-003 10.1,
`packages/db/src/database-file/default-database-file-path.ts`); ez termékdöntés volt, nem külső forrás,
és a naplóra nem terjed ki. **Lezárva (user döntés 2026-10-26):** `.data/logs/server`, lásd 13.1.

## 11. M-145: a Node `--watch` a szerveren (SPEC-012 O-6)

**Módszer.** A worktree gyökeréből, `env -i` alapon (`PATH`, `HOME`, `EASTER_SERVER_PORT=3012`), ideiglenes
`s.env` fájllal (`EASTER_SERVER_PORT=3011` és az öt másik kötelező változó, ideiglenes `EASTER_DB_FILE` és
napló útvonal): `node --watch --env-file-if-exists=<s.env> apps/server/src/main.ts`, háttérben. Utána
`touch` a `apps/server/src/main.ts`, a `packages/core/src/index.ts` és az `s.env` fájlon (tartalom változás
nélkül), minden `touch` után 5-6 másodperc várakozás és `GET /api/providers`. Valódi provider hívás nincs.

**Eredmény.**

- A környezetben megadott `EASTER_SERVER_PORT=3012` nyert a fájlbeli `3011` ellen (a `3012` portra
  `200`, a `3011` portra nincs kapcsolat): a környezet erősebb, mint az `--env-file-if-exists` fájl.
- Mindhárom `touch` után a Node `Change detected in '<fájl>'` és `Restarting 'apps/server/src/main.ts'`
  sort írt, és a szerver a következő kérésre ismét `200`-at adott.
- Tehát a figyelő mód újraindítja a szervert a szerver forrás, egy workspace csomag forrása
  (`packages/core`, szimbolikus linkelt csomag) **és az env fájl** változására is.
- **Nem mértem:** mit tesz az újraindítás egy futó lépéssel (a Node `--watch-kill-signal` kapcsolója
  Stability 1.1; a szerver `SIGTERM` kezelője 3 másodperces leállítási ablakkal fut, SPEC-006 8.2). A
  figyelő mód ezért fejlesztői kényelem, nem a futó lépések megőrzésének eszköze.

**Források.** <https://nodejs.org/docs/latest-v26.x/api/cli.html> (`--watch`: "By default, watch mode
will watch the entry point and any required or imported module"; Added in v18.11.0, "Watch mode is now
stable" v22.0.0); <https://nodejs.org/en/blog/announcements/v22-release-announce> ("From this release Watch
Mode is considered stable"); <https://github.com/nodejs/node/commit/5a922232da> ("watch: mark as stable",
Stability 1 -> 2). Az `--env-file-if-exists` leírása: <https://nodejs.org/api/cli.md> ("Behavior is the same
as `--env-file`, but an error is not thrown if the file does not exist"; "the value from the environment
takes precedence"). A `--watch` nem kombinálható `--check`, `--eval`, `--interactive` kapcsolóval, fájl
útvonal argumentum kell (ugyanott).

## 12. A hitelesítési precedencia újraolvasása (SPEC-012 O-2, O-3, O-4)

Újraolvasva 2026-10-26-án (<https://code.claude.com/docs/en/authentication>, "Authentication precedence";
<https://code.claude.com/docs/en/env-vars>). A 4. szekció sorrendje szó szerint megegyezik. További tények:

- A `CLAUDE_CODE_OAUTH_TOKEN` az 5. szinten áll, a `/login` (7.) fölött, és a lap szerint "This token
  authenticates with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan", az
  env-vars lap szerint "OAuth access token for claude.ai authentication. Alternative to /login for SDK and
  automated environments". Ezért előfizetéses út: a `claude-subscription` providernél **nem tiltott** (O-3).
- A `CLAUDE_CODE_USE_ANTHROPIC_AWS` ("Use Claude Platform on AWS") és a `CLAUDE_CODE_USE_MANTLE` ("Use the
  Amazon Bedrock Mantle endpoint") az env-vars lapon provider választóként áll; a **precedencia listában
  nem szerepelnek**, a rangjuk a `/login` mellett **nem ellenőrzött**. A tiltott listába a leírásuk
  (provider választó) miatt kerülnek, nem igazolt rang alapján.
- A `ANTHROPIC_PROFILE` ("Name of the Anthropic profile to authenticate with"), valamint az
  `ANTHROPIC_FEDERATION_RULE_ID` és az `ANTHROPIC_ORGANIZATION_ID` együtt állítva "federation credentials,
  which rank above your /login credential" (env-vars lap, és az authentication lap táblázata: "Above").
- Az `apiKeyHelper` beállítás fájl, nem env változó, tehát a kimenő környezet szűrése nem érinti.
- Független megerősítés a sorrendre: 4. szekció (llm-gateway-connect, claude-code #39126).

## 13. Iparági alapértékek a hat forrás nélküli változóra (SPEC-012 11.2, user döntés 2026-10-26)

A user döntése: "webes keresés! mi az ajánlás! nehogy már én találjak ki mindent, amikor ezeket az ipar
már kitalálta!" A 10.5 ... 10.7 szekció azt találta, hogy a `pino-roll` nem ad alapértéket, és a
lapméretre nincs szabvány. Ez a szekció az iparági bevett gyakorlatot keresi: a nagy rendszerek
**szállított alapértékét vagy kimondott ajánlását** (nem példaértéket), elsődleges forrással és legalább
két független megerősítéssel. A keresés Exa eszközzel, a források elérése: 2026-10-26.

**A választás szabálya.** Ahol a források ugyanazt a számot adják, az az érték. Ahol eltérnek, a döntő
szempont kimondva, és a nem választott érték a táblában marad. Példaérték (például egy `daemon.json`
minta) nem számít alapértéknek.

### 13.1 Napló forgatás

**A jelöltek, szállított alapértékkel:**

| Rendszer                                | Méret                      | Gyakoriság                             | Megőrzés                                       | Forrás                                                                                                                                                                      |
| --------------------------------------- | -------------------------- | -------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logrotate` szállított `logrotate.conf` | nincs                      | `weekly`                               | `rotate 4`                                     | upstream példa: <https://github.com/logrotate/logrotate/blob/master/examples/logrotate.conf>                                                                                |
| Debian, Ubuntu (a csomag configja)      | nincs                      | `weekly`                               | `rotate 4`                                     | <https://ubuntumanual.org/configuring-log-rotation-of-apache2-and-other-logs/>; <https://askubuntu.com/questions/443232/log-file-rotation-setting>                          |
| Red Hat Enterprise Linux                | nincs                      | `weekly`                               | `rotate 4`                                     | <https://docs.redhat.com/en/documentation/Red_Hat_Enterprise_Linux/6/html/deployment_guide/s2-log_rotation>; RHEL 4 útmutató: "rotate every week and keep four weeks worth" |
| Kubernetes `kubelet`                    | `containerLogMaxSize` 10Mi | nincs                                  | `containerLogMaxFiles` 5 (az aktívval együtt)  | <https://kubernetes.io/docs/concepts/cluster-administration/logging/>; <https://kubernetes.io/docs/reference/config-api/kubelet-config.v1beta1/>                            |
| Docker `local` driver                   | `max-size` 20m             | nincs                                  | `max-file` 5 (az aktívval együtt)              | <https://docs.docker.com/engine/logging/drivers/local/>                                                                                                                     |
| `pm2-logrotate` (Node)                  | `max_size` 10M             | `rotateInterval` `0 0 * * *` (naponta) | `retain` 30 (forgatott fájl, az aktív mellett) | <https://github.com/keymetrics/pm2-logrotate/blob/master/README.md>; <https://www.npmjs.com/package/pm2-logrotate>                                                          |
| Spring Boot (Log4j2 rolling policy)     | `max-file-size` 10MB       | nincs megnevezve                       | `max-history` 7                                | <https://docs.spring.io/spring-boot/reference/features/logging.html>                                                                                                        |

**Idézetek (rövid):**

- logrotate példa config: "rotate log files weekly / weekly", "keep 4 weeks worth of backlogs / rotate 4".
  A RHEL 6 útmutató ugyanezt a két sort mutatja, és kimondja: "rotated log files are kept for four weeks".
  A `logrotate(8)` oldal a `rotate` direktívára: "Log files are rotated count times before being removed"
  (<https://manpages.debian.org/bookworm/logrotate/logrotate.8.en.html>), vagyis a `count` a forgatott
  példányok száma, az aktív fájlon felül.
- Kubernetes: "`containerLogMaxSize` (default 10Mi) and `containerLogMaxFiles` (default 5)"; a kubelet
  config referencia: `containerLogMaxFiles` "Defines the maximum number of container log files that can be
  present for a container ... The default value is 5", `containerLogMaxSize` "The default value is 10Mi".
- Docker `local`: "`max-size` ... Defaults to 20m", "`max-file` ... The maximum number of log files that can
  be present ... Defaults to 5"; a lap összegzése: "a 20M default size for each file and a default count of
  5".
- `pm2-logrotate`: "`max_size` (Defaults to `10M`)", "`retain` (Defaults to `30` file logs) ... if you have
  retain = 7 you will have at most 7 rotated logs and your current one", "`rotateInterval` (Defaults to
  `0 0 * * *` everyday at midnight)".
- Spring Boot: "`logging.log4j2.rollingpolicy.max-file-size` ... (defaults to 10MB)",
  "`logging.log4j2.rollingpolicy.max-history` ... (defaults to 7)".

**Megvizsgált, de nem használható jelöltek:**

- Docker `json-file`: `max-size` alapértéke -1 (korlátlan), `max-file` alapértéke 1 és csak `max-size`
  mellett hat (<https://docs.docker.com/engine/logging/drivers/json-file/>); a `daemon.json` minta
  `10m` / `3` értéke példa, nem alapérték.
- `winston-daily-rotate-file`: `maxSize` és `maxFiles` alapértéke `null`, "If not set, no logs will be
  removed" (<https://github.com/winstonjs/winston-daily-rotate-file/blob/master/README.md>); a
  `rotating-file-stream` `size`, `interval`, `maxFiles`, `maxSize` alapértéke `null`
  (<https://www.npmjs.com/package/rotating-file-stream>). Egyik sem ad számot.
- `systemd-journald`: a határok a fájlrendszer százalékában állnak (`SystemMaxUse` 10 százalék, legfeljebb
  4G; `MaxFileSec` egy hónap; `SystemMaxFiles` 100), tehát a méretet nem fordítják le egy fájl
  méretére (<https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html>). A `pino-roll`
  nem ismeri a hónapot.
- OWASP Logging Cheat Sheet: nem ad megőrzési számot. A "Disposal of logs" szakasz szerint a naplót nem
  szabad "destroyed before the duration of the required data retention period", és nem szabad tovább
  tartani; "Legal, regulatory and contractual obligations may impact on these periods"; a "Verification"
  szakasz kéri: "Ensure logging cannot be used to deplete system resources, for example by filling up disk
  space" (<https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Logging_Cheat_Sheet.md>).
  Ebből a korlát megléte következik (méret és darabszám), a szám nem.
- `pino-roll` README és a telepített forrás: nincs alapérték (10.5). Az npm legfrissebb kiadása
  `4.0.0` (<https://registry.npmjs.org/pino-roll/latest>, 2026-10-26), tehát a GitHub `main` README-jében
  szereplő `weekly` kiadott verzióban nincs.

**A választás.**

| Változó                          | Érték                                 | Indok                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EASTER_LOG_ROTATION_SIZE`       | `10m`                                 | Három független rendszer szállított alapértéke ugyanaz a 10 mebibájt: kubelet (10Mi), `pm2-logrotate` (10M), Spring Boot (10MB). A `pino-roll` `m` utótagja 1024 négyzet bájt (`lib/utils.js:11-27`, M-146: `parseSize('10m')` = 10485760), azaz pontosan a kubelet 10Mi értéke. A Docker `local` 20m értéke egyetlen forrás, ezért nem döntő.                                                                                                                  |
| `EASTER_LOG_RETAINED_FILE_COUNT` | `4`                                   | A forgatott példányok száma a `logrotate` `rotate 4` értéke (Debian, Ubuntu, RHEL, upstream), és ugyanaz a kubelet és a Docker `local` "5 fájl az aktívval együtt" értéke is (4 forgatott plusz 1 aktív). A `pino-roll` `limit.count` jelentése is "in addition to the active file" (README), tehát a számok közvetlenül megfelelnek. A `pm2-logrotate` 30 és a Spring 7 értéke egymásnak ellentmond, ezért a darabszámot nem döntik el.                        |
| `EASTER_LOG_ROTATION_FREQUENCY`  | `604800000` (7 nap ezredmásodpercben) | A rendszer szintű szabvány a `weekly` (három disztribúció és az upstream példa, egyező `rotate 4` mellett). A `pino-roll` `4.0.0` a `weekly` értéket nem ismeri (`lib/utils.js:29-46`, a kiadott README sem), ezért a hét ezredmásodpercben. Az alkalmazás szintű `daily` (`pm2-logrotate`, Spring dátum minta) nem választott: a hozzájuk tartozó darabszám (30, illetve 7) nem egyezik, a `logrotate` és a kubelet viszont a `weekly` mellett egyező 4-et ad. |
| `EASTER_LOG_DIRECTORY`           | `.data/logs/server`                   | **Nem iparági érték, user döntés 2026-10-26** ("a repo gyökerének `.data/logs/` mappája"). A `.data/` kizárt a gitből (`.gitignore:44`), és a `db` alapértelmezett fájlja is ott áll (`default-database-file-path.ts`). A változó fájl útvonal előtag (M-142): a napló `.data/logs/server.1.log`.                                                                                                                                                               |

**M-146 (saját mérés, 2026-10-26).** A telepített `pino-roll@4.0.0` a választott értékekkel
(`file: '.data/logs/server'`, `size: '10m'`, `frequency: 604800000`, `mkdir: true`, `limit.count: 4`), üres
ideiglenes könyvtárban, Node `v26.7.0`. Eredmény: a `.data/logs` könyvtár létrejött (`mkdir: true`), a fájl
`server.1.log`; `parseSize('10m')` = 10485760 bájt. **A hét határa:** `parseFrequency(604800000)` a hét
elejét `2026-10-22T00:00:00.000Z`, a következőt `2026-10-29T00:00:00.000Z` értékre számolta; a forrás
(`lib/utils.js:36-38`, `:56-58`) az időpontot `now - now % frequency` alakban számolja, tehát a határ az
**Unix epochtól számolt hétszeres többszörös, UTC szerint csütörtök 00:00**, nem hétfő és nem helyi idő.
A rotáció hetente tehát igaz, de csütörtök éjfélre (UTC) esik. A méret és az idő együtt is él: "Can be
combined with frequency" (README), bármelyik előbb eléri a határát, forgat. A legrosszabb lemezigény:
(4 forgatott plusz 1 aktív) szorozva 10 MiB, azaz 50 MiB.

**Lelet, nem módosítottam (javaslat, nem döntés).** A `limit.count` a README szerint alapból csak a
**jelenlegi folyamat** által létrehozott fájlokra érvényes ("When `false` or `undefined`, the `count`
limit only applies to files generated by the current process"), a telepített forrásban
`removeOldFiles` a `createdFileNames` listát törli (`lib/utils.js:205-211`). A
`buildLogRotationOptions` (`packages/logger/src/log-rotation/build-log-rotation-options.ts`) nem állítja
a `limit.removeOtherLogFiles` mezőt, tehát egy szerver újraindítás után a korábbi futások fájljai nem
törlődnek: a darabszám korlát futásonként érvényes, nem a könyvtárra. Ha a korlátnak a könyvtárra kell
szólnia, a `removeOtherLogFiles: true` mezőt kell beállítani; ez a SPEC-006 döntése, ezért itt nem
nyúltam hozzá.

### 13.2 `VITE_LIST_LIMIT`: 100

A `GET /api/workflows` kezelő a `limit` darabszámnál levágja a listát, nincs lapozás
(`apps/server/src/workflow-endpoint/list-workflows.ts:35`); a protokoll `limit` mezője pozitív egész, felső
korlát nélkül (`packages/protocol/src/workflow/workflow-record.ts:66`, `run/run-record.ts:61`). A web
a workflow listát és a futás előzményeket ugyanezzel az egy értékkel kéri.

| Rendszer                             | Alapérték        | Felső korlát      | Forrás                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe `limit`                       | 10               | 100               | <https://docs.stripe.com/api/pagination> ("default is 10", "ranging between 1 and 100")                                                                                                                                   |
| GitLab `per_page`                    | 20               | 100               | <https://docs.gitlab.com/api/rest/> ("default: `20`, max: `100`")                                                                                                                                                         |
| Spring Data `size`                   | 20               | 2000              | <https://docs.spring.io/spring-data/commons/reference/repositories/core-extensions-web.html> ("Defaults to 20"); a forrás `DEFAULT_MAX_PAGE_SIZE = 2000`                                                                  |
| GitHub REST `per_page`               | 30               | 100               | <https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api> ("For most endpoints, the maximum value of `per_page` is `100`"); <https://docs.github.com/en/rest/issues/issues> ("Default: `30`") |
| Jira Cloud `maxResults`              | 50               | végpontonként más | <https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/>; az Atlassian kimondja, hogy az alapérték és a maximum "not considered part of the API"                                                              |
| Google AIP-158 `page_size`           | az API választja | az API választja  | <https://google.aip.dev/158> ("the API chooses an appropriate default, which the API should document"); a példában 50 és 1000                                                                                             |
| Slack `limit` (`conversations.list`) | 100              | 1000 alatt        | <https://docs.slack.dev/reference/methods/conversations.list> ("Default: `100`"); <https://docs.slack.dev/apis/web-api/pagination> ("We recommend `100`-`200` results at a time")                                         |

**Következtetés.** Alapértékre nincs egyetlen iparági szám: a szállított alapértékek 10 és 100 között
szórnak (10, 20, 20, 30, 50, 100), tehát az "alapérték" nem dönt. Két dolog viszont egyezik:

1. **A felső korlát.** A három legelterjedtebb REST API (GitHub, Stripe, GitLab) mind **100**-nál
   korlátoz, a Slack alapértéke 100, és kimondott ajánlása "100-200".
2. **A lapozás hiánya a mi oldalunkon.** A Google AIP-158 hátrányként nevezi meg, hogy egy kis alapértékkel
   (példa: 50) bevezetett lapozás eltöri azt a klienst, amely mindent vár ("it was getting all resources,
   and now is only getting the first 50"). A mi kezelőnk csendben levág, tehát minden, a gyűjtemény
   méreténél kisebb érték sorokat rejt el.

**Választás: 100.** A Slack alapértéke és ajánlásának alsó határa, a GitHub, Stripe és GitLab közös
felső korlátja, vagyis a legnagyobb érték, amit a legelterjedtebb API-k módosítás nélkül elfogadnak. **Mennyire
közeli:** ez nem egy "leggyakoribb alapérték" (azok 10 és 50 közt vannak), hanem a közös felső korlát és egy
dokumentált ajánlás; a lapozás hiánya miatt a nagyobb érték az iparági minta szerinti óvatos irány. **A
hatása nem szűnik meg:** 100 felett a lista továbbra is csendben levágódik, amit az érték nem old meg,
csak a lapozás (nem ennek a specnek a hatóköre).

### 13.3 `VITE_STREAM_REPLAY_LIMIT`: 100

**Mit csinál a kódban.** A `replayLimit` a pótlás **lapmérete**, nem plafon: a szerver
`readEventsSince(runId, kurzor, replayLimit)` hívást ismétel, amíg a lap tele jön vissza
(`apps/server/src/stream-connection/handle-stream-connection.ts:131-153`), és az élő lecsapolás is így
lapoz (`:185-198`). A web `fromEventId: 0` értékkel és ezzel a számmal iratkozik fel
(`apps/web/src/run-view/RunViewScreen.tsx:455`). Egy futás teljes története tehát mindig újrajátszódik,
a szám csak azt dönti el, hány sor jön egy adatbázis olvasásra. A protokoll mezője pozitív egész, felső
korlát nélkül (`packages/protocol/src/event-stream/stream-subscription.ts:13`).

**Közvetlenül alkalmazható iparági alapérték nincs.** Amit találtam:

- **SSE hubok újrajátszása.** A Mercure a `Last-Event-ID` után mindent újrajátszik, lapozás nélkül; a Bolt
  tároló megőrzési határának alapértéke "`size 0` default disables automatic retention limits"
  (<https://mercure.rocks/docs/concepts/reconnection-and-history>, a specifikáció:
  <https://mercure.rocks/spec>: "the hub SHOULD send all events published after the one bearing this
  identifier"). Ez a mi "mindent újrajátszunk" viselkedésünkkel egyezik, de lapméretet nem ad, tehát
  **számra nem használható**. Más hubot (Nchan, Pusher) nem vizsgáltam.
- **Eseménynapló lapok, kurzoros olvasás.** Ugyanaz a művelet (időrendi, append-only napló egy lapja),
  szállított alapértékkel: Slack `conversations.history` `limit` alapértéke 100, maximuma 999, ajánlása
  "100-200" (<https://docs.slack.dev/reference/methods/conversations.history>,
  <https://docs.slack.dev/apis/web-api/pagination>); Ably csatorna előzmény `limit` alapértéke 100,
  maximuma 1000 (<https://ably.com/docs/pub-sub/api/javascript/rest/channel>: "Default: 100. Maximum:
  1000"); Grafana Loki `query_range` `limit` alapértéke 100 ("The max number of entries to return. It
  defaults to `100`", <https://grafana.com/docs/loki/latest/reference/loki-http-api>).

**Választás: 100.** Három független, nagy rendszer ugyanazt a számot adja a legközelebbi analóg
műveletre. **Mennyire közeli:** közepesen. A művelet ugyanaz (egy lap egy időrendi eseménynaplóból, kurzorral),
a szerep is (sorok száma olvasásonként), de azok a kliens által lapozott REST hívások, a miénk szerver oldali
ciklus egy SSE csatorna mögött; SSE specifikus lapméret iparági forrásban nem található. Mivel a szám
nem plafon, a rossz érték nem veszít eseményt, csak olvasások számát változtatja.

### 13.4 Összegzés

| Változó                          | Érték               | Forrás típusa                                                                 | Közelség                                             |
| -------------------------------- | ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| `EASTER_LOG_ROTATION_SIZE`       | `10m`               | három szállított alapérték (kubelet, pm2-logrotate, Spring)                   | közeli (fájlnapló forgatás)                          |
| `EASTER_LOG_RETAINED_FILE_COUNT` | `4`                 | `logrotate` `rotate 4` (három disztribúció), kubelet és Docker `local` 5 fájl | közeli                                               |
| `EASTER_LOG_ROTATION_FREQUENCY`  | `604800000`         | `logrotate` `weekly` (három disztribúció), ezredmásodpercben                  | közeli, a `weekly` név hiánya miatt számként         |
| `EASTER_LOG_DIRECTORY`           | `.data/logs/server` | user döntés (nem iparági)                                                     | nem értelmezhető                                     |
| `VITE_LIST_LIMIT`                | `100`               | Slack alapérték és ajánlás, GitHub, Stripe, GitLab közös maximuma             | közepes: közös korlát, nem közös alapérték           |
| `VITE_STREAM_REPLAY_LIMIT`       | `100`               | Slack, Ably, Loki előzmény alapértéke                                         | közepes: ugyanaz a művelet, de kliens oldali lapozás |
