# Gráfszerkesztő és transcript panel felderítés, 2026-09-05

Kérdés: a SPEC-008 (vizuális gráf szerkesztő, transcript panel, osztott nézet) megírásához
négy nyitott terület tényszerű felderítése. Minden állítás mögött saját, ebben a
munkamenetben lefuttatott mérés vagy hivatalos dokumentációs hivatkozás áll. A repó nem
módosult ezen fájlon kívül.

---

## 1. `@xyflow/react` a projekt tényleges felállásában

**Módszer.** Eldobható próba `/tmp/xyflow-meres` alatt (repón kívül): `react@19.2.8`,
`react-dom@19.2.8`, `@xyflow/react@12.11.5`, `vitest@4.1.11`, `happy-dom@20.11.6` -
mindegyik a projekt rögzített verziója (`docs/research/2026-08-26-toolchain.md`). Render a
projekt saját unit teszt mintája szerint: nyers `react-dom/client` `createRoot` + `act`,
`@testing-library` nélkül (`packages/ui/src/button/Button.spec.tsx` mintája).

**React 19 kompatibilitás.** A telepített `@xyflow/react@12.11.5` `package.json`
`peerDependencies` mezője `react: ">=17"`, `react-dom: ">=17"`, `@types/react: ">=17"`,
`@types/react-dom: ">=17"` - a `19.2.8` a range-en belül van. **Saját méréssel igazolva**:
a fenti Vitest+happy-dom felállásban egy két node + egy él gráf hibátlanul renderelt,
kivétel nélkül.

**Licenc.** A telepített csomag tényleges `LICENSE` fájlja MIT, `Copyright (c) 2019-2025
webkid GmbH`, extra feltétel nélkül. Külön, nem licenc jellegű megfigyelés: a kirajzolt
`react-flow__attribution` panel szövege `"Please only hide this attribution when you are
subscribed to React Flow Pro"` - ez UI szöveg, nem a LICENSE fájl tartalma.

**DOM szerkezet, saját méréssel (a kirajzolt `innerHTML`-ből).** A csomópontok és élek
valóban DOM elemek, nem canvas - ezt a hivatalos `reactflow.dev/learn/advanced-use/testing`
oldal is kimondja ("relies on rendering DOM elements"), és a saját mérés megerősíti:

| Elem                       | Attribútumok, tényleges kirajzolt értékek                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| wrapper (`.react-flow`)    | `role="application"`, `data-testid="rf__wrapper"`                                                                                                                       |
| node (`.react-flow__node`) | `role="group"`, `aria-roledescription="node"`, `tabindex="0"`, `data-id="<id>"`, **`data-testid="rf__node-<id>"`**, `aria-describedby` egy rejtett leíró `div`-re mutat |
| edge leíró konténer        | `id="react-flow__edge-desc-1"`, `display:none`, előre legenerálva akkor is, ha egy él sem renderelődött                                                                 |
| élő régió                  | `id="react-flow__aria-live-1"`, `aria-live="assertive"`, `aria-atomic="true"`                                                                                           |

**Locator következmény.** A node `role="group"` **generikus**, minden node ugyanazt a
role-t kapja (hacsak nincs `ariaRole` felülírás egy node-on) - tehát `getByRole('group')`
önmagában nem különbözteti meg a node-okat, csak `.filter({ hasText })`-tel vagy egy
konkrét node-ra szűkítve. A projekt kötött locator sorrendje szerint (`getByRole` elsőként)
ez azt jelenti, hogy egy adott node kiválasztásához a gyakorlatban a beépített
**`data-testid="rf__node-<id>"`** a használható, egyedi azonosító - ez nem `getByRole`, de
a hivatalos xyflow API **saját maga** szállítja ezt a testid-et, nem a projektnek kell
felvennie.

**`ResizeObserver` és happy-dom - két saját mérés.** A telepített csomag forrása
(`node_modules/@xyflow/react/dist/umd/index.js`) mindenhol védetten hívja:
`"undefined"!=typeof ResizeObserver?new ResizeObserver(...)`- tehát happy-dom stubján
(ami létezik, csak üres törzsű, SPEC-007 M-24) **nem dob hibát**.

