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
