# SPEC-008: A vizuális gráf szerkesztő és az élő futás nézet

|          |                                                                                                                                                                                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet                                                                                                                                                                                                                                                                    |
| Dátum    | 2026-09-05                                                                                                                                                                                                                                                                  |
| Előzmény | [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md) (a felület váza, amire épül), [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md) (a fogyasztott szerződés), [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) (a futás állapotgépe) |
| Kimenet  | a `packages/ui` csomag egy, az `apps/web` alkalmazás tíz és a `packages/protocol` csomag egy új téma mappája (11.1, 11.2, 11.3)                                                                                                                                             |
| Mérés    | [`../research/2026-09-05-grafszerkeszto-es-transcript.md`](../research/2026-09-05-grafszerkeszto-es-transcript.md)                                                                                                                                                          |
| Terv     | [`../plan/PLAN-009-graf-szerkeszto-es-futas-nezet.md`](../plan/PLAN-009-graf-szerkeszto-es-futas-nezet.md)                                                                                                                                                                  |

---

## 1. Cél és hatókör

### Amit eldönt

- A vizuális gráf szerkesztőt: az `@xyflow/react` vászon vezérelt módban, a tíz csomópont típus megjelenítése, az élek kötése, a mentés és a betöltés.
- **A csomópont `config` mezőjének drótszintű alakját**: a `protocol` csomag `node-config` téma mappáját a tíz ág Zod sémájával, a sodródás védelmével együtt, ami a SPEC-005 egy kimondott döntését felülírja (5.3, SPEC-005 7.7).
- **Az automatikus elrendezést**: egy gomb, ami a gráfot a `@dagrejs/dagre` könyvtárral rendezi el, dokumentált alapértelmezett távolságokkal (5.7).
- A lépés szintű beállítások felületét: hol és hogyan jelenik meg az `AgentStepConfig` huszonegy mezője, **beleértve az `agents` mező űrlapját a mért, dokumentált `AgentDefinition` alakra**, és melyik mező marad a SPEC-009 hatókörében.
- A mentés előtti validáció határvonalát: mit ellenőriz a kliens, és mit hagy a szerverre, indoklással.
- A szerkesztő és a futáshoz tartozó gráf pillanatkép viszonyát.
- Az élő futás nézetet: az osztott elrendezést húzható elválasztóval, a futás állapotának megjelenítését a rajzon, a párhuzamos ágakat, a hibát és a megszakítást.
- A transcript panelt: mind a huszonöt esemény típus megjelenítését, a virtualizációt, az automatikus görgetést, és a delta kapcsoló következményét.
- A virtualizációs csomag választását, két mért és élő registryből igazolt jelölt közül.
- A jóváhagyás felületét: hogyan kér beavatkozást a `human_approval` lépés.
- A várakozás jelzését a felület minden új async pontján.
- A tesztelési stratégiát: mi unit, mi e2e, kiemelten az élek e2e kényszerét, és mi lesz az e2e lefedettségi küszöbbel.
- A reszponzív tervet, kizárólag a design system tényleges töréspont tokenjeire építve.
- **A szerver portját és a fejlesztői proxy elrendezést**, ami a `.claude/CLAUDE.md` 14. szekció 1. nyitott tételét, a SPEC-006 O-1 és a SPEC-007 O-4 kérdését zárja le (3. szekció).

### Amit NEM dönt el

- **Nem építi meg a beállítás felületet.** A beállítások képernyő, a skill feltöltés és az MCP szerver konfiguráció a **SPEC-009** hatóköre. A `GET`/`PUT /api/settings`, a párhuzamossági korlát négy végpontja és a provider kapcsolat teszt kezelője a jelen specben **nem** kap felületet.
- **Nem szerkeszthető a jelen specben a `skills` és az `mcpServers` mező.** Mindkettő a SPEC-009 hatóköre. Az `agents` mező ezzel szemben **szerkeszthetővé válik**, mert a mérés dokumentált, két független forrással fedett alakot talált (M-90, 5.2); a mérésben nem megerősített három `AgentDefinition` mező viszont változatlanul olvasható marad.
- **Nem futtat gráf szemantikai validációt a kliensen.** A körkeresés, a `loop` visszaél szabályai, a `fan_out` hatókör kiegyensúlyozottsága és a kezeletlen hiba politika a motor validációja (SPEC-004 4., 6. szekció); a kliens ezt nem másolja le (5.4).
- **Nem vezet be új futásindítási vagy megszakítási szemantikát.** A `POST /runs`, a `POST /interrupt` és a `POST /restart` a SPEC-005 4.2 B táblázata szerint hívódik, változatlanul.
- **Nem módosítja a `packages/db`, az `engine` és az `apps/server` viselkedését**, a 3. szekció szerinti port és CORS átvezetést leszámítva, ami a szerveren egyetlen sort sem változtat, csak a spec szövegét pontosítja.
- **Nem vezet be új hitelesítést.** A szerver a `127.0.0.1` címre köt (SPEC-006 3.5).
- **Nem ad számot ott, ahol nincs forrás.** A transcript sor magassága, a `retry` érték és az e2e küszöb új értéke mind mérésből vagy nyitott kérdésből jön, nem becslésből (14. szekció). Az automatikus elrendezés távolságai **két független forrásból** jönnek (M-93), a csomópont kártya mérete pedig a PLAN-009 saját méréséből (5.7).

### A user öt döntése, amiket ez a spec megvalósít

| #   | Döntés                                                                                                                                                          | Hol valósul meg                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | A szerver portja `3001`, a Vite dev szerver az alapértelmezett porton marad, tehát a dev proxy megépíthető, és a dev REST hívás proxyn megy                     | 3. szekció, és a 15. szekció 1 ... 6. kritériuma |
| 2   | Az élő futás nézet osztott, húzható elválasztóval; szűk nézetben egymás alá kerül, a legszűkebben fülekre vált, kizárólag a design system töréspont tokenjeivel | 6.1 és 10. szekció, és a 15. szekció 30 ... 34.  |
| 3   | A `protocol` csomag kap egy `node-config` témát a tíz ág Zod sémájával, tehát a szerkesztő űrlapja típusbiztos, mezőnkénti hibajelzéssel (O-1 lezárva)          | 5.3, SPEC-005 7.7, és a 15. szekció 58 ... 59.   |
| 4   | Az `agents` mező alakját előbb megmérjük az SDK forrásából és a hivatalos doksiból; a mérés dokumentált alakot talált, tehát az űrlap megépül (O-4 lezárva)     | 5.2, M-90, és a 15. szekció 60.                  |
| 5   | Legyen automatikus elrendezés, egy gombbal, dokumentált könyvtárral és dokumentált távolságokkal (O-6 lezárva)                                                  | 5.7, M-91 ... M-93, és a 15. szekció 61 ... 62.  |

## 2. Megerősített tények, forrással

Minden sor mögött hivatalos dokumentáció, élő registry lekérdezés vagy saját, dokumentált mérés áll. Amire nincs forrás, az a 14. szekcióban áll nyitott kérdésként. A jelen spec a SPEC-007 M-1 ... M-49 tényeit nem ismétli meg; a számozás `M-50`-től folytatódik, hogy a két dokumentum hivatkozásai ne ütközzenek.

### 2.1 Az `@xyflow/react`

A 2.1 sorai a [`../research/2026-09-05-grafszerkeszto-es-transcript.md`](../research/2026-09-05-grafszerkeszto-es-transcript.md) 1. szekciójának mérésén és a hivatalos dokumentáción állnak.