1. **Node explicit `width`/`height` nélkül:** a node `style` attribútuma
   `visibility:hidden` marad (a forrás: `visibility:O?"visible":"hidden"`, ahol `O` a
   `measured.width && measured.height` állapotból jön), és a `.react-flow__edges` konténer
   **teljesen üres** marad - egyetlen él sem rajzolódik ki, mert a happy-dom
   `ResizeObserver` stub sosem hívja meg a callback-et, tehát a `measured` mező sosem
   frissül.
2. **Node explicit `width`/`height`-tel megadva** (`{ id, position, data, width: 150,
height: 40 }`): a node azonnal `visibility:visible` lesz (a forrás
   `e.measured?.width??e.width??e.initialWidth??0` láncán az explicit `width` mező elég,
   `ResizeObserver` nélkül is) - **de a `.react-flow__edges` konténer ekkor is teljesen
   üres marad.**

**Verdikt.** Happy-dom alatt a node-ok szerkezete, ARIA attribútumai és a `data-testid`
egyezősége **unit tesztelhető**, ha a node objektumokon explicit `width`/`height` mező áll.
**Az élek happy-dom alatt semmilyen körülmények között nem jelennek meg** ebben a mérésben

- az élrajzolás tesztelése kizárólag e2e (valós böngésző, Playwright) útján lehetséges,
  összhangban a `docs/research/2026-08-29-playwright-teszt-szabalyok.md` 10. szekciójával
  ("React Flow needs to measure nodes in order to render edges").

**Billentyűzet, hivatalos doksi (`reactflow.dev/learn/advanced-use/accessibility`) plusz
saját render kimenet.** Alapból minden node és él `tabIndex={0}` és `role="group"`;
`Tab` fókuszál, `Enter`/`Space` kiválaszt, `Escape` törli a kijelölést, nyilak mozgatják a
kijelölt node-ot (`Shift`-tel gyorsabban), fókuszáláskor automatikus pan viszi képbe a
node-ot (`autoPanOnNodeFocus`). A saját mérésben kirajzolt leíró szöveg szó szerint
megegyezik a doksi dokumentált alapértékével: _"Press enter or space to select a node. You
can then use the arrow keys to move the node around. Press delete to remove it and escape
to cancel."_

**Vezérelt kontra nem vezérelt, hivatalos doksi.** A
`reactflow.dev/learn/concepts/adding-interactivity` oldal szó szerint: _"Passing `nodes`
and `edges` to the `ReactFlow` component is called **controlled flow**. This means that
you are in control of the state of the nodes and edges."_ Ehhez `useState` (vagy a
kényelmi `useNodesState`/`useEdgesState` hook) plusz `onNodesChange`/`onEdgesChange` és az
`applyNodeChanges`/`applyEdgeChanges` segédfüggvény kell. A
`reactflow.dev/learn/advanced-use/uncontrolled-flow` oldal ezzel szemben: nem vezérelt
módban "the state of the nodes and edges is handled by React Flow internally", és a
mentéshez ekkor **nincs** helyi state - a `useReactFlow()` instance `getNodes()`/`toObject()`
hívásán át kell kiolvasni. **Mivel a szerkesztő tartalmát menteni kell, a hivatalos minta a
vezérelt (`controlled`) mód**: a node/edge tömb már a saját state-ben van, a mentés ebből
egyenesen szerializálható, nem kell külön instance-hívás.

---

## 2. A transcript panel megjelenítendő tartalma, a projekt saját adataiból

**A `run_event.kind` 25 zárt értéke** (`packages/protocol/src/transcript/run-event-kind.ts`,
egy az egyben a `packages/db/src/run-event/event-kind/run-event-kind.ts` szándékos
duplikátuma):

