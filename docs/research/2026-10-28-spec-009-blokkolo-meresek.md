# PLAN-012 F0: a SPEC-009 blokkoló mérései (T-012-3 M-136, T-012-4 M-139)

|               |                                                                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dátum         | 2026-10-28                                                                                                                                                                                                                                                        |
| Terv          | [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md) T-012-3, T-012-4                                                                                                                                 |
| Spec          | [`../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md`](../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md) 4., 5.3, 6.4 szekció                                                                                                                             |
| Mérő eszközök | [`2026-10-28-spec-009-blokkolo-meresek/`](2026-10-28-spec-009-blokkolo-meresek/): `m136.mjs`, `m139.mjs`, a közös `csonk-messages-api.mjs`, `sdk-betolto.mjs`, `mcp-jsonrpc.mjs`, `mcp-stdio-csonk.mjs`; nyers kimenet `m136-kimenet.jsonl`, `m139-kimenet.jsonl` |

## 1. Felállás

- **Verziók.** `@anthropic-ai/claude-agent-sdk` `0.3.245` (a repó telepítése, a `tools/wire-probe`
  csomag `node_modules` linkjén át, a `package.json` `version` mezője a kimenet első sorában), a
  beágyazott CLI `claude_code_version` értéke `2.1.245` (az `init` üzenetből, `m136-kimenet.jsonl`),
  Node `v26.7.0`. Linux `aarch64` sandbox.
- **Valódi API hívás nem volt.** Az `Options.env` teljesen lecseréli a CLI környezetét (SPEC-009 2.2), és
  a mérés ezt adja meg: `PATH`, eldobható `HOME`, `CLAUDE_CONFIG_DIR=<HOME>/.claude`,
  `ANTHROPIC_BASE_URL` a helyi csonkra (`127.0.0.1`, OS által kiosztott port), `ANTHROPIC_API_KEY` egy
  hamis jelölő (`csonk-kulcs-nem-valodi`), `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`,
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `DISABLE_TELEMETRY=1`, `DISABLE_AUTOUPDATER=1`. Mellette
  `settingSources: []` és `strictMcpConfig: true`, és minden eset saját, üres `cwd`-ben fut. A mérés előtt
  a sandbox környezetében nem állt kulcs vagy token nevű változó (csak `CLAUDE_TMPDIR`,
  `CLAUDE_CODE_TMPDIR`, `CLAUDE_CODE_CERT_STORE`), és a gépen nincs `/etc/claude-code` managed policy.
- **A csonk minden kérést naplóz.** Esetenként pontosan egy `HEAD /api/hello` (404) és a
  `POST /v1/messages?beta=true` kérések érkeztek; más útvonal nem. **Nem ellenőrzött**, hogy a CLI a
  csonkon kívül más hostot nem szólított meg (hálózati elzárás root nélkül nem állítható); a kulcs hamis,
  tehát egy ilyen kérés hitelesítést nem hordozhatott.
- **A csonk válasza.** Az első modell kérésre `tool_use` blokk (M-136: `Skill` a vizsgált névvel; M-139:
  `mcp__stdio-csonk__ping`), a `tool_result` utáni kérésre szöveg. Így a nyers kimenetben a modellnek
  küldött skill listázás (a kérés törzsének `- <név>: <leírás>` sorai) és az eszköz valódi eredménye is
  látszik. A `canUseTool` minden hívást enged.
- **Titok és kép.** A kimenetekben nincs kulcs: a hamis kulcs neve igen, értéke nem került kiírásra; a
  sandbox útvonalai `<home>`, `<sandbox-home>`, `<pluginok>`, `<meresi-mappa>`, `<node>` jelölésre
  cserélve. A jelölő értékek (`jelolo-ertek-nem-titok`, `Bearer jelolo-fejlec-nem-titok`) szándékosan
  nem titkok. Képet egyik script sem ír. A CLI saját leírásaiban álló gondolatjel a kimenetben `-` jelre
  cserélve (a gyökér `CLAUDE.md` 6. szekciója).
- **Futtatás.** A mappából `node m136.mjs > m136-kimenet.jsonl` és `node m139.mjs > m139-kimenet.jsonl`;
  egy futás kevesebb mint egy perc.

