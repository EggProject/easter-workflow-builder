# SDK session log vs. `run_event` és `graph_snapshot`, 2026-08-28

Kérdés: kiválthatja-e a Claude Agent SDK saját session-perzisztenciája a `run_event`
táblát, és kiválthatja-e a `graph_snapshot` táblát. Forrás: a telepített
`@anthropic-ai/claude-agent-sdk@0.3.245` típusdefiníciója
(`tools/wire-probe/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`), a hivatalos
doksi (`code.claude.com/docs/en/sessions` és `code.claude.com/docs/en/agent-sdk/session-storage`,
lekérve 2026-08-28), és három valós session fájl a futtatókörnyezetben
(`~/.claude/projects/-sessions-vigilant-clever-mendel-mnt-easter-workflow-builder-tools-wire-probe/`),
amit a `tools/wire-probe` M-07/M-13/M-28 mérési esetei hoztak létre.

## 1. A session log formátuma

`~/.claude/projects/<project>/<sessionId>.jsonl`, ahol a `<project>` a munkakönyvtár
elérési útja, minden nem-alfanumerikus karakter `-`-re cserélve; 200 karakter fölött a
CLI 200-ra vágja és a teljes útvonal hash-ét fűzi hozzá. Forrás:
`code.claude.com/docs/en/sessions` ("Where transcripts are stored") és ugyanez a
szabály szó szerint a `sdk.d.ts` `SessionKey.projectKey` kommentjében ("Paths longer
than 200 characters are truncated and suffixed with a portable djb2 hash"). A
`CLAUDE_CONFIG_DIR` env változó áthelyezi a teljes `~/.claude` gyökeret.

**Ez NEM a `query()` által streamelt `SDKMessage` alak.** A hivatalos doksi szó szerint:
"The entry format is internal to Claude Code and changes between versions, so scripts
that parse these files directly can break on any release." A saját mérésünk ezt
megerősíti: a három valós `.jsonl` fájlban talált sortípusok
(`queue-operation`, `user`, `assistant`, `attachment`, `last-prompt`, `atis-latch`,
`ai-title`) egyike sem `system`/`init`, `result`, `stream_event` vagy `hook_*` -
ezek az `SDKMessage` unió ágai, de **egyik sem jelenik meg a fájlban**. A perzisztens
`user`/`assistant` sor is bővebb az `SDKMessage`-nél (`parentUuid`, `isSidechain`,
`promptId`, `permissionMode`, `cwd`, `gitBranch`, `version` mezőkkel), ez a CLI saját,
verziónként változó transzkript-formátuma, amit a `SessionStoreEntry` típus is csak
`{ type: string, uuid?, timestamp?, [k]: unknown }` opaque szupertípusként ír le.

**Token-számláló van, összesített `result` nincs.** Az `assistant` sor
`message.usage` mezője tartalmazza a `input_tokens`/`output_tokens`/
`cache_read_input_tokens`/`cache_creation_input_tokens` értékeket (ténylegesen
kiolvasva egy valós sorból), de a streamelt `result` üzenet `total_cost_usd` és
`num_turns` mezőjének a JSONL-ben **nincs megfelelője** - egyik vizsgált fájlban sem
volt `result`-szerű sor.

## 2. Segédfüggvények

`listSessions({dir?, limit?, offset?, includeWorktrees?, includeProgrammatic?})` lapozható
(`limit`/`offset`), `SDKSessionInfo[]`-t ad vissza (`sessionId`, `summary`,
`lastModified`, `fileSize?`, `customTitle?`, `firstPrompt?`, `gitBranch?`, `cwd?`,
`tag?`, `createdAt?` - **nincs token/költség mező**). `getSessionInfo(sessionId, {dir?})`
egyetlen session-t olvas. `getSessionMessages(sessionId, {dir?, limit?, offset?,
includeSystemMessages?})` a `parentUuid`-láncot építi fel és csak
`'user'|'assistant'|'system'` típusú `SessionMessage`-eket ad vissza
(`message: unknown`); store-ból olvasva ez a **post-compaction** láncot adja, a teljes
nyers előzményhez `store.load(key)` kell közvetlenül (doksi, "getSessionMessages
returns the post-compaction chain"). `renameSession`/`tagSession`/`deleteSession`
egy-egy mutáló entry-t fűznek a fájlhoz (`SessionMutationOptions: {dir?, sessionStore?}`).

## 3. A `sessionStore` opció

**`@alpha`** jelölésű a típusdefinícióban (`SessionStore`, `SessionStoreEntry`,
`SessionSummaryEntry`, `listSessionSummaries`, `foldSessionSummary` mind `@alpha`),
tehát nem stabil API. Interfész: kötelező `append(key, entries)` és `load(key)`,
opcionális `listSessions`, `listSessionSummaries`, `delete`, `listSubkeys`.

**Nem helyettesíti a helyi lemezírást, csak tükrözi.** A hivatalos doksi: "The Claude
Code subprocess always writes each batch of transcript entries to local disk first,
and the SDK then forwards the same batch to your store's append(), so the store is a
mirror of the local transcript rather than a replacement for it." Friss (nem resume)
session esetén a helyi `.jsonl` mindig megmarad a futás végén, a store csak másolatot
kap. Csak akkor törlődik a helyi példány, ha a futás a store-ból lett resume-olva.
**A `sessionStore` és a `persistSession: false` együtt nem használható**, a doksi
szerint az SDK indításkor hibát dob rá. Retenció: "The SDK never deletes from your
store on its own" - a takarítás teljes egészében a saját adapter felelőssége, az SDK
sosem hív rá törlést automatikusan.

## 4. `persistSession: false`

Kikapcsolja a `~/.claude/projects/`-be írást, a session nem resume-olható utólag
(`sdk.d.ts`, `Options.persistSession` komment, szó szerint). A `tools/wire-probe`
`buildBaseOptions()` (`tools/wire-probe/src/harness/runner.ts:148`) alapból
`persistSession: false`-t állít; három mérési eset (`M-07`, `M-13`, `M-28`) explicit
felülírja `true`-ra, ezek hozták létre a most talált valós fájlokat.

## 5. Élettartam

`cleanupPeriodDays` alapértéke **30**, minimum 1 (`sdk.d.ts` settings-típus, szó
szerint: "Number of days to retain chat transcripts before automatic cleanup
(default: 30). Minimum 1."). Két független megerősítés: a hivatalos
`code.claude.com/docs/en/sessions` doksi ("Change the 30-day retention" sor) és
több GitHub issue (pl. `anthropics/claude-code#62476`,
`anthropics/claude-code#64999`), amik pontosan ezt a startup-kori, mtime alapú
törlést írják le. **Fél évvel későbbi visszanézésre a helyi `.jsonl` alapból NEM
számítható**, csak ha a user saját Claude Code beállítása a 30 napnál nagyobbra van
állítva - ez nem a mi alkalmazásunk kezében van.

## 6. Párhuzamos `query()` hívások

Nincs ütközés: `Options.sessionId` alapból auto-generált UUID hívásonként
(`sdk.d.ts`, "Use a specific session ID... instead of an auto-generated one"), a
fájlnév maga a sessionId, a könyvtár a cwd-ből képződik. A most talált három fájl
pontosan ezt mutatja: ugyanabban a projekt-könyvtárban (`tools/wire-probe` cwd) három
különálló sessionId-jű `.jsonl` él egymás mellett, egy-egy `query()` hívásból.

## 7. Provider-függetlenség

Empirikusan igazolt, nem feltételezés. A `buildBaseOptions()` a `model: 'MiniMax-M3'`
és `env.ANTHROPIC_BASE_URL: context.proxyBaseUrl` (a wire-probe MiniMax felé forgató
logoló proxyja) beállítással fut, és a `persistSession: true`-t használó esetek
(`M-07` "d-persist-session" ág) ugyanezt az alapkonfigurációt öröklik. A ténylegesen
talált `8ab5dfb7-...jsonl` fájl `assistant` sorainak `message.model` mezője mind
`"MiniMax-M3"` - a session log tehát a kliens (CLI subprocess) oldalán, a
providertől függetlenül keletkezik.

## 8. Mérési artefaktum

Három valós fájl a futtatókörnyezetben:
`8ab5dfb7-f210-452e-a1f4-0a95dbb3dc9a.jsonl` (57 sor), `21d65e96-c66d-40b3-af31-a1f9427ef274.jsonl`
(41 sor), `9599939b-5538-42b9-9c19-aa90909a4583.jsonl` (11 sor), plusz egy
`491fab4a-.../subagents/agent-*.meta.json` alkönyvtár subagent metaadatokkal. Egyikben
sincs `result`, `system`/`init` vagy `stream_event` sor; token-adat kizárólag az
`assistant.message.usage` mezőn belül van jelen.

---

## Verdikt A) - kiválthatja-e a session log a `run_event` táblát

**Nem.** Indoklás:

- A `run_event.id` `AUTOINCREMENT`-je adja a WebSocket replay szigorúan monoton
  kurzorát (`packages/db/src/run-event/run-event.ts` kommentje). A JSONL fájl sorrendje
  fájlon belül append-only, de nincs saját, stabil, kereshető sorszáma; a
  `getSessionMessages`/`listSessions` limit/offset alapú lapozást ad, nem
  kurzor-alapú "id > X" replay-t.
- A JSONL formátum a hivatalos doksi szerint verziónként változik és nem API-felület
  ("scripts that parse these files directly can break on any release") - egy
  Claude Code frissítés csendben eltörhetné a lapozott transcript-panelt.
- **Hiányzó tartalom**: nincs `result` sor (nincs `total_cost_usd`, `num_turns`),
  nincs `stream_event` (nincs élő delta-stream, ha ezt valaha bekapcsolnánk), nincs
  hook esemény egyik talált fájlban sem (ez utóbbi NEM MEGERŐSÍTETT végérvényesen,
  mert a mért esetek nem futottak `hooks` beállítással - a hiány közvetett bizonyíték,
  nem kizáró teszt).
- **A `run_event` 25 `kind` értékéből 13 `engine` eredetű** (`run_started`,
  `step_started`, `branch_taken`, `fan_out_expanded`, `join_resolved`,
  `approval_requested` stb., `packages/db/src/run-event/run-event-kind.ts`) - ezek a mi
  workflow-motorunk saját eseményei, a Claude Agent SDK-nak fogalma sincs róluk, tehát
  a session log eleve csak a `run_event` sorok kevesebb mint feléhez tudna bármit
  mondani.
- **Futás/lépés összerendelés**: egy workflow futás sok `query()` hívásból áll, a
  session log csak `cwd`/`gitBranch` szintű metaadatot ismer, `run_id`/`step_run_id`
  fogalma nincs - ezt csak úgy tudnánk visszafejteni, ha mi magunk tároljuk a
  `session_id`-t a saját táblánkban, amit a `run_event.sdk_session_id` oszlop már meg
  is tesz.
- **Törlés kaszkádja nem működne tranzakcióban**: a `run_event` a `workflow_run`/
  `step_run` `ON DELETE CASCADE` láncába tartozik, egy SQLite tranzakción belül. A
  helyi `.jsonl` fájl törlése (`deleteSession()`) egy külön, fájlrendszeri művelet, nem
  vehető részt egy DB tranzakcióban.
- **Ugyanaz a gép, CLI is fut**: ha a user a Claude Code CLI-t is használja ugyanabban
  a munkakönyvtárban, az ő interaktív session-jei és a workflow motor `query()`
  hívásai **ugyanabba a `~/.claude/projects/<cwd>/` könyvtárba** írnak (ezt a most
  talált három fájl is mutatja: azonos `tools/wire-probe` cwd, három különálló
  sessionId). A saját `run_event` táblánk ezzel szemben tisztán a mi workflow
  futásainkra szűrt.
- A `sessionStore` (`@alpha`) elméletileg kivezethetné az írást saját tárolóba, de a
  dual-write architektúra miatt ez **mindig másolat** friss session esetén, nem
  helyettesítés - a helyi `.jsonl` naprakész marad emellett is, kivéve ha minden lépés
  store-ból resume-olva indul, ami nem a mi futási modellünk (minden lépés jellemzően
  friss `query()`).

## Verdikt B) - kiválthatja-e a session log a `graph_snapshot` táblát

**Nem, egyértelműen.** A `graph_snapshot` a mi saját fogalmunk: a workflow gráf
(node-ok, élek, lépés-beállítások) tartalom szerint deduplikált, sha256 hash-elt,
megváltoztathatatlan dokumentuma (`packages/db/src/graph-snapshot/graph-snapshot.ts`).
A Claude Agent SDK session logja egyetlen `query()` hívás beszélgetés-transzkriptje;
nincs benne semmi, ami a gráf topológiáját, a node-típusokat vagy az élek
konfigurációját reprezentálná - a `cwd`/`gitBranch` szintű metaadat a legközelebbi
dolog, és az egy fájlrendszeri könyvtárra, nem egy vizuális gráfra vonatkozik. Az SDK-nak
nincs is fogalma arról, hogy "workflow gráf" létezik: a `query()` egyetlen prompt-ot és
`Options`-t kap, nem egy node-gráfot. Itt nincs elméleti kiváltási lehetőség sem.

---

**Amit nem sikerült véglegesen eldönteni**: hogy a hook-események (`PreToolUse`,
`Stop` stb.) valaha megjelennek-e a helyi `.jsonl` transzkriptben - a három mért
fájl egyike sem futott `hooks` beállítással, ez dedikált mérést igényelne, ezért ez a
pont NEM MEGERŐSÍTETT.