| Eredet        | Értékek                                                                                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdk` (12)    | `sdk_system`, `sdk_assistant`, `sdk_user`, `sdk_stream_event`, `sdk_result`, `sdk_hook_started`, `sdk_hook_progress`, `sdk_hook_response`, `sdk_informational`, `sdk_commands_changed`, `sdk_rate_limit`, `sdk_context_usage`                               |
| `engine` (13) | `run_started`, `run_finished`, `run_interrupted`, `step_started`, `step_finished`, `branch_taken`, `fan_out_expanded`, `join_resolved`, `loop_iteration_started`, `approval_requested`, `approval_decided`, `sub_workflow_started`, `sub_workflow_finished` |

**A `RunEventRecord` mezői** (`run-event-record.ts`), amik egy sorhoz ténylegesen
elérhetők: `id`, `runId`, `stepRunId`, `origin`, `kind`, `occurredAtMs`,
`sdkMessageType`/`sdkMessageSubtype`, `sdkSessionId`, `sdkUuid`, `parentToolUseId`,
`toolName`/`toolUseId`, négy usage szám (`inputTokens`, `outputTokens`,
`cacheReadInputTokens`, `cacheCreationInputTokens`), `numTurns`, és a teljes nyers
`payload: unknown`.

**Mit kell megjeleníteni fajtánként** (`packages/db/src/run-event/sdk-message/normalize-sdk-message.ts`
tényleges leképezése):

- **`sdk_assistant`**: a `message.content` tömb `tool_use` blokkjából az ELSŐ blokk
  `name`/`id` kerül `toolName`/`toolUseId` oszlopba (transcript panelen: "eszközhívás
  neve + azonosítója"); a `message.usage` a négy token oszlopba.
- **`sdk_result`**: `usage` top-level mezőből a négy token oszlop, plusz `numTurns` -
  **nincs költség oszlop** (`total_cost_usd` a nyers `payload`-ban marad, mert first-party
  árazás, a MiniMaxnál nem értelmezhető).
- **`sdk_system`**: az öt alfajta (`hook_started`, `hook_progress`, `hook_response`,
  `informational`, `commands_changed`) saját `kind`-ot kap a `subtype` mezőből; minden más
  `system` subtype (`init`, `status`, `thinking_tokens`, `compact_boundary`, ...) a gyűjtő
  `sdk_system` alá esik.
- **`sdk_stream_event`**: a `content_block_delta` jellegű részleges szöveg - lásd a delta
  kapcsoló hatását alább.
- **`sdk_rate_limit`**: a `rate_limit_event` SDK üzenettípusból.
- **`sdk_context_usage`**: a leképezésből **szándékosan hiányzik** saját forrás - a pinelt
  SDK-ban nincs önálló üzenet erre (a `context_usage` az `SDKAssistantMessage` egy mezője,
  nem külön üzenet), nyitott pontként dokumentálva a `packages/db` CLAUDE.md fájlban.
- **Motor eredetű 13 `kind`**: nem SDK üzenetből, hanem a workflow motor saját eseményéből
  jön, `origin: 'engine'`; ezeknek nincs `sdkMessageType`/`sdkMessageSubtype`/token mezője.

**Az öt SSE keret típus** (`packages/protocol/src/event-stream/stream-frame.ts`,
diszkriminált unió az `event` mezőn): `stream_ready` (kapcsolat felépülés, nincs `id:`),
`run_event` (`delivery: 'replayed'|'live'`, ez az egyetlen keret, ami `id:` sort kap az
SSE kódolásban), `run_event_transient` (nincs `id:`, nincs `delivery`, mindig élő),
`replay_complete` (`throughEventId` nullable), `protocol_error`.

**A delta kapcsoló hatása a transcript panelre** (a szabálykönyv 10. szekció 3. pontja,
`workflow_run.persisted_stream_deltas`, alapból kikapcsolva):

- **Ha a kapcsoló kikapcsolt (alapállapot):** a `content_block_delta` jellegű `sdk_stream_event`
  üzenetek **nem kerülnek a `run_event` táblába**, tehát nincs `id`-juk, és a
  `GET /api/runs/{runId}/events` lapozott lekérdezés (`ReadRunEventsQuerySchema`) **soha
  nem adja vissza őket** visszanézéskor. Élőben viszont a `run_event_transient` keretként
  megérkeznek a nyitott SSE kapcsolatra - tehát a transcript panel **élőben** karakterenkénti
  streamelést mutathat, de **egy oldal-újratöltés vagy egy múltbeli futás megnyitása után
  ez a részletesség elvész**, csak a végleges, összeállt üzenet (a nem-`stream_event` `kind`
  sorok) marad látható.
- **Ha a kapcsoló bekapcsolt:** ugyanezek az események `run_event` keretként mennek,
  `id`-vel, perzisztálva - visszanézéskor is megjelennek.
- A kapcsoló a **futás indításakor** befagy, futás közben nem módosítható (a
  `workflow_run` sorból olvasódik ki minden beszúráskor).

---

## 3. Nagy mennyiségű esemény megjelenítése

**Módszer, saját mérés valós böngészőben.** A happy-dom/jsdom szimulátorok nem végeznek
valódi layoutot, ezért nem alkalmasak render-idő mérésre. Emiatt **valós, headless
Chromiumot** használtam: a `@playwright/test@1.62.1` pinelt csomaghoz tartozó, már
telepített `chromium-1234` binárison (a repó saját, dokumentált kerülőútjával - 12. szekció
"Playwright rootless konténerben": `apt-get download libxdamage1` + `dpkg -x` +
`LD_LIBRARY_PATH`, mert a sandbox nem-root felhasználóként fut). **Saját mérés, plusz
tény:** a telepített `react@19.2.8`/`react-dom@19.2.8` csomagban **nincs UMD build**
(`node_modules/react*` alatt nulla `*umd*`/`*.production.min.js` fájl) - React 19 óta a
böngésző-közvetlen `<script>` betöltés megszűnt, ezért a mérési oldalt `esbuild`-del
kellett becsomagolni. A méréshez `flushSync` (a `react-dom` csomagból, **nem** a
`react-dom/client`-ből) kényszerítette ki a szinkron commitot - `root.render()` önmagában
a React 18+ automatikus batching miatt nem azonnal fut le, a mérés enélkül ~0 ms-ot adott
minden méretre, ami hamis eredmény lett volna.

**Naiv, nem memoizált teljes lista, egy 6143 hosszú listát (a projekt korábbi, valós
SSE mérése ugyanennyi eseményt dolgozott fel egyetlen futásból) is tartalmazó
méréssorozat, teljes újrarenderelés:**

| Elemszám | Teljes rerender (ms) |
| -------- | -------------------- |
| 100      | 12,0                 |
| 1 000    | 42,3                 |
| 3 000    | 34,2                 |
| 6 143    | 75,3                 |
| 10 000   | 149,4                |
| 20 000   | 569,6                |

**Ugyanaz, de csak egyetlen új elem hozzáfűzése egy N hosszú listához** (ez felel meg a
valós SSE mintának: egy új esemény érkezik, a teljes tömb újra map-elődik):

| Elemszám (N) | Append egy elem, memoizálás nélkül (ms) | ...`React.memo`-val a sor komponensen (ms) | react-window 2.3.0 valódi virtualizációval (ms) |
| ------------ | --------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| 100          | 4,7                                     | 2,2                                        | 2,6                                             |
| 1 000        | 16,5                                    | 10,1                                       | 1,7                                             |
| 6 143        | 40,3                                    | 13,9                                       | 1,5                                             |
| 10 000       | 73,4                                    | 18,5                                       | -                                               |
| 20 000       | 147,7                                   | 39,9                                       | 1,7                                             |

**Verdikt, mérésből.** A memoizálás nélküli naiv append **6143 elemnél már 40 ms** -
ez a projekt saját, korábban mért, valós futásból származó eseményszáma
(`docs/research/...` korábbi mérése 6143 SSE eseményt dolgozott fel egyetlen futásból). A
`React.memo` a sor komponensen körülbelül harmadára-felére csökkenti a költséget, **de nem
szünteti meg a lineáris növekedést**, mert a szülő lista `.map()`-je és a React
gyermek-diffelése minden append esetén **végigjárja a teljes tömböt**, csak a már
memoizált sorok tényleges DOM-mutációját ússza meg. **A `react-window@2.3.0` valódi
ablakozással ez a költség gyakorlatilag N-től függetlenné válik** (1,5-2,6 ms minden
mért méretre 100-tól 20 000-ig), mert a ténylegesen a DOM-ban álló sorok száma **állandó
22 elem** (a látható ablak plusz overscan), a `rowCount` értékétől függetlenül.

**Kell-e új függőség - igen, méréssel indokolva.** A natív React eszköztár (`React.memo`)
nem old meg egy folyamatosan növekvő, korlátlan hosszúságú eseménylistát: a költség a
projekt saját, korábban mért eseményszámánál (6143) már a memoizált változatban is 14 ms,
memoizálás nélkül 40 ms - egy folyamatosan érkező SSE stream mellett ez érzékelhető
akadást okoz minden egyes új eseménynél. Virtualizáció szükséges.

**Két függő csomag, élő npm registry lekérdezéssel, mindkettőre két független forrással:**

| Csomag                    | Verzió    | Forrás 1 (npm registry)                             | Forrás 2 (GitHub, közvetlenül a repóból)                                             | React peer range                                                       |
| ------------------------- | --------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `react-window`            | `2.3.0`   | `registry.npmjs.org/react-window/latest`            | `api.github.com/repos/bvaughn/react-window/tags` (`2.3.0` tag)                       | `^18.0.0 \|\| ^19.0.0` (explicit, nevesítve)                           |
| `@tanstack/react-virtual` | `3.14.10` | `registry.npmjs.org/@tanstack/react-virtual/latest` | `api.github.com/repos/TanStack/virtual/releases` (`@tanstack/react-virtual@3.14.10`) | `^16.8.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` (explicit, nevesítve) |

A `react-window@2.3.0`-t **ténylegesen letelepítettem és lerendereltem** a fenti valós
Chromium-mérésben React 19.2.8 alatt - hibátlanul fut, a fenti táblázat számai ebből a
tényleges futtatásból származnak, nem dokumentációból.

**Fontos, saját méréssel feltárt buktató.** A `react-window` 2.x API **teljesen más**, mint
a széles körben idézett 1.x (`FixedSizeList`/`VariableSizeList`): ezek megszűntek, helyettük
`List`/`Grid` áll, `rowComponent`/`cellComponent` props-szal (saját ellenőrzés a telepített
csomag `.d.ts` fájljában). Egy elavult tutorial alapján írt kód nem fordulna.

**`ResizeObserver`, ugyanaz a buktató mint az `@xyflow/react`-nál.** A telepített
`react-window@2.3.0` forrása is használ `ResizeObserver`-t (saját grep a
`dist/react-window.js` fájlban), de kizárólag az automatikus méretfelismerő módban
(amikor a konténer magassága/szélessége nincs explicit megadva). A mérésben explicit
`style: { height, width }` props-szal ezt elkerültem - ugyanez a mintázat, mint a
xyflow-nál: explicit méret mellett happy-dom alatt is legalább a szerkezet tesztelhető,
automatikus méretezéssel viszont a happy-dom stub (SPEC-007 M-24) miatt nem.

**Automatikus alsó görgetés.** A `react-window@2.3.0` `.d.ts` fájlja imperatív
`scrollToRow({ align, behavior, index })` metódust és `onRowsRendered` callback-et
exportál (`ListImperativeAPI`) - ez a dokumentált mechanizmus, amivel egy hívó kód
eldöntheti, hogy az utolsó sor éppen látszik-e, és ha igen, egy új elem érkezésekor
`scrollToRow`-val az aljára görgessen. **Az "alul tartás, ha a user nem görgetett fel"
logika maga nem automatikus** - az alkalmazásnak kell nyomon követnie a görgetési
pozíciót és feltételesen hívnia a `scrollToRow` metódust. A konkrét küszöb (mennyi
pixeltől számít "az alján van a user") **NEM MEGERŐSÍTETT**: erre sem a `react-window`
dokumentációja, sem saját mérés nem ad számot, ezért nem javaslunk konkrét értéket.

---

## 4. Az osztott nézet húzható elválasztója

**Van kész elem a design systemben.** Az `eggproject-design-components` skill
`components/resizable/` téma mappája (`Resizable.jsx` + `resizable.css`) pontosan erre
a célra készült: `resizable-group`/`resizable-panel`/`resizable-handle` szerkezet, a
`direction` prop `horizontal`/`vertical` között vált. **Saját olvasás a tényleges
fájlból** - ez már a hivatalos WAI mintát követi:

| WAI Window Splitter Pattern előírás (`w3.org/WAI/ARIA/apg/patterns/windowsplitter/`)              | A tényleges `Resizable.jsx` megvalósítása                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role="separator"` a fókuszálható elválasztón                                                     | `role="separator"` ✓                                                                                                                                                                        |
| `aria-valuenow`/`aria-valuemin`/`aria-valuemax`                                                   | `aria-valuemin={5}`, `aria-valuemax={95}`, `aria-valuenow` a tényleges százalékos méretből ✓                                                                                                |
| `aria-label` vagy `aria-labelledby`                                                               | `aria-label={"Resize panels " + ...}` ✓                                                                                                                                                     |
| `aria-controls` a vezérelt panel(ek)re                                                            | `aria-controls` mindkét szomszédos panel id-jára ✓                                                                                                                                          |
| Nyilak mozgatják az elválasztót (vízszintes elválasztónál balra/jobbra, függőlegesnél fel/le)     | `ArrowLeft`/`ArrowRight` (`!isVertical`), `ArrowUp`/`ArrowDown` (`isVertical`), `Shift`-tel dupla lépésköz ✓                                                                                |
| `Home`/`End` opcionális, a szélső méretre ugrik                                                   | Implementálva (`resizeAt(prev, handleIndex, -100/+100)`) ✓                                                                                                                                  |
| `Enter` a fő panel összecsukása/visszaállítása (opcionális, csak fix méretű splitternél kötelező) | **Nincs implementálva** - ez a WAI doksi szerint is csak opcionális, "fixed size splitter omits implementation of the arrow keys" jegyzet a variálható splitterre nem vonatkozik kötelezően |

