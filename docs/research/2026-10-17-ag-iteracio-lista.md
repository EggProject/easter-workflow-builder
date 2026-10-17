# A `fan_out` ágainak és a `loop` iterációinak tételes listája (PLAN-009 T-009-61)

**Dátum:** 2026-10-17
**Ág:** `feat/spec-008-ag-iteracio-lista`, az `origin/main` `0b263ad` állapotáról
**Környezet:** Node `v26.7.0`, Bun `1.4.0`, `@playwright/test@1.62.1` (chromium), `@xyflow/react`
`12.11.6`, `@xyflow/system` `0.0.82`, a sandbox rootless konténere (`.claude/CLAUDE.md` 12. szekció,
`LD_LIBRARY_PATH` kerülő).

A SPEC-008 6.3, 14.1 O-39 és a 118. kritérium megvalósításának mért tényei, forrásai és e2e
lefedettségi darabszámai. A megvalósított alakot a SPEC-008 6.3 írja le; a megvalósításból nyílt két
kérdést (SPEC-008 O-40, O-41) a user 2026-10-17-én eldöntötte, a lezárás a 10. szekcióban áll. A lista
függő jóváhagyás alatti alakja (legördülő) a 11. szekcióban áll.

## 1. A user döntései, amiket a lépés megvalósít (2026-10-17)

| Döntés                                                                                                                                                                                        | Hol áll a kódban                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A megvalósítás most készül (O-39, "Épüljön meg most")                                                                                                                                         | `apps/web/src/branch-iteration-list/`                                             |
| A lista helye a transcript sáv tetején, a transcript fölött, bezáró gombbal                                                                                                                   | `RunViewScreen.tsx` (a `transcriptPanel` első gyereke), `BranchIterationList.tsx` |
| A csomópontra kattintva a transcript a csomópont összes ágának (iterációjának) eseményeire szűkül; egy tételre kattintva csak annak az eseményei látszanak; a bezárás a teljeset hozza vissza | `resolve-branch-iteration-scope.ts`, `filter-transcript-by-step-runs.ts`          |

A jóváhagyás felülete a transcript sáv ALJÁN áll (SPEC-008 8. szekció 1. pont, user döntés
2026-09-25, "transcript felül, kérdés alul", `RunViewTranscriptSide.tsx`), tehát a lista (felül) és a
jóváhagyás (alul) más helyen áll. **Pontosítás (2026-10-17):** a sáv MAGASSÁGÁÉRT viszont versenyeznek;
egy függő jóváhagyás mellett a táblás lista és a transcript szinte eltűnik, ezért függő jóváhagyás alatt
a lista legördülő (user döntés 2026-10-17, "Legördülő jóváhagyáskor", 11. szekció).

## 2. A 19. kritérium a kattintás kezelő mellett: forrás

### 2.1 A telepített forrás (elsődleges)

`node_modules/.bun/@xyflow+react@12.11.6+c647125726432005/node_modules/@xyflow/react/dist/esm/index.js`,
a `NodeWrapper` függvény (2227. sortól):

| Sor  | Szöveg (rövidítve)                                                                                                                        | Következmény                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 2245 | `const isSelectable = !!(node.selectable \|\| (elementsSelectable && typeof node.selectable === 'undefined'));`                           | `elementsSelectable={false}` és a csomóponton nem adott `selectable` mellett hamis                 |
| 2266 | `const hasPointerEvents = isSelectable \|\| isDraggable \|\| onClick \|\| onMouseEnter \|\| onMouseMove \|\| onMouseLeave;`               | az `onNodeClick` megadása a doboznak `pointer-events: all` értéket ad                              |
| 2282 | `const onSelectNodeHandler = (event) => { ... if (isSelectable && (...)) { handleNodeClick(...) } if (onClick) { onClick(event, ...) } }` | a kijelölés csak `isSelectable` mellett fut, az `onNodeClick` hívása ettől független               |
| 2303 | `if (elementSelectionKeys.includes(event.key) && isSelectable) { handleNodeClick(...) }`                                                  | billentyűre (`Enter`, szóköz, `Escape`) csak kijelölhető csomópont reagál, és az `onClick` nem fut |
| 2366 | `onClick: onSelectNodeHandler, ..., onKeyDown: isFocusable ? onKeyDown : undefined, tabIndex: isFocusable ? 0 : undefined`                | a kattintás kezelő mindig a dobozon áll; a csomópont fókuszálható                                  |