## 2. M-136: a `plugins` úton betöltött skill

Plugin gyökerek (`m136.mjs`): `easter-skills` (manifeszttel, `.claude-plugin/plugin.json`
`{"name":"easter-skills"}`; `skills/alfa/SKILL.md` `name: alfa`, `skills/beta/SKILL.md`
`name: gamma-mas`), egy manifeszt nélküli gyökér `manifeszt-nelkuli-mappa` néven
(`skills/delta/SKILL.md`), és `utkozo` (manifeszttel; `skills/simplify/SKILL.md`, ami a CLI beépített
`simplify` skilljével azonos könyvtárnév, és `skills/nevtelen/SKILL.md` `name` mező nélkül). A plugin
útvonal abszolút (a `8a` eset kivételével, ami a `cwd`-hez relatív).

| Eset | `skills` opció                            | A modell listázásában (plugin és beépített)      | `Skill` hívás neve              | Eredmény                                                               |
| ---- | ----------------------------------------- | ------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------- |
| 1a   | `['easter-skills:alfa']`                  | `easter-skills:alfa`                             | `easter-skills:alfa`            | betöltve (`Launching skill`, a `SKILL.md` törzse a következő kérésben) |
| 1b   | `['alfa']`                                | `easter-skills:alfa`                             | `easter-skills:alfa`            | betöltve                                                               |
| 1c   | `['alfa']`                                | `easter-skills:alfa`                             | `alfa`                          | betöltve                                                               |
| 1d   | `[]`                                      | semmi                                            | `easter-skills:alfa`            | elutasítva: "not in this session's skills allowlist"                   |
| 2a   | `['easter-skills:beta']`                  | `easter-skills:beta`                             | `easter-skills:beta`            | betöltve                                                               |
| 2b   | `['easter-skills:gamma-mas']`             | semmi                                            | `easter-skills:gamma-mas`       | elutasítva: "not in this session's skills allowlist"                   |
| 2c   | `'all'`                                   | mindkét plugin skill és tíz beépített            | `easter-skills:gamma-mas`       | betöltve (a `beta` könyvtár törzse)                                    |
| 2d   | `'all'`                                   | ugyanaz                                          | `easter-skills:beta`            | betöltve                                                               |
| 2e   | `['gamma-mas']`                           | semmi                                            | `gamma-mas`                     | elutasítva: "not in this session's skills allowlist"                   |
| 2f   | `['beta']`                                | `easter-skills:beta`                             | `beta`                          | elutasítva: "Unknown skill: beta"                                      |
| 3a   | elhagyva, `plugins` megadva               | mindkét plugin skill és tíz beépített            | `easter-skills:alfa`            | betöltve                                                               |
| 3b   | elhagyva, `plugins` nélkül                | tíz beépített                                    | `easter-skills:alfa`            | elutasítva: "Unknown skill"                                            |
| 4a   | `'all'`, manifeszt nélküli plugin         | `manifeszt-nelkuli-mappa:delta` és tíz beépített | `manifeszt-nelkuli-mappa:delta` | betöltve                                                               |
| 4b   | `['manifeszt-nelkuli-mappa:delta']`       | `manifeszt-nelkuli-mappa:delta`                  | ugyanaz                         | betöltve                                                               |
| 5a   | `['easter-skills:nincs-ilyen']`           | semmi                                            | ugyanaz                         | nem dob; a hívás elutasítva: "Unknown skill"                           |
| 5b   | `['rossz,nev']`                           | (nem indul)                                      |                                 | a `query()` a folyamat indítása előtt dob: "Invalid skill name"        |
| 6a   | `['simplify']`                            | `utkozo:simplify` **és** a beépített `simplify`  | `simplify`                      | a beépített indul                                                      |
| 6b   | `['utkozo:simplify']`                     | `utkozo:simplify`                                | `utkozo:simplify`               | betöltve                                                               |
| 7a   | `['utkozo:nevtelen']`                     | `utkozo:nevtelen`                                | `utkozo:nevtelen`               | betöltve                                                               |
| 8a   | `['easter-skills:alfa']`, relatív útvonal | `easter-skills:alfa`                             | `easter-skills:alfa`            | betöltve                                                               |

