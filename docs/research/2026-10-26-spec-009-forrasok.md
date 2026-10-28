# SPEC-009 forrásgyűjtés a nyitott kérdések lezárásához (2026-10-26)

Kapcsolódó: [`../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md`](../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md),
`.claude/CLAUDE.md` 4. szekció (bizonyíték kényszer).

Módszer: webes lekérdezés kizárólag az Exa eszközzel (`web_fetch_exa`, `web_search_exa`), a telepített
`@anthropic-ai/claude-agent-sdk` `0.3.245` `sdk.d.ts` és `sdk.mjs` fájljának olvasása
(`node_modules/.bun/@anthropic-ai+claude-agent-sdk@0.3.245+7b719043580c7622/node_modules/@anthropic-ai/claude-agent-sdk/`),
és az `rg`/`grep` a repón. Valódi API hívás nem futott. Minden állításnál: elsődleges forrás plusz két
megerősítés; ahol ez nem teljesül, a sor "nem ellenőrzött" vagy "korlátozott" jelölést kap.

## 1. O-20: a `settingSources: []` és a hitelesítés

**Kérdés.** Érinti-e a `settingSources: []` a hitelesítő adatok (`~/.claude/.credentials.json`, macOS
Keychain, `CLAUDE_CONFIG_DIR`) betöltését, vagy csak a beállítás fájlokat?

| #   | Állítás                                                                                                       | Forrás                                                                                                                                           | Idézet                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1 | A `settingSources` kizárólag a user, project és local **beállítás** forrásokat vezérli                        | elsődleges: <https://code.claude.com/docs/en/agent-sdk/claude-code-features>                                                                     | "`settingSources` covers user, project, and local settings. A few inputs are read regardless of its value"                                                                                                                                                                                       |
| 1.1 | ugyanez                                                                                                       | megerősítés 1: <https://code.claude.com/docs/en/agent-sdk/configuration>                                                                         | "controls which filesystem sources load: user, project, and local. Settings files and CLAUDE.md files arrive through these sources."                                                                                                                                                             |
| 1.1 | ugyanez                                                                                                       | megerősítés 2: telepített `sdk.d.ts:2004-2014`                                                                                                   | "Control which filesystem settings to load ... Pass `[]` to disable filesystem settings (SDK isolation mode)."                                                                                                                                                                                   |
| 1.2 | A `/login` előfizetéses bejelentkezés tárolója nem beállítás fájl                                             | elsődleges: <https://code.claude.com/docs/en/authentication> ("Credential management")                                                           | macOS: Keychain, ennek elutasításakor és Linuxon `~/.claude/.credentials.json`; "If you've set the `CLAUDE_CONFIG_DIR` environment variable, Claude Code keeps the `.credentials.json` file under that directory instead"                                                                        |
| 1.2 | A beállításból jövő hitelesítés az `apiKeyHelper` (és a `customApiKeyResponses`), nem a `/login`              | ugyanott, "Authentication precedence"                                                                                                            | a 4. pont `apiKeyHelper script output`, a 7. pont "Subscription OAuth credentials from `/login`"                                                                                                                                                                                                 |
| 1.2 | ugyanez, harmadik fél, kimondva                                                                               | megerősítés 1: <https://github.com/entireio/cli/commit/f457d27a98afa958f228560203252e3f3ac6d7ee>                                                 | "`--setting-sources ""` ... API-billing users configure auth in their user settings (apiKeyHelper, or the ANTHROPIC_API_KEY approval in customApiKeyResponses), so dropping all sources dropped their auth ... Subscription and raw ANTHROPIC_API_KEY env-var users were unaffected either way." |
| 1.2 | a hitelesítő fájl és a `settings.json` külön                                                                  | megerősítés 2: <https://github.com/anthropics/claude-agent-sdk-typescript/issues/392>                                                            | "migrates only `.credentials.json` and `.claude.json` into it. `settings.json` is left behind ... a host that authenticates via `apiKeyHelper` - which lives in `settings.json`"                                                                                                                 |
| 1.3 | Az SDK `0.3.245` nem ad `--bare` kapcsolót; csak `--setting-sources=<lista>` és `--strict-mcp-config` megy ki | saját olvasás: `sdk.mjs` ("`--bare`" 0 találat; `if(T!==void 0)Y.push(\`--setting-sources=${T.join(",")}\`);if(X)Y.push("--strict-mcp-config")`) |                                                                                                                                                                                                                                                                                                  |
| 1.3 | A `--bare` az a hivatalos mód, ami nem olvassa az OAuth hitelesítést és a kulcstartót                         | <https://code.claude.com/docs/en/headless>                                                                                                       | "In bare mode, Claude Code never reads OAuth credentials or the system keychain."                                                                                                                                                                                                                |

**Besorolás.** Az 1.1 és 1.2 három-három forrással áll. **Korlát:** a hivatalos doksi nem mondja ki szó
szerint, hogy az előfizetéses bejelentkezés `settingSources: []` mellett is él; a kimondott mondat
(1.2, entireio) harmadik fél forrás. A SPEC-009 ezt "forrásból eldöntött, korlátozott megerősítéssel"
jelöli. **2026-10-28:** az O-38 technikai döntésként lezárva (SPEC-009 14.7): az 1.1 és az 1.2 egy-egy
elsődleges forrással és két-két megerősítéssel áll, ez a bizonyíték szabálynak megfelel; a maradék korlátot a
PLAN-012 T-012-12a valódi próbája zárja, a user engedélyével.