`@xyflow/system` `0.0.82` `dist/esm/index.js` 28. sor: `const elementSelectionKeys = ['Enter', ' ', 'Escape'];`.

A `nodesDraggable` és a `nodesConnectable` ugyanígy, a saját propjukból számolódik (`isDraggable`,
`isConnectable`, 2244. és 2246. sor), az `onNodeClick` egyiket sem érinti.

### 2.2 Független megerősítés

- A hivatalos API leírás: <https://reactflow.dev/api-reference/react-flow>, "`onNodeClick`: This event
  handler is called when a user clicks on a node."; "`elementsSelectable`: When `true`, elements (nodes
  and edges) can be selected by clicking on them." A két prop külön, egymástól független leírással.
- A hivatalos "Interaction Props" példa: <https://reactflow.dev/examples/interaction/interaction-props>,
  ahol az `elementsSelectable` és az `onNodeClick` egymástól függetlenül kapcsolható (`isSelectable`
  kezdetben `false`, az `onNodeClick` külön kapcsolóval).
- A publikált típusleírás: <https://cdn.jsdelivr.net/npm/@xyflow/react@12.11.3/dist/esm/types/component-props.d.ts>,
  ugyanazokkal a doksi kommentekkel.

### 2.3 Mérés

- **Unit, a valódi könyvtár kattintás útján** (`RunGraphCanvas.spec.tsx`, "a csomópontra kattintás"):
  a happy-dom alatt kirajzolt `rf__node-n1` dobozra kattintva a vászon `onNodeClick` propja a csomópont
  pillanatkép szerinti alakjával fut, és utána a doboz se `selected`, se `selectable`, se `draggable`
  osztályt nem visel; a három prop hamis.