A tíz beépített skill a listázásban: `dataviz`, `update-config`, `keybindings-help`, `simplify`,
`fewer-permission-prompts`, `loop`, `claude-api`, `run`, `init`, `security-review`. Az `init` üzenet
`skills` tömbje ennél több beépített nevet hordoz (`deep-research`, `verify`, `debug`, `code-review`,
`batch`, `doctor`, `run-skill-generator` is); hogy ezek miért nincsenek a modell listázásában, nem
ellenőrzött. A beépítettek a CLI-ből jönnek, nem a gépről: üres `HOME`, `CLAUDE_CONFIG_DIR` és `cwd`
mellett, `settingSources: []` alatt is megjelennek.

**Megállapítások:**

1. **Az `init` `skills` tömbje** a felfedezett skillek **teljes** listája: a plugin skillek
   `<plugin>:<könyvtárnév>` alakban (`easter-skills:alfa`, `easter-skills:beta`), plusz a CLI beépített
   skilljei. A `skills` opció **nem** szűri (minden esetben azonos, 1d-ben is). Az `init` `plugins`
   tömbje `{ name, path }`, a `path` a megadott útvonal abszolút alakja (a 8a relatív útvonala is
   abszolútként jelent meg). Tehát az `init` arra jó, hogy a skill **felfedezését** igazolja, arra
   nem, hogy az engedélyezést.
2. **A plugin neve** a manifeszt `name` mezője; manifeszt nélkül a plugin gyökér könyvtárának neve
   (4a, 4b).
3. **A skill neve a könyvtárnév**, plugin skillnél `<plugin>:<könyvtárnév>`, eltérő frontmatter `name`
   mellett is (2a ... 2f), és `name` mező nélkül is (7a). A `skills` lista a könyvtárnevet fogadja: a
   frontmatter néven álló bejegyzés (teljes és puszta alakban is, 2b, 2e) a skillt elrejti és a hívást
   elutasítja. A `Skill` eszköz ezen felül a `<plugin>:<frontmatter név>` alakot is feloldja ugyanarra a
   skillre, ha az engedélyezés ezt átengedi (2c). A hivatalos doksi szerint plugin skillnél a frontmatter
   `name` az utolsó parancs szakaszt cseréli (research `2026-10-26-spec-009-forrasok.md` 3.3); a pinelt
   verzióban mérve az `init`, a `slash_commands` és a listázás a könyvtárnevet mutatja, tehát ez a doksi
   állítás a pinelt verzióra nem áll.
4. **A `skills` lista alakja.** A `<plugin>:<könyvtárnév>` alak elfogadott (1a, 2a, 4b, 6b, 7a, 8a). A
   puszta könyvtárnév is engedélyezi a plugin skillt (1b, 2f), de **ugyanilyen nevű beépített skillt is**
   (6a: a `simplify` bejegyzés a `utkozo:simplify` és a beépített `simplify` skillt is a modell elé
   tette, és a `simplify` hívás a beépítettet indította). A puszta alak tehát ütközhet.
5. **`'all'`** a plugin skillek mellett a CLI beépített skilljeit is engedélyezi (2c, 2d, 4a).
6. **`skills` elhagyva** (3a): a `plugins` skilljei és a beépítettek a modell elé kerülnek és
   hívhatók; a d.ts "not skills off" állítása mérve. `plugins` nélkül (3b) a beépítettek maradnak.
7. **`[]`** (1d) a modell elől minden skillt elrejt, a hívást elutasítja.
8. **Nem létező, de érvényes alakú név** (5a): a `query()` nem dob, a futás sikeres, a skill nincs a
   listában, a hívás "Unknown skill". A motor saját `skill_not_found` ellenőrzése (SPEC-009 O-13) ezért
   szükséges, az SDK nem ad indítási hibát. **Érvénytelen alakú név** (5b): a `query()` dob, a d.ts
   szerint, szó szerint: `Invalid skill name "rossz,nev": parentheses, commas, and control characters are
not allowed in skill names. Skill names match the skill's directory name (or 'plugin:skill' for
plugin-qualified skills); rename the skill if its directory name contains these characters.`
9. **A `plugins` útvonal** abszolút és a `cwd`-hez relatív alakban is működik (8a).