**Nincs szükség saját, nulláról írt ARIA megoldásra** - a döntés a meglévő `resizable`
komponens átemelése (a projekt korábbi mintája szerint, ahogy a SPEC-007 a 12
komponenst átemelte), nem új implementáció.

**Töréspont tokenek, saját olvasás a tényleges fájlból** (`eggproject-design/tokens/breakpoints.css`,
megegyezik a SPEC-007 M-26 korábbi mérésével, most újra ellenőrizve): `--ep-screen-sm:
640px`, `--ep-screen-md: 768px`, `--ep-screen-lg: 1024px`, `--ep-screen-xl: 1280px`,
`--ep-screen-2xl: 1536px`, `--ep-screen-3xl: 1920px`, `--ep-screen-4xl: 2560px`. A fájl
**egyetlen tényleges `@media` szabályt sem tartalmaz**, csak a token értékeket - a
"szűk nézetben egymás alá kerül vagy fülekre vált" viselkedést a SPEC-008-nak kell
megírnia, kizárólag ezekre a token értékekre hivatkozva, ahogy az SPEC-007 5.3 szekciója
is tette.

---

## Amit ez a felderítés NEM dönt el

- **Melyik virtualizációs csomagot választja a projekt** (`react-window` vagy
  `@tanstack/react-virtual`) - ez a SPEC-008 döntése, ehhez a mérés két, egyaránt
  React 19-kompatibilis, élő registryből igazolt jelöltet ad.
- **Az automatikus görgetés pontos küszöbét** ("mennyire kell az aljához közel lenni,
  hogy still auto-scrollozzon") - nincs rá forrás, NEM MEGERŐSÍTETT.
- **Melyik töréspontnál vált a SPEC-008 osztott nézete fülekre** - ez tervezési döntés,
  a rendelkezésre álló hét token közül.
