# A `fan_out` ágainak és a `loop` iterációinak tételes listája (PLAN-009 T-009-61)

**Dátum:** 2026-10-17
**Ág:** `feat/spec-008-ag-iteracio-lista`, az `origin/main` `0b263ad` állapotáról
**Környezet:** Node `v26.7.0`, Bun `1.4.0`, `@playwright/test@1.62.1` (chromium), `@xyflow/react`
`12.11.6`, `@xyflow/system` `0.0.82`, a sandbox rootless konténere (`.claude/CLAUDE.md` 12. szekció,
`LD_LIBRARY_PATH` kerülő).

A SPEC-008 6.3, 14.1 O-39 és a 118. kritérium megvalósításának mért tényei, forrásai és e2e
lefedettségi darabszámai. A megvalósított alakot a SPEC-008 6.3 írja le; a nyitva maradt két
kérdést a SPEC-008 14.2 O-40 és O-41 tartja.

## 1. A user döntései, amiket a lépés megvalósít (2026-10-17)

| Döntés                                                                                                                                                                                        | Hol áll a kódban                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A megvalósítás most készül (O-39, "Épüljön meg most")                                                                                                                                         | `apps/web/src/branch-iteration-list/`                                             |
| A lista helye a transcript sáv tetején, a transcript fölött, bezáró gombbal                                                                                                                   | `RunViewScreen.tsx` (a `transcriptPanel` első gyereke), `BranchIterationList.tsx` |
| A csomópontra kattintva a transcript a csomópont összes ágának (iterációjának) eseményeire szűkül; egy tételre kattintva csak annak az eseményei látszanak; a bezárás a teljeset hozza vissza | `resolve-branch-iteration-scope.ts`, `filter-transcript-by-step-runs.ts`          |

A jóváhagyás felülete a transcript sáv ALJÁN áll (SPEC-008 8. szekció 1. pont, user döntés
2026-09-25, "transcript felül, kérdés alul", `RunViewTranscriptSide.tsx`), tehát a lista (felül) és a
jóváhagyás (alul) nem versenyez egy helyért; a spec helyettesítési vagy egymás alatti szabályára nincs
szükség.

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

## 3. A billentyűzetes út hiánya (SPEC-008 14.2 O-41)

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

## 5. A szűkítés útja (SPEC-008 14.2 O-40)

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
- E2e (`apps/web/e2e/branch-iteration-list.spec.ts`, nyolc teszt): `fan_out` és `loop` lista, szűkítés,
  ismételt megnyomás, bezárás, csak olvasható vászon, más típusú csomópont, a két magasság eset, a
  rendezés hiánya és a pillanatképen kívüli csomópont.