## 3. M-139: helyi stdio és http MCP csonk

A stdio csonk (`mcp-stdio-csonk.mjs`, `command: process.execPath`, `args: [script, jelentésfájl]`)
indításkor a kapott környezet **neveit** (és a `PATH`, `HOME`, `CLAUDE_CONFIG_DIR`, `DEKLARALT_VALTOZO`,
`EASTER_PROBE_SECRET` értékét) fájlba írja. A http csonk ugyanabban a folyamatban fut (Streamable HTTP,
JSON válasz, `GET` kérésre 405), az `Authorization` fejlécet ellenőrzi. A JSON-RPC kézi
(`mcp-jsonrpc.mjs`): a `@modelcontextprotocol/sdk` nincs a repó egyetlen csomagjának függőségei között
sem. A mérő folyamat `process.env` környezetében `EASTER_PROBE_SECRET=jelolo-ertek-nem-titok` áll.

| Változat | `Options.env`                                   | Az MCP szerver `env` mezője  | A stdio gyerek környezete                                                                                                                               |
| -------- | ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1       | izolált (jelölő nélkül)                         | `{ DEKLARALT_VALTOZO }`      | a CLI teljes környezete (`ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `PATH`, `HOME`, ...) + a CLI saját változói + `DEKLARALT_VALTOZO`; jelölő **nincs** |
| V2       | izolált + `EASTER_PROBE_SECRET`                 | `{ DEKLARALT_VALTOZO }`      | ugyanaz, és a jelölő **megvan**                                                                                                                         |
| V3       | izolált + `EASTER_PROBE_SECRET`                 | nincs `env` mező             | a CLI teljes környezete, a jelölővel                                                                                                                    |
| V4       | elhagyva (a CLI a mérő `process.env`-ét örökli) | `{ DEKLARALT_VALTOZO }`      | a mérő folyamat teljes környezete (49 név, a jelölővel)                                                                                                 |
| V5       | izolált                                         | `{ HOME: '/felulirt-home' }` | a CLI környezete, a `HOME` értéke `/felulirt-home`                                                                                                      |

A CLI saját, a gyereknek továbbadott változói (a megadott `Options.env` neveken felül): `AI_AGENT`,
`CLAUDECODE`, `CLAUDE_AGENT_SDK_VERSION`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SESSION_ID`,
`CLAUDE_PROJECT_DIR`, `COREPACK_ENABLE_AUTO_PIN`, `NoDefaultCurrentDirectoryInExePath`.

**Megállapítások:**

1. **A kapcsolat állapota.** Mindkét csonk `connected` az `init` üzenet `mcp_servers` tömbjében
   (`{ name, status }`), és a `mcpServerStatus()` ugyanezt adja, `serverInfo`, `scope: 'dynamic'` és
   `tools: ['ping']` mezővel. Az eszköznév `mcp__stdio-csonk__ping`, `mcp__http-csonk__ping`; a
   `mcp__stdio-csonk__ping` hívás eredménye `pong stdio-csonk`. Az `init` nem `pending` állapottal
   érkezett: a CLI az `init` előtt bevárta a kapcsolódást (öt változat, mind `connected`). A d.ts szerint viszont az MCP indulás alapból nem blokkoló, és csak az `alwaysLoad: true` vár
   a kapcsolódásra (`sdk.d.ts` `McpStdioServerConfig.alwaysLoad`); hogy az `init` minden környezetben már
   a végleges állapotot hordozza, **nem ellenőrzött**, ezért a végleges állapot forrása a
   `mcpServerStatus()`.
2. **Sikertelen szerver.** Lezárt portú http szerverre és nem létező stdio parancsra (V1) az `init`
   `failed` állapotot ad, a `mcpServerStatus()` `error` mezővel ("Unable to connect. Is the computer
   able to access the url?", illetve `ENOENT ... posix_spawn`). A futás ettől **nem** bukik
   (`result` `success`).
3. **A stdio alfolyamat környezete egyesítés, nem csere.** A gyerek a **CLI teljes környezetét** örökli
   (ami a megadott `Options.env`, vagy annak hiányában a szülő `process.env`), plusz a CLI saját
   változóit, és erre ráíródik az MCP szerver `env` mezője (V5: a mező felülír). A `PATH` és a `HOME`
   tehát a CLI környezetéből megérkezik (V1 ... V3: a `PATH` azonos a CLI `PATH`-jával, a `HOME` a CLI
   `HOME`-ja); az `env` mező hiánya (V3) sem üríti a környezetet. Egy, a CLI környezetében **nem** álló
   szülő változó (V1: a mérő folyamat `EASTER_PROBE_SECRET` jelölője) nem jut el a gyerekhez; a CLI
   környezetében álló bármely változó (V2, V3, V4) eljut, akkor is, ha az MCP `env` mezője nem nevezi
   meg. **Következmény:** a provider hitelesítő adata (itt `ANTHROPIC_API_KEY`; a motorban a kimenő blokk
   kulcsa, SPEC-012 3.1) és a szerver környezetének minden változója, amit a motor `Options.env`-be tesz,
   **minden stdio MCP szerver folyamatában megjelenik**.
4. **A http ág alakja.** `{ type: 'http', url, headers: { Authorization } }`: a fejléc minden kérésen
   (`initialize`, `notifications/initialized`, `GET`, `tools/list`) változatlanul megérkezett. A
   `mcpServerStatus()` `config` mezője a http szerver `headers` értékét **szó szerint visszaadja** (a
   jelölő fejléc a nyers kimenetben látszik); a stdio ág `config` mezője `{ type, command, args }`, az
   `env` mezőt nem adja vissza. Az `init` üzenet csak `{ name, status }` párt hordoz.
5. **Az `sse` ágat** a mérés nem vizsgálta (nem volt a T-012-4 része); a 6.4 `sse` sora a d.ts
   (`McpSSEServerConfig`) és a http mérés analógiája, mérés nélkül.

## 4. Hatás a SPEC-009-re

- **5.3 (a lista elemeinek alakja):** a javaslat mérve igazolt és pontosítva: a tárolt elem a puszta
  könyvtárnév (a feltöltéskor megadott név), a motor `<plugin>:<név>` alakban adja át, ahol a plugin
  név a skill könyvtár gyökerének `plugin.json` `name` mezője, vagy manifeszt nélkül a gyökér
  könyvtárneve. A puszta alak átadása **nem** elfogadható, mert a CLI azonos nevű beépített skilljét is
  engedélyezi (2. szekció 4. pont). A tárolt `'all'` állapotot a motor a skill könyvtár neveinek
  explicit `<plugin>:<név>` listájára fordítja, mert az SDK `'all'` a beépítetteket is engedélyezi
  (5. pont); ez a "minden feltöltött skill" jelentés (5.2) megvalósítása, nem új döntés.
- **O-37** változatlan és mérve megalapozott: az SDK a könyvtárnevet használja, a frontmatter név a
  listán hatástalan; a hiányzó `name` elfogadott (7a).
- **O-40** (`null`: sem `plugins`, sem `skills`): a feltöltött skillek valóban nem érhetők el (3b), de a
  CLI beépített skilljei a modell elé kerülnek és hívhatók. Ez a 5.2 "a lépés nem használ feltöltött
  skillt" mondatával összefér, de a "nincs beállítva" állapot nem jelent "skill nélkül"-t; kérdés a
  usernek (jelentés).
- **6.4 (leképezés):** a `stdio` és a `http` sor alakja mérve működik (`connected`). A stdio `env`
  mező a CLI környezetére **ráíródik**, nem helyettesíti; a 6.4 "env: { <deklarált név>: <érték> }"
  sora így igaz, de a gyerek a deklarált neveken túl a motor teljes kimenő környezetét is megkapja
  (3. szekció 3. pont). Ez a 6.1 titok szabályát (a változó NÉV hozzárendelése a lépésen) nem sérti,
  de a "három GitHub fiók" esetben a másik két fiók tokenje is a gyerek környezetében áll, ha a szerver
  környezetében van; kérdés a usernek (jelentés).
- **A naplózás:** a `mcpServerStatus()` `config` mezője a http `Authorization` értékét hordozza, ezért
  a motor ezt a választ nem naplózhatja és nem írhatja `run_event` sorba (SPEC-009 AC19).