- **E2e, valós Chromiumban** (`branch-iteration-list.spec.ts`, "a kattintás után a vászon csak olvasható
  marad"): a kattintás után a csomópont nem kijelölt; egy egérhúzás (120, 60 pixel, öt lépésben) után a
  csomópont inline `transform` értéke változatlan, tehát a csomópont nem mozdult (a húzás legfeljebb a
  nézetet pásztázza).
- **Szándékos rontás:** `elementsSelectable` igazra állítva két e2e teszt bukik (a fenti, és a meglévő
  `run-view.spec.ts` "a vászon csak olvasható" tesztje), mindkettő a `selectable` osztályon.

### 2.4 A kártya gombjainak `pointer-events` kiegészítése feleslegessé vált

A `run-graph.css` korábbi `.run-graph-canvas .react-flow__node .btn { pointer-events: auto; }`
szabálya azt pótolta, hogy kattintás kezelő nélkül a doboz `pointer-events: none` értéket kapott
(2266. sor). Az `onNodeClick` óta a doboz `all`, a szabály hatástalan, ezért törlődött; a `sub_workflow`
gomb kattintását a `run-view.spec.ts` meglévő e2e tesztje továbbra is igazolja (zöld).

## 3. A billentyűzetes út (SPEC-008 O-41, lezárva: 10.2)

**Saját mérés** (valós Chromium, ideiglenes, nem commitolt teszt a `branch-iteration-list.spec.ts`
fixtúráján): a `fan_out` csomópont doboza `tabindex="0"`, fókuszálható (`toBeFocused`), és a fókuszált
dobozon az `Enter`, majd a szóköz lenyomása után a lista NEM nyílik ki (a "Ágak: ..." régió száma 0).
Ez egyezik a forrással (2.1, 2303. sor) és azzal, hogy egy nem interaktív elem `click` eseményt
billentyűre nem kap, ezért a billentyűs aktiválást külön kezelővel kell adni:
<https://www.w3.org/WAI/WCAG20/Techniques/client-side-script/SCR29> és
<https://lists.w3.org/Archives/Public/w3c-wai-ig/2019JanMar/0086.html>. A csomópont `domAttributes`
mezője eseménykezelőt nem fogad (`types/nodes.d.ts` 24. sor: `Omit<HTMLAttributes<HTMLDivElement>,
... | keyof DOMAttributes<HTMLDivElement>>`). A lehetséges utakat a SPEC-008 14.2 O-41 sorolja fel.

## 4. A design system elem választása

| Jelölt (`packages/ui` vagy a design system)              | Döntés  | Indok                                                                                                                                                                                               |
| -------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DataTable` + `Badge` + `Button` (átemelve)              | **ez**  | tételes lista soronkénti állapottal; a futás előzmények listája ugyanígy rajzol állapot `Badge`-et és soronkénti `sm` gombot (`run-history-screen.tsx`); görgető régiója van (`.data-table-scroll`) |
| `Tabs` (átemelve, a futás előzmények szűrőjeként is áll) | elvetve | `tablist`/`tabpanel` szemantika, a lista elemei nem panelek; a fül nem hordoz állapot jelvényt; sok tételnél egy sorban vízszintesen görget                                                         |
| `Pagination` (átemelve, a jóváhagyás panel lapozója)     | elvetve | egyszerre egy tételt mutat, a user döntése listát kért                                                                                                                                              |
| `Menu` (átemelve)                                        | elvetve | felugró menü, a lista a sávban tartósan áll                                                                                                                                                         |
| a `drawer` fejléce (`.drawer__header`, a CSS átemelve)   | elvetve | 26 pixeles kijelző betűs cím és nem `.btn` bezárás gomb; a gombok `sm` szabálya (`.claude/CLAUDE.md` 11. szekció) a design system ikon gombját kéri                                                 |
| `Segmented`, `Pills` (a design system `tabs` családja)   | elvetve | nincs átemelve, rádiócsoport szemantika (a kijelölés nem vonható vissza), állapot jelvény nélkül                                                                                                    |

A tétel gombja a lenyomott állapotot `aria-pressed` attribútummal és a `ghost` helyett `secondary`
változattal mutatja, tehát a kiválasztás nem csak színnel látszik. A bezárás ikonja a `packages/ui`
`Modal.tsx` bezárás útvonala (`M4 4l8 8M12 4l-8 8`, a design system `Drawer.jsx` fejlécéével azonos).

## 5. A szűkítés útja (SPEC-008 O-40, lezárva: 10.1)

| Tény                                                                                                                                                  | Forrás                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A futás nézet a nézett futásra `fromEventId: 0` feliratkozást ad, a szerver a futás teljes perzisztált eseménysorát pótolja, utána élő keretek jönnek | SPEC-008 M-107, `RunViewScreen.tsx` (`replaceStreamSubscriptions`)         |
| A transcript a keretekből épül, a sor rekordja hordozza a `stepRunId` mezőt; az átmeneti keret is                                                     | `transcript-panel/use-run-transcript.ts`, `to-transient-row-record.ts`     |
| A REST lépés lekérdezés alakja `{ limit, stepRunId }`, `limit` kötelező pozitív egész, `afterEventId` kurzor ezen az ágon nincs                       | `packages/protocol/src/transcript/read-run-events-query.ts`, SPEC-008 M-86 |
| A web kliensben a `GET /api/runs/{runId}/events` útvonalnak ma nincs hívója                                                                           | `grep readRunEvents apps/web/src` (nulla találat)                          |

A `limit` értékére nincs dokumentált szám (`.claude/CLAUDE.md` 4. szekció 1. pont), tehát a REST út
csak user által adott értékkel volna megvalósítható; a kliens oldali szűrés nem igényel számot.

## 6. A lista és a transcript magasság megosztása

`branch-iteration-list.css`: a lista `flex: 1 1 0` és `max-height: max-content`, a transcript panel a
meglévő `flex: 1` értékével. E2e mérés valós Chromiumban, 1440x900-on (`branch-iteration-list.spec.ts`,
`measureSplit`):

- **Rövid lista** (2 ág): a lista doboza alacsonyabb a transcript panelnél, és a tábla görgető régiója
  nem görget (`scrollHeight` nem nagyobb a `clientHeight` értéknél).
- **Hosszú lista** (32 tétel): a lista és a transcript panel magasságának különbsége legfeljebb 1
  pixel, a tábla görget, a transcript első sora teljesen a nézetben áll (`toBeInViewport({ ratio: 1 })`),
  és a görgetett táblában az utolsó tétel is szűkít.

A tűrés (1 pixel) a két flex elem kerekítésére vonatkozik; nyers pixel számot ez a fájl nem rögzít
(`.claude/CLAUDE.md` 4. szekció 3. pont).

## 7. Szándékos rontások (valós Chromium, `bun x playwright test e2e/branch-iteration-list.spec.ts`)

| Rontás                                                                                       | Eredmény                                                                                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| a szűrés elhagyása (`RunViewScreen.tsx`: `const shownTranscript = transcript;`)              | 3 teszt bukik (`fan_out`, `loop`, hosszú lista), mindhárom: "Expected: 3, Received: 8" a transcript sorainak számán |
| a `parent_step_run_id` lánc elhagyása (`collect-step-run-scope.ts`: a leszármazottak nélkül) | 3 teszt bukik (`fan_out`: 1 sor 3 helyett; `loop`: 2 sor 3 helyett; hosszú lista: 1 sor 3 helyett)                  |
| `elementsSelectable` igaz (`RunGraphCanvas.tsx`)                                             | 2 teszt bukik (2.3)                                                                                                 |

Mindhárom rontás visszaállítva, utána a fájl minden tesztje zöld.

## 8. E2e lefedettség, előtte és utána

A 29. szekció tiszta eljárása (`docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md`), a sandboxban a 47.
szekció módja szerint: `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`,
az `apps/web` alatt `bun x playwright test --shard=<i>/8 --workers=3` nyolc egymás utáni futásban,
`flock /tmp/playwright-gep.lock` alatt, majd `bun run coverage:e2e:report`; a darabszámok a `nyc report
--reporter=json-summary` kimenetéből.

| Metrika    | Előtte (`0b263ad`, 593 teszt) | Utána (601 teszt) | Fedetlen előtte -> utána |
| ---------- | ----------------------------- | ----------------- | ------------------------ |
| statements | 1991 / 2005                   | 2059 / 2073       | 14 -> 14                 |
| branches   | 918 / 929                     | 954 / 965         | 11 -> 11                 |
| functions  | 684 / 686                     | 714 / 716         | 2 -> 2                   |
| lines      | 1920 / 1934                   | 1985 / 1999       | 14 -> 14                 |

A `coverage:e2e:report` a meglévő küszöbbel (99.3 / 98.81 / 99.7 / 99.27) exit 0. A küszöb nem mozdul (a
PLAN-009 F9 szabálya szerint a lépés csak a darabszámot vezeti). A fedetlen tételek ugyanazon az öt
fájlon állnak, mint a 49.3 szekcióban (`mount-app.tsx`, `read-frontend-config.ts`,
`is-valid-connection.ts`, `perform-route-request.ts`, `use-stream-connection.ts`); a lépés minden új és
módosított fájlja mind a négy metrikán 100 százalék.

**Egy köztes állapot.** Az első teljes futás 16 / 13 / 4 / 16 fedetlen tételt adott (599 teszt):
a `BranchIterationList.tsx` két oszlopának `value` függvénye (a `DataTable` csak rendezéskor hívja), a
`build-branch-iteration-items.ts` pillanatképen kívüli csomópont ága, és a `TranscriptPanel.tsx`
`isFiltered` alapértéke. A lezárás: két új e2e teszt (a fejlécre kattintva a sorrend nem változik, és a
pillanatképen kívüli csomópontra mutató ág tétele az azonosítót viseli), és az `isFiltered` kötelező
prop lett, alapérték nélkül.

## 9. A tesztek

- Unit (`bun run test`, 100 százalék): `branch-iteration-list-kind.spec.ts`,
  `collect-step-run-scope.spec.ts` (a lánc, beágyazott hatókörrel), `resolve-branch-iteration-scope.spec.ts`,
  `build-branch-iteration-items.spec.ts` (az `iteration` és a közvetlen gyerekek, létrehozási sorrend,
  azonos időpont), `filter-transcript-by-step-runs.spec.ts`, `toggle-branch-iteration-item.spec.ts`,
  `BranchIterationList.spec.tsx`, plusz a `RunGraphCanvas.spec.tsx`, a `RunViewScreen.spec.tsx` és a
  `TranscriptPanel.spec.tsx` új esetei.
- E2e (`apps/web/e2e/branch-iteration-list.spec.ts`, eredetileg nyolc teszt, a 10. szekció kettővel bővítette): `fan_out` és `loop` lista, szűkítés,
  ismételt megnyomás, bezárás, csak olvasható vászon, más típusú csomópont, a két magasság eset, a
  rendezés hiánya és a pillanatképen kívüli csomópont.

## 10. A 2026-10-17-i user döntések és a review lezárása

### 10.1 O-40: a szűkítés útja

User döntés: "Marad a böngészőben." A kliens oldali szűrés (5. szekció) marad; a SPEC-008 118.
kritériumának zárójele a kliens oldali szűrést írja elő, az O-40 a 14.1-be került.

### 10.2 O-41: az `Enter` és a szóköz a fókuszált csomóponton

User döntés: "Enter és szóköz nyissa." A megvalósítás: `apps/web/src/run-graph/find-keyboard-activated-node.ts`
(tiszta függvény) és a `RunGraphCanvas` `ReactFlow` elemének `onKeyDown` propja. A `ReactFlowProps`
a `HTMLAttributes<HTMLDivElement>` bővítése (`types/component-props.d.ts` 8. sor), a `...rest` a
burkoló `div`-re kerül (`dist/esm/index.js` 3775. sor), tehát a fókuszált csomópont dobozáról
felbuborékoló `keydown` itt látszik. A figyelő csak akkor lép, ha a célpont maga a csomópont doboza
(`react-flow__node` osztály, 2345. sor; `data-id`, 2366. sor).

**A React Flow saját billentyűi** a telepített `@xyflow/react` 12.11.6 és `@xyflow/system` 0.0.82
forrásában:

| Billentyű kezelő (forrás sor)                                                                                                                  | Hatás a futás vásznán (`elementsSelectable`, `nodesDraggable` hamis)                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a csomópont `onKeyDown`: `elementSelectionKeys` (`Enter`, szóköz, `Escape`) csak `isSelectable` mellett (2303.)                                | nem lép; a nyilak csak húzható, kijelölt csomópontot mozgatnak (2312.), szintén nem lép                                                                   |
| `deleteKeyCode` alapérték `Backspace`, `selectionKeyCode` `Shift`, `multiSelectionKeyCode` és `zoomActivationKeyCode` `Meta`/`Control` (3767.) | egyik sem az `Enter` vagy a szóköz                                                                                                                        |
| `panActivationKeyCode` alapérték `Space` (3767.), `useKeyPress` a `window`-on (2118.)                                                          | amíg lenyomva áll, `panOnDrag` és `panOnScroll` igaz (2119-2120.); a `preventDefault` a nem `BUTTON`/`A` célponton fut (446-447.), a lap tehát nem görget |

Tehát az `Enter` és a szóköz a csomóponton a React Flow-ban semmit nem jelöl ki és nem mozdít, és a
lista nyitása egyik kezelőt sem zavarja. Az `Escape` szándékosan kimarad (a kijelölés visszavonása, nem
aktiválás).

**Mérés:** unit (`find-keyboard-activated-node.spec.ts`; `RunGraphCanvas.spec.tsx` "a billentyűs út":
az `Enter` és a szóköz a valódi könyvtár dobozán a kattintással azonos hívást ad, más billentyű és a
panel nem, és a doboz billentyűre sem kap `selected` vagy `selectable` osztályt); e2e
(`branch-iteration-list.spec.ts` "a fókuszált fan_out és loop csomóponton ..."): `focus()` után
`Enter` a `fan_out`, `Space` a `loop` listáját nyitja, a `start` csomóponton a nézet nem változik, és
egyik csomópont sem lesz kijelölt. **Szándékos rontás:** a figyelő hívásának elhagyása mellett az e2e
bukik (a régió nem jelenik meg).

### 10.3 Az iteráció jelvénye az iteráció lépéseiből

User döntés: "Az iteráció lépései alapján." A megvalósítás: `resolve-loop-iteration-status.ts`, az
iteráció lépés futása és minden leszármazottja közül a legerősebb állapot (`failed`, `rejected`,
`interrupted`, `cancelled`, `waiting_approval`, `running`, `pending`, `succeeded` sorrendben). A
sorrend user döntés (2026-10-17, "A legrosszabb"), a SPEC-008 6.3 rögzíti. Unit teszt minden párra
mindkét sorrendben, plusz a lépés nélküli, a beágyazott és a hatókörön kívüli esetre. E2e: a `loop` második iterációjának kiértékelése sikeres, a törzse elbukott, a
tétel jelvénye "sikertelen". **Szándékos rontás:** a jelvény a lépés futás saját állapotából (a régi
alak) mellett az e2e bukik.

### 10.4 Review: a `loop` tétel felirata

A korábbi "1. iteráció: 0" felirat a sorszámot (1-től) és az `iteration` értéket (0-tól) keverte. Az
új felirat a kártya összesítésének alakja, "iteráció: N / M" (`GraphNodeCard.tsx`), sorszám nélkül;
a `fan_out` tétele a sorszámot és a nevet tartja.

### 10.5 Review: a transcript panel `key` értéke

A `key={transcriptPanelKey}` szükséges: a szűkítés váltásakor a transcript panel görgetés követése
(`use-transcript-auto-scroll.ts`) nem viheti át az állapotát a másik sorlistára. E2e
(`branch-iteration-list.spec.ts` "a lista bezárása után a transcript tiszta lappal indul ..."): 40
ágsorral a szűkített lista görget, a teszt a tetejére görget, majd bezárja a listát; a teljes lista
utolsó sora a nézetbe kerül, és "Ugrás az aljára" gomb nincs. **Szándékos rontás:** `key={runId}`
mellett a teszt bukik (a lista a tetején marad, az utolsó sor nincs kirajzolva), mert a követés nélküli
állapot átjön, és a visszatérő sorokat új eseménynek számolja.

## 11. Függő jóváhagyás alatt legördülő (user döntés 2026-10-17, "Legördülő jóváhagyáskor")

### 11.1 A felülírt döntés és a mért indok

A user 2026-10-17-én először azt döntötte, hogy nyitott lista és függő jóváhagyás mellett a transcript
sáv két, húzható elválasztóval osztott fele legyen: felül a lista, alul a transcript és a jóváhagyás
("fele-fele"). Ennek a prototípusa (egy előző munkamenet nem commitolt `RunViewTranscriptSide`
változata: külső `Resizable` `[50, 50]` arányon, a lista az első panelen, a transcript, a jóváhagyás
törzse és a "Függő jóváhagyások" régió a másodikon) a mérés szerint egyetlen teljes listasort sem
mutatott, és a transcriptet szinte eltüntette. **A döntést a user ugyanaznap felülírta** ("Legördülő
jóváhagyáskor"), ezért a fele-fele elválasztó nem épült meg.

**A mérés** ebben a munkamenetben újrafuttatva: a `bc436c0` állapotán a prototípus javítása, valós
Chromium, egy `fan_out` 32 ággal (az első `waiting_approval`), 20 transcript sorral, egy függő
jóváhagyással, a lista kinyitva; a mérő spec nem commitolt, képet nem ír, csak számot (`page.evaluate`,
`getBoundingClientRect`, egész pixelre kerekítve). "Teljes listasor": a tábla sora teljes egészében a
tábla görgető régiójában, a lista paneljében és a nézetben, a fejléc alatt.

| Méret, jóváhagyás                                         | A rajz | A transcript oldal | A lista panel | Teljes listasor | A transcript panel | A jóváhagyás törzse |
| --------------------------------------------------------- | -----: | -----------------: | ------------: | --------------: | -----------------: | ------------------: |
| 1440x600, függő jóváhagyás                                |    400 |                400 |           198 |               0 |                 12 |                  44 |
| 1000x700, függő jóváhagyás                                |    266 |                229 |           112 |               0 |                  0 |                   2 |
| 1000x700, függő jóváhagyás, tárolt külső arány `[10, 90]` |     60 |                435 |           215 |               1 |                 21 |                  53 |
| 375x812, függő jóváhagyás, Transcript fül                 |      0 |                533 |           264 |               1 |                 46 |                  78 |

A lista panel teteje és a tábla fejlécének alja között (a cím, a mondat és a tábla fejléce) 122 pixel
állt, 375x812-n 143, egy tábla sor 57 pixel magas volt. A jóváhagyás gombjai mindegyik esetben a nézetben álltak.

### 11.2 A megvalósult alak

Függő jóváhagyás alatt (amíg a jóváhagyás felülete látszik: `shownApproval !== undefined`, ugyanaz a
feltétel, ami a jóváhagyás törzsét és az elválasztót kiteszi) a lista tábla helyett egyetlen sor: a
`packages/ui` `SelectField` eleme `size="sm"` mérettel és a bezárás ikon gombja
(`BranchIterationList.tsx` `isCompact`, `branch-iteration-list.css` `.branch-iteration-list--compact`).
Az első opció "Összes ág", illetve "Összes iteráció", a továbbiak tételenként "<a tétel felirata>, <az
állapot jelvény felirata>" (`describeStepRunStatusBadge`, SPEC-008 6.2). A legördülő értéke a tétel
lépés futás azonosítója előtaggal, hogy egyetlen azonosító (a drótszintű séma szerint tetszőleges szöveg,
`StepRunRecordSchema` `id: z.string()`) se eshessen egybe a "minden tétel" opció értékével. A
`packages/ui` nem változott.

**A transcript panel nem szerel le.** A lista és a transcript panel ugyanannak a `transcriptPanel`
töredéknek két testvére (`RunViewScreen.tsx`); a váltás csak a `BranchIterationList` belsejét cseréli, a
transcript panel helye és a `key` értéke (a futás és a szűkítés) változatlan, a kiválasztás a
`RunViewScreen` állapota. A React a helyben maradó elemet megtartja
(<https://react.dev/learn/preserving-and-resetting-state#same-component-at-the-same-position-preserves-state>),
és a `RunViewTranscriptSide` a transcriptet a jóváhagyás nélkül és vele is ugyanazon a helyen tartja
(a fájl fejkommentje).

**Mérés utána**, ugyanazzal a fixtúrával és mérő spec alakkal (nem commitolt), a jelen lépés kódján
(`bc436c0` plusz a lépés változásai):

| Méret, jóváhagyás                         | A rajz | A transcript oldal | A lista régió | A legördülő | A legördülő a nézetben | A transcript panel | A jóváhagyás törzse |
| ----------------------------------------- | -----: | -----------------: | ------------: | ----------: | ---------------------- | -----------------: | ------------------: |
| 1440x600, függő jóváhagyás                |    400 |                400 |            36 |          36 | igen                   |                 21 |                 181 |
| 1000x700, függő jóváhagyás                |     60 |                435 |            36 |          36 | igen                   |                 75 |                 162 |
| 375x812, függő jóváhagyás, Transcript fül |      0 |                533 |            36 |          36 | igen                   |                125 |                 210 |
| 1440x600, jóváhagyás nélkül (tábla)       |    400 |                400 |           176 |           - | -                      |                176 |                   - |

A jóváhagyás gombjai mindhárom jóváhagyásos esetben a nézetben álltak. 1000x700-on (függőleges sáv) a
rajz a felfedés szabálya szerint 60 pixelre húzódott össze (SPEC-008 8. szekció 1. pont, "a rajz
húzódjon össze"); a prototípusban ugyanezen a méreten 266 pixelen maradt, az eltérés okát ez a mérés
nem vizsgálta (nem ellenőrzött). 1440x600-on (vízszintes sáv) a külső elválasztó más tengelyen áll,
tehát a kérdés felfedése a belső elválasztót mozdítja (SPEC-008 8. szekció 1. pont), és a transcript
panelnek 21 pixel marad; ebből a magasságból a legördülő sora a saját 36 pixelét és a lista alsó
margóját veszi el.

### 11.3 E2e és szándékos rontások

`apps/web/e2e/branch-iteration-list.spec.ts`, négy új teszt, plusz egy állítás a meglévő `fan_out`
tesztben (jóváhagyás nélkül a tábla áll, legördülő nincs):

- 1440x600, 1000x700 és 375x812 (a fül sávban a "Transcript" fülön): nyitott lista és függő jóváhagyás
  mellett a legördülő és a bezárás gomb teljesen a nézetben (`toBeInViewport({ ratio: 1 })`), tábla
  nincs, az opciók a 11.2 alakjában, a "2. Ellenőrzés, elutasítva" választás a transcriptet egy sorra
  szűkíti, az "Összes ág" visszaállítja, és a kérdés címe, szövege és a két gomb előtte és utána is
  teljesen látszik.
- 1440x600, élőben érkező és eltűnő jóváhagyás (a kapcsolat a `node:http` teszt szerveren nyitott,
  `startOpenStreamServer`, a szabálykönyv 11. szekciójának kivétele): a táblában választott tétel a
  legördülő értéke lesz, a szűkítés marad, a transcript panel DOM eleme (`data-e2e-mounted` jelöléssel)
  megmarad; az eltűnés után a tábla áll, a tétel gombja lenyomott, a szűkítés és a DOM elem marad.

| Rontás (`RunViewScreen.tsx`)                                                                    | Eredmény                                                                                           |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| a legördülő választása nem írja a kiválasztást (`onSelectItem` a régi kiválasztást adja vissza) | a három méret tesztje bukik: a legördülő felirata "Összes ág" marad                                |
| a választás nem szűkít (jóváhagyás alatt a szűkítés a tételt figyelmen kívül hagyja)            | négy teszt bukik (a három méret és az élő érkezés): "Expected: 1, Received: 3" a transcript sorain |
| mindig a tábla (`isCompact={false}`)                                                            | négy teszt bukik: a legördülő nincs a nézetben, illetve nincs legördülő                            |
| a transcript panel a jóváhagyás váltásakor újra felcsatolódik (a `key` része a jóváhagyás)      | az élő érkezés tesztje bukik: a jelölt DOM elem száma 0                                            |

Mindegyik rontás visszaállítva, utána a fájl mind a 14 tesztje zöld. Unit:
`BranchIterationList.spec.tsx` (a legördülő alak hat esete) és `RunViewScreen.spec.tsx` (élő
érkezés és eltűnés, a választás, a szűkítés és a transcript panel eleme marad).

### 11.4 E2e lefedettség a merge kapun

A 8. szekció eljárása szerint (nyolc egymás utáni shard, `--workers=3`, `flock`, utána
`bun run coverage:e2e:report`), az `origin/main` `7233fef` (PR #48) beolvasztása után.

**Első futás a `30918f3` merge fejen (615 teszt, mind zöld):** 15 / 12 / 2 / 15 fedetlen tétel, a
`coverage:e2e:report` a küszöb alatt bukott (statements 99.29, branches 98.78, lines 99.26). Az új
fedetlen tétel a `run-graph/find-keyboard-activated-node.ts` 41. sora (a nem aktiváló billentyű ága,
és vele az `if` igaz ága): a `b14146a` óta egyetlen e2e sem nyomott a fókuszált csomóponton az
`Enter`-től és a szóköztől eltérő billentyűt. A lezárás: a "fókuszált fan_out és loop csomóponton"
e2e teszt végén az `ArrowDown` a fókuszált `fan_out` csomóponton a listát nem nyitja. **Szándékos
rontás:** az `ArrowDown` felvétele az aktiváló billentyűk közé mellett a teszt bukik ("Expected: 0,
Received: 1" a lista régióin).

**A végső fejen (615 teszt):**

| Metrika    | Fedett / összes | Fedetlen |
| ---------- | --------------- | -------: |
| statements | 2112 / 2126     |       14 |
| branches   | 980 / 991       |       11 |
| functions  | 735 / 737       |        2 |
| lines      | 2033 / 2047     |       14 |

A fedetlen darabszám a 8. szekció és a `7233fef` állapotával azonos (14 / 11 / 2 / 14), ugyanazon az öt
fájlon (`mount-app.tsx`, `read-frontend-config.ts`, `is-valid-connection.ts`,
`perform-route-request.ts`, `use-stream-connection.ts`); a küszöb nem mozdul.