**A `settingSources` által NEM vezérelt bemenetek** (ugyanaz az elsődleges oldal, "What settingSources does
not control"): a managed policy beállítás, a `~/.claude.json` globális konfig, az auto memory
(`~/.claude/projects/<projekt>/memory/`), a claude.ai MCP connectorok (letiltásuk: `strictMcpConfig: true`),
a `sandbox.credentials` bejegyzések. Idézet: "For multi-tenant deployments, run each tenant in its own
filesystem and set `settingSources: []` plus `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in `env`."

## 2. O-21: az `Options.env` és a hitelesítési precedencia

| #   | Állítás                                                                                                                                                                                                                                                                                                                                                         | Forrás                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | A megadott `env` az alfolyamat környezetét **lecseréli**, nem olvad össze a `process.env`-vel                                                                                                                                                                                                                                                                   | elsődleges: <https://code.claude.com/docs/en/agent-sdk/typescript> (Options `env` sora: "this replaces the subprocess environment instead of merging with `process.env`, so pass `{ ...process.env, YOUR_VAR: 'value' }`"); megerősítés 1: telepített `sdk.d.ts:1482-1500` ("REPLACES the subprocess environment entirely"); megerősítés 2: <https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.2.113> ("**Breaking**: `options.env` once again replaces `process.env` for the CLI subprocess instead of overlaying it") és `v0.3.149` |
| 2.2 | A futásidejű kód is ezt teszi                                                                                                                                                                                                                                                                                                                                   | saját olvasás: `sdk.mjs` `Cn=ne?{...ne}:{...process.env}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2.3 | A hitelesítési precedencia: 1. felhő provider változók (`CLAUDE_CODE_USE_BEDROCK`, `_VERTEX`, `_FOUNDRY`), 2. `ANTHROPIC_AUTH_TOKEN`, 3. `ANTHROPIC_API_KEY`, 4. `apiKeyHelper`, 5. `CLAUDE_CODE_OAUTH_TOKEN`, 6. profil és föderáció (`ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID` plusz `ANTHROPIC_ORGANIZATION_ID`), 7. a `/login` előfizetéses OAuth | <https://code.claude.com/docs/en/authentication> ("Authentication precedence"); egy hivatalos oldal, a lista a külön spec dolga                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2.4 | A mai `claude-subscription` leíró `requiredEnv` listája üres, a `disallowedEnv` listája egyetlen név (`ANTHROPIC_BASE_URL`)                                                                                                                                                                                                                                     | saját olvasás: `packages/provider-claude-subscription/src/environment/required-environment.ts`, `disallowed-environment.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Következmény: a mai kód `claude-subscription` lépésnél üres `env` blokkot küld, ami az SDK szerint a teljes
környezetet elveszi (`PATH`, `HOME`). A javítás a külön spec dolga (SPEC-009 7.2). Mérés nem kell: a
viselkedést az elsődleges forrás és két megerősítés kimondja.

## 3. O-12: a skill neve és a könyvtárnév

| #   | Állítás                                                                                                                                                                                                                                          | Forrás                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Az SDK `skills` listában a saját skill neve a **könyvtárnév**, a plugin skillé `plugin:skill`                                                                                                                                                    | elsődleges: <https://code.claude.com/docs/en/agent-sdk/skills> ("Your own skills: the skill's directory name; Plugin skills: `plugin:skill`"); telepített `sdk.d.ts:2023-2024` ("Names match the SKILL.md `name` / directory name, or `plugin:skill`")                                                                                                                 |
| 3.2 | A `skills` lista csak pontos nevet fogad; üres név, zárójel, vessző, vezérlő karakter, szóközzel kiegészített név és joker (`*`, `:*`) esetén a `query()` a folyamat indítása előtt elutasítja                                                   | <https://code.claude.com/docs/en/agent-sdk/skills> ("Invalid skill name error"); TS SDK 0.3.221-től                                                                                                                                                                                                                                                                    |
| 3.3 | A frontmatter `name` alapértéke a könyvtárnév; plugin skillnél a `name` a parancs **utolsó szakaszát** cseréli (`my-plugin/skills/review/SKILL.md` + `name: fancy` -> `/my-plugin:fancy`)                                                        | <https://code.claude.com/docs/en/skills> ("How a skill gets its command name")                                                                                                                                                                                                                                                                                         |
| 3.4 | Az Agent Skills specifikáció: a `name` 1-64 karakter, kisbetű, szám és kötőjel, nem kezdődhet és végződhet kötőjellel, nem tartalmazhat `--` sorozatot, és **egyeznie kell a szülő könyvtár nevével**; a `description` kötelező, 1-1024 karakter | elsődleges: <https://agentskills.io/specification>; megerősítés 1: <https://claude.com/docs/skills/how-to> ("Must match the skill's directory name"); megerősítés 2: <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview> (64 karakter, kisbetű/szám/kötőjel, tiltott szavak "anthropic" és "claude", `description` nem üres, legfeljebb 1024) |

**Következmény.** Ha a frontmatter `name` eltér a könyvtárnévtől, az SDK `skills` listájában (plugin úton)
melyik név érvényes, a doksi nem mondja ki szó szerint (3.1 a könyvtárnevet írja, 3.3 a `name`-et a parancsnévre).
Ezt az M-136 második esete méri; a szabály, ami az eltérést kizárja, az O-37 kérdése.

## 4. MCP szerver név és környezet

| #   | Állítás                                                                                                                                                                     | Forrás                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | Az MCP eszköz neve `mcp__<szerver>__<eszköz>`; a szerver nevében a `.` és a szóköz `_`-re cserélődik (`my.server` -> `mcp__my_server__list_issues`)                         | <https://code.claude.com/docs/en/agent-sdk/mcp> ("Tool naming convention"); a teljes kör a 10.3 szekcióban lezárva                                                             |
| 4.2 | A stdio szerver `env` mezője a folyamat környezetét adja (`env: { API_KEY: process.env.API_KEY }`); hogy az alfolyamat a CLI környezetét örökli-e mellé, a doksi nem mondja | ugyanott ("Pass credentials via environment variables"); az örökléshez az M-139                                                                                                |
| 4.3 | A `${VAR}` kiterjesztés csak a `.mcp.json` fájlban működik, a kódban átadott `mcpServers` értékeit az alkalmazás állítja elő                                                | ugyanott                                                                                                                                                                       |
| 4.4 | A claude.ai fiókhoz kötött MCP connectorokat a `settingSources: []` nem tiltja; a `strictMcpConfig: true` igen                                                              | <https://code.claude.com/docs/en/agent-sdk/claude-code-features> ("claude.ai MCP connectors"); megerősítés: <https://github.com/anthropics/claude-agent-sdk-python/issues/853> |

## 5. Zip kicsomagolás: a Node beépített lehetősége és a jelöltek

| #   | Állítás                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Forrás                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | A `node:zlib` **ZIP archívum API-t** kapott a Node 26.8.0-ban: `ZipFile`, `ZipEntry`, `ZipBuffer`, `createZipArchive`; **Stability: 1.0 Early development**, "The ZIP archive API is experimental. Using any part of it ... emits an experimental warning the first time"                                                                                                                                                                                                                | elsődleges: <https://nodejs.org/api/zlib.html> (a `ZipEntry` mezői: `isSymlink`, `mode`, `name`, `size`); megerősítés 1: <https://nodejs.org/en/blog/release/v26.8.0> és <https://github.com/nodejs/node/releases/tag/v26.8.0> ("zlib: add ZipEntry, ZipFile, and ZipBuffer", 2026-08-26); megerősítés 2: <https://github.com/nodejs/node/pull/64339> (merged 2026-08-01, címkék: `experimental`, `baking-for-lts`) |
| 5.2 | A repó rögzített Node verziója `26.7.0` (`.nvmrc` `v26.0.0`), tehát a beépített ZIP API a rögzített verzióban **nem érhető el** (8 verzióval később jelent meg)                                                                                                                                                                                                                                                                                                                          | `docs/research/2026-08-26-toolchain.md`; a futtatókörnyezet `node -v` kimenete `v26.7.0`                                                                                                                                                                                                                                                                                                                            |
| 5.3 | `yauzl` `3.4.0` (MIT, 2026-06-07 frissítve, függősége: `pend`); a README alapelvei: "Follow the spec", "Keep memory usage under control", "Catch unsafe file names. See `validateFileName()`"; a `validateFileName` elutasítja a `/`-rel és a `[A-Za-z]:/` alakkal kezdődő, a `..` szegmenst és a `\\` jelet tartalmazó nevet; a `validateEntrySizes` (alapból bekapcsolva) a deklarált és tényleges kicsomagolt méret egyezését ellenőrzi; a README zip bomba elleni védekezést is leír | elsődleges: <https://github.com/thejoshwolfe/yauzl> (README); verzió: <https://registry.npmjs.org/yauzl/latest> és <https://unpkg.com/yauzl@3.4.0/package.json> (két független forrás); típusok: `@types/yauzl` `3.4.0` (<https://registry.npmjs.org/@types/yauzl/latest>, egy forrás)                                                                                                                              |
| 5.4 | A `yauzl` 3.2.0 verzióját érinti a `CVE-2026-31988` (a `getLastModDate()` NTFS mező olvasásának egy-eggyel elcsúszott határa, szolgáltatásmegtagadás); javítva a 3.2.1-ben                                                                                                                                                                                                                                                                                                               | <https://api.github.com/advisories?ecosystem=npm&affects=yauzl> (GHSA-gmq8-994r-jv83)                                                                                                                                                                                                                                                                                                                               |
| 5.5 | Más jelöltek (nem ajánlott, csak a teljesség miatt): `fflate` `0.8.3` (<https://registry.npmjs.org/fflate/latest>, <https://unpkg.com/fflate@0.8.3/package.json>), `adm-zip` `0.6.1`, `@zip.js/zip.js` `2.24.0` (mindkettő egy forrás: registry); az útvonal ellenőrzés a hívó dolga vagy nem dokumentált                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5.6 | A szerver kérés törzs olvasója (`readJsonRequestBody`) ma korlát nélkül gyűjti a törzset, és JSON-ként értelmezi                                                                                                                                                                                                                                                                                                                                                                         | saját olvasás: `apps/server/src/http-server/read-json-request-body.ts`                                                                                                                                                                                                                                                                                                                                              |
| 5.7 | Zip méret és fájlszám korlátra a Claude Code / Agent SDK dokumentációban **nincs** szám (az SDK lokális skilljére). **2026-10-28:** az Anthropic Skills API doksija ad számot, és a zip bomba védelemre iparági ajánlás van: a 7. szekció                                                                                                                                                                                                                                                | a 3. szekció oldalai; a 7. szekció                                                                                                                                                                                                                                                                                                                                                                                  |

Az 5.3 és 5.5 verziószámok jelöltek, nem rögzítettek: a döntés után a rögzített verzió a
`docs/research/2026-08-26-toolchain.md` fájlba kerül (`.claude/CLAUDE.md` 4. szekció 4. pont).

## 7. O-33 ... O-37: a zip kezelés forrásai (2026-10-28)

Módszer: Exa (`web_search_exa`, `web_fetch_exa`), élő npm registry és jsDelivr lekérdezés `curl`-lel, a
GitHub API tag listája. Valódi API hívás nem futott. A user kifejezett elvárása szerint ahol a termékre
szabott forrás nincs, az iparági ajánlás az alapérték, a forrás megnevezésével.

### 7.1 A kicsomagolt összméret: 30 MB

| Állítás                                                                | Forrás                                                                                                                                                                                                                       | Idézet                                                                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Az Anthropic Skills API egy skill feltöltésének összméretét korlátozza | elsődleges: <https://platform.claude.com/docs/en/build-with-claude/skills-guide> ("Limits and constraints")                                                                                                                  | "Maximum Skill upload size: 30 MB (all files combined, uncompressed)"; "Total upload size must be under 30 MB (uncompressed)" |
| ugyanez                                                                | megerősítés 1: <https://changelogs.core-directive.com/docs/change/1497> (a doksi változásnapló, 2026-08-19)                                                                                                                  | "Total upload size must be under 30 MB (uncompressed)" (a korábbi 8 MB helyett)                                               |
| ugyanez                                                                | megerősítés 2: <https://www.developersdigest.tech/blog/claude-files-api-agent-skills>; <https://apidog.com/blog/claude-skills-api-ga/>                                                                                       | "Total upload must be under 30 MB uncompressed"; "The whole upload must stay under 30 MB uncompressed"                        |
| A "MB" decimális vagy bináris volta                                    | nem ellenőrzött: a doksi nem mondja ki; egy harmadik fél kliens `30 * 1024 * 1024` értéket használ (<https://github.com/modus-agendi/terraform-provider-anthropic-claude-managed-agents/blob/main/internal/client/skill.go>) |                                                                                                                               |

**Alkalmazás:** 30 000 000 bájt, a decimális (szigorúbb) olvasat, ami a bináris olvasat mellett is a
korláton belül marad. Az Anthropic a saját korlátját az API-ra mondja, nem a helyi SDK skillre; a
projekt a legközelebbi, termékre szabott hivatalos számként alkalmazza.

### 7.2 A bejegyzések száma: 1024

| Állítás                                                                                      | Forrás                                                                                                           | Idézet                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A zip kicsomagolás fájlszám korlátja a CERT megfelelő megoldásában 1024, az összméret 100 MB | elsődleges: <https://wiki.sei.cmu.edu/confluence/display/java/IDS04-J.+Safely+extract+files+from+ZipInputStream> | "the code also counts the number of file entries in the archive and throws an exception if there are more than 1024 entries"; `static final int TOOMANY = 1024; // Max number of files`; "The actual limit depends on the capabilities of the platform and expected usage." |
| A bejegyzés szám korlátja kötelező védelem, a minta értéke 10000                             | <https://rules.sonarsource.com/javascript/rspec-5042/>, <https://rules.sonarsource.com/csharp/rspec-5042/>       | "Count the number of file entries extracted from the archive and abort the extraction if their number is greater than a predefined threshold"; `const MAX_FILES = 10000;`                                                                                                   |
| A minta számai önkényesek                                                                    | <https://community.sonarsource.com/t/incorrect-security-remedy-for-adm-zip/97929> (Sonar munkatárs)              | "the threshold is picked rather arbitrarily as different situations require different limits"                                                                                                                                                                               |

**Alkalmazás:** 1024, a két iparági minta közül a szigorúbb (CERT), mert egy skill a doksi szerint egy
`SKILL.md` plusz néhány `references/`, `assets/`, `scripts/` fájl (<https://claude.com/docs/skills/how-to>).
A konkrét szám két független megerősítése nincs: a két forrás eltérő számot ad, a választás a
szigorúbb, kimondott indokkal.

### 7.3 Tömörítési arány: nincs külön korlát

| Állítás                                                                                                                                    | Forrás                                                                                               | Idézet                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A kicsomagolás közben, a ténylegesen olvasott bájtokon számolt összméret megállítja a zip bombát; a fejléc deklarált mérete nem megbízható | <https://wiki.sei.cmu.edu/confluence/display/java/IDS04-J.+Safely+extract+files+from+ZipInputStream> | "a malicious attacker can forge the field in the ZIP file that purports to show the uncompressed size"; "tracks the uncompressed file size of each entry ... while extracting the entry" |
| A `yauzl` alapból ellenőrzi a deklarált és a tényleges méret egyezését                                                                     | <https://github.com/thejoshwolfe/yauzl> (README, `open()`)                                           | "`validateEntrySizes` is the default and ensures that an entry's reported uncompressed size matches its actual uncompressed size"                                                        |
| Az arány küszöb (Sonar: 10) ép fájlokat is blokkol                                                                                         | <https://community.sonarsource.com/t/incorrect-security-remedy-for-adm-zip/97929>                    | "This blocked valid and innocuous zip files for us."; a válasz: "picked rather arbitrarily"                                                                                              |

**Alkalmazás:** nincs külön arány korlát; a 30 MB összméret a kicsomagolás közben, kiírt bájtokon
számolva korlátoz (CERT módszer), a `yauzl` `validateEntrySizes` pedig a hazudó fejlécet fogja.

### 7.4 A feltöltött törzs: 30 000 000 bájt (levezetett)

Közvetlen forrás nincs (a claude.ai súgója csak annyit mond: "ZIP file exceeds size limits",
<https://support.claude.com/en/articles/12512180-use-skills-in-claude>). Levezetés: a törzs korlát
nélkül a szerver korlát nélkül olvasna (5.6), tehát kell; a zip a tartalmon felül csak fejléceket
hordoz, tehát egy 7.1 szerint elfogadható skill zipje a gyakorlatban ugyanekkora vagy kisebb. A
határeset (tömörítés nélküli, a korlátot kitöltő tartalom) a fejlécek miatt elbukhat: kimondott,
elfogadott következmény, mert ugyanaz a skill tömörítve átmegy.

### 7.5 A `yauzl` verziója

| Csomag         | Verzió                                                                        | Forrás 1                                                | Forrás 2                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yauzl`        | 3.4.0 (közzétéve 2026-06-07; függőség `pend` `~1.2.0`; `engines.node` `>=12`) | <https://registry.npmjs.org/yauzl> (`dist-tags.latest`) | <https://data.jsdelivr.com/v1/packages/npm/yauzl> (`tags.latest`); a GitHub tag lista (<https://api.github.com/repos/thejoshwolfe/yauzl/tags>) első eleme `3.4.0` |
| `@types/yauzl` | 3.4.0 (közzétéve 2026-06-13; `ts6.0` tag: 3.4.0)                              | <https://registry.npmjs.org/@types/yauzl>               | <https://data.jsdelivr.com/v1/packages/npm/@types/yauzl>                                                                                                          |

A `docs/research/2026-08-26-toolchain.md` fájlba a bevezetés commitjában kerül (`.claude/CLAUDE.md` 4.
szekció 4. pont). A használt opciók a README szerint: `lazyEntries: true` ("will keep memory usage under
control for zip files with many entries"), `validateEntrySizes: true`, `strictFileNames: true` ("entries
with backslashes in their file names will result in an error"), `fromBuffer` (a törzs pufferből).

### 7.6 O-35: a zip belső elrendezése

| Állítás                                                                  | Forrás                                                                                                                                                         | Idézet                                                                                                                                                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Az API a gyökérben álló és az egy mappába zárt `SKILL.md`-t is elfogadja | elsődleges: <https://platform.claude.com/docs/en/build-with-claude/skills-guide>                                                                               | "Must include a `SKILL.md` file at the upload root (or at the top of a single enclosing folder)"                                                      |
| ugyanez, a változás ténye                                                | megerősítés 1: <https://changelogs.core-directive.com/docs/change/1497>; megerősítés 2: <https://www.developersdigest.tech/blog/claude-files-api-agent-skills> | a régi "A zip archive must contain the skill directory as its single top-level entry" helyén az új mondat; "Root placement is new with the GA shape." |
| A claude.ai feltöltés a mappás alakot írja elő                           | <https://support.claude.com/en/articles/12512198-how-to-create-custom-skills>; <https://claude.com/docs/skills/how-to>                                         | "The ZIP should contain the skill folder as its root"; "a `SKILL.md` sitting at the root of the ZIP isn't recognized as a skill"                      |

**Alkalmazás:** mindkét alak elfogadott (SPEC-009 5.4 4. pont): így minden, az Anthropic bármelyik
leírása szerint készült zip feltölthető.

### 7.7 O-36: az átviteli alak

| Állítás                                                                | Forrás                                                                                                                                  | Idézet                                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A base64 minden 3 bájtot 4 karakterrel ír, a méret kb. egyharmaddal nő | elsődleges: <https://www.rfc-editor.org/rfc/rfc4648#section-4>; megerősítés: <https://developer.mozilla.org/en-US/docs/Glossary/Base64> | "three 8-bit bytes ... can be represented by four 6-bit Base64 digits"; "roughly a third larger than its source" |
| Az Anthropic Skills API bináris multipart feltöltést használ           | <https://platform.claude.com/docs/en/api/skills>                                                                                        | "Body parameters (form-data)"; `-H 'Content-Type: multipart/form-data'`, `-F 'files[]=@...'`                     |
| A `yauzl` pufferből olvas                                              | <https://github.com/thejoshwolfe/yauzl>                                                                                                 | "`fromBuffer(buffer, [options], [callback])` Like `fromFd()`, but reads from a RAM buffer"                       |

## 8. O-39: az auto memory kikapcsolása (2026-10-28)

| Állítás                                                                       | Forrás                                                                                                                                   | Idézet                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A hivatalos izolációs recept a `settingSources: []` mellé a változót írja elő | elsődleges: <https://code.claude.com/docs/en/agent-sdk/claude-code-features> (1. szekció, a "What settingSources does not control" rész) | "set `settingSources: []` plus `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in `env`"                             |
| A változó jelentése                                                           | megerősítés 1: <https://code.claude.com/docs/en/env-vars>                                                                                | "Set to `1` to disable auto memory. ... When disabled, Claude does not create or load auto memory files" |
| ugyanez                                                                       | megerősítés 2: <https://code.claude.com/docs/en/memory>                                                                                  | "To disable auto memory via environment variable, set `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`."              |

## 9. O-42: a lépés MCP mezőjének tárolt alakja (PLAN-012 T-012-5a, 2026-10-28)

**Kérdés.** A központi MCP lista (SPEC-009 O-31) mellett a lépés hivatkozása (a) a meglévő
`mcpServers` mező értékének cseréjével, vagy (b) új mezővel álljon, úgy, hogy a régi gráf és
pillanatkép olvasható maradjon (`.claude/CLAUDE.md` 10. szekció 2. pont), és ne keletkezzen halott ág
(100 százalékos lefedettség, `.claude/CLAUDE.md` 5. szekció).

**Döntés: (b).** A lépés configja egy új, elhagyható mezőt kap a hivatkozásnak (munkanév:
`mcpServerReferences`; kulcsa a központi definíció neve, értéke a lépés felülírása, kizárólag nevekkel).
A meglévő `mcpServers` mező típusa, guardja és protokoll sémája változatlan; a felület csak olvashatóan
mutatja, a motor továbbra sem adja át. Módszer: a `feat/spec-009-beallitasok` ág `7228ca3` fejének
olvasása (`sed`, `grep`), valódi futás nélkül.

### 9.1 A kódból olvasott tények

| #      | Tény                                                                                                                                                                                                     | Hely                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1.1  | A lépés `mcpServers` mezője `Readonly<Record<string, StorableMcpServer>>`; a három ág értéket nem, csak env változó nevet hordoz                                                                         | `packages/db/src/workflow-graph/agent-step-config/agent-step-config.ts:72`; `storable-mcp-server.ts:21-49`                                                |
| 9.1.2  | Az `isAgentStepConfig` guard zárt kulcslistával dolgozik: ismeretlen kulcs elutasítva; az `mcpServers` minden értéke az `isStorableMcpServer` hármas ágán megy át, az ágak is zárt kulcslistásak         | `packages/db/src/workflow-graph/agent-step-config/is-agent-step-config.ts:48-68, 95-112, 167-198, 244-267`                                                |
| 9.1.3  | A zárt kulcslista guard a hiányzó kulcsot nem vizsgálja, csak az ismeretlent tiltja ("A hiányzó kulcsot nem vizsgálja")                                                                                  | `packages/typeguards/src/is-record-with-known-keys/is-record-with-known-keys.ts:3-16`                                                                     |
| 9.1.4  | A protokoll párja ugyanez az alak (`z.record(z.string(), StorableMcpServerSchema)`, `z.strictObject` ágak); az olvasó és a mentési séma közös alapja                                                     | `packages/protocol/src/node-config/agent-step-config.ts:67`; `packages/protocol/src/node-config/storable-mcp-server.ts:9-46`                              |
| 9.1.5  | A két oldal `NodeConfig` típusa kétirányban egyenlő a `typecheck` kapun, és a protokoll szerint érvényes érték a `db` guardon is átmegy                                                                  | `apps/server/src/node-config-drift-protection/node-config-drift-protection.spec.ts:49-58, 147-157`                                                        |
| 9.1.6  | A pillanatkép a node configot változatlanul (`unknown`) másolja, a szűkítés az `isNodeConfig` guarddal történik; a motor a futás indításakor ugyanezzel szűkít, különben `malformed_node_config`         | `packages/db/src/graph-snapshot/snapshot-document/graph-snapshot-document.ts:29-41`; `packages/engine/src/run-validation/validate-node-configs.ts:2, 33`  |
| 9.1.7  | A `readGraph` is ezzel a guarddal olvas (`corrupt_node_config`), és a `replaceGraph` írás előtt is futtatja                                                                                              | `packages/db/src/workflow-graph/workflow/workflow-repository.ts:247-266, 329`; `packages/db/CLAUDE.md:98-110, 142`                                        |
| 9.1.8  | A felület az `mcpServers` mezőbe soha nem írt nem üres értéket: az új lépés kezdő configja `{}`, a beállítás panel csak olvashatóan mutatja, az agent definíció sora `readonly` vezérlő                  | `apps/web/src/node-inspector/default-agent-step-settings.ts:26`; `AgentStepConfigFields.tsx:21, 280-291`; `agent-definition-field-table.ts:11-13, 97-102` |
| 9.1.9  | A REST út nem üres értéket is elfogad: a `PUT .../graph` mentési sémája ugyanezt a rekord sémát használja, tehát egy nem a felületről küldött kérés ilyet menthetett, és az pillanatképbe is kerülhetett | `packages/protocol/src/node-config/agent-step-config.ts:67`; `apps/server/src/workflow-endpoint/replace-workflow-graph.ts:16`                             |
| 9.1.10 | A motor az `mcpServers` mezőt kihagyja, tehát egy tárolt nem üres érték ma hatástalan                                                                                                                    | `packages/engine/src/agent-step/build-agent-step-options.ts:91-94, 98-120`                                                                                |
| 9.1.11 | Az SDK agent definíciójának `mcpServers` mezője `AgentMcpServerSpec[]`, az elem név vagy rekord; az `agents` mező a `db` és a `protocol` oldalán `Record<string, unknown>`, a guard nem szűkíti          | telepített `sdk.d.ts:59, 120`; `agent-step-config.ts:70`; `.claude/CLAUDE.md` 5. szekció                                                                  |
| 9.1.12 | A kanonikus pillanatkép lenyomatát egy commitolt fixtúra és a rá épülő teszt őrzi                                                                                                                        | `packages/db/src/graph-snapshot/snapshot-hash/graph-snapshot-document-v1-fixture.json` és `graph-snapshot-document-v1-fixture.spec.ts`                    |
| 9.1.13 | A TypeScript `exactOptionalPropertyTypes` kapcsolója be van kapcsolva                                                                                                                                    | `tooling/tsconfig/base.json:10`                                                                                                                           |

### 9.2 Az (a) alak

Az (a) a meglévő `mcpServers` értékének típusát cserélné (`StorableMcpServer` helyett hivatkozás). A
pillanatkép megváltoztathatatlan, és a 9.1.9 szerint régi, nem üres érték a REST úton keletkezhetett,
tehát a 9.1.6 és 9.1.7 guardjának a régi ágat is el kellene fogadnia, különben egy ilyen régi futás
újraindítása `malformed_node_config`, a gráf olvasása `corrupt_node_config` hibát adna. Az érték típusa
így a régi definíció és az új hivatkozás uniója lenne a `db`, a `protocol` (olvasó séma) és a felület
oldalán is, és a motornak (a régi ág leképezése vagy elutasítása) és a szerkesztőnek (a régi érték
megjelenítése és mentése) ágenként kellene kezelnie. Ha a mentési séma csak az új alakot fogadná, egy
régi értékű gráf a felületről nem lenne változatlanul menthető, ami új termékkérdést nyitna. A régi
ág nem lenne halott (régi sorral elérhető), de minden rétegben új kódot hoz. Ha a felület soha nem írt
nem üres értéket (9.1.8), az csak a felületi útra igaz; a REST utat a kód nem zárja ki, tehát a régi
ág nem hagyható el.

### 9.3 A (b) alak

A (b)-ben a `mcpServers` típusa, guardja és protokoll sémája bájtra változatlan, tehát minden régi gráf
és pillanatkép a mai úton olvasható, és a meglévő sodródás védelem rá változatlanul érvényes. Az új
mező elhagyható: a hiánya a régi sorokon a természetes állapot, és a zárt kulcslista guard (9.1.3) a
hiányzó kulcsot eleve elfogadja; a guard új ága "hiányzik" vagy "érvényes hivatkozás rekord", és
mindkettő régi, illetve új sorral elérhető, tehát halott ág nincs. Az új mező a kanonikus
dokumentumban csak akkor jelenik meg, ha a config hordozza, tehát a régi pillanatképek bájtjai és
lenyomata nem változik (9.1.12). A régi mező nem üres értéke ma hatástalan (9.1.10), és az is marad:
ez a mai viselkedés megtartása, nem új döntés.

### 9.4 Következmények (átvezetve a SPEC-009 6.1, 6.2, 6.4 szekciójába)

1. A központi definíció saját tárolt alakot kap (új tábla, régi sora nincs): a három ág, a `stdio`
   ágon kötelező `envBindings` mezővel. A `StorableMcpServer` nem bővül, tehát az `envBindings`
   hiányának olvasási kérdése nem áll fenn.
2. A lépés új mezőjének kulcsa a központi definíció neve, értéke a lépés felülírása, kizárólag
   nevekkel (a `stdio` ágon deklarált név -> szerver oldali név, a `sse` és `http` ágon az
   `authEnvName` felülírása); a pontos mezőket és a végleges nevet a T-012-10 rögzíti. A `db` és a
   `protocol` oldalon ugyanaz a típus, a `node-config-drift-protection` kétirányú egyenlőségével; a
   9.1.13 kapcsoló mellett az elhagyható mező pontos deklarációját (a `db` oldali `?:` és a zod
   `.optional()` egyezését) a `typecheck` kapu dönti el, nem ez a jegyzet.
3. A régi `mcpServers` mező: a felület csak olvashatóan mutatja (a korábbi hatókör indoklás szöveg
   helyett a régi, a futás által nem használt alakot megnevező szöveggel), a motor nem képezi le, a
   mentési séma változatlanul elfogadja.
4. Az agent definíció `mcpServers` bejegyzése az `agents` szűkítetlen rekordjában marad (9.1.11), tehát
   a döntés a guardot és a sodródás védelmet nem érinti.

### 9.5 A T-012-10 régi gráf tesztjének terve

1. `packages/db` `is-agent-step-config.spec.ts`: a guard átengedi (i) az új mező nélküli configot üres
   `mcpServers` értékkel, (ii) az új mező nélküli configot nem üres régi `mcpServers` értékkel mindhárom
   ágon, (iii) az új mezővel; elutasítja az új mező ismeretlen kulcsú vagy nem név értékű bejegyzését.
2. `packages/db`, valós `:memory:` adatbázison a commitolt migrációkkal: egy régi alakú node config
   nyers SQL beszúrással a `workflow_node` táblába, a `readGraph` sikeres; egy régi alakú pillanatkép
   dokumentum a `graph_snapshot` táblába, a pillanatkép olvasása sikeres; a v1 fixtúra és a lenyomat
   teszt változatlanul zöld.
3. `packages/protocol`: a `NodeConfigSchema`, a `WorkflowGraphDocumentSchema` és a
   `NodeConfigSaveSchema` a régi alakot (új mező nélkül, nem üres régi értékkel) elfogadja.
4. `apps/server` `node-config-drift-protection`: a típusszintű egyenlőség az új mezővel; futásidejű ág
   a régi és az új alakra (mindkét oldalon átmegy) és az új mező ismeretlen kulcsára (mindkét oldalon
   elbukik), a meglévő "ismeretlen kulcs" és "szabadon maradó mezők" csoport mintájára.
5. `packages/engine`: régi pillanatképből (új mező nélkül, nem üres régi `mcpServers` értékkel) a futás
   indítási ellenőrzése nem ad `malformed_node_config` hibát, és a kimenő `Options`-ban a régi érték nem
   jelenik meg; az új mező hiánya és az üres rekord ugyanazt az `Options` objektumot adja.
6. e2e: a `GET .../graph` mock régi alakú configgal (új mező nélkül, nem üres régi értékkel) betölt, és
   a mentés `PUT` törzse a régi `mcpServers` értéket változatlanul visszaküldi.

## 6. Amit nem tudtunk megerősíteni (nem ellenőrzött)

- A plugin skill neve, ha a `.claude-plugin/plugin.json` hiányzik (a plugin neve a könyvtárnévből jön-e): az M-136.
- Hogy a `skills` opció elhagyásakor a plugin úton betöltött skillek elérhetők-e a modellnek: az M-136.
- A `yauzl` `Entry` mezőinek pontos bitkiosztása a szimbolikus link felismeréséhez: a PLAN-012 F0 a README
  `Entry` szakaszából olvassa.
- Az MCP szerver név teljes karakterhalmaza (4.1): lezárva a 10.3 szekcióban.

## 10. T-012-2: a SPEC-009 2.3 "nem ellenőrzött" soraira (2026-10-28)

Módszer: Exa (`web_fetch_exa`, `web_search_exa`), a telepített `sdk.d.ts` (`0.3.245`) és `sdk.mjs` olvasása,
valódi API hívás nélkül. A doksi a legfrissebb SDK-t írja le (a TS referencia és az unpkg példa `0.3.303`-ig
hivatkozik), a pinelt `0.3.245`-re a telepített d.ts mérvadó. Minden tételnél: elsődleges forrás, megerősítések,
ítélet.

### 10.1 Skills oldal: "Invalid skill name error" és a plugin skill (2.3 első sor)

- Elsődleges: <https://code.claude.com/docs/en/agent-sdk/skills> ("Invalid skill name error"): üres név, zárójel,
  vessző vagy vezérlő karakter, szóközzel kiegészített név és joker (`*`, `:*` suffix) esetén a `query()` a
  Claude Code folyamat indítása előtt hibát dob; a TS SDK `Error`-t (`Invalid skill name "docs:*": wildcard-suffix
names are not allowed; list each skill by its exact name.`), a Python `ValueError`-t. Ez a SPEC-009 2.2 sorát
  megerősíti (a 3.2 sor már idézte).
- Ugyanaz az oldal: az `init` `skills` tömbje "lists the same skills whether or not they're in your `skills`
  list", a felderítés a `settingSources` `user` és `project` forrásán megy, vagy a `plugins` opcióval ("use the
  `plugins` option to load skills from a specific path"); a `skills` kihagyva: "discovered skills are enabled".
- **Ítélet: a 2.3 első sora marad "nem ellenőrzött".** A doksi nem mondja ki, hogy `settingSources: []` mellett a
  plugin úton betöltött skill megjelenik-e az `init` `skills` tömbjében, melyik nevet fogadja a lista, ha a
  frontmatter `name` eltér a könyvtárnévtől, és hogy a `skills` elhagyásakor a plugin skill elérhető-e a
  modellnek. Az M-136 (PLAN-012 T-012-3) méri.

### 10.2 A TS referencia `Query` metódusai (2.2 sor)

- Elsődleges: <https://code.claude.com/docs/en/agent-sdk/typescript> (`Query` objektum): `supportedModels():
Promise<ModelInfo[]>` ("Returns available models with display info"), `mcpServerStatus():
Promise<McpServerStatus[]>` ("Returns the status of connected MCP servers"); az MCP oldal is hivatkozza
  (`mcpServerStatus()` "to poll ... in the TypeScript SDK").
- Telepített d.ts: `sdk.d.ts:2528` (`supportedModels`), `:2540` (`mcpServerStatus`), a `McpServerStatus` típus
  `status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'`, `error?`, `tools?`.
- Megerősítés 1 (harmadik fél): <https://github.com/fcsouza/agent-skills/blob/main/skills/claude-agent-sdk/references/typescript-api.md>;
  megerősítés 2: <https://github.com/bgauryy/open-docs/blob/505ade2c/research/AI/@anthropic-ai/claude-code/claude-code-architecture.md>;
  a `McpServerStatus` alakot az unpkg `0.3.303` d.ts is mutatja
  (<https://app.unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.303/files/sdk.d.ts>).
- **Ítélet: ellenőrzött** (a 2.2 sor "nem ellenőrzött (doksi)" jelölése "ellenőrzött"-re vált). A `ModelInfo`
  mezőit a telepített `sdk.d.ts:1247` adja, az a kód olvasásakor mérvadó.

### 10.3 Az MCP szerver név szabálya (2.3 harmadik sor)

- Hivatalos doksi: <https://code.claude.com/docs/en/agent-sdk/mcp> ("Tool naming convention"): "Characters in the
  server name such as `.` and spaces are replaced by `_`" (példa, nem kimerítő lista).
- Elsődleges a teljes szabályra, a telepített `sdk.d.ts:3805` (`SDKControlMcpCallRequest.tool` megjegyzése):
  "server names are normalized: non-[a-zA-Z0-9_-] becomes _".
- Megerősítés 1 (harmadik fél, a Claude Code belső működését magyarázó oldal): <https://claude-code-explain.helmcode.com/mcp/>
  ("Characters outside `[a-zA-Z0-9_-]` are replaced with `_`", példa: `My Server!` -> `mcp__My_Server___do_thing`).
  Megerősítés 2 (harmadik fél kódmásolat): <https://github.com/LING71671/Open-ClaudeCode/blob/main/src/services/mcp/normalization.ts>
  (`name.replace(/[^a-zA-Z0-9_-]/g, '_')`, "API pattern ^[a-zA-Z0-9_-]{1,64}$"). A két megerősítés nem hivatalos,
  ezt a SPEC-009 2.2 sora kimondja.
- Nem összetévesztendő: a `sdk.mjs` `/^[a-zA-Z0-9_-]+$/` mintája ("Server name can only contain letters,
  numbers, hyphens, and underscores") egy másik mező (engedélyezett szerver név a konfigurációs sémában), nem
  a csere szabálya.
- **Ítélet: ellenőrzött** (telepített d.ts plusz két nem hivatalos megerősítés). A 64 karakteres plafon és a
  `__` elválasztó ütközése (a név nem tartalmazhat `__`-t megbízhatóan) a harmadik fél forrásban szerepel, hivatalos
  doksi nem mondja: **nem ellenőrzött**, a mentési szabály (6.1: ASCII betű, szám, `_`, `-`) úgyis szűk marad.

### 10.4 Auto memory és `~/.claude.json` (2.2 "settingSources nem vezérli" sor)

- Elsődleges: <https://code.claude.com/docs/en/agent-sdk/claude-code-features> ("What settingSources does not
  control"): a `~/.claude.json` "Always read", kikapcsolás "Relocate with `CLAUDE_CONFIG_DIR` in `env`"; az auto
  memory (`~/.claude/projects/<projekt>/memory/`) "Loaded into the system prompt at session start", kikapcsolás
  "`autoMemoryEnabled: false` in settings, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in `env`"; a többszerzős
  üzemhez "`settingSources: []` plus `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in `env`".
- Auto memory megerősítései: a 8. szekció (<https://code.claude.com/docs/en/env-vars>,
  <https://code.claude.com/docs/en/memory>).
- `CLAUDE_CONFIG_DIR` megerősítései: <https://code.claude.com/docs/en/claude-directory> ("If you set
  `CLAUDE_CONFIG_DIR`, every `~/.claude` path on this page lives under that directory instead");
  <https://github.com/anthropics/claude-code/issues/25762> (Anthropic munkatárs: "set `CLAUDE_CONFIG_DIR` to
  relocate the config directory. All settings, session history, plugins, and (on Linux/Windows) credentials live
  under that path; on macOS credentials stay in the Keychain"); <https://github.com/anthropics/claude-code/issues/264>.
  Az env-vars oldal szerint a projekt és a helyi `settings.json` nem állíthatja a `CLAUDE_CONFIG_DIR`-t, az `env`
  opció (folyamat környezet) igen.
- **Ítélet:** az auto memory kikapcsolása és a `CLAUDE_CONFIG_DIR` áthelyezés **ellenőrzött** (három-három forrás). A
  "a `~/.claude.json` mindig beolvasódik, a `settingSources` nem érinti" állítás, a managed policy és a
  `sandbox.credentials` sor **egy hivatalos forrásra** támaszkodik (a többi oldal ezt nem ismétli): a sor
  "részben ellenőrzött". Az előfizetéses bejelentkezés `settingSources: []` mellett (2.3 negyedik sor) marad
  "nem ellenőrzött", a PLAN-012 valódi próbája zárja.

### 10.5 Összesítés

| SPEC-009 sor                                        | Előtte                  | Utána                                                   |
| --------------------------------------------------- | ----------------------- | ------------------------------------------------------- |
| 2.3 plugin skill és `skills` lista (M-136)          | nem ellenőrzött         | marad (az M-136 méri)                                   |
| 2.3 stdio MCP környezet öröklés (M-139)             | nem ellenőrzött         | marad (az M-139 méri)                                   |
| 2.3 MCP szerver név karakterhalmaza                 | nem ellenőrzött         | ellenőrzött (telepített d.ts, két nem hivatalos forrás) |
| 2.3 előfizetéses bejelentkezés `settingSources: []` | nem ellenőrzött         | marad (valódi próba, user engedéllyel)                  |
| 2.2 `Query.supportedModels`, `mcpServerStatus`      | nem ellenőrzött (doksi) | ellenőrzött                                             |
| 2.2 `settingSources` nem vezérli                    | egy hivatalos forrás    | részben ellenőrzött (auto memory, `CLAUDE_CONFIG_DIR`)  |