| #    | Tény                                                                                                                                                                                                                                                                                                                                                         | Forrás                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M-50 | A `@xyflow/react@12.11.5` `peerDependencies` mezője `react: ">=17"`, tehát a projekt `19.2.8` verziója a range-en belül van, és a csomag a projekt pinelt Vitest plusz happy-dom felállásában **ténylegesen renderelt** egy két node és egy él gráfot, kivétel nélkül                                                                                        | saját mérés, research 1. szekció                                                                                                                             |
| M-51 | A telepített csomag `LICENSE` fájlja MIT, `Copyright (c) 2019-2025 webkid GmbH`, extra feltétel nélkül                                                                                                                                                                                                                                                       | saját olvasás a telepített fájlon, research 1. szekció                                                                                                       |
| M-52 | A kirajzolt node DOM alakja: `role="group"`, `aria-roledescription="node"`, `tabindex="0"`, `data-id="<id>"` és **`data-testid="rf__node-<id>"`**. A `role="group"` **minden** node-on ugyanaz, tehát önmagában nem különböztet meg node-okat                                                                                                                | saját mérés a kirajzolt `innerHTML`-ből, research 1. szekció                                                                                                 |
| M-53 | Happy-dom alatt a node explicit méret nélkül `visibility:hidden` marad, explicit `width`/`height` mezővel viszont láthatóvá válik; **a `.react-flow__edges` konténer mindkét esetben teljesen üres marad**, tehát él happy-dom alatt semmilyen körülmények között nem rajzolódik ki                                                                          | saját mérés, research 1. szekció, két külön futtatás                                                                                                         |
| M-54 | A hivatalos tesztelési oldal ugyanezt mondja ki: _"React Flow needs to measure nodes in order to render edges and for that relies on rendering DOM elements."_ Cypress és Playwright esetén a doksi szerint nincs szükség további beállításra, mert azok valódi böngészőt használnak                                                                         | [React Flow, Testing](https://reactflow.dev/learn/advanced-use/testing)                                                                                      |
| M-55 | A vezérelt mód a hivatalos alak: `nodes` és `edges` propok, `onNodesChange`/`onEdgesChange`, `applyNodeChanges`/`applyEdgeChanges`, illetve a kényelmi `useNodesState`/`useEdgesState` hook: _"This hook makes it easy to prototype a controlled flow where you manage the state of nodes and edges outside the `ReactFlowInstance`."_                       | [React Flow, `useNodesState`](https://reactflow.dev/api-reference/hooks/use-nodes-state)                                                                     |
| M-56 | A `nodeTypes` objektumot **nem szabad** a komponens render függvényén belül létrehozni; a hivatalos hibaoldal ezt nevesítve mondja: _"It looks like you have created a new nodeTypes or edgeTypes object. ... which will cause React Flow to re-render every time your component re-renders."_ A dokumentált javítás a modul szintű `const` vagy a `useMemo` | [React Flow, Common Errors](https://reactflow.dev/learn/troubleshooting/common-errors)                                                                       |
| M-57 | A `Node` típus hordoz `width`, `height`, `initialWidth` és `initialHeight` mezőt, de a doksi szó szerint óv az első kettő beállításától: _"You shouldn't try to set the `width` or `height` of a node directly. ... To control a node's size you should use the `style` or `className` props to apply CSS styles instead."_                                  | [React Flow, `Node` típus](https://reactflow.dev/api-reference/types/node)                                                                                   |
| M-58 | A `Handle` komponens propjai: `type: 'source' \| 'target'`, `position: Position`, `id: string \| null`, plusz `isConnectable`, `isValidConnection`. Az `addEdge(edgeParams, edges, options?)` segédfüggvény az `onConnect` dokumentált párja                                                                                                                 | [React Flow, `Handle`](https://reactflow.dev/api-reference/components/handle), [`addEdge`](https://reactflow.dev/api-reference/utils/add-edge)               |
| M-59 | Az `isValidConnection` prop dokumentált típusa `(edge: Edge \| Connection) => boolean`, és mind a fő komponensen, mind a `Handle` elemen elérhető                                                                                                                                                                                                            | [React Flow, `IsValidConnection`](https://reactflow.dev/api-reference/types/is-valid-connection)                                                             |
| M-60 | A `<Controls />` a nagyítás, kicsinyítés, illesztés és zárolás gombjait adja; a `<Background />` három variánst ismer (`lines`, `dots`, `cross`); a `<MiniMap />` önálló, karbantartott komponens                                                                                                                                                            | [Controls](https://reactflow.dev/api-reference/components/controls), [Background](https://reactflow.dev/api-reference/components/background)                 |
| M-61 | **Élő registry lekérdezés, 2026-09-05.** A `@xyflow/react` `dist-tags.latest` értéke **`12.11.6`**, nem `12.11.5`, amit a `docs/research/2026-08-26-toolchain.md` ma rögzít. A `12.11.6` GitHub release két javítást sorol, mindkettő belső; a `peerDependencies` és a licenc változatlan                                                                    | `registry.npmjs.org/@xyflow/react`, plusz a `github.com/xyflow/xyflow` `@xyflow/react@12.11.6` release, plusz `unpkg.com/@xyflow/react@12.11.6/package.json` |

### 2.2 A transcript adatai és a nagy lista

| #    | Tény                                                                                                                                                                                                                                                                                                                 | Forrás                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-62 | A `run_event.kind` **huszonöt** zárt értéket vesz fel: tizenkettő `sdk` és tizenhárom `engine` eredetű; a felsorolás a `packages/protocol/src/transcript/run-event-kind.ts` fájlban áll, a `packages/db` azonos nevű típusának szándékos duplikátumaként                                                             | research 2. szekció, plusz a két forrásfájl                                                                                                                     |
| M-63 | A `RunEventRecord` egy sorhoz elérhető mezői: `id`, `runId`, `stepRunId`, `origin`, `kind`, `occurredAtMs`, `sdkMessageType`, `sdkMessageSubtype`, `sdkSessionId`, `sdkUuid`, `parentToolUseId`, `toolName`, `toolUseId`, négy token szám, `numTurns`, és a nyers `payload: unknown`                                 | `packages/protocol/src/transcript/run-event-record.ts`                                                                                                          |
| M-64 | Az öt SSE keret közül **kizárólag a `run_event` kap `id:` sort**; a `run_event_transient` nem, és a `delivery` mezője sincs, mert mindig élő                                                                                                                                                                         | `packages/protocol/src/event-stream/stream-frame.ts`, SPEC-005 5.4                                                                                              |
| M-65 | Kikapcsolt delta kapcsoló esetén (ez az alapállapot) a `content_block_delta` jellegű `sdk_stream_event` üzenetek **nem kerülnek a `run_event` táblába**, tehát a `GET /api/runs/{runId}/events` lekérdezés soha nem adja vissza őket. Élőben viszont `run_event_transient` keretként megérkeznek                     | research 2. szekció, `.claude/CLAUDE.md` 10. szekció 3. pont                                                                                                    |
| M-66 | **Saját mérés valós headless Chromiumban, React 19.2.8 alatt.** A memoizálás nélküli, naiv append egy N hosszú listához 6143 elemnél 40,3 ms, 20 000 elemnél 147,7 ms; `React.memo` mellett 13,9 illetve 39,9 ms; `react-window@2.3.0` valódi ablakozással minden mért méretre 1,5 ... 2,6 ms, állandó 22 DOM sorral | research 3. szekció                                                                                                                                             |
| M-67 | **Élő registry lekérdezés, 2026-09-05.** A `react-window` `latest` értéke `2.3.0`, `peerDependencies` mezője `react: "^18.0.0 \|\| ^19.0.0"` és `react-dom` ugyanez, licenc MIT                                                                                                                                      | `registry.npmjs.org/react-window/latest`, plusz a `github.com/bvaughn/react-window` `2.3.0` release tag, plusz `unpkg.com/react-window@2.3.0` publikált tarball |
| M-68 | **Élő registry lekérdezés, 2026-09-05.** A `@tanstack/react-virtual` `latest` értéke `3.14.10`, `peerDependencies` mezője `react: "^16.8.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0"`, licenc MIT                                                                                                                      | `registry.npmjs.org/@tanstack/react-virtual/latest`, plusz `unpkg.com/@tanstack/react-virtual@3.14.10/package.json`                                             |
| M-69 | A `react-window` 2.x API **teljesen más**, mint az 1.x: a `FixedSizeList` és a `VariableSizeList` megszűnt, helyettük `List` és `Grid` áll, `rowComponent`, `rowCount`, `rowHeight` és `rowProps` propokkal. A publikált `2.3.0` `.d.ts` és a README egyik korábbi nevet sem exportálja                              | a publikált `.d.ts` és README a `unpkg` és a `raw.githubusercontent.com` útvonalon, plusz saját olvasás a telepített csomagon a research 3. szekcióban          |
| M-70 | A `ListImperativeAPI` exportált interfész, `scrollToRow({ align, behavior, index })` metódussal, és az `onRowsRendered` callback két tartományt ad: `visibleRows` és `allRows`, mindkettő `{ startIndex, stopIndex }` alakban                                                                                        | a publikált `react-window@2.3.0` `.d.ts`, plusz a hivatalos README                                                                                              |
| M-71 | Az "alul tartás, ha a felhasználó nem görgetett fel" logika **nem automatikus**: a hívónak kell nyomon követnie a görgetési pozíciót és feltételesen hívnia a `scrollToRow` metódust. Konkrét pixel küszöbre ("mennyire kell az aljához közel lenni") **sem a dokumentáció, sem saját mérés nem ad számot**          | research 3. szekció, kimondottan NEM MEGERŐSÍTETT pontként                                                                                                      |

### 2.3 Az elválasztó és a töréspontok

| #    | Tény                                                                                                                                                                                                                                                                                                                                                                                                        | Forrás                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| M-72 | Az `eggproject-design-components` `components/resizable/` téma mappája (`Resizable.jsx` plusz `resizable.css`) `resizable-group`, `resizable-panel` és `resizable-handle` szerkezetet ad, `direction` proppal `horizontal` és `vertical` között váltva                                                                                                                                                      | saját olvasás a tényleges fájlon, research 4. szekció                                                                        |
| M-73 | Ugyanez a komponens már ma `role="separator"`, `aria-valuemin={5}`, `aria-valuemax={95}`, tényleges százalékból számolt `aria-valuenow`, `aria-label` és mindkét szomszédos panelre mutató `aria-controls` értékkel rajzol; a nyilak iránynak megfelelően mozgatnak, `Shift` dupla lépésközzel, `Home` és `End` a szélső méretre ugrik                                                                      | saját olvasás, research 4. szekció                                                                                           |
| M-74 | A WAI Window Splitter Pattern billentyű listájában a `Left Arrow`, `Right Arrow`, `Up Arrow`, `Down Arrow` és az **`Enter`** jelölés nélkül áll, míg a `Home`, az `End` és az `F6` mellett kifejezetten ott a `(Optional)` jelölés. Az `Enter` dokumentált szerepe: _"If the primary pane is not collapsed, collapses the pane. If the pane is collapsed, restores the splitter to its previous position."_ | [W3C WAI APG, Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)                             |
| M-75 | A `role="separator"` fókuszálható alakjához az MDN ugyanezt a nyíl, `Home` és `End` viselkedést és az `aria-valuenow` kötelezettségét írja le, függetlenül szerkesztve                                                                                                                                                                                                                                      | [MDN, ARIA `separator` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/separator_role) |
| M-76 | A `tokens/breakpoints.css` hét viewport tokent definiál (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`, `3xl: 1920px`, `4xl: 2560px`), és **egyetlen tényleges `@media` szabályt sem tartalmaz**; a token kommentek megnevezik a jelentésüket                                                                                                                                         | saját olvasás, research 4. szekció, megegyezik a SPEC-007 M-26 mérésével                                                     |

### 2.4 A port és a fejlesztői proxy

| #    | Tény                                                                                                                                                                                                                                                                                                                                                                                                                 | Forrás                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-77 | A Vite dev szerver `server.port` mezőjének dokumentált alapértéke **`5173`**, a projektben telepített `vite@8.2.2` verzióban is. A Vite 8 ezt nem változtatta meg                                                                                                                                                                                                                                                    | [Vite, Server Options](https://vite.dev/config/server-options), plusz a telepített `vite/dist/node/chunks/node.js` `DEFAULT_DEV_PORT = 5173` konstansa, plusz egy harmadik, független leírás |
| M-78 | A `server.proxy` dokumentált alakja `Record<string, string \| ProxyOptions>`, és a kulcs egyszerű előtag egyezés: _"Any requests whose request path starts with that key will be proxied to the specified target."_ `^` kezdetű kulcs esetén a Vite `RegExp` mintaként értelmezi                                                                                                                                     | [Vite, Server Options](https://vite.dev/config/server-options)                                                                                                                               |
| M-79 | A `server.proxy` a `http-proxy-3` opcióit adja tovább, de a `timeout` mezőt a Vite doksi nem sorolja fel nevesítve. Konkrét `timeout` érték viselkedésére a jelen munkamenetben **nem sikerült két független megerősítést** találni: **NEM MEGERŐSÍTETT**                                                                                                                                                            | ugyanott, plusz az `http-proxy-3` hiányzó, második független forrása                                                                                                                         |
| M-80 | A SPEC-005 5.8 alapja, a Vite dev proxy SSE lezárás hibája (`vitejs/vite` #12157 és #13522), **javítva lett** a #13578 PR-ben, amit egy Vite core maintainer írt és egy másik mergelt, 2023-06-21-én. A SPEC-005 5.8 által említett `timeout: 0` workaroundot maintainer forrás nem támasztja alá: a talált közösségi hozzászólás `3600000` értéket használ. **Ez a pont NEM MEGERŐSÍTETT**, és nyitott kérdés (O-2) | `github.com/vitejs/vite` #12157, #13522, #13578, #20712, plusz a `vitejs/vite` #10851 discussion                                                                                             |
| M-81 | A szerver ma kötelező `EASTER_SERVER_PORT` env változóból olvassa a portot, alapérték nélkül, és a `127.0.0.1` címre köt; a fejlesztői CORS origin `EASTER_STREAM_DEV_ORIGIN` néven **nem kötelező**, és ezt a `environment-variable-name.ts` fejléc komment maga jelzi a SPEC-006 O-1 megfogalmazásától való eltérésként                                                                                            | `apps/server/src/server-config/environment-variable-name.ts`, `server-config.ts`, `startup-sequence/continue-startup-with-database.ts`                                                       |
| M-82 | A CORS fejlécet a `resolve-cors-headers.ts` számítja: kizárólag a `STREAM_PATH` útvonalon, kizárólag ha a konfiguráció megnevez egy dev origint, sosem `*`, és sosem a kérés `Origin` fejlécének visszatükrözésével                                                                                                                                                                                                  | `apps/server/src/.../resolve-cors-headers.ts`, SPEC-006 5.7                                                                                                                                  |

### 2.5 A drótszintű alakok, amikre a felület épül

| #    | Tény                                                                                                                                                                                                                                                                                                       | Forrás                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| M-83 | A `WorkflowNodeInput` mezői: `id`, `type`, `label`, `positionX`, `positionY`, `config`. **A `config` a dróton `z.unknown()`**, kimondott indoklással: a tíz ágú `NodeConfig` a `db` domain típusa, amit a `protocol` L1 rétegként nem importálhat, és egy kézzel másolt duplikátum elcsúszásra képes lenne | `packages/protocol/src/workflow/workflow-graph-document.ts` |
| M-84 | A `WorkflowEdgeInput` mezői: `id`, `sourceNodeId`, `targetNodeId`, `sourceHandle`, `targetHandle`, `branchKey`, mindhárom utóbbi nullable. **Az élen nincs feltétel kifejezés**: a feltétel a `branch` node configjában áll                                                                                | ugyanott, plusz SPEC-003 4.7                                |
| M-85 | A `RunSnapshotResponse` mezői: `version: 1`, `sdkVersionPin`, `workflow` (`id`, `name`, `description`), `nodes`, `edges`. A `SnapshotNode` a `config` mellett **`effectiveProviderId`** mezőt is hordoz, amit az élő gráf node-ja nem                                                                      | `packages/protocol/src/run/run-snapshot.ts`                 |
| M-86 | A `ReadRunEventsQuery` **két, egymást kizáró alak uniója**: `{ limit, afterEventId }` vagy `{ limit, stepRunId }`; mindkettő `z.strictObject`, tehát a másik ág kulcsát is elutasítja, és a kettő együtt `invalid_request` hibát ad                                                                        | `packages/protocol/src/transcript/read-run-events-query.ts` |
| M-87 | A `NodeType` tíz zárt értéke: `start`, `agent_step`, `branch`, `fan_out`, `join`, `loop`, `human_approval`, `error_handler`, `sub_workflow`, `script`. A `script` **tárolható, de nem futtatható**: futás indításakor `unimplemented_node_type` hibával elutasítva                                         | SPEC-003 4.3, SPEC-004 5.                                   |
| M-88 | A `RunStatus` hat, a `StepRunStatus` nyolc értéket vesz fel; a fenntartott `branchKey` értékek a `continue`, `exit`, `approved`, `rejected`, `exhausted` és `on_error`                                                                                                                                     | SPEC-003 7.1, 7.2, SPEC-004 4.2                             |
| M-89 | Az `InterruptSummaryResponse` mezői: `rootRunId` és `cancelledRunIds`, tehát a megszakítás válasza megnevezi az al-workflow futásokat is                                                                                                                                                                   | `packages/protocol/src/run/interrupt-summary.ts`            |

### 2.6 Az SDK `agents` mezője és az elrendező könyvtár

A 2.6 sorai a [`../research/2026-09-05-grafszerkeszto-es-transcript.md`](../research/2026-09-05-grafszerkeszto-es-transcript.md) 5. és 6. szekciójának mérésén és a hivatkozott hivatalos dokumentáción állnak.

| #    | Tény                                                                                                                                                                                                                                                                                                                                                                                                                             | Forrás                                                                                                                                                                                                                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-90 | A pinelt `@anthropic-ai/claude-agent-sdk@0.3.245` `Options` típusában az `agents` mező alakja `Record<string, AgentDefinition>`, és az `AgentDefinition` **tizenhat** mezőt hordoz, kettő kötelező (`description`, `prompt`). Ebből **tizenhármat két független forrás is fed**; a `criticalSystemReminder_EXPERIMENTAL`, az `observer` és az `observerMessage` **NEM MEGERŐSÍTETT**, mert csak a telepített `.d.ts` sorolja fel | saját olvasás a telepített `sdk.d.ts` fájlon (1414. és 38 ... 99. sor), plusz a [subagents doksi](https://docs.claude.com/en/docs/agent-sdk/subagents) "AgentDefinition configuration" táblázata, plusz a [TypeScript referencia](https://docs.claude.com/en/api/agent-sdk/typescript) `Options` táblázatának `agents` sora |
| M-91 | A hivatalos React Flow layouting oldal négy külső könyvtárat sorol fel (`Dagre`, `D3-Hierarchy`, `D3-Force`, `ELK`), és fa alakú gráfra nevesítve ajánlja az elsőt: _"If you need to organize your flows into a tree, we highly recommend dagre."_ A `d3-hierarchy` esetére maga zárja ki a mi felállásunkat: _"assigns the same width and height to all nodes"_, ami tíz eltérő csomópont típusnál hibás                        | [React Flow, Layouting](https://reactflow.dev/learn/layouting/layouting)                                                                                                                                                                                                                                                    |
| M-92 | **Élő registry lekérdezés, 2026-09-05.** A `@dagrejs/dagre` `latest` értéke `3.1.1`, licence `MIT`, `peerDependencies` mezője **nincs**, egyetlen futásidejű függősége a `@dagrejs/graphlib@4.0.5`, és a típusdefiníciót maga szállítja. Az eredeti `dagre` csomag utolsó kiadása `0.8.5`, `2019-12-03`, a fork `3.1.1` kiadása `2026-08-08`                                                                                     | `registry.npmjs.org/@dagrejs/dagre`, `registry.npmjs.org/dagre`, plusz `unpkg.com/@dagrejs/dagre@3.1.1/package.json` és a publikált `LICENSE` fájl                                                                                                                                                                          |
| M-93 | A dagre dokumentált alapértelmezései közül a `nodesep` (`50`), a `ranksep` (`50`), a `rankdir` (`TB`), a `marginx` (`0`) és a `marginy` (`0`) **két független forrásban azonos**. Az `edgesep` értékén a két forrás eltér (wiki `10`, a publikált `3.1.1` kód `20`), ezért azt a spec nem állítja be, hanem a csomag saját alapértékén hagyja                                                                                    | [dagre wiki, Configuring the layout](https://github.com/dagrejs/dagre/wiki#configuring-the-layout), plusz saját olvasás a `unpkg.com/@dagrejs/dagre@3.1.1/dist/dagre.cjs` fájlon                                                                                                                                            |
| M-94 | A dagre bemenete csomópontonként egy `width` és egy `height` érték, amit a **hívónak** kell megadnia; erre a könyvtár nem ad alapértelmezést, és külső dokumentált forrás sem létezik, mert a kártya a mi saját elemünk. **NEM MEGERŐSÍTETT szám**, a PLAN-009 saját mérése adja                                                                                                                                                 | research 6.3 szekció, kimondottan forrás nélküli pontként                                                                                                                                                                                                                                                                   |

### 2.7 Amit ezekből NEM következtetünk

- **Az M-53-ból nem következik, hogy a gráf szerkesztő nem tesztelhető unit szinten.** Abból az következik, hogy az **élrajzolás** nem tesztelhető happy-dom alatt. A saját kódunk (az állapot, a `nodeTypes` tábla, a validáció, a szerializálás) tiszta függvény és React állapot, tehát száz százalékig unit tesztelhető (12.2).
- **Az M-57 és az M-53 együtt nem ad kész megoldást.** A doksi óv a `width`/`height` beállításától, a mérés viszont pont azzal tette láthatóvá a node-ot. A feloldás egy blokkoló mérés a PLAN-009 F0 fázisában (O-3), nem egy találgatás.
- **Az M-61-ből nem következik, hogy azonnal `12.11.6`-ra kell váltani.** Abból az következik, hogy a `docs/research/2026-08-26-toolchain.md` `12.11.5` bejegyzése egy patch-csel elavult, és a rögzítés előtt a mérést a ténylegesen rögzített verzión kell megismételni (PLAN-009 F0).
- **Az M-80-ból nem következik, hogy az SSE mehet a proxyn át.** Abból az következik, hogy a SPEC-005 5.8 indoklása részben elavult. A döntés (az SSE megkerüli a proxyt) marad, mert a telepített `vite@8.2.2` proxyján át **nincs saját mérésünk**, a megkerülés pedig szigorúan a biztonságosabb út (O-2).
- **Az M-74-ből nem következik, hogy a meglévő `resizable` komponens hibás.** Abból az következik, hogy az `Enter` billentyű a forrásban hiányzik, a hivatkozott elsődleges forrás pedig nem jelöli opcionálisnak, tehát az átemeléskor pótolni kell (6.1).
- **Az M-90-ből nem következik, hogy a `db` csomag `agents` típusát szűkíteni kell.** A `Readonly<Record<string, unknown>>` alak indoklása (a mezőlista SDK verzióhoz kötött) érvényben marad, és a `protocol` sémája is ezt az alakot veszi át, különben a sodródás védelem megbukna. Az űrlap egy **felületi mezőtáblából** épül, nem a tárolt típus szűkítéséből (5.2).
- **Az M-93-ból nem következik, hogy a spec bármelyik dagre opciót beállítja.** Abból az következik, hogy amit nem állítunk be, arról tudjuk, mi lesz a viselkedés, és két forrásból tudjuk. A spec egyetlen dagre opciót sem ír felül; a `rankdir` iránya a felület saját, kimondott választása (5.7).
- **Az M-94-ből nem következik, hogy az automatikus elrendezés mért node geometriától függene.** A kártya mérete egyetlen, statikus konstans, amit a CSS és a dagre hívás egyaránt olvas; futásidejű mérés (`measured.width`, `getBoundingClientRect()`) sehol nem szerepel, tehát a 12.2 szabály sértetlen marad.

## 3. A port döntés és az átvezetései

### 3.1 A döntés

**A szerver portja `3001`, a Vite dev szerver az alapértelmezett `5173` porton marad** (M-77). Ez a user termékdöntése, ami a SPEC-006 O-1 és a SPEC-007 O-4 kérdését, és ezzel a `.claude/CLAUDE.md` 14. szekció 1. nyitott tételét lezárja.

**A választott út a proxy.** A fejlesztői REST hívás a Vite dev szerver `/api` előtagú proxy szabályán megy át, tehát a böngésző szempontjából azonos originről érkezik, és nincs CORS. Az SSE csatorna **változatlanul közvetlenül a backend originre megy**, megkerülve a proxyt, a SPEC-005 5.8 döntése szerint.

| Réteg             | Fejlesztéskor                                                                           | Élesben                               |
| ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| REST (`/api/...`) | `http://localhost:5173/api/...`, a Vite proxy továbbítja a `3001` portra; azonos origin | azonos origin, a szerver szolgálja ki |
| SSE (`/events`)   | közvetlenül a `3001` portra, proxy nélkül; **más origin, tehát CORS kell**              | azonos origin, nincs CORS             |

### 3.2 Miért marad a SPEC-006 CORS engedélye változatlan, és mi az, ami mégsem konzisztens

**A hatókör kérdésében a SPEC-006 5.7 a proxy úttal teljesen konzisztens.** Az 5.7 1. pontja ("a CORS engedély kizárólag a `STREAM_PATH` útvonalra vonatkozik") pontosan azt az elrendezést írja le, ami a proxy úton áll elő: fejlesztéskor egyedül a stream jön más originről. A SPEC-006 691. sorának 8. kritériuma szintén változatlan marad, és a `resolve-cors-headers.ts` már ma is pontosan ezt valósítja meg (M-82). **Az `/api` előtagra tehát nem kell kiterjeszteni a CORS engedélyt**, ellentétben azzal, amit a SPEC-007 O-4 a másik ág esetére kilátásba helyezett.

**Egy tényleges belső ellentmondást viszont találtunk a SPEC-006-ban, és kimondjuk.** Az 5.7 4. pontja és az O-1 tétel a fejlesztői origint **kötelező** env változónak nevezi, alapérték nélkül. Ugyanennek a szekciónak az 1. pontja viszont a nem konfigurált esetet is leírja ("Ha nem nevez meg, a szerver egyetlen CORS fejlécet sem küld"), a 8. elfogadási kritérium külön tesztet is kér erre az esetre, és a ténylegesen megírt kód a változót opcionálisként kezeli, a saját fejléc kommentjében megnevezve az eltérést (M-81). **A három forrás közül kettő és a kód egybehangzó: a dev origin opcionális.** A jelen spec ezért a SPEC-006 5.7 4. pontját és az O-1 tételt a kód és a saját 1. pontja szerint javítja: a **port kötelező**, a **fejlesztői origin opcionális**. Ez a `.claude/CLAUDE.md` 14. szekció 1. pontja szerinti eset ("az egyik forrás egyértelműen elavult"), tehát nem új nyitott tétel, hanem a talált helyen javítandó.

### 3.3 Mi változik a frontenden

**A Vite proxy szabály.** Az `apps/web/vite.config.ts` `server.proxy` mezője egyetlen szabályt kap, a `API_BASE_PATH` értékére (`/api`), `target` mezőjében a backend originnel. A `target` értéke **nem literál a fájlban**: a `loadEnv` mechanizmuson át ugyanabból a kötelező env változóból jön, amiből a kliens config is dolgozik, tehát a SPEC-007 45. kritériuma ("nincs port szám, nincs origin literál") sértetlen marad. A `timeout` mezőt **nem állítjuk be**, mert az M-79 szerint nincs rá két független forrásunk.

**A konfiguráció kettéválik.** Ma a `frontend-config` egyetlen `apiOrigin` mezőt ad, amit a REST és az SSE réteg egyaránt használ. A proxy úton a két csatorna célja eltér, ezért a téma egy második mezőt kap:

| Mező           | Env változó          | Fejlesztéskor                       | Élesben          | Ki használja    |
| -------------- | -------------------- | ----------------------------------- | ---------------- | --------------- |
| `apiOrigin`    | `VITE_API_ORIGIN`    | a dev szerver saját originje        | a szerver origin | `rest-client`   |
| `streamOrigin` | `VITE_STREAM_ORIGIN` | a backend origin, proxy megkerülése | a szerver origin | `stream-client` |

**Mindkettő kötelező, alapérték nélkül**, a SPEC-007 O-4 addigi viselkedésének megfelelően: hiányzó változó esetén a konfigurációs hibaképernyő a változó **nevét** nevezi meg, az értékét soha. A `stream-client` a `buildStreamUrl` hívásához az `apiOrigin` helyett a `streamOrigin` értéket kapja; más változás nincs benne.

**Az e2e felállás.** Az `apps/web/e2e/api-origin.ts` ma egyetlen `API_ORIGIN` konstanst ad, amit a `playwright.config.ts` `webServer.env` mezője köt be. A kettéválás után a fájl két konstanst ad, és a `page.route()` minták a REST oldalon az előbbihez, az SSE oldalon az utóbbihoz igazodnak; a SPEC-007 52. kritériuma ("a `VITE_API_ORIGIN` értéke egyetlen helyen áll") a kettévált alakra is érvényes marad.

### 3.4 Amit a döntés lezár

| Hol                                     | Mi történik                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/CLAUDE.md` 14.                 | az 1. nyitott tétel **törölve**, a szekció bevezetője "Nyitott tétel jelenleg nincs" alakra vált, és az eljárás leírásának a törölt tételre mutató mondata is |
| SPEC-006 O-1                            | **lezárva**: a port `3001`, a dev szerver `5173`, a port kötelező env változó, a fejlesztői origin opcionális (3.2)                                           |
| SPEC-006 5.7 4. pont                    | pontosítva: a fejlesztői origin **opcionális**, nem kötelező; a hatókör (`STREAM_PATH`) **változatlan**                                                       |
| SPEC-007 O-4                            | **lezárva**: a dev REST hívás proxyn megy, a CORS engedély nem terjed ki az `/api` előtagra, és a konfiguráció két originre válik (3.3)                       |
| `docs/research/2026-08-26-toolchain.md` | bővül a `react-window` bejegyzéssel, két független forrással, és a `@xyflow/react` sor a ténylegesen rögzített verzióra pontosítva (M-61, M-67)               |

## 4. A csomagok felelőssége és határai

### 4.1 A határvonal

| Kérdés                                      | Ki dönti el   | Miért nem a másik                                                                        |
| ------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| hogyan néz ki egy húzható elválasztó        | `packages/ui` | domain fogalom nélküli, a design system átemelése (M-72)                                 |
| hogyan néz ki egy `agent_step` csomópont    | `apps/web`    | a csomópont típus domain fogalom, a `packages/ui` domain mentes (SPEC-007 3.1)           |
| melyik `run_event.kind` hogyan jelenik meg  | `apps/web`    | ugyanaz                                                                                  |
| mi a drótszintű alak                        | `protocol`    | egyetlen forrás, Zod sémából (SPEC-005 3.1)                                              |
| mi a gráf szemantikai szabálya              | `engine`      | a motor validációja, amit a kliens nem másol le (5.4)                                    |
| melyik útvonal melyik képernyőt jelenti     | `apps/web`    | kliens oldali fogalom                                                                    |
| virtualizált lista, ami az aljára tapad     | `apps/web`    | egyetlen fogyasztója a transcript, tehát a `packages/ui` szintre emelés spekulatív lenne |
| mi a node `config` drótszintű alakja        | `protocol`    | ugyanaz, mint a többi drótszintű alaknál: egyetlen forrás, Zod sémából (5.3)             |
| melyik `AgentDefinition` mező szerkeszthető | `apps/web`    | felületi döntés a mért, dokumentált alak felett; a tárolt típust nem szűkíti (5.2)       |
| hogyan rendezi el a gráfot egy gomb         | `apps/web`    | a dagre hívás a csomópont kártya méretét és a saját éllistát ismeri (5.7)                |

**Az `@xyflow/react`, a `react-window` és a `@dagrejs/dagre` az `apps/web` függősége, nem a `packages/ui` csomagé.** Az első mert a vászon a workflow csomópont típusait ismeri, tehát domain fogalmat hordoz; a második mert egyetlen helyen használjuk, és a `.claude/CLAUDE.md` 5. szekció tiltja a spekulatív absztrakciót egyszer használt kódra; a harmadik mert a hívása a csomópont kártya méretét és a gráf éllistáját is ismeri, tehát ugyanabba a domain körbe esik, mint a vászon.

**A `packages/protocol` csomag viszont bővül**, a `node-config` téma mappával (5.3). Ez a csomag `dependencies` mezőjét nem érinti: a `zod` már ma is ott áll, új külső csomag nem kell hozzá.

### 4.2 Függőségi irány

A réteg besorolás **nem változik**: `ui` L2, `web` L5, és a `package-layer.ts` térképet nem kell bővíteni, mert új workspace csomag nem keletkezik.

| Csomag              | `dependencies` a spec után                                                                                               | Változás                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `packages/protocol` | `zod`                                                                                                                    | nincs, a `node-config` téma nem hoz új csomagot |
| `packages/ui`       | `@tanstack/react-table`, `react`, `react-dom`                                                                            | nincs, a `resizable` téma nem hoz új csomagot   |
| `apps/web`          | a három workspace bejegyzés, `react`, `react-dom`, plusz **`@xyflow/react`**, **`react-window`** és **`@dagrejs/dagre`** | három új külső csomag, katalógus hivatkozással  |

Mind a három új verzió a `docs/research/2026-08-26-toolchain.md` fájlba kerül, két független forrással (M-61, M-67, M-92), és a gyökér `package.json` `catalog` mezőjén át hivatkozódik.

## 5. A gráf szerkesztő

A szerkesztő útvonala a `/editor`, a szerkesztett workflow azonosítója a `?workflowId=` query paraméterből jön. **Paraméteres útvonal szegmenst nem vezetünk be**: a `CLIENT_ROUTE_TABLE` két bejegyzésről négyre nő (`/`, `/runs`, `/editor`, `/run`), de mind a négy fix, tehát a SPEC-007 34. kritériuma (nincs paraméteres ág az illesztőben) sértetlen marad, és nem keletkezik soha nem futó ág. A minta a SPEC-007 10.2 futás előzmény füleinek `?workflowId=` paramétere, tehát nem új konvenció.

### 5.1 A tíz csomópont típus a felületen

A típusok zárt listája a `packages/db` `node-type` témájából jön (M-87), a `protocol` `NodeTypeSchema` tükrözésével. A vászon **egyetlen** egyedi node komponenst regisztrál, `nodeTypes` alatt, modul szintű `const` objektumban (M-56); a tíz típus közötti különbséget egy adat tábla írja le, nem tíz komponens.

| Típus            | Bemenő handle | Kimenő handle-ök                                                      | Mit szerkeszt a felület                                             |
| ---------------- | ------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `start`          | nincs         | egy, névtelen                                                         | a bemeneti mezők listája (`name`, `label`, `valueKind`, `required`) |
| `agent_step`     | egy           | egy, névtelen                                                         | a teljes `AgentStepConfig` (5.2)                                    |
| `branch`         | egy           | ágankéntki egy, a `branches[].key` értékkel, plusz az alapértelmezett | `expression`, az ágak listája, `defaultBranchKey`                   |
| `fan_out`        | egy           | egy, névtelen                                                         | `itemsExpression`, `branchLabelTemplate`                            |
| `join`           | egy           | egy, névtelen                                                         | `mode`, és a módhoz tartozó `settings`                              |
| `loop`           | egy           | kettő: `continue` és `exit`                                           | `maxIterations`, `continueExpression`                               |
| `human_approval` | egy           | kettő: `approved` és `rejected`                                       | `title`, `bodyTemplate`, `timeoutMs`                                |
| `error_handler`  | egy           | kettő: névtelen és `on_error`                                         | `maxAttempts`, `backoffMs`, `handledErrorKinds`                     |
| `sub_workflow`   | egy           | egy, névtelen                                                         | `targetWorkflowId`, `inputMapping`                                  |
| `script`         | egy           | egy, névtelen                                                         | `source`, `runtime`                                                 |

**A `script` csomópont felvehető, de a felület figyelmeztet.** A motor futás indításkor `unimplemented_node_type` hibával elutasítja (M-87), ezért a szerkesztő a `script` node kártyáján és a "Futtatás" gomb tiltásakor is megnevezi ezt, a szerver hibaüzenetére való várakozás nélkül. Ez nem szemantikai validáció újraírása, hanem egy **zárt listából olvasott, egyetlen típusra vonatkozó** tény megjelenítése.

**A kimenő handle azonosítója a `branchKey` értéke.** Az `onConnect` a `Connection` `sourceHandle` mezőjéből tölti ki a `WorkflowEdgeInput.branchKey` mezőt, tehát a fenntartott értékek (`continue`, `exit`, `approved`, `rejected`, `exhausted`, `on_error`, M-88) sosem kézzel íródnak: a handle azonosítója maga a forrás.

### 5.2 A lépés szintű beállítások

A csomópont kiválasztásakor egy oldalsó panel nyílik, ami a kiválasztott típus szerinti mezőket mutatja. Az `agent_step` és a `join` `ai_synthesis` módja a teljes `AgentStepConfig` alakot szerkeszti, három csoportban.

| Csoport               | Mezők                                                                                                          | Vezérlő                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| prompt és provider    | `promptTemplate`, `systemPrompt`, `providerId`, `modelId`, `sessionMode`                                       | szövegmező, `SelectField` a providerre és a session módra |
| futási korlátok       | `maxTurns`, `maxBudgetUsd`, `effort`, `thinking`, `permissionMode`, `enabledEngineHooks`                       | szám mező és `SelectField`, a zárt listákból              |
| eszközök és környezet | `allowedTools`, `disallowedTools`, `agentTools`, `cwd`, `additionalDirectories`, `sandbox`, `structuredOutput` | lista szerkesztő és jelölőnégyzet                         |

**Két mező szándékosan nem szerkeszthető a jelen specben**, és a panel ezt ki is mondja, nem hagyja üresen a helyet:

| Mező         | Miért                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| `skills`     | a skill feltöltés a SPEC-009 hatóköre; a panel a jelenlegi értéket olvashatóan mutatja |
| `mcpServers` | az MCP konfiguráció a SPEC-009 hatóköre; ugyanaz                                       |

#### Az `agents` mező űrlapja, a mérés eredménye szerint

**A user 4. döntése: előbb mérünk, aztán döntünk.** A mérés a **pinelt** `@anthropic-ai/claude-agent-sdk@0.3.245` telepített típusdefiníciójából és a hivatalos dokumentációból dolgozott, két független forrással (M-90). **Az eredmény: van dokumentált, stabil alak**, tehát a spec megépíti az űrlapot, nem hagyja olvashatónak.

A mező alakja `Record<string, AgentDefinition>`, tehát a panel egy **kulcsonkénti listát** rajzol: minden bejegyzés az agent neve plusz egy összecsukható űrlap. A bejegyzés felvehető, átnevezhető és törölhető.

**Az űrlap pontosan a tizenhárom, két forrással fedett mezőt szerkeszti.** A mezőlista egy `apps/web` oldali, `as const satisfies` alakú tábla a `node-inspector` témában, aminek minden sora megnevezi a mező nevét, az értékfajtáját és a kötelezőségét; a forrása a research 5. szekciója, és a sorok mellett ott a hivatkozás.

| Csoport            | Mezők                                                         | Vezérlő                                   |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------- |
| kötelező           | `description`, `prompt`                                       | többsoros szövegmező, üresen nem menthető |
| modell és korlátok | `model`, `maxTurns`, `effort`, `permissionMode`, `background` | szövegmező, szám mező, `SelectField`      |
| eszközök           | `tools`, `disallowedTools`                                    | lista szerkesztő                          |
| környezet          | `memory`, `initialPrompt`                                     | `SelectField` a zárt listából, szövegmező |
| SPEC-009 hatókör   | `skills`, `mcpServers`                                        | olvasható, nem szerkeszthető              |

Az utolsó két sor ugyanazt a határvonalat követi, mint a lépés szintjén: a skill és az MCP konfiguráció a SPEC-009 hatóköre, tehát az agent definícióján belül sem szerkeszthető, csak olvasható.

**Három mező kimondottan nem szerkeszthető, mert NEM MEGERŐSÍTETT** (M-90): a `criticalSystemReminder_EXPERIMENTAL`, az `observer` és az `observerMessage` csak a telepített `.d.ts` fájlban szerepel, hivatalos doksi nem fedi. A panel ezeket olvashatóan mutatja, és megnevezi az okot.

**A szerkesztés soha nem dob el ismeretlen kulcsot.** A mentés a szerkesztett tizenhárom mezőt **ráolvasztja** a tárolt objektumra, nem lecseréli azt. Ebből következik, hogy egy jövőbeli SDK verzió új mezője, vagy a fenti három nem megerősített mező, változatlanul átmegy a mentésen. Ez nem kényelmi döntés: a tárolt alak `Record<string, unknown>`, tehát egy lecserélő mentés csendes adatvesztés lenne.

**A `db` és a `protocol` típusa emiatt nem szűkül.** A `db` `Readonly<Record<string, unknown>>` alakja marad, dokumentált indokkal (a mezőlista SDK verzióhoz kötött), és a `protocol` `node-config` sémája is ugyanezt az alakot veszi át, különben a sodródás védelem (5.3) megbukna. **Az űrlap tehát felületi réteg egy `unknown` érték felett, nem egy második típusforrás.**

**A provider választás három szintje** a `.claude/CLAUDE.md` 9. szekciója szerint áll: a globális alapértelmezés a SPEC-009 beállítás képernyőjén, a workflow szintű felülírás a workflow létrehozó modálisban (SPEC-007 10.1), a **lépés szintű felülírás pedig ebben a panelben**, a `providerId` mezőn. A "nincs felülírás" állapotot a `null` érték jelenti, és a panel megnevezi, melyik providert örökli ilyenkor a lépés. A kapcsolat teszt gomb a SPEC-009 hatóköre, ide nem kerül.

### 5.3 A `config` mező drótszintű alakja: a `protocol` `node-config` téma

**A kiindulás.** A `WorkflowNodeInput.config` eddig a dróton `z.unknown()` volt (M-83), kimondott indoklással: a tíz ágú `NodeConfig` a `db` domain típusa, amit a `protocol` L1 rétegként nem importálhat, és a SPEC-005 egy kézzel másolt duplikátumot elcsúszásra képes második forrásnak minősített. Az `apps/web` viszont a `db` csomagtól **nem függhet** (`apps/web/CLAUDE.md` függőségi irány), tehát a szerkesztő űrlapjának nem volt típusa, amire épülhetett volna.

**A user 3. döntése ezt lezárja: a `protocol` csomag kap egy `node-config` téma mappát**, benne a tíz ág Zod sémájával. Ebből következik, hogy a szerkesztő űrlapja **típusbiztos, mezőnkénti hibajelzéssel**, és hogy a lépés szintű beállítások ténylegesen szerkeszthetők (5.2).

**Ez a SPEC-005 egy kimondott döntésének felülírása, és nem csendben történik.** A SPEC-005 kapott egy új, 7.7 szekciót, ami megnevezi a visszavont döntést, a három indokot és azt, ami nem változik. A jelen szekció ezt nem ismétli meg, csak a felületre néző következményeket rögzíti.

**A séma írás négy szabálya az új témára is érvényes** (SPEC-005 7.3): minden bejövő objektum `z.strictObject`, nincs `.default()` és nincs `.transform()`, a kimenő alakok `.readonly()`, a tíz ág `z.discriminatedUnion` a `type` mezőn, és `.parse()` sehol nem fut, csak `.safeParse()`.

**Két alak kimondottan nem szűkül**, mert a `db` oldalon sem szűkített, és egy szűkítés a sodródás védelmet azonnal megbuktatná:

| Mező                           | Alak a `db` oldalon                 | Alak a sémában                          |
| ------------------------------ | ----------------------------------- | --------------------------------------- |
| `AgentStepConfig.agents`       | `Readonly<Record<string, unknown>>` | `z.record(z.string(), z.unknown())`     |
| `JoinMergeNodeConfig.settings` | `Readonly<Record<string, unknown>>` | ugyanaz, a `db` saját indoklása szerint |

#### A sodródás védelem, pontosan a meglévő hat minta szerint

A `protocol` ma **hat** drótszintű felsorolást deklarál a `db` uniójának szándékos duplikátumaként, és mindegyikhez ugyanaz a gépi védelem tartozik, az `apps/server/src/enum-drift-protection/` téma mappában (SPEC-005 7.6, PLAN-006 T-006-12). **A `node-config` ugyanezt a mintát követi, nem egy újat.** A minta öt eleme, ahogy a meglévő fájl megvalósítja:

1. **A hely az `apps/server`**, mert az az egyetlen csomag, ahol a `protocol` és a `db` egyszerre látszik.
2. **Megvalósítás nélküli regressziós teszt**: a mappában nincs futásidejű forrásfájl, csak a `.spec.ts`, és a mappa neve az, amit őriz. A lefedettségi mérleget ezért nem érinti.
3. **A típusszintű ág az erős védelem**: `expectTypeOf<ProtocolNodeConfig>().toEqualTypeOf<DatabaseNodeConfig>()`, ami futásidőben nem csinál semmit, kizárólag a `bun run typecheck` kapu dönt róla. A védelem tehát nem attól függ, hogy a teszt lefut-e, hanem attól, hogy a fájl lefordul-e.
4. **A futásidejű ág ott fut, ahol a `db` guardot exportál.** A `node-config` esetében exportál (`isNodeConfig`), tehát ez az ág itt **erősebb, mint a hat felsorolásnál**: mind a tíz ágra egy reprezentatív érték átmegy a séma `safeParse` hívásán, és ugyanaz az érték átmegy a `db` `isNodeConfig` guardján is.
5. **A bizonyíték a szándékos elrontás.** A meglévő fájl doc kommentje rögzíti, hogy a védelmet manuálisan is igazolták: egy szándékosan hibás érték `TS2344` hibával megbuktatta a `typecheck` kaput. A `node-config` védelmének ugyanígy futtatott próbával kell igazolnia magát.

**Ha a típusszintű egyenlőség nem áll elő** (a `readonly` tömbök és a rekord alakok szerkezeti eltérése miatt), a lépés **nem zárható le egy gyengébb ellenőrzéssel**: az eltérést a séma oldalán kell megszüntetni, vagy a különbséget kimondva, a bukó próbával együtt kell dokumentálni. Ez a `.claude/CLAUDE.md` 4. szekció "nem ellenőrzött jelölés" szabálya, nem egy új kivétel.

### 5.4 Mit validál a kliens, és mit nem

**A kliens kizárólag azt ellenőrzi, amit a protokoll séma maga megkövetel.** A mentés előtt a `ReplaceGraphRequestSchema` `safeParse` hívása fut a felépített dokumentumon, és hiba esetén a felület megnevezi, melyik node vagy él melyik mezője hibás. **Az 5.3 döntés után ez a `config` mezőre is kiterjed**, mert a séma a tíz ág diszkriminált uniója, tehát az `error.issues[].path` a config mezőútvonalát is megadja. Ettől nem lesz több a kliens oldali szabály: a séma **alakot** ellenőriz, nem gráf szemantikát, és a séma forrása változatlanul egyetlen csomag. Ezen felül két, tisztán szerkesztői ellenőrzés fut, mert mindkettő a szerkesztő saját állapotáról szól, nem a gráf szemantikájáról:

1. **Van-e mentetlen változás**, és ha van, az elnavigálás megerősítést kér.
2. **Van-e olyan él, aminek a forrása vagy a célja már törölt csomópont**, mert azt a szerkesztő saját törlési művelete okozná, és a `PUT` idegen kulcs hibát adna.

**Minden más validáció a szerveré.** A kör, a `loop` visszaél szabályai, a `fan_out` hatókör kiegyensúlyozottsága, a hiányzó `onUnhandledError` és az al-workflow rekurzió mind a motor validációja (SPEC-004 4., 6. szekció), és a szerver a `PUT` végponton `invalid_request`, a futás indításakor `unprocessable` hibával jelzi. Három oka van, hogy ezt nem másoljuk le:

1. **Két forrás keletkezne**, ami elcsúszhat; a `.claude/CLAUDE.md` egyetlen forrás elve ezt tiltja.
2. **A szerver hibaüzenete a `ProtocolErrorBody.message` mezőben már megérkezik**, és a SPEC-007 kimondja, hogy ezt elemzés nélkül jelenítjük meg.
3. **A 100 százalékos lefedettség** minden lemásolt ághoz tesztet követelne, ami a motor tesztjeinek duplikátuma lenne.

**Az `isValidConnection` viszont bekötésre kerül** (M-59), mert az nem szemantikai validáció, hanem a szerkesztés közbeni, azonnali visszajelzés két, tisztán szerkezeti szabályra: egy handle-ből nem indulhat két él ugyanabba a célba, és a `start` csomópontnak nincs bemenő handle-je, tehát oda nem lehet kötni. Mindkettő a handle tábla adatából következik (5.1), nem a motor szabályaiból.

### 5.5 A vezérelt mód és az állapot

A vászon a hivatalos vezérelt alakot használja (M-55): a `nodes` és az `edges` tömb a képernyő React állapota, a változásokat az `onNodesChange` és az `onEdgesChange` az `applyNodeChanges` és az `applyEdgeChanges` segédfüggvényen át vezeti vissza. **Ez nem stílus kérdése:** a mentéshez a node és él tömbnek a saját állapotban kell lennie, különben a `useReactFlow()` instance `toObject()` hívásán át kellene kiolvasni, ami a nem vezérelt mód dokumentált útja.

**A `nodeTypes` objektum modul szintű `const`** (M-56), a komponensen kívül, és regressziós teszt igazolja, hogy a hivatkozás két render között azonos marad. Enélkül a React Flow minden szülő rendernél újraépítené a teljes vásznat, és a hivatalos hibaoldal ezt nevesített hibaként kezeli.

**A képernyő állapota négy részből áll:** a betöltött gráf, a szerkesztés alatti node és él tömb, a kiválasztott csomópont azonosítója, és a mentetlen jelző. A mentetlen jelző a betöltött és a szerkesztett dokumentum összehasonlításából származik, nem egy külön "piszkos" logikai mezőből, hogy egy visszavont változtatás után ne maradjon hamis jelzés.

### 5.6 A szerkesztő és a pillanatkép viszonya

**A szerkesztő mindig az élő gráfot szerkeszti, a pillanatképet soha.** A két alak külön végponton és külön sémán érkezik: az élő gráf a `GET /api/workflows/{id}/graph` válasza (`WorkflowGraphDocument`), a pillanatkép a `GET /api/runs/{runId}/snapshot` válasza (`RunSnapshotResponse`, M-85). A pillanatkép megváltoztathatatlan: repository szinten nincs módosító művelet, és egy `BEFORE UPDATE` trigger is megbuktatja a kísérletet (`.claude/CLAUDE.md` 10. szekció 2. pont).

**Ebből három felületi következmény adódik:**

1. **A futás nézet gráfja csak olvasható.** A `nodesDraggable`, a `nodesConnectable` és az `elementsSelectable` prop hamis; a felhasználó nagyíthat és pásztázhat, de nem szerkeszthet.
2. **A szerkesztő nem tud "visszaállni egy futás állapotára".** A pillanatkép alakja szűkebb, mint az élő gráfé (nincs `createdAtMs`, van viszont `effectiveProviderId`), tehát egy visszatöltő funkció adatvesztéssel járna. Ilyen funkciót a jelen spec nem épít.
3. **A futás nézet megnevezi, hogy a rajz a futás pillanatképe**, nem a workflow mai állapota, és a fejlécében megjeleníti a `sdkVersionPin` értéket. A felhasználónak tudnia kell, hogy egy régi futás rajza eltérhet attól, amit a szerkesztőben lát.

### 5.7 Az automatikus elrendezés

**A user 5. döntése: legyen egy gomb, ami szépen elrendezi a gráfot.** Ez az O-6 tétel lezárása, és a feltétele teljesült: a könyvtár dokumentált és két független forrással igazolt, a távolságok pedig dokumentált forrásból jönnek.

#### A könyvtár és a választás indoka

**A választás a `@dagrejs/dagre@3.1.1`**, `MIT` licenccel. Két független forrás támasztja alá:

1. **A hivatalos React Flow layouting oldal** négy jelöltet sorol fel, és fa alakú gráfra nevesítve ezt ajánlja (M-91). Ugyanez az oldal zárja ki a másik két egyszerű jelöltet a mi esetünkre: a `d3-hierarchy` egyetlen gyökeret vár és minden csomópontnak azonos méretet ad, ami tíz eltérő típusnál hibás; a `d3-force` iteratív fizikai szimuláció, ami minden renderben újraszámolna.
2. **Saját, most futtatott élő registry lekérdezés** (M-92), ami szerint az eredeti `dagre` csomag utolsó kiadása 2019-es, a `dagrejs` fork viszont 2026-08-08-i. A React Flow doksi által megadott repo és wiki link maga is a `dagrejs` szervezetre mutat.

**React 19 verdikt: nincs mit ütköztetni.** A csomag `peerDependencies` mezője sem a registry válaszban, sem a publikált `package.json` fájlban nem létezik (M-92), tehát nem deklarál React peer range-et. Ez erősebb bizonyíték, mint egy kompatibilitási táblázat, mert nincs olyan range, amin kívül eshetnénk: a könyvtár koordinátákat számol, React importja nincs. A típusdefiníciót maga szállítja, tehát `@types/dagre` nem kell.

#### A távolságok, és mi az, amire nincs forrás

**Amit nem állítunk be, arról tudjuk, mi lesz, és két forrásból tudjuk** (M-93): a `nodesep` `50`, a `ranksep` `50`, a `marginx` és a `marginy` `0`. A spec **egyetlen dagre opciót sem ír felül**, egyetlen kivétellel: a `rankdir` értéke `LR`, mert a workflow gráf balról jobbra olvasandó, és ez a felület saját, kimondott iránydöntése, nem egy távolság szám. Az `edgesep` értékén a két forrás eltér (M-93), ezért azt kimondottan nem állítjuk be, hanem a telepített csomag saját alapértékén hagyjuk.

**Amire nincs forrás: a csomópont kártya mérete** (M-94). A dagre bemenete csomópontonként egy `width` és egy `height`, amit a hívónak kell megadnia, és ez a mi saját kártyánk mérete, nem a könyvtár alapértelmezése. A spec ezért **nem ad rá számot**. A `.claude/CLAUDE.md` 4. szekciója szerinti kezelés:

| Kérdés                | Válasz                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mi a viselkedés addig | a gomb nem íródik meg; a csomópont pozícióját a felhasználó adja, ahogy eddig                                                                                                         |
| mi zárja le           | a PLAN-009 egy külön lépésének saját mérése: a ténylegesen kirajzolt kártya mérete valós chromiumban, a SPEC-007 5.3 módszerével, és a mért érték kerül a kódba egyetlen konstansként |

**A konstans egyetlen helyen áll**, a `graph-node-catalog` témában, és **két fogyasztója van**: a kártya CSS-e egy custom propertyn át, és a dagre hívás közvetlenül. Ebből következik, hogy a rajzolt méret és az elrendezéshez használt méret **nem tud elcsúszni**, és hogy a 12.2 szabály sértetlen marad: futásidejű geometria mérés (`measured.width`, `getBoundingClientRect()`) sehol nem szerepel.

#### Mit csinál a gomb, és mit nem

| Amit csinál                                                                                                        | Amit nem csinál                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| a jelenlegi node és él listából dagre gráfot épít, minden csomópontra ugyanazzal a kártya mérettel                 | nem ment: a mentés továbbra is külön, kimondott felhasználói művelet                       |
| a kapott középpont koordinátákat bal felső sarok koordinátává alakítja, és beírja a `positionX`/`positionY` mezőbe | nem fut automatikusan betöltéskor, változtatáskor vagy mentéskor                           |
| a változtatást piszkos állapotnak jelöli, tehát a felhasználó vissza tudja vonni, ha nem menti el                  | nem érinti a futás nézet gráfját (5.6), mert az a pillanatképet mutatja, és csak olvasható |

**Az elrendezés tiszta függvény, és nem importál `@xyflow/react` szimbólumot.** A bemenete a `WorkflowNodeInput` és a `WorkflowEdgeInput` lista, plusz a kártya méret konstans; a kimenete azonosítónként egy `positionX`/`positionY` pár. A vászon típusaira azért nem hivatkozik, mert a pozíció a mi drótszintű alakunk mezője, nem a React Flow rajzoló állapota; ebből következik, hogy a 29. kritérium (`@xyflow/react` import kizárólag három témában) érintetlen marad. DOM hivatkozás nincs benne. Ebből következik, hogy happy-dom alatt közvetlenül, szintetikus bemenettel tesztelhető, tehát a 100 százalékos lefedettség nem szorul e2e tesztre (12.2 mintája).

**Az `N = 0` és az `N = 1` eset nem hibaág.** Üres gráfon és egyetlen csomópont esetén a függvény ugyanazt az utat futja: a dagre gráfot felépíti, elrendezi, és a kapott pozíciókat visszaírja. Külön ág nem íródik rá, mert a `.claude/CLAUDE.md` 5. szekció tiltja a lehetetlen esetre írt hibakezelést, és a kimerítő lefedettség tiltja a sosem futó ágat.

## 6. Az élő futás nézet

A futás nézet útvonala a `/run`, a futás azonosítója a `?runId=` query paraméterből jön (5. szekció bevezetője).

### 6.1 Az osztott elrendezés és a húzható elválasztó

**A user 2. döntése: a gráf és a transcript egyszerre látszik, közöttük húzható elválasztóval.** A megvalósítás a design system `resizable` komponensének átemelése, nem új implementáció, mert a forrás már ma a WAI Window Splitter Pattern szerint épült (M-72, M-73).

**Az átemelés a SPEC-007 4. szekciójának mintáját követi**: a `resizable.css` bájtra azonosan kerül át, fejléc kommenttel a forrásról, és a `.prettierignore` kizárja; a JSX `.tsx` alakban íródik újra, típusos propokkal, `React` globális nélkül.

**Egy dolgot pótolni kell: az `Enter` billentyűt.** A W3C elsődleges forrás a nyíl billentyűk és az `Enter` mellett **nem** jelöli az `(Optional)` megjegyzést, míg a `Home`, az `End` és az `F6` mellett kifejezetten ott áll (M-74). A research 4. szekciója ezt opcionálisnak írta le, de az idézett forrás ezt nem támasztja alá, ezért a jelen spec az elsődleges forráshoz igazodik: az elválasztó `Enter` hatására összecsukja az elsődleges panelt, ismételt `Enter` hatására visszaállítja az előző pozícióra. Az `F6` opcionális marad, és nem kerül be.

**A panelek aránya nem perzisztálódik.** A `localStorage` írása egy fel nem merült igény lenne, és a `.claude/CLAUDE.md` 5. szekció tiltja a nem kért konfigurálhatóságot. Az arány az `aria-valuemin={5}` és `aria-valuemax={95}` korlátok között mozog, ahogy a forrás komponens adja.

### 6.2 Hogyan jelöli a rajzon, hol tart a futás

A gráf a pillanatképből épül, a dekoráció pedig a `GET /api/runs/{runId}/steps` válaszából, majd élőben az SSE keretekből frissül.

| Amit a felhasználó lát               | Miből jön                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| a csomópont állapota                 | a hozzá tartozó `StepRunRecord.status`, a `StepRunStatus` nyolc értékének leképezésével     |
| melyik lépés fut éppen               | `status === 'running'`, plusz a `step_started` és a `step_finished` engine esemény          |
| melyik lépés vár jóváhagyásra        | `status === 'waiting_approval'`, plusz az `approval_requested` esemény                      |
| hányadik próbálkozásnál tart         | `StepRunRecord.attempt`, ha nagyobb mint egy                                                |
| hányadik iterációnál tart egy `loop` | `StepRunRecord.iteration`, plusz a `loop_iteration_started` esemény                         |
| melyik ág futott egy `branch` után   | a `branch_taken` esemény, ami a megfelelő élt kiemeli                                       |
| melyik al-workflow futás indult      | `StepRunRecord.subWorkflowRunId`, ami a `?runId=` paraméterrel egy másik futás nézetre visz |

**A csomópont állapotjelzése nem szín, hanem szöveg és forma együtt.** A kártyán a `Badge` komponens jeleníti meg az állapotot magyar szóval, és a kártya kerete is változik; a szín önmagában nem hordozhat információt, mert az a színlátás zavarával élő felhasználót kizárná. Ez a szabály nem új: a `Badge` variánsai már ma feliratot hordoznak (SPEC-007 6.1).

**A rajz mindig a pillanatképet mutatja, akkor is, ha a lépés futás olyan csomópontra hivatkozik, ami már nem létezik.** A `step_run.node_id` **szándékosan nem idegen kulcs** (SPEC-003 4.10), tehát elméletileg hivatkozhat pillanatképen kívüli azonosítóra. Ez nem hibaág a felületen: a nem párosítható lépés futások a gráf alatt, listás alakban jelennek meg, megnevezve, hogy a rajzon nem szerepelnek.

### 6.3 A párhuzamos ágak, a loop és az al-workflow

**A `fan_out` N ága nem N új csomópont a rajzon.** A pillanatkép egyetlen csomópontot tartalmaz; a párhuzamosság a `step_run` sorokban jelenik meg, ahol ugyanahhoz a `node_id` értékhez több sor tartozik, eltérő `parent_step_run_id` láncon. A felület ezt **összesítve** mutatja a csomóponton: hány ág fut, hány zárt le sikeresen, hány bukott el. A tételes lista a csomópontra kattintva nyílik, a transcript panelt az adott lépés eseményeire szűkítve (`stepRunId` szerinti lekérdezés, M-86).

**Ugyanez a `loop` iterációira.** A csomóponton az aktuális iteráció száma és a `maxIterations` korlát látszik; a korábbi iterációk a tételes listában.

**Az `N = 0` eset nem hiba** (SPEC-004): a `join` üres listával azonnal lefut. A felület ezt kimondja a csomóponton ("nulla ág"), mert egy néma, azonnal kész `fan_out` egyébként hibának látszana.

**Az al-workflow futás önálló nézet.** A `sub_workflow` csomópont a `subWorkflowRunId` értékkel egy linket kap, ami ugyanerre a képernyőre navigál, másik `?runId=` paraméterrel. A fejléc a `RunDetail.workflowAncestry` listájából morzsasort rajzol, hogy a felhasználó a mélyben is tudja, hol jár, és vissza tudjon lépni.

### 6.4 Hiba és megszakítás

| Esemény                    | Mit lát a felhasználó                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| egy lépés `failed`         | a csomópont hibás állapotot vesz fel, a kártyán az `errorKind`, a teljes `errorMessage` a csomópont kiválasztásakor a panelen                                                        |
| a futás `failed`           | a fejléc hibás állapotot vesz fel, az `errorKind` és `errorMessage` a fejléc alatt, teljes szélességben                                                                              |
| `error_handler` újrapróbál | a védett csomópont `attempt` száma nő, és a transcript `step_started` sora mutatja az új próbát; a rajzon a csomópont visszatér futó állapotba                                       |
| megszakítás                | a futás `cancelled` állapotot vesz fel, minden nem terminális lépés szintén; a válasz `cancelledRunIds` listája megnevezi az al-workflow futásokat is (M-89), és a fejléc ezt kiírja |
| `interrupted` állapot      | a `RunStatus` `interrupted` értéke a szerver újraindulásából származó helyreállítás, nem felhasználói művelet, ezért a fejléc ezt külön szóval nevezi meg, nem "megszakítva" alakban |

**A megszakítás nem azonnali, és ezt a felület kimondja.** A motor a jelzés után a generátorokat kimeríti, minden üzenetet beír, és csak utána zár tranzakcióban (SPEC-004 9.). A gomb megnyomása után tehát a felület "megszakítás folyamatban" állapotot mutat, amíg a `run_finished` esemény meg nem érkezik, és a gomb letiltva marad.

### 6.5 A futás vezérlése

| Művelet     | Végpont                             | Mikor aktív                                                     |
| ----------- | ----------------------------------- | --------------------------------------------------------------- |
| indítás     | `POST /api/workflows/{id}/runs`     | a szerkesztőből, ha nincs mentetlen változás és a gráf nem üres |
| megszakítás | `POST /api/runs/{runId}/interrupt`  | `pending` és `running` állapotban                               |
| újraindítás | `POST /api/runs/{runId}/restart`    | terminális állapotban                                           |
| jóváhagyás  | `POST /api/approvals/{id}/decision` | ha van függő jóváhagyás a futáshoz (8. szekció)                 |

**Az indítás bemenete a `start` csomópont `inputFields` listájából épül.** A modális a lista alapján rajzol mezőket, a `required` jelzés szerint kötelezővel, és a `StartRunRequest.input` mezőjébe teszi az összeállított objektumot. Üres `inputFields` esetén a modális nem nyílik meg, a futás azonnal indul.

## 7. A transcript panel

### 7.1 A huszonöt esemény típus megjelenítése

Minden sor ugyanabból a szerkezetből épül: időbélyeg, eredet jelölés, típus címke, és a típusonként eltérő törzs. A `kind` szerinti elágazás **kimerítő `switch`**, tehát egy huszonhatodik érték a `protocol` csomagban fordítási hibát adna.

| Csoport                                                                            | Mit mutat a törzs                                                                                                                       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sdk_assistant`                                                                    | a `toolName` és a `toolUseId` (az első `tool_use` blokkból, research 2. szekció), plusz a négy token szám kompakt utótagként            |
| `sdk_user`                                                                         | a felhasználói fordulat, és a `parentToolUseId`, ha eszköz eredmény                                                                     |
| `sdk_result`                                                                       | a négy token szám és a `numTurns`; **költség nincs**, mert a `total_cost_usd` a nyers payloadban marad, first-party árazásként          |
| `sdk_stream_event`                                                                 | a részleges szöveg, `run_event_transient` keretként megkülönböztetve (7.5)                                                              |
| `sdk_system`                                                                       | az `sdkMessageSubtype` értéke, ami az öt saját `kind`-on kívüli összes rendszer alfajtát gyűjti                                         |
| `sdk_hook_started`, `sdk_hook_progress`, `sdk_hook_response`                       | a hook azonosítója a payloadból, ha jelen van                                                                                           |
| `sdk_informational`, `sdk_commands_changed`, `sdk_rate_limit`, `sdk_context_usage` | a típus címkéje, és a payload olvasható összefoglalója                                                                                  |
| a tizenhárom `engine` eredetű `kind`                                               | az esemény saját, magyar mondata; ezeknek nincs `sdkMessageType`, és nincs token mezőjük, tehát a sor vizuálisan is eltér az sdk sortól |

**A `sdk_context_usage` a leképezésből ma hiányzik.** A pinelt SDK-ban nincs önálló üzenet erre, mert a `context_usage` az `SDKAssistantMessage` egy mezője (research 2. szekció), és ezt a `packages/db` `CLAUDE.md` nyitott pontként dokumentálja. A felület ezért a `kind` értéket kezeli, de az élő gyakorlatban nem kap ilyen sort; ezt a téma `CLAUDE.md` fájlja megnevezi, hogy az olvasó ne hiányolja a tesztadatot.

**A nyers `payload` mindig elérhető.** Minden sor kinyitható, és a kinyitott állapotban a teljes, formázott JSON payload látszik. Ez a menekülőút arra, amit a strukturált leképezés nem fed.

### 7.2 A Claude Code CLI szerű megjelenés

**A követelmény forrása a gyökér `CLAUDE.md`** ("egy Claude Code CLI szerű transcript panel mutatja, mit csinál az agent"). A jelen spec ezt kimondottan a következő olvasat szerint valósítja meg, hogy a követelmény ellenőrizhető legyen, és ha az olvasat téves, javítható:

1. **Monospace betűkép**, a már átemelt `self-hosted-font` téma JetBrains Mono családjából; a sorok bal oldalán állandó szélességű jelölő oszlop.
2. **Sor orientált, kronologikus** megjelenítés, csoportosítás és összecsukható fa nélkül; a lépésenkénti szűkítés a `stepRunId` szerinti lekérdezés dolga, nem a rajzolásé.
3. **Az eszközhívások láthatók**, névvel és azonosítóval, mert az agent munkájának ez a legfontosabb, követhető nyoma.
4. **A színek kizárólag a design system tokenjeiből** jönnek, saját érték nélkül; az `origin` (`sdk` vagy `engine`) a jelölő oszlopban, nem csak színnel jelenik meg.

**Amit szándékosan nem csinálunk:** nem próbálunk egy konkrét, idegen felületet pixelre másolni. Erre nincs forrásunk, és a másolás a design system tokenjeit sértené.

### 7.3 A virtualizáció, és melyik csomagot választjuk

**A választás: `react-window@2.3.0`.** Négy érv, mindegyik mérésre vagy élő forrásra épül:

1. **Ez az egyetlen jelölt, amit ténylegesen lerendereltünk** React 19.2.8 alatt, valós headless Chromiumban; a research 3. szekció számai ebből a futtatásból származnak, nem dokumentációból (M-66). A `@tanstack/react-virtual` élő registryből igazolt, de **mérés nélküli**; a projekt bizonyíték kényszere szerint a mért jelölt erősebb, mint a csak dokumentált.
2. **A peer range nevesítve tartalmazza a React 19-et** (`^18.0.0 || ^19.0.0`, M-67), tehát nem egy tág `>=` range alá esünk be.
3. **A dokumentált imperatív API pontosan a szükséglet:** a `ListImperativeAPI.scrollToRow` és az `onRowsRendered` együtt elég az automatikus görgetéshez, pixel küszöb nélkül (7.4, M-70).
4. **A mérés szerint a költség N-től gyakorlatilag független** (1,5 ... 2,6 ms minden méretre 100-tól 20 000-ig), állandó 22 DOM sorral, míg a naiv append a projekt saját, valós futásból mért 6143 eseményénél már 40 ms (M-66).

**Egy buktató, amit a spec kimond:** a 2.x API teljesen más, mint a széles körben idézett 1.x. A `FixedSizeList` és a `VariableSizeList` megszűnt, helyettük `List` és `Grid` áll, `rowComponent`, `rowCount` és `rowHeight` propokkal (M-69). Egy elavult tutorial alapján írt kód nem fordulna le.

**A `rowHeight` alakja nyitott kérdés (O-5).** A publikált `.d.ts` szerint a prop kötelező, de arra, hogy soronként eltérő magasságot elfogad-e, nincs két független forrásunk. A PLAN-009 F0 fázisa ezt méréssel dönti el, és a mérés két kimenetét a spec előre rögzíti: soronként változó magasság esetén a sor magassága a tartalomból számítódik; egyébként a sorok fix magasságúak, és a hosszú tartalom a soron belül, saját görgethető dobozban áll.

### 7.4 Az automatikus görgetés

**Pixel küszöböt nem vezetünk be**, mert arra nincs forrásunk (M-71), és a `.claude/CLAUDE.md` 4. szekciója tiltja a szám adását dokumentált szabály nélkül. Helyette egy pontos, küszöb nélküli predikátum áll, kizárólag a dokumentált API-ból:

> A felhasználó akkor "van az alján", ha az `onRowsRendered` által adott `visibleRows.stopIndex` értéke megegyezik a `rowCount - 1` értékkel, tehát az utolsó sor a látható tartományban van.

Ha ez igaz, egy új esemény érkezésekor a panel a `scrollToRow({ index: rowCount - 1 })` hívással az aljára görget. Ha hamis, **nem görget**, és a lista fejlécében megjelenik egy "ugrás az aljára" gomb, ami megnevezi, hány új esemény érkezett a felgörgetés óta. A gomb megnyomása visszaállítja az automatikus követést.

**Az elhagyott alternatíva.** Egy `scrollTop + clientHeight >= scrollHeight - X` alakú feltétel `X` küszöböt igényelne, amire nincs forrás. A `stopIndex` predikátum ezt kiváltja, és unit tesztben közvetlenül léptethető, mert az `onRowsRendered` callback szintetikusan meghívható.

### 7.5 A delta kapcsoló következménye

**A kapcsoló alapból kikapcsolt** (`.claude/CLAUDE.md` 10. szekció 3. pont), és a futás indításakor befagy a `workflow_run.persisted_stream_deltas` oszlopba. Ebből a felületre nézve egy zavarba ejtő különbség következik, amit a panelnek kezelnie kell:

| Helyzet                                                      | Mit lát a felhasználó                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| élő futás, kikapcsolt kapcsoló                               | a karakterenkénti szöveg megjelenik, `run_event_transient` keretként, **átmenetiként megjelölve**      |
| ugyanaz a futás oldal újratöltés vagy későbbi megnyitás után | a karakterenkénti szöveg **eltűnik**; csak az összeállt üzenetek maradnak                              |
| bekapcsolt kapcsoló                                          | a karakterenkénti szöveg `run_event` keretként érkezik, `id` értékkel, és visszanézéskor is megjelenik |

**Három szabály, amivel ez nem lesz megtévesztő:**

1. **Az átmeneti sorok vizuálisan meg vannak jelölve**, és a jelölés `title` szövege kimondja, hogy ez a sor nem kerül tárolásra ennél a futásnál.
2. **A transcript fejléce megnevezi a futás beállítását.** Ha a `RunDetail.persistedStreamDeltas` hamis, a fejlécben egy mondat áll arról, hogy a részleges szöveg csak élőben látszik. Ez a `RunDetail` mezőjéből jön, nem a globális beállításból, mert a kapcsoló futásonként befagy.
3. **Az átmeneti soroknak nincs `id` mezőjük** (M-64), tehát a lista kulcsa nem lehet az esemény azonosítója. A kulcs egy kliens oldali, monoton számláló, és a soroknak **nem** szabad az `afterEventId` kurzort mozgatniuk, különben a lapozás átugorna perzisztált sorokat.

## 8. A jóváhagyás felülete

A `human_approval` csomópont a motorban `waiting_approval` állapotba viszi a lépést, és `approval_requested` eseményt ad ki. A felület három helyen jelzi ezt:

| Hely                     | Mit mutat                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| a rajzon a csomóponton   | `waiting_approval` állapot, és hogy mióta vár (`PendingApproval.requestedAtMs`)                 |
| a futás nézet fejlécénél | egy kiemelt sáv, ami megnevezi, hogy a futás beavatkozásra vár                                  |
| a jóváhagyás panelen     | a `title`, a `body`, és a `payload` formázott alakja, két gombbal: "Jóváhagyás" és "Elutasítás" |

**A lista forrása a `GET /api/approvals`**, ami minden függő jóváhagyást ad; a futás nézet a saját `runId` értékére szűr. A döntés a `POST /api/approvals/{approvalId}/decision` hívás, `ApprovalDecisionRequest` törzzsel, aminek egyetlen mezője a `decision`, két értékkel.

**A döntés visszavonhatatlan, és a felület ezt kimondja.** A `human_approval_step_uq` egyedi index miatt lépésenként pontosan egy jóváhagyás létezik, és a `decision` mező egyszer íródik; egy második hívás `conflict` hibát ad. A gombok a küldés pillanatában letiltódnak, és a válaszig letiltva maradnak.

**A lejárt jóváhagyás nem a felület dolga.** A `timeoutMs` lejártakor a motor a lépést `failed` állapotba viszi `approval_timed_out` hibával, és a `decision` mező `NULL` marad (SPEC-004). A felület ezt ugyanúgy hibás lépésként mutatja, mint bármely más `failed` lépést, a hiba nevének megjelenítésével.

## 9. A várakozás jelzése

**A felhasználó követelménye: minden felületi ponton, ahol várni kell, látható jelzés van.** A táblázat a jelen spec **minden új** async pontját felsorolja; a SPEC-007 tizenhét pontja változatlanul érvényes, és itt nem ismétlődik.

| #   | Async pont                                              | Jelzés                                                                       | Miért ez                                             |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | a szerkesztendő gráf betöltése                          | `Skeleton` a vászon helyén, a leendő elrendezés arányában                    | a vászon mérete ismert, nem ugrik a layout           |
| 2   | a workflow fejadatainak betöltése a szerkesztő fejlécbe | `Skeleton` a címben és a leírásban                                           | mint a SPEC-007 2. pontja                            |
| 3   | a gráf mentése                                          | a "Mentés" gomb letiltva, benne spinner, majd `Toast` a sikerről             | a dupla küldés kizárása                              |
| 4   | a provider lista betöltése a node panelben              | a `SelectField` letiltott állapotban, "betöltés" felirattal                  | a mező helye már látszik                             |
| 5   | futás indítása a szerkesztőből                          | a gomb letiltva, benne spinner, majd navigáció a futás nézetre               | a felhasználó tudja, hogy elindult                   |
| 6   | a futás pillanatképének betöltése                       | `Skeleton` a gráf panelen                                                    | a panel mérete ismert                                |
| 7   | a futás fejadatainak betöltése                          | `Skeleton` a fejlécben                                                       | mint a 2. pont                                       |
| 8   | a lépés futások betöltése                               | a csomópontok semleges, "állapot betöltése" jelzést kapnak, nem üres kártyát | a rajz már látszik, csak a dekoráció hiányzik        |
| 9   | a transcript első lapjának betöltése                    | `Skeleton` sorok a listában                                                  | ismert a sor alak                                    |
| 10  | a transcript további lapjának betöltése                 | `ProgressBar` a lista tetején, a meglévő sorok megtartásával                 | a felhasználó ne veszítse el a helyét                |
| 11  | a stream pótlási szakasza a futás nézetben              | a transcript fejlécében "előzmények betöltése", a `replay_complete` keretig  | a felhasználó tudja, miért nem élő még a nézet       |
| 12  | a futás megszakítása                                    | a gomb letiltva, benne spinner, és "megszakítás folyamatban" a fejlécben     | a megszakítás nem azonnali (6.4)                     |
| 13  | a futás újraindítása                                    | a gomb letiltva, benne spinner, majd navigáció az új futásra                 | mint az 5. pont                                      |
| 14  | a függő jóváhagyások lekérése                           | `ProgressBar` a jóváhagyás sávban                                            | a sáv helye már látszik                              |
| 15  | a jóváhagyási döntés elküldése                          | mindkét gomb letiltva, spinner a megnyomotton                                | a dupla küldés kizárása, és látszik, melyiket nyomta |

**Ami szándékosan nem async pont:** az elválasztó húzása, a vászon pásztázása és az automatikus elrendezés gombja. Mind a három szinkron, helyi művelet, tehát jelzés nélkül fut, és ezt kimondjuk, hogy a 15. szekció 35. kritériuma egyértelmű legyen. Az elrendezés azért szinkron, mert a dagre hívás tiszta függvény a helyi node és él listán (5.7), tehát nincs hálózat és nincs várakozás.

## 10. A reszponzív terv

**A kötött szabály változatlan** (SPEC-007 5.3): a media queryk `min-width` és `max-width` literálja kizárólag a `breakpoints.css` hét token értéke közül vehet fel értéket (M-76), és ezt a már meglévő `media-query-breakpoint-invariant` regressziós teszt őrzi, ami a `packages/ui/src` és az `apps/web/src` **minden** CSS fájljára fut. Az új CSS fájlok automatikusan a hatálya alá esnek.

**A futás nézet három sávja:**

| Sáv                                                 | Elrendezés                                                                                                   | Miért ez a token                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ep-screen-lg` (1024px) és felette                | vízszintes osztás, `direction="horizontal"`, függőleges húzható elválasztóval                                | a token kommentje szerint ez a **kis laptop** határa, tehát a legszűkebb, ahol két hasáb idiomatikus                                                     |
| `--ep-screen-md` (768px) és `--ep-screen-lg` között | függőleges osztás, `direction="vertical"`; a gráf felül, a transcript alul, vízszintes húzható elválasztóval | a token kommentje szerint ez a **tablet** sáv, ahol a magasság még elég két panelnek                                                                     |
| `--ep-screen-md` alatt                              | `Tabs` komponens két füllel: "Gráf" és "Transcript"; elválasztó nincs                                        | a token alatt telefon méret van, ahol a `.app-tn__bar` 60px-e (SPEC-007 M-28) után maradó magasság két panelre osztva egyiket sem hagyná használhatóként |

**A két váltási pont választása a rendelkezésre álló hét token közül, a token kommentjeik jelentése alapján történt, nem méréssel.** A `.claude/CLAUDE.md` 4. szekciója szerint ezt kimondjuk: a **szabály** (csak token érték lehet literál) forrásolt és kikényszerített, a **választás** a hét token közül tervezési döntés. A PLAN-009 ezt ugyanazzal a módszerrel erősíti meg, amivel a SPEC-007 5.3 mobil túllógását mérte (chromium, `apps/web` preview build, `scrollWidth` és `toBeInViewport` állítások); ha a mérés azt mutatja, hogy a tényleges törés máshol van, a **fölötte álló** tokennél lépünk be, pontosan úgy, ahogy a SPEC-007 5.3 tette, és kitalált töréspontot nem vezetünk be.

**A gráf szerkesztő ugyanezt a három sávot használja**, azzal a különbséggel, hogy ott a második panel a node beállítás oldalsó panel, nem a transcript. `--ep-screen-md` alatt a panel `Modal` alakban nyílik, mert egy fül váltás a szerkesztésnél elveszítené a vászon kontextusát.

**A vászon minden sávban a teljes rendelkezésre álló területet tölti ki**, a SPEC-007 5.2 "faltól falig" követelménye szerint; a `.app-content` magassága a viewport magasságából és a `60px` bar magasságából számítódik, mindkettő a design system saját értéke.

## 11. A csomagok belső szerkezete

### 11.1 `packages/ui`, egy új téma

```
packages/ui/src/
  resizable/                 Resizable.tsx, ResizablePanel.tsx, ResizableHandle.tsx,
                             a harom .spec.tsx par, es a bajtra azonos resizable.css
```

| Téma        | Mi kerül bele                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resizable` | a design system `resizable` komponensének átemelése, `.tsx` alakban, bájtra azonos CSS-sel, az `Enter` billentyű pótlásával (6.1), és `direction` proppal |

A csomag ezzel **huszonhárom** téma mappából áll. A fájlszám a SPEC-007 25. kritériumának szabálya szerint alakul: exportált egységenként egy megvalósítás és egy `.spec.tsx`, plusz a téma egyetlen `.css` fájlja. A `packages/ui` `dependencies` mezője **nem bővül**.

### 11.2 `apps/web`, tíz új téma

```
apps/web/src/
  graph-node-catalog/        a tiz csomopont tipus megjelenitesi es handle tablaja,
                             plusz a kartya meret konstans (5.7)
  graph-editor/              a vezerelt vaszon, a mentes es a betoltes, a piszkos allapot
  graph-node-card/           az egyetlen egyedi node komponens, a Handle elemekkel
  graph-auto-layout/         a dagre hivas tiszta fuggvenykent es az elrendezes gomb
  node-inspector/            a csomopont beallitas panel es az agents mezotabla
  run-view/                  az osztott futas nezet osszeallitasa es a reszponziv savok
  run-graph/                 a pillanatkepbol epulo, csak olvashato graf, elo dekoracioval
  transcript-panel/          a virtualizalt lista, az automatikus gorgetes es a delta jeloles
  run-event-row/             a huszonot kind kimerito lekepezese egy sorra
  approval-prompt/           a jovahagyas panel es a ket dontes
```

| Téma                 | Felelősség                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph-node-catalog` | tiszta adat: típusonként a magyar címke, a bemenő és kimenő handle-ök, és hogy melyik config mező szerkeszthető, plusz a kártya méret konstans. Négy téma használja (`graph-node-card`, `graph-auto-layout`, `node-inspector`, `run-graph`), tehát egyikük mappájába sem tartozik |
| `graph-editor`       | a `ReactFlow` vezérelt bekötése, a modul szintű `nodeTypes`, az `onConnect` és az `isValidConnection`, a `PUT` mentés                                                                                                                                                             |
| `graph-node-card`    | az egyetlen egyedi node komponens, ami a katalógusból rajzol; itt állnak a `Handle` elemek                                                                                                                                                                                        |
| `graph-auto-layout`  | a `@dagrejs/dagre` hívás tiszta függvényként a node és él listán, plusz az elrendezés gomb (5.7). Egyetlen fogyasztója a `graph-editor`, de önálló domain fogalom és a `graph-editor` témán kívül nincs `@dagrejs/dagre` import                                                   |
| `node-inspector`     | a kiválasztott csomópont beállításai, csoportonként, a `node-config` séma felett; itt áll az `agents` mezőtábla is (5.2)                                                                                                                                                          |
| `run-view`           | a `Resizable` és a `Tabs` közötti váltás, a fejléc, a vezérlő gombok és a morzsasor                                                                                                                                                                                               |
| `run-graph`          | a pillanatkép és a `StepRunRecord` lista összefésülése, és az élő SSE frissítés bekötése                                                                                                                                                                                          |
| `transcript-panel`   | a `react-window` `List` bekötése, az `onRowsRendered` predikátum, a `scrollToRow`, és a delta figyelmeztetés                                                                                                                                                                      |
| `run-event-row`      | a huszonöt `kind` kimerítő `switch` leképezése egy sorra, plusz a nyers payload kinyitása                                                                                                                                                                                         |
| `approval-prompt`    | a függő jóváhagyás megjelenítése és a két döntés elküldése                                                                                                                                                                                                                        |

Az alkalmazás ezzel **huszonnégy** téma mappából áll. **Négy meglévő téma módosul**, és egyik módosítás sem hoz új mappát:

| Téma                   | Mi változik                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `client-route`         | a `CLIENT_ROUTE_TABLE` két bejegyzésről négyre nő; paraméteres ág továbbra sincs (5. szekció)              |
| `frontend-config`      | a `streamOrigin` mező és a `VITE_STREAM_ORIGIN` változó neve (3.3)                                         |
| `stream-client`        | a `buildStreamUrl` az `apiOrigin` helyett a `streamOrigin` értéket kapja (3.3)                             |
| `greppable-invariants` | a SPEC-008 hatókör tilalma törlődik, helyére a SPEC-009 hatókör tilalma és az új invariánsok lépnek (12.5) |

**Egy szint mély, tárgykör mappa nélkül.** A PLAN-004 3. szekció bontási kritériuma mélyebb szintre nem teljesül: a fájlnevek már megnevezik a csoportot. **A repó kétszintű csomagjainak száma marad három** (`core`, `provider-capability`, `db`).

### 11.3 `packages/protocol`, egy új téma

```
packages/protocol/src/
  node-config/               a tiz ag Zod semaja, z.discriminatedUnion a type mezon
```

| Téma          | Mi kerül bele                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node-config` | a `workflow_node.config` tíz ágának Zod sémája, a `db` `NodeConfig` uniójának szándékos duplikátumaként, és a belőle következtetett drótszintű típus (5.3, SPEC-005 7.7) |

A csomag ezzel **tíz** téma mappából áll, egy szint mélyen, plusz az `index.ts` barrel. A bontási kritérium (PLAN-004 3. szekció) mindhárom feltétele teljesül: önálló domain neve van; egyetlen fájlja sem tartozik egyszerre a `workflow` témába; és az import irány egyirányú, mert a `workflow` téma hivatkozik a `node-config` sémára, fordítva nem. A visszairány azért nincs, mert az ágak a saját `z.literal` diszkriminátorukat hordozzák, nem a `workflow` téma `NodeTypeSchema` értékét.

**A sodródás védelem nem ide kerül, hanem az `apps/server` csomagba**, a meglévő `enum-drift-protection` téma mappa mellé, mert az az egyetlen csomag, ahol a `protocol` és a `db` egyszerre látszik (5.3). Az `apps/server` így egy új, megvalósítás nélküli regressziós teszt mappát kap, aminek a neve az, amit őriz.

## 12. Tesztelés

### 12.1 A határvonal unit és e2e között

| Amit igazolni akarunk                                            | Hol     | Miért ott                                                                         |
| ---------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| a node katalógus tábla teljessége mind a tíz típusra             | unit    | tiszta adat, kimerítő `switch`                                                    |
| az `onConnect` a helyes `branchKey` értéket állítja be           | unit    | tiszta függvény a `Connection` objektumon                                         |
| a `nodeTypes` hivatkozás két render között azonos                | unit    | modul szintű `const`, identitás összehasonlítással ellenőrizhető                  |
| a mentetlen jelző a szerkesztett és a betöltött különbségéből    | unit    | tiszta összehasonlítás                                                            |
| a `ReplaceGraphRequestSchema` `safeParse` hibaútja               | unit    | a séma a `protocol` csomagból jön, a bemenet szintetikus                          |
| a `node-config` séma mind a tíz ága, elfogadva és elutasítva     | unit    | tiszta séma, szintetikus bemenettel, a `protocol` csomagban                       |
| a `node-config` és a `db` `NodeConfig` sodródás védelme          | unit    | típusszintű ág a `typecheck` kapun, futásidejű ág az `isNodeConfig` guardon (5.3) |
| az automatikus elrendezés kiszámolt pozíciói                     | unit    | tiszta függvény, DOM hivatkozás nélkül, szintetikus gráffal (5.7)                 |
| az `agents` mezőtábla és a ráolvasztó mentés                     | unit    | tiszta adat és tiszta objektum összefésülés (5.2)                                 |
| a huszonöt `kind` mindegyikének sor alakja                       | unit    | szintetikus `RunEventRecord`, nincs hálózat                                       |
| az automatikus görgetés predikátuma                              | unit    | az `onRowsRendered` callback szintetikusan hívható (M-70)                         |
| a delta figyelmeztetés megjelenése                               | unit    | a `RunDetail.persistedStreamDeltas` mező szintetikus                              |
| a node kártya kirajzolt osztály és ARIA listája                  | unit    | explicit méret mellett a node szerkezete tesztelhető (M-53)                       |
| **hogy egy él ténylegesen ki van rajzolva**                      | **e2e** | happy-dom alatt semmilyen körülmények között nem rajzolódik (M-53, M-54)          |
| **hogy a vászon pásztázása és nagyítása működik**                | **e2e** | valós layout és egérműveletek kellenek                                            |
| **hogy az elválasztó húzása arányt változtat**                   | **e2e** | valós pointer esemény és valós méret                                              |
| **hogy a transcript virtualizált, tehát a DOM sor szám állandó** | **e2e** | valós layout nélkül nincs látható ablak                                           |
| **hogy a három reszponzív sáv a helyes elrendezést adja**        | **e2e** | a viewport méret böngésző szintű fogalom                                          |
| **hogy egy SSE keret hatására a csomópont állapota frissül**     | **e2e** | a stream, a React fa és a DOM együtt                                              |

### 12.2 Az élek e2e kényszere, és miért nem sérti a 100 százalékot

**A mérés egyértelmű: az élek happy-dom alatt sosem rajzolódnak ki** (M-53), és a hivatalos doksi ugyanezt az okot nevezi meg (M-54). Ebből **nem** következik, hogy a lefedettség elérhetetlen, két okból:

1. **A React Flow rajzoló kódja nem a mi kódunk**, tehát nem szerepel a lefedettségi mérlegben; a `coverage.include` mintája `apps/*/src/**/*.{ts,tsx}`.
2. **A saját kódunk minden ága elérhető hálózat és layout nélkül.** Az élek a mi oldalunkon adat: a `WorkflowEdgeInput` tömb, az `applyEdgeChanges` eredménye, az `addEdge` hívás kimenete és a `branchKey` kitöltése mind tiszta függvény vagy React állapot.

**Ebből egy kötött tervezési szabály következik:** a `graph-editor` és a `run-graph` téma **egyetlen ága sem függhet mért node geometriától**. Ha egy ág a `measured.width` vagy a `getBoundingClientRect()` értékétől függene, az happy-dom alatt sosem futna le, tehát a 100 százalékos küszöböt sértené. Ha ilyen igény felmerül, a `packages/ui` `menu` témájának mintáját követjük: a számítás tiszta függvénybe kerül, szintetikus bemenettel közvetlenül tesztelve (`.claude/CLAUDE.md` 12. szekció).

### 12.3 A locator kivétel, és a hatóköre

**A projekt kötött locator sorrendje** (`getByRole` elsőként, `getByTestId` utolsóként, `docs/research/2026-08-29-playwright-teszt-szabalyok.md` 2. szekció) **egyetlen, szűkre szabott kivételt kap**: egy **konkrét React Flow csomópont vagy él kiválasztása** a beépített `data-testid="rf__node-<id>"` attribútummal történik.

**Az indoklás mérésen áll** (M-52): a node `role="group"` értéke **minden** csomóponton azonos, tehát a `getByRole('group')` önmagában nem különbözteti meg őket; a megkülönböztetéshez `.filter({ hasText })` kellene, ami a csomópont szövegére, tehát egy változó tartalomra kötné a tesztet. A `data-testid` értéket **maga a hivatalos xyflow API szállítja**, nem a projektnek kell felvennie, tehát nem egy kikerülő megoldás, hanem a könyvtár saját, dokumentált azonosítója.

**A kivétel hatóköre szigorúan három dolog:** a csomópont és az él DOM elemének megtalálása, és a vászon konténer (`data-testid="rf__wrapper"`). **Minden más locator a kötött sorrend szerint áll**, a megtalált csomóponton belülre szűkítve is: a csomópont kártyáján a `Badge` felirata `getByText`, a kártya gombjai `getByRole('button')`, az oldalsó panel mezői `getByLabel`, a fülek `getByRole('tab')`, az elválasztó `getByRole('separator')`. A kivétel megsértését greppes invariáns teszt őrzi: `getByTestId` hívás kizárólag `rf__` előtagú értékkel állhat az `apps/web/e2e` alatt.

### 12.4 A 100 százalékos unit lefedettség

**A küszöb változatlan: 100 százalék mind a négy metrikán, kizárás nélkül**, és a `vitest.config.ts` `coverage.exclude` listája **nem bővül** (`.claude/CLAUDE.md` 8. szekció). Négy tervezési megkötés következik ebből, a 12.2 szabálya mellett:

- **A `kind` szerinti leképezés kimerítő `switch`**, alapértelmezett ág nélkül; a huszonöt ág mindegyikéhez tartozik teszteset, és egy huszonhatodik érték fordítási hibát adna.
- **Az `isValidConnection` két szabálya tiszta függvény**, a `Connection` objektumon; nincs benne DOM hivatkozás.
- **A `react-window` bekötése köré nem íródik hibaág**, amit nem lehet előidézni; a `ListImperativeAPI` hivatkozás hiányának kezelése a `menu` téma `read-panel-element.ts` mintáját követi, ha egyáltalán szükséges (a mérés dönti el, PLAN-009 F0).
- **A `graph-node-catalog` tábla teljességét a `NodeType` unió kényszeríti ki**, `Record<NodeType, ...>` alakkal, tehát egy hiányzó típus fordítási hiba, nem futásidejű ág.

### 12.5 Az e2e lefedettség és a küszöb

**Az e2e küszöb ma kikényszerített, mért ratchet érték** (`.claude/CLAUDE.md` 8. szekció, `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md`): az `apps/web/package.json` `coverage:e2e:report` scriptjének `--check-coverage` kapcsolója mind a négy metrikára állít küszöböt, és a küszöb pontosan a mért érték, felfelé kerekítés nélkül.

**A jelen spec ezt a mechanizmust nem változtatja meg, és a küszöb értékét nem írja elő.** Ennek oka a ratchet természete: a négy szám a **tényleges mérés** eredménye, tehát csak a kód és a tesztek megírása után ismerhető meg. Amit a spec előír, az három szabály:

1. **A küszöb a PLAN-009 zárásakor újramérődik**, és az új, mért értékre áll be, ugyanazzal a módszerrel, ugyanabba a research fájlba vezetve.
2. **A küszöb egyik metrikán sem csökkenhet** a mai értékhez képest. Ha egy új képernyő lefedettsége a mai szint alá vinné az összesítést, a hiányzó teszt ugyanabban a lépésben íródik meg; a küszöb csökkentése nem megoldás.
3. **A fájl kizárás továbbra is nulla.** A research 2.2 szekciója fájl szintű kizárás helyett a nem fedett sorok tételes indoklását választotta, és ez az elv a SPEC-008 új fájljaira is érvényes.

**A `nyc` összehasonlítása szigorúan kisebb** (`coverage < threshold`), tehát a küszöbbel pontosan egyenlő érték átmegy; ezt a research 1. szekciója méréssel rögzítette, és a küszöb beállításánál számít.

**Új, e2e-vel elvileg sem elérhető sor várhatóan keletkezik**, mert a `VITE_STREAM_ORIGIN` hiányának hibaága ugyanolyan build időben rögzülő konfiguráció, mint a mai `VITE_API_ORIGIN` ága. Az ilyen sorok a research fájl 2.2 táblázatába kerülnek, fájlonként indokolva, és unit teszttel fedve.

## 13. Kockázatok

| Kockázat                                                                   | Hatás                                                                     | Védelem                                                                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A `nodeTypes` objektum a render függvényen belül keletkezik                | a vászon minden szülő rendernél újraépül, a szerkesztés akadozik          | modul szintű `const`, plusz identitás regressziós teszt (M-56, 5.5)                                                                    |
| Valaki lemásolja a gráf szemantikai validációt a kliensre                  | két forrás keletkezik, ami elcsúszhat, és nem tesztelhető ágakat hoz      | az 5.4 szabály, plusz greppes kritérium a `graph_cycle_detected` és társai mintára                                                     |
| Egy ág mért node geometriától függ                                         | happy-dom alatt sosem fut le, a 100 százalékos küszöb elérhetetlen        | a 12.2 szabály, plusz a `menu` téma tiszta függvény mintája                                                                            |
| A transcript sorai nem virtualizáltak, csak látszólag                      | a mért 40 ms-os akadás minden új eseménynél visszatér                     | e2e teszt, ami a DOM sor számot méri nagy listán, és állandó értéket vár (M-66)                                                        |
| Az átmeneti delta sorok mozgatják az `afterEventId` kurzort                | a lapozás perzisztált sorokat ugrana át, csendben                         | a 7.5 3. szabály, plusz unit teszt a kurzor mozgatására                                                                                |
| Egy `react-window` 1.x tutorial alapján íródik a kód                       | nem fordul le, vagy rosszul fordul le                                     | a M-69 tény kimondása a specben, plusz a mért, 2.x API-ra írt PLAN-009 lépés                                                           |
| A `getByTestId` a kivételen kívül is elterjed az e2e tesztekben            | a locator sorrend szabálya elveszti az értelmét                           | a 12.3 greppes invariáns: `getByTestId` kizárólag `rf__` előtagú értékkel                                                              |
| Az átemelt `resizable.css` a Prettier miatt megváltozik                    | a bájtazonosság elvész                                                    | a `.prettierignore` bővítése, plusz bájtszintű összehasonlító teszt (SPEC-007 4.5 mintája)                                             |
| Egy media queryhez olyan töréspont kellene, ami nincs a tokenek között     | a layout elcsúszik a design systemtől                                     | a meglévő `media-query-breakpoint-invariant` regressziós teszt, ami az új CSS fájlokra is fut                                          |
| A dev proxy bevezetése után az SSE is a proxyn menne                       | a SPEC-005 5.8 döntése sérül, és egy nem mért kockázatot vállalnánk       | a `streamOrigin` külön konfiguráció (3.3), plusz greppes kritérium, hogy a proxy szabály kulcsa `/api`                                 |
| A `node-config` séma elcsúszik a `db` `NodeConfig` uniójától               | a felület olyan alakot fogadna el, amit a szerver elutasít, vagy fordítva | a hat meglévő felsorolás mintája szerinti kétirányú sodródás védelem az `apps/server` csomagban, típusszintű és futásidejű ággal (5.3) |
| A `node-config` séma szűkíti az `agents` vagy a `settings` rekord alakját  | a sodródás védelem azonnal megbukik a `typecheck` kapun                   | az 5.3 kimondott szabálya: a két rekord alak a `db` oldali alakot veszi át, szűkítés nélkül                                            |
| Az `agents` űrlap mentése eldob egy ismeretlen kulcsot                     | csendes adatvesztés egy `Record<string, unknown>` mezőben                 | az 5.2 ráolvasztó mentés szabálya, plusz unit teszt egy nem megerősített mezőt hordozó bejegyzésre                                     |
| Az automatikus elrendezés kitalált távolságokkal dolgozik                  | forrás nélküli szám kerül a kódba                                         | az 5.7: a dagre opciókat nem írjuk felül (M-93), a kártya méret pedig a PLAN-009 saját mérése (M-94)                                   |
| Az elrendezés a `measured.width` értékből venné a kártya méretet           | happy-dom alatt sosem futna le, a 100 százalékos küszöb elérhetetlen      | az 5.7 egyetlen konstansa, plusz a 12.2 greppes invariáns, ami a `graph-auto-layout` témára is fut                                     |
| A `@xyflow/react` a `12.11.5` helyett más verzióval kerül be, mérés nélkül | a mért DOM alak és a locator kivétel alapja elvész                        | a PLAN-009 F0 lépése: a rögzített verzión meg kell ismételni a research 1. szekció mérését (M-61)                                      |

## 14. Nyitott kérdések, amikre nincs forrás

### 14.1 A lezárt tételek

**Hat tétel lezárult, és a döntés minden érintett forrásdokumentumba át van vezetve.** Az azonosítók nem számozódnak újra, hogy a hivatkozások ne csússzanak el; a maradék két tétel a 14.2 táblázatban áll.

| #   | Mi zárta le                                                                                                                                                                                                                                                                                          | Hova lett átvezetve                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-1 | **user döntés**: a `protocol` csomag kap egy `node-config` témát a tíz ág Zod sémájával                                                                                                                                                                                                              | jelen spec 5.3, 11.3, a 15. szekció 58 ... 59. kritériuma; **SPEC-005 új 7.7 szekció** (a visszavont döntés kimondva, indokolva), SPEC-005 9. szekció és 1 ... 2. kritériuma |
| O-2 | **saját mérés**, valós `EventSource` a telepített `vite@8.2.2` dev proxyján át (PLAN-009 T-009-5): a lezárás és a `Last-Event-ID` fejléc is helyesen eljut a forrásig, a hivatkozott elavult hiba nem reprodukálható. **A döntés (az SSE megkerüli a proxyt) a mérés kimenetétől függetlenül marad** | `docs/research/2026-09-05-plan009-f0-blokkolo-meresek.md` 4. szekció; SPEC-005 5.8 indoklása pontosítva                                                                      |
| O-3 | **saját mérés** (PLAN-009 T-009-3): az `initialWidth`/`initialHeight` ugyanúgy láthatóvá teszi a node-ot happy-dom alatt, mint a `width`/`height`                                                                                                                                                    | `docs/research/2026-09-05-plan009-f0-blokkolo-meresek.md` 2. szekció; a teszt fixture-ök `initialWidth`/`initialHeight` mezőt használnak, a termékkód egyiket sem állítja    |
| O-4 | **saját mérés**, a pinelt SDK telepített `sdk.d.ts` fájlján és két hivatalos doksi oldalon (M-90); az eredmény: van dokumentált, stabil alak                                                                                                                                                         | jelen spec 5.2, a 15. szekció 60. kritériuma; research 5. szekció                                                                                                            |
| O-5 | **saját mérés**, valós Chromium ellen (PLAN-009 T-009-4): a `react-window@2.3.1` `rowHeight` propja elfogad soronként eltérő magasságot adó függvényt, a mért sormagasságok pontosan követik a függvényt                                                                                             | `docs/research/2026-09-05-plan009-f0-blokkolo-meresek.md` 3. szekció; a SPEC-008 7.3 első, dokumentált kimenete lép életbe                                                   |
| O-6 | **user döntés** plusz két független forrás a könyvtárra (M-91, M-92) és a távolságokra (M-93)                                                                                                                                                                                                        | jelen spec 5.7, 11.2, a 15. szekció 61 ... 62. kritériuma; research 6. szekció; `docs/research/2026-08-26-toolchain.md` új bejegyzés                                         |

**Egy szám maradt nyitva a lezárt O-6 tételen belül, és ezt kimondjuk:** a csomópont kártya mérete (M-94). Erre nincs külső dokumentált forrás, mert a kártya a mi saját elemünk; a PLAN-009 egy külön lépésének saját mérése adja, addig az elrendezés gomb nem íródik meg (5.7).

**Az O-5 lezárásakor a `react-window` verziója is pontosodott.** A research 3. szekciója még `2.3.0`-t mért; a PLAN-009 T-009-4 2026-09-05-i, élő registry lekérdezése (két forrás: npm `dist-tags.latest`, plusz a GitHub tag lista) `2.3.1`-et ad, ami a katalógusba és a toolchain research fájlba is `2.3.1`-ként kerül.

### 14.2 A nyitva maradt két tétel

Egyik sem zárható le tippeléssel. Mindegyiknél áll, mi a viselkedés addig, és mi zárná le. Mindkettő az F7/F8 fázis hatóköre (reszponzív e2e mérés, illetve az e2e küszöb újramérése), nem az F0-F3 fázisé.

| #   | Kérdés                                                                            | Addig                                                                                                                                              | Mi zárná le                                                                                                        |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| O-7 | A `--ep-screen-md` és a `--ep-screen-lg` váltási pont a futás nézetben a helyes-e | a 10. szekció három sávja érvényes; a szabály (csak token érték lehet literál) kikényszerített, a **választás** a hét token közül tervezési döntés | a PLAN-009 reszponzív mérése, a SPEC-007 5.3 módszerével; ha a törés máshol van, a fölötte álló tokennél lépünk be |
| O-8 | Az e2e lefedettségi küszöb új értéke                                              | a mai, mért érték marad érvényben, és egyik metrikán sem csökkenhet (12.5)                                                                         | a PLAN-009 záró lépésének újramérése, a research fájlba vezetve                                                    |

## 15. Elfogadási kritériumok

### A port döntés és az átvezetései

1. A `.claude/CLAUDE.md` 14. szekciójában **nincs nyitott tétel**: a korábbi 1. tétel törölve, a szekció bevezetője és az eljárás leírásának a tételre mutató mondata átvezetve.
2. A SPEC-006 O-1 tétele **lezárva**: a szerver portja `3001`, a dev szerver `5173`, a port kötelező env változó, a fejlesztői origin **opcionális**. A SPEC-006 5.7 4. pontja ehhez igazítva, a hatóköre (`STREAM_PATH`) változatlan.
3. A SPEC-007 O-4 tétele **lezárva**: a dev REST hívás proxyn megy, a CORS engedély nem terjed ki az `/api` előtagra.
4. Az `apps/web/vite.config.ts` `server.proxy` mezője pontosan egy szabályt tartalmaz, a kulcsa az `API_BASE_PATH` értéke, és a `target` **nem literál a fájlban**, hanem env változóból jön. `timeout` mező nincs beállítva (M-79).
5. A `frontend-config` téma két origin mezőt ad (`apiOrigin`, `streamOrigin`), mindkettő kötelező, alapérték nélkül; a hibaüzenet a hiányzó változó **nevét** nevezi meg, az értékét soha. A `stream-client` a `streamOrigin` értéket kapja.
6. Az `apps/web/src` alatt **továbbra sincs port szám és origin literál**; a SPEC-007 45. kritériumát őrző greppes teszt a kettévált konfigurációra is zöld.

### A gráf szerkesztő

7. A `graph-node-catalog` `Record<NodeType, ...>` alakú, tehát mind a tíz típusra tartozik bejegyzés, és egy hiányzó típus **fordítási hibát** ad, nem futásidejű ágat.
8. A `nodeTypes` objektum modul szintű `const`; futtatott teszt igazolja, hogy a hivatkozás két render között azonos (M-56).
9. A vászon vezérelt módban áll: a `nodes` és az `edges` a képernyő állapota, a változások az `applyNodeChanges` és az `applyEdgeChanges` függvényen mennek át (M-55). Futtatott teszt igazolja mindkét irányt.
10. Az `onConnect` a `Connection.sourceHandle` értékéből tölti ki a `WorkflowEdgeInput.branchKey` mezőt; futtatott teszt igazolja mind a hat fenntartott értékre (M-88).
11. Az `isValidConnection` két szabálya (egy handle-ből nem indul két él ugyanabba a célba, a `start` csomópontra nem lehet kötni) tiszta függvény, DOM hivatkozás nélkül; mindkét ágra tartozik teszteset.
12. Az `apps/web/src` alatt **nincs** gráf szemantikai validáció: greppes teszt igazolja, hogy a `graph_cycle_detected`, a `loop_back_edge_outside_body`, a `loop_missing_branch_edge` és az `unbalanced_fan_out_scope` sztring egyikére sincs saját ellenőrző kód, kizárólag a szerver hibaüzenetének megjelenítése.
13. A mentés előtt a `ReplaceGraphRequestSchema` `safeParse` hívása fut; hiba esetén a felület megnevezi, melyik node vagy él melyik mezője hibás, és **nem küld kérést**.
14. A `script` csomópont felvehető, de a szerkesztő a kártyán és a futtatás tiltásakor megnevezi, hogy a motor `unimplemented_node_type` hibával elutasítaná (M-87).
15. A mentetlen jelző a betöltött és a szerkesztett dokumentum összehasonlításából származik; egy visszavont változtatás után a jelző eltűnik. Futtatott teszt igazolja.
16. A node beállítás panel a `protocol` `node-config` sémája felett szerkeszt, mezőnkénti hibajelzéssel; a `skills` és az `mcpServers` mező olvasható, de nem szerkeszthető, és a panel ezt ki is mondja (5.2).
17. A lépés szintű `providerId` felülírás a panelen szerkeszthető, és a `null` érték mellett a panel megnevezi, melyik providert örökli a lépés.
18. A `CLIENT_ROUTE_TABLE` pontosan négy bejegyzést tartalmaz, mind a négy fix útvonal; az illesztő **továbbra sem** tartalmaz paraméteres szegmens ágat (SPEC-007 34. kritériuma).

### Az élő futás nézet

19. A futás nézet gráfja csak olvasható: a `nodesDraggable`, a `nodesConnectable` és az `elementsSelectable` prop hamis. Futtatott teszt igazolja mind a hármat.
20. A gráf a `GET /api/runs/{runId}/snapshot` válaszából épül, és a fejléc megnevezi, hogy a rajz a futás pillanatképe, a `sdkVersionPin` értékkel együtt.
21. A csomópont állapotjelzése **szöveget és formát is** hordoz, nem csak színt; futtatott teszt igazolja, hogy a `Badge` felirata a `StepRunStatus` mind a nyolc értékére megjelenik.
22. A `fan_out` és a `loop` csomópont összesítést mutat (hány ág, hány sikeres, hány bukott; hányadik iteráció a `maxIterations` korlátból), és a `nulla ág` eset külön, kimondott felirattal jelenik meg (6.3).
23. A pillanatképpel nem párosítható `step_run` sorok a gráf alatt, listás alakban jelennek meg, megnevezve, hogy a rajzon nem szerepelnek (6.2).
24. A `sub_workflow` csomópont a `subWorkflowRunId` értékkel ugyanerre a képernyőre navigál, és a fejléc a `workflowAncestry` listájából morzsasort rajzol.
25. A megszakítás után a felület "megszakítás folyamatban" állapotot mutat a `run_finished` eseményig, és a gomb letiltva marad (6.4).
26. A megszakítás válaszából a `cancelledRunIds` lista megjelenik, ha nem csak a gyökér futás szerepel benne (M-89).
27. Az `interrupted` állapot a `cancelled` állapottól **eltérő szóval** jelenik meg, mert az a szerver helyreállításából származik, nem felhasználói műveletből.
28. A futás indítása a `start` csomópont `inputFields` listájából épített modálison megy; üres lista esetén a modális nem nyílik meg. Futtatott teszt igazolja mindkét ágat.
29. Az `apps/web/src` alatt egyetlen `@xyflow/react` import sem áll a `graph-editor`, a `graph-node-card` és a `run-graph` témán kívül; greppes teszt igazolja.

### Az osztott elrendezés és a reszponzív terv

30. A `packages/ui/src/resizable` téma CSS fájlja **bájtra azonos** a design system forrásával, a fejléc kommentet leszámítva; futtatott, bájtszintű összehasonlító teszt igazolja, és a `.prettierignore` kizárja a fájlt.
31. Az elválasztó `role="separator"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` és `aria-controls` attribútummal rajzol; futtatott teszt igazolja mind a hatot (M-73, M-75).
32. Az elválasztó a nyilakra mozdul (iránynak megfelelően, `Shift` dupla lépésközzel), a `Home` és az `End` a szélső méretre ugrik, és az **`Enter` összecsukja, majd visszaállítja az elsődleges panelt**; futtatott teszt igazolja mind a négy billentyűt, az `Enter` mindkét irányát (M-74, 6.1).
33. A futás nézet három reszponzív sávja a `--ep-screen-lg` és a `--ep-screen-md` token értéken vált: vízszintes osztás, függőleges osztás, `Tabs`. Futtatott e2e teszt igazolja mind a három sávot.
34. A `packages/ui/src` és az `apps/web/src` alatti **minden** új CSS media query literálja megegyezik a `breakpoints.css` egyik token értékével; a meglévő `media-query-breakpoint-invariant` regressziós teszt zöld.
35. A 9. szekció mind a tizenöt új async pontjához tartozik a táblázatban megnevezett jelzés, és mindegyikhez futtatott teszt. **Jelzés nélküli async pont nincs**, és a két kimondott nem-async pont (elválasztó húzás, vászon pásztázás) jelzés nélkül fut.

### A transcript panel

36. A `run-event-row` téma a `RunEventKind` mind a huszonöt értékét **kimerítő `switch`** szerkezettel képezi le; egy huszonhatodik érték fordítási hibát adna, és ezt szándékosan hozzáadott értékkel futtatott próba igazolja.
37. Az `sdk_assistant` sor a `toolName` és a `toolUseId` értéket, az `sdk_result` sor a négy token számot és a `numTurns` értéket mutatja; **költség sehol nem jelenik meg**, greppes teszt igazolja a `total_cost_usd` és a `cost` mintára.
38. Minden sor kinyitható, és a kinyitott állapotban a teljes, formázott `payload` látszik. Futtatott teszt igazolja.
39. A lista `react-window@2.3.0` `List` komponensével virtualizált, `rowComponent`, `rowCount` és `rowHeight` propokkal; a `FixedSizeList` és a `VariableSizeList` név sehol nem szerepel (M-69). Greppes teszt igazolja.
40. Az automatikus görgetés predikátuma **pixel küszöb nélküli**: a `visibleRows.stopIndex === rowCount - 1` feltétel dönt (7.4). Az `apps/web/src` alatt nincs görgetési pixel küszöb szám; greppes teszt igazolja.
41. Ha a felhasználó felgörgetett, a panel **nem görget**, és megjelenik az "ugrás az aljára" gomb, ami megnevezi az új események számát; futtatott teszt igazolja mindkét ágat.
42. Az átmeneti (`run_event_transient`) sorok vizuálisan megjelöltek, a jelölés szövege kimondja, hogy a sor nem kerül tárolásra, és ezek a sorok **nem mozgatják** az `afterEventId` kurzort. Futtatott teszt igazolja a kurzort is.
43. Ha a `RunDetail.persistedStreamDeltas` hamis, a transcript fejlécében egy mondat áll arról, hogy a részleges szöveg csak élőben látszik; ha igaz, ez a mondat nem jelenik meg. Futtatott teszt igazolja mindkét ágat.
44. Az e2e teszt igazolja, hogy nagy eseménylistán a ténylegesen a DOM-ban álló sorok száma **állandó**, tehát a virtualizáció valóban működik (M-66).

### Tesztelés és kapuk

45. Az `apps/web/e2e` alatt a `getByTestId` hívás **kizárólag `rf__` előtagú értékkel** áll; minden más locator a kötött sorrend szerinti. Greppes teszt igazolja (12.3).
46. Az `apps/web/src` alatt egyetlen ág sem függ mért node geometriától: nincs `measured.width`, `measured.height` és `getBoundingClientRect()` hivatkozás a `graph-editor`, a `graph-node-card`, a `graph-auto-layout` és a `run-graph` témában. Greppes teszt igazolja (12.2, 5.7).
47. Az élek kirajzolására vonatkozó minden állítás **e2e tesztben** áll, unit tesztben egy sem; az él állapotra vonatkozó állítások (tömb tartalom, `branchKey`) viszont unit tesztek. A két halmaz elkülönülését a PLAN-009 zárása tételesen igazolja.
48. Az `apps/web/e2e` alatt továbbra sincs `page.waitForTimeout(`, `setTimeout(` és `sleep(` hívás; minden új e2e teszt is web-first assertionre vagy `page.waitForResponse()` hívásra épül. Greppes teszt igazolja.
49. Minden új e2e spec fájl a `./coverage-fixture.ts` fájlból importálja a `test` és az `expect` párost, és minden REST hívás `page.route()` mockon megy; valós backend szervert egyetlen új teszt sem szólít meg, a SPEC-007 13.4 szerinti, kimondott `sse-real-server` kivételt leszámítva.
50. A `bun run test` nulla kilépési kóddal fut, és a lefedettség mind a négy metrikán **100 százalék**; a `vitest.config.ts` `coverage.exclude` listája **nem bővült**.
51. A `bun run coverage:e2e:report` nulla kilépési kóddal fut, a küszöb az újramért, tényleges értékre áll, és egyik metrikán sem alacsonyabb a mai értéknél; a származtatás a `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` fájlba vezetve (12.5).
52. A `docs/research/2026-08-26-toolchain.md` tartalmazza a `react-window`, a `@xyflow/react` és a `@dagrejs/dagre` bejegyzést, mindhármat **két független forrással**, és a `@xyflow/react` sor a ténylegesen rögzített, telepített verziót nevezi meg (M-61, M-67, M-92).
53. A `packages/ui/src` alatt **huszonhárom**, az `apps/web/src` alatt **huszonnégy**, a `packages/protocol/src` alatt **tíz** téma mappa áll, plusz a barrel és az `apps/web` `vite-env.d.ts` fájlja; egyetlen téma mappában sincs alkönyvtár. Mind a három `CLAUDE.md` `## Fájlok` táblázata minden témát felsorol, és a `bun run docs:check` zöld.
54. Az `apps/web/src` alatt **nincs** olyan fájl, ami a SPEC-009 hatókörébe tartozik: nincs beállítás képernyő, nincs skill feltöltés, nincs MCP konfiguráció. Greppes teszt igazolja, és a `greppable-invariants` téma korábbi, SPEC-008 hatókört tiltó sora törölve.
55. A 14. szekció három lezárt tétele (O-1, O-4, O-6) minden érintett forrásdokumentumba át van vezetve, és a maradék öt (O-2, O-3, O-5, O-7, O-8) vagy a user válaszával, illetve méréssel lezárva és átvezetve, vagy nyitottként áll a "mi a viselkedés addig" és a "mi zárná le" mezővel. Tippeléssel lezárt pont nincs.
56. A jelen dokumentumban nincs gondolatjel: a hosszú kötőjel karakterre futtatott keresés nulla találatot ad.
57. A `bun run format:check`, `typecheck`, `lint`, `test`, `build`, `docs:check`, `check:casing`, `check:graph` és `check:db-drift`, mind a kilenc parancs nulla kilépési kóddal fut a teljes workspace-en. A kapuk mérvadó listája a `.claude/CLAUDE.md` 8. szekciója.

### A lezárt O-1, O-4 és O-6 döntések

58. A `packages/protocol/src/node-config` téma a `workflow_node.config` mind a tíz ágát Zod sémával fedi, `z.discriminatedUnion` alakban a `type` mezőn, és a `WorkflowNodeInput.config` erre a sémára hivatkozik, nem `z.unknown()` értékre. A négy séma írási szabály (SPEC-005 7.3) sértetlen: `z.strictObject`, nincs `.default()` és `.transform()`, a kimenő alakok `.readonly()`, `.parse()` sehol nem fut. Az `AgentStepConfig.agents` és a `JoinMergeNodeConfig.settings` alakja **nem szűkül** a `db` oldali `Record<string, unknown>` alakhoz képest (5.3).
59. Az `apps/server` csomag új, megvalósítás nélküli regressziós teszt mappát kap, aminek a neve az, amit őriz, és ami a meglévő `enum-drift-protection` téma öt elemű mintáját követi: típusszintű kétirányú kölcsönös értékadhatóság a `protocol` és a `db` `NodeConfig` alakja között, plusz futásidejű ág mind a tíz ágra a `db` `isNodeConfig` guardján. A védelmet **szándékosan elrontott értékkel futtatott próba** igazolja, ami a `bun run typecheck` kaput megbuktatja (5.3).
60. Az `agents` mező űrlapja a mérésben két független forrással fedett **tizenhárom** `AgentDefinition` mezőt szerkeszti, a `skills` és az `mcpServers` kivételével, ami a SPEC-009 hatóköre; a nem megerősített `criticalSystemReminder_EXPERIMENTAL`, `observer` és `observerMessage` mező olvasható, és a panel megnevezi az okot. A mentés **ráolvaszt**, nem cserél: futtatott teszt igazolja, hogy egy ismeretlen kulcsot hordozó bejegyzés a szerkesztés után is megőrzi azt (5.2, M-90).
61. A gráf szerkesztő elrendezés gombja a `@dagrejs/dagre@3.1.1` könyvtárral számol, tiszta függvényben, `@xyflow/react` import és DOM hivatkozás nélkül; a `rankdir` az egyetlen felülírt opció (`LR`), és a `nodesep`, a `ranksep`, az `edgesep`, a `marginx` és a `marginy` egyetlen sorban sem szerepel a kódban. Greppes teszt igazolja mind az ötöt (5.7, M-93).
62. A csomópont kártya mérete **egyetlen konstans** a `graph-node-catalog` témában, amit a kártya CSS-e és a dagre hívás egyaránt olvas; az értéke a PLAN-009 saját méréséből származik, és a mérés a research fájlba van vezetve. Az `apps/web/src` alatt nincs második kártya méret szám; greppes teszt igazolja (5.7, M-94).

## 16. Kapcsolódó dokumentumok

- [`../plan/PLAN-009-graf-szerkeszto-es-futas-nezet.md`](../plan/PLAN-009-graf-szerkeszto-es-futas-nezet.md): a végrehajtási terv
- [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md): a felület váza, a `packages/ui` és a kliens rétegek
- [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md): a szerver, a port és a CORS elrendezés
- [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md): a REST és SSE kontraktus
- [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md): a futás állapotgépe, a fan out, a loop és a megszakítás
- [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md): a gráf modell, a pillanatkép és a delta kapcsoló
- [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md), 6. szekció: a mappa és csomagnév konvenció
- [`../research/2026-09-05-grafszerkeszto-es-transcript.md`](../research/2026-09-05-grafszerkeszto-es-transcript.md): a jelen spec négy mérési területe
- [`../research/2026-09-05-e2e-lefedettsegi-kuszob.md`](../research/2026-09-05-e2e-lefedettsegi-kuszob.md): az e2e küszöb és a ratchet
- [`../research/2026-08-29-playwright-teszt-szabalyok.md`](../research/2026-08-29-playwright-teszt-szabalyok.md): a 15 tételes Playwright szabálylista
- [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md): a rögzített verziók
