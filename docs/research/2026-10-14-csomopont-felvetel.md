# D1: csomópont felvétel és törlés

A PLAN-009 F9 fázisának D1 munkacsomagja (SPEC-008 5.8, 5.9, 5.10, 11.4) ide vezeti a forrással
igazolt tényeit és a saját méréseit, lépésenként külön szekcióban. A kódban csak a forrás neve
vagy ez a fájl áll, a mérési próza és a nyers számok itt (`.claude/CLAUDE.md` 4. szekció 3. pont).
Az e2e lefedettség előtte és utána darabszáma lépésenként ide kerül (PLAN-009 F9, "Az e2e
lefedettségi küszöb kezelése").

## T-009-41

A design system `context-menu` komponensének átemelése a `packages/ui` csomagba, pontra nyitó,
vezérelt alakban (`packages/ui/src/context-menu/`).

### 1. A forrás

Saját olvasás: `eggproject-design-components/components/context-menu/ContextMenu.jsx`,
`context-menu.css`, `context-menu.html`.

- A forrás komponens a célelemet maga burkolja (`.context-menu__target`), a saját `contextmenu`
  eseményén és a `Shift+F10`, illetve a `ContextMenu`/`Apps` billentyűn nyit, a panelt a célelem
  testvéreként rajzolja, `position: fixed` alakban, a nézetablak koordinátáiban.
- A nézetablakhoz szorítás (`clampAxis`): a közeli él legalább `VIEWPORT_MARGIN` (8 pixel, a
  forrás kommentje szerint "positioning-internal; not a token/prop"), a távoli él legfeljebb a
  nézetablak mérete mínusz a panel mérete mínusz a margó; ha a panel nagyobb a résnél, a közeli
  margóra tapad; az eredmény egész pixel. A méret az `offsetWidth`/`offsetHeight`, mert a belépő
  animáció `scale()` transzformációja a `getBoundingClientRect()` értékét nyitás közben
  kicsinyíti; a mérés `requestAnimationFrame`-ben fut.
- Bájtazonosság: a forrás `context-menu.css` blokkjának SHA-256 lenyomata a nyitó kommentjétől a
  fájl végéig (az `@import` sor és az utána álló üres sor nélkül)
  `c83003b7154925067478e77740dcdf0ea5149ee452833a9576bb9de422dfe9dc`, saját számítás
  2026-10-14-én. A blokk egyetlen U+2014 karaktert tartalmaz (a fókusz állapot
  kommentjében); a bájtazonosság miatt ez a forrás része marad, ugyanúgy, mint a
  `pagination.css` öt és a `drawer.css` tíz ilyen karaktere. Ezért a fájl a `tooling/scripts`
  `no-em-dash` tesztjének vendorolt listájára is felkerül, ami a `.prettierignore` vendorolt
  blokkjának másolata.

### 2. A hozzáférhetőségi szerződés forrásai

| Tény                                                                                                                                                                 | Forrás                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nyitáskor a fókusz az első menüpontra kerül                                                                                                                          | [W3C APG, Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/), "Keyboard Interaction"; [MDN, ARIA `menu` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menu_role), "Description" |
| `ArrowDown`/`ArrowUp` a következő és az előző menüpontra lép, a körbeérés elhagyható; a `Home`/`End` az első és az utolsó elemre ugrik                               | APG, "Keyboard Interaction" (a `Home`/`End` ott a körbeérés nélküli esethez kötött; a forrás mindkettőt adja, a port is)                                                                                                                          |
| Az `Escape` zár, és a fókuszt annak az elemnek vagy környezetnek adja vissza, ahonnan a menü nyílt; kontextus művelettel nyitott menünél az `Enter` is visszaadhatja | APG, "Keyboard Interaction" és a hozzá tartozó 3. megjegyzés; MDN, "Description"                                                                                                                                                                  |
| A `Tab` kiviszi a fókuszt a menüből, és bezárja                                                                                                                      | APG, "Keyboard Interaction"                                                                                                                                                                                                                       |
| A menüben minden menüpont `tabindex="-1"` (a roving `0` csak a menubarban kell), a panel `tabindex` értéke `-1` vagy `0`                                             | APG, "WAI-ARIA Roles, States, and Properties"; MDN, "Associated WAI-ARIA roles, states, and properties" (`tabindex` sor)                                                                                                                          |
| A `role="menu"` elemnek hozzáférhető neve kell: `aria-labelledby` a megnyitó elemre, vagy `aria-label`                                                               | APG, "WAI-ARIA Roles, States, and Properties"; MDN, `aria-label` vagy `aria-labelledby` sor                                                                                                                                                       |
| A karakteres típusba-ugrás elhagyható                                                                                                                                | APG, "Keyboard Interaction" ("(Optional)"). **Egy forrás**: az MDN a billentyűt leírja, de az elhagyhatóságról nem szól. A port a típusba-ugrást azért nem emeli át, mert a felvételi menü nem használja, nem e tény miatt                        |

### 3. A megvalósítás többi forrása

- **`useLayoutEffect` a mérésre.** A react.dev leírása szerint a hook "fires before the browser
  repaints the screen", és a "Measuring layout before the browser repaints the screen" példa
  pontosan egy lebegő elem méréséhez és újrapozicionálásához használja, a kifestés előtti második
  renderrel (<https://react.dev/reference/react/useLayoutEffect>). **Egy forrás**, a hivatalos
  dokumentáció.
- **Portál a `document.body`-ba.** A `position: fixed` elem tartalmazó blokkja a nézetablak, de
  egy `transform`, `filter`, `perspective`, `contain: paint` stb. értékű ős a tartalmazó blokkja
  lesz ([MDN, "Layout and the containing block"](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_display/Containing_block), 4. pont; [W3C CSS Transforms Module Level 1](https://www.w3.org/TR/css-transforms-1/), "any value
  other than none for the transform property also causes the element to establish a containing
  block for all descendants"; ugyanez a [CSSWG szerkesztői változatban](https://drafts.csswg.org/css-transforms-1/)).
  A React Flow nézet rétege inline `transform` stílust kap (a telepített `@xyflow/react`
  `dist/esm/index.mjs` a `.react-flow__viewport` elemnek `style: { transform: ... }` értéket ad),
  tehát egy azon belül rajzolt panel nem a nézetablakhoz igazodna.
  A portál a `menu` téma bevett mintája (`Menu.tsx`).

### 4. A megtervezett felület

`ContextMenu<TValue>` propjai: `position: ContextMenuPosition | undefined` (a nyitási pont
nézetablak koordinátában, `undefined` esetén zárva), `label: string` (`aria-label`),
`items: readonly ContextMenuItem<TValue>[]` (`{ value, label }`), `onSelect(value)` és
`onClose()`. A választás után az `onSelect`, utána az `onClose` fut; egy nyitási ciklusban az
`onClose` legfeljebb egyszer. A T-009-43 (a jobb klikk menü bekötése) a React Flow
`onPaneContextMenu` eseményén a `{ x: event.clientX, y: event.clientY }` pontot állapotba teszi, a
`onClose` hívásra törli, és a választott típust a pontból számolt `screenToFlowPosition` helyre
veszi fel (SPEC-008 5.8, M-97, M-98).

### 5. Unit teszt és lefedettség

- `packages/ui/src/context-menu`: 42 teszt három fájlban (`ContextMenu.spec.tsx` 33,
  `compute-context-menu-position.spec.ts` 8, `context-menu-byte-identity.spec.ts` 1), mind zöld.
- A teljes `bun run test` 546 tesztfájl, 4559 teszt, zöld, a lefedettség mind a négy metrikán 100
  százalék, a `ContextMenu.tsx` és a `compute-context-menu-position.ts` is.
- Szándékos rontással igazolva, hogy a tesztek nem vakok: a "nyitási ciklusonként egy zárás" őr
  eltávolítása hat tesztet buktat (a programozott fókusz visszaadás a happy-dom alatt is
  `focusout` eseményt vált ki, ami nélküle második zárási kérést adna); a visszaadási cél
  felülírása áthelyezéskor egy tesztet buktat.
- Mért buktató: a `no-em-dash` és a `component-boundary-invariant` teszt a `git ls-files`
  listáján dolgozik, tehát a commit előtti helyi futás a még nem követett új fájlokat nem látja. Az
  első push CI futása (run `38540342535`) ezért a `no-em-dash` teszten bukott a
  `context-menu.css` miatt, miközben a helyi futás zöld volt; a lista bővítése után a commitolt
  fájlokon mindkét teszt helyben is zöld.

### 6. Az e2e lefedettség előtte és utána

Előtte: a `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 47. szekciójának mért értéke. A
mérés óta az `apps/web/src` alatt csak egy spec fájl változott a `8413882` állapotig
(`git diff --stat 95f62db 8413882 -- apps/web/src`: kizárólag
`greppable-invariants/greppable-invariants.spec.ts`), termékkód nem. A `packages/ui` forrása nincs
az `apps/web` e2e lefedettségének hatókörében.

Utána: a jelen ág (`feat/spec-008-d1-context-menu`) teljes e2e futása a sandboxban, a 47.
szekció eljárásával: `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, a Playwright az
`apps/web` alatt közvetlenül, nyolc egymás utáni shardban (`--shard=k/8`, egy futás egy hívásban,
mert a sandbox a hívás végén a háttérfolyamatot leállítja), **477 teszt, mind zöld**, majd
`bun run coverage:e2e:report` (exit 0, a meglévő küszöbbel).

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1682 / 1697            | 1682 / 1697           | 15 -> 15                 |
| branches   | 784 / 795              | 784 / 795             | 11 -> 11                 |
| functions  | 562 / 565              | 562 / 565             | 3 -> 3                   |
| lines      | 1622 / 1637            | 1622 / 1637           | 15 -> 15                 |

A fedetlen helyek ugyanazon a hat fájlon és sorszámon állnak, mint a 47. szekcióban
(`mount-app.tsx` 16, 21-22; `read-frontend-config.ts`; `is-valid-connection.ts` 36;
`browser-history-location-port.ts` 21; `perform-route-request.ts` 89; `use-stream-connection.ts`
202). Az `apps/web/package.json` küszöbe nem változott.

### 7. A kívülre kattintás zárása a React Flow vásznon

Hiba (független review): a `ContextMenu` panelen kívüli `mousedown` figyelője a `window`
buborékoló fázisában futott, nem elfogó fázisban. A telepített forrás szerint a React Flow vásznon
a bal gombos lenyomás nem ér el odáig: a `d3-zoom` 3.0.0 a `mousedown.zoom` kezelőt a vászon
elemére köti (`src/zoom.js` 76. sor), a `mousedowned` (270. sor) pedig a 280. sorban
`nopropagation(event)`-et hív, ami `event.stopImmediatePropagation()` (`src/noevent.js` 2. sor). Az
`@xyflow/system` 0.0.82 `createFilter` szűrője a bal gombot átengedi neki (`dist/esm/index.js`
2947-2951. sor, `buttonAllowed`, mert a `panOnDrag` alapértéke `true`, `@xyflow/react` 12.11.6
`dist/esm/index.js` 3767. sor), és a `d3-zoom` az `XYPanZoom` `domNode` elemén, a `zoomPane`
ref elemén fut (`@xyflow/react` `dist/esm/index.js` 1323-1324. sor). A DOM szabálya szerint a
`stopImmediatePropagation` az eseményt más objektumokhoz sem engedi tovább
(<https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation>), az elfogó
(`capture`) figyelő viszont a célelem alatti elemek előtt kap eseményt
(<https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener>, a DOM
Standard eseményfa szabálya: <https://dom.spec.whatwg.org/#concept-event-dispatch>), és a
leiratkozáshoz ugyanaz a `capture` érték kell
(<https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener>).

Javítás: a `mousedown` figyelő `{ capture: true }` opcióval köt fel és ugyanazzal köt le. Két
új unit teszt őrzi (`ContextMenu.spec.tsx`, `zárás` csoport): egy célelem saját `mousedown`
figyelője `stopImmediatePropagation`-t hív (a `d3-zoom` mintájára), és az `onClose` ettől
függetlenül pontosan egyszer fut; valamint a felkötés és a leiratkozás hívásainak egyezése a
`globalThis` figyelő hívásain. A második teszt azért kell, mert a happy-dom 20.11.6
`removeEventListener` megvalósítása a `capture` értéket nem veti össze (`lib/event/EventTarget.js`
64-82. sor, mindkét listából töröl), tehát a hibás leiratkozást (valódi böngészőben szivárgás)
viselkedés alapú teszt nem látná.

Szándékos rontással igazolva: a felkötés és a leiratkozás is buborékoló alakra állítva két teszt
bukik (a `stopImmediatePropagation` teszt és a hívás egyezés teszt), 31 zöld marad; csak a
leiratkozás állítva vissza buborékolóra a hívás egyezés teszt egyedül bukik, a viselkedés alapú
teszt zöld marad (ezért kell a második). A rontás visszaállítva. `--project ui` futás: 69
tesztfájl, 671 teszt, zöld, a `packages/ui` lefedettsége mind a négy metrikán 100 százalék, a
`component-boundary-invariant` is zöld. Az 5. szekció teljes futásának összege (4559 teszt) a
javítás előtti állapotra szól.

Nem ellenőrzött: valódi böngészőben, valódi React Flow vásznon futó kattintás. A unit teszt a
`d3-zoom` viselkedését egy célelem figyelőjével utánozza; a vásznon tett kattintás e2e bizonyítéka
a menü fogyasztójához (T-009-43) tartozik.

## T-009-50

A design system `tooltip` komponensének átemelése a `packages/ui` csomagba, a `shortcut` propjával
(`packages/ui/src/tooltip/`).

### 8. A forrás

Saját olvasás: `eggproject-design-components/components/tooltip/Tooltip.jsx`, `tooltip.css`,
`tooltip.html`.

- A komponens propjai: `content` (szöveg vagy elem), `placement` (`top` alapérték, `bottom`,
  `left`, `right`), `variant` (`dark` alapérték, `light`, `rich`), `shortcut` (opcionális
  billentyű jelölés), `delay` (az egér alatti nyitás késleltetése, **alapérték 200 ms**; a fókusz
  mindig azonnal nyit). A trigger a `children`: a komponens `React.cloneElement` hívással írja rá az
  `aria-describedby` értéket.
- Az egér és a fókusz külön állapot (`hovered`, `focused`). A `mouseenter` időzítőt indít, a
  `mouseleave`, a `focus` és a `blur` lemondja a függő időzítőt. Az `Escape` a burkolón fut, zárja
  mindkét állapotot, és megállítja az esemény terjedését.
- A `tooltip.css` 328 sor. Az 1-118. sor a demó oldal saját szabálya: az `@import`, a globális
  reset (`*`, `html, body`, `button`, `code`, `h1, h2`, `#root`), a `.demo*`, `.btn*`,
  `.toolbar*`, `.icon-btn`, `.inline-anchor*` és a `.demo__keys` minta. A 119. sor a
  `/* ============ TOOLTIP <U+2014> the actual component ============ */` nyitó komment, a
  119-328. sor a komponens: `.tooltip-anchor`, `.tooltip*`, a három változat, a `.rich*` tartalom
  stílusok, a négy elhelyezés, a `forced-colors` és a `prefers-reduced-motion` blokk.
- A komponens blokk SHA-256 lenyomata a nyitó kommentjétől a fájl végéig
  `658e439e4e9f5e3110e5d245fdada5eb919f2ad3af7046d27ee047ee6957b2bb`, saját számítás
  2026-10-14-én, a forrás és az átemelt fájl azonos. A blokk négy sora tartalmaz U+2014
  karaktert (a nyitó komment és három magyarázó komment); a bájtazonosság miatt ezek a forrás
  részei maradnak, ezért a fájl a `.prettierignore` vendorolt blokkjára és a `tooling/scripts`
  `no-em-dash` tesztjének vendorolt listájára is felkerül.

**Értelmezési döntés, amit a koordinátornak jelzek.** A feladat szövege ("a CSS bájtra azonos a
forrással, a fejléc komment és az `@import` sor nélkül") a `pagination`, `drawer` és `context-menu`
mintájára készült, ahol a forrás CSS csak a komponens. A `tooltip.css` eleje a demó oldal, és a
szó szerinti átemelés a globális `*` resetet, a `html, body` és `#root` szabályt, valamint a
`.btn*` osztályokat is bevinné, amik az alkalmazás globális stílusát és a `button` téma `.btn`
osztályát írnák felül. A repóban erre már van precedens: a `data-table` és a `loading-indicator`
átemelés a demó oldal szabályait kihagyja ("egy komponens CSS nem írhatja felül az alkalmazás
globális stílusát"). A port ezt követi: a komponens blokk (119-328. sor) bájtra azonos, a demó
szabályok nem kerültek át. A blokk végén álló `.inline-anchor:focus-visible` szabály (a
`forced-colors` lekérdezésen belül, a demó mintáé) a bájtazonosság miatt bent maradt, az
alkalmazásban egyetlen elemre sem illeszkedik.

### 9. A hozzáférhetőségi szerződés forrásai

| Tény                                                                                                                                             | Forrás                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A tipp konténer `role="tooltip"`, a triggert `aria-describedby` köti hozzá                                                                       | [W3C APG, Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/), "WAI-ARIA Roles, States, and Properties"; [MDN, ARIA `tooltip` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tooltip_role) |
| Fókuszra és az egér fölé vitelére nyílik; a tipp nem kap fókuszt, a fókusz a triggeren marad                                                     | APG, "About This Pattern" és "Keyboard Interaction" 1. megjegyzés; MDN, "Description" és "Required JavaScript features"                                                                                                                           |
| Az `Escape` zárja                                                                                                                                | APG, "Keyboard Interaction"; MDN, "Keyboard interactions"                                                                                                                                                                                         |
| Fókusszal nyitott tipp a fókusz elvesztésekor (`onBlur`) záródik; egérrel nyitott tipp addig nyitva, amíg a kurzor a triggeren vagy a tippen van | APG, "Keyboard Interaction" 2. és 3. megjegyzés. A 3. megjegyzés második fele (a tipp fölött is nyitva marad) a forrás CSS-ével nem teljesül (10. szekció), a kiegészítő fájllal igen (15. szekció)                                               |
| A tipp elemre `aria-describedby` mutat, mielőtt vagy amikor megjelenik; a hívó meglévő leírása nem veszhet el                                    | MDN, "Description" ("Elements with the `tooltip` role should be referenced through the use of `aria-describedby` before or when the tooltip is displayed"); a meglévő hivatkozás megőrzése a forrás `Tooltip.jsx` viselkedése, saját olvasás      |

Az APG Tooltip minta oldala maga jelzi: "This design pattern is work in progress; it does not yet
have task force consensus". A tény sor tehát a W3C munkaanyagára és az MDN-re áll, két független
forrás.

### 10. A forrás korlátja: a panelre nem vihető át az egér

A forrás `.tooltip` szabálya `pointer-events: none` értéket ad (`tooltip.css` 130. sor), a
`.tooltip.is-open` ezt nem írja felül. Az MDN szerint ez az érték azt jelenti, hogy az elem
önmagában sosem célpontja a mutató eseményeknek, és az esemény "átmegy" rajta arra, ami alatta van
([MDN, `pointer-events`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/pointer-events));
ugyanezt mondja a W3C wiki CSS UI vázlata ("The element is never the target of pointer events",
<https://www.w3.org/wiki/User:Tantekelik/pointer-events>). A WCAG 2.2 1.4.13 "Hoverable" feltétele
szerint, ha a hover tartalmat hoz elő, "the pointer can be moved over the additional content
without the additional content disappearing"
(<https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html>); az APG 3.
megjegyzése is ezt kéri. A forrás tippje tehát a "Dismissible" (`Escape`) és a "Persistent"
feltételt adja, a "Hoverable" feltételt nem.

A `pointer-events: none` nem az egyetlen ok: a forrásban a tipp a trigger burkolójától
`calc(100% + 10px)` távolságra áll (a forrás `tooltip.css` 220., 236., 251. és 266. sora, a négy
elhelyezés), tehát a panelhez vezető úton az egér egy 10 px-es sávon halad át, ami sem a triggerhez,
sem a panelhez nem tartozik, és a burkoló `mouseleave` eseménye ott zár. A 15. szekció mérése szerint a rés
önmagában is zár (`pointer-events: auto` mellett is); a `pointer-events: none` önálló hatása külön
nem mért. A port eredetileg a CSS bájtazonossága miatt ezen nem változtatott;
a user 2026-10-14-i döntése nyomán a javítás külön fájlban áll, lásd a 15. szekciót.

### 11. A megvalósítás döntései

- **A trigger a `children` elem, a `cloneElement` megmaradt.** A `Menu` téma a forrás
  `cloneElement` API-ját render-függvényre cserélte, mert a fókusz visszaadáshoz a trigger DOM
  elemére kell hivatkozni. A `Tooltip` egyetlen propot ír a triggerre (`aria-describedby`), és nincs
  szüksége a DOM elemre, ezért a forrás API-ja maradt (`<Tooltip content="..."><Button/></Tooltip>`).
  A react.dev a `cloneElement` helyett alternatívát ajánl ("`cloneElement` makes it harder to trace
  the data flow", <https://react.dev/reference/react/cloneElement>); ez az egy sor eltérés a
  forrástól, ha a koordinátor render-függvényt kér, a fogyasztók (T-009-51, a D2 kapcsoló) még nem
  készültek el.
- **A `children` típusa `ReactElement<{ 'aria-describedby'?: string | undefined }>`**, így a
  `cloneElement` hívás `as` és `any` nélkül típushelyes. A forrás `isValidElement` ága (nem elem
  gyerek változatlan kirajzolása) típusilag nem érhető el, ezért nem került át (100 százalékos
  lefedettség, `.claude/CLAUDE.md` 5. szekció).
- **A hívó saját `aria-describedby` értéke** a `joinAriaTokenList` segéddel egyesül (szóköz mentén
  bontva, duplikátum nélkül, üres esetén `undefined`), ami a forrás `Set` alapú összefűzésével azonos
  eredményt ad; az osztálynevek a `joinClassNames` segéddel.
- **Forrás viselkedés, ami a portban is megvan** (saját unit teszt, happy-dom, hamis óra,
  `Tooltip.spec.tsx` "a fókusz érkezése és elvesztése lemondja a függő nyitást, miközben az egér a
  triggeren marad"): ha az egér belép, 100 ms múlva a trigger fókuszt kap, majd a fókusz elvész,
  miközben az egér még bent van, a tipp záródik. A `focus` és a `blur` lemondja a függő egeres nyitást, így a `hovered`
  állapot sosem lesz igaz. A "az egyik nem zárja be azt, amit a másik tart" szabály ezért csak a
  már nyitva tartó állapotra igaz. Nem módosítottuk, a forrás szerint maradt.

### 12. Unit teszt és lefedettség

- `packages/ui/src/tooltip`: 34 teszt két fájlban az eredeti átemelés commitjánál (`Tooltip.spec.tsx`
  33, `tooltip-byte-identity.spec.ts` 1), a 2026-10-14-i kiegészítés (15. szekció) után 52 teszt három
  fájlban (`Tooltip.spec.tsx` 35, `tooltip-byte-identity.spec.ts` 1, `tooltip-hover-bridge.spec.ts`
  16), mind zöld. Az egér alatti időzítő tesztjei a Vitest hamis óráját használják
  (`vi.useFakeTimers()`, `vi.advanceTimersByTime`).
- A teljes `bun run test` az eredeti átemelés commitjánál: 551 tesztfájl, 4847 teszt, zöld, a
  lefedettség mind a négy metrikán 100 százalék, a `Tooltip.tsx` is.
- A kilenc kapu az eredeti átemelés commitolt fáján zöld: `format:check`, `typecheck`, `lint`, `test`, `build`,
  `docs:check`, `check:casing`, `check:graph`, `check:db-drift`.
- Szándékos rontással igazolva, hogy a tesztek nem vakok (mindegyik rontás után a teszt fájl
  elbukott, a rontás visszaállítva): az `event.stopPropagation()` törlése 1 tesztet buktat; a
  `delay` alapérték 300 ms-ra 4-et; az egér elhagyásának időzítő lemondása nélkül 1-et; a
  lecsatolási takarítás nélkül 1-et; a fókuszra nyitás késleltetve 6-ot; az `aria-describedby`
  mindig kitéve 8-at; a hívó saját hivatkozásának elhagyása 1-et; a `role="tooltip"` törlése 28-at;
  a `hidden` törlése 8-at.
- Mért buktató: a `no-em-dash` és a `component-boundary-invariant` teszt a `git ls-files`
  listáján dolgozik, tehát a commit előtti helyi futás a még nem követett új fájlokat nem látja (a
  T-009-41 szekciója ugyanezt tárta fel); a kapukat ezért a commit után futtattam.
- Mért buktató: a teljes `bun run lint` a 4 magos, 3,9 GB memóriájú sandboxban a Turborepo
  párhuzamos ESLint folyamataival `SIGKILL` (137) kilépést kapott (memória). A
  `bun x turbo run lint --concurrency=1` futás 43/43 zöld. Termékkód hiba nem volt, a lint kimenet
  a `tooltip` mappára külön futtatva is tiszta.

### 13. Az e2e lefedettség előtte és utána

Előtte: a `docs/research/2026-10-14-kotelezo-mezok-es-start.md` 3. szekciójának mérése (a `main`
`4ce7de0` állapota, T-009-48 és T-009-49 után). A `packages/ui` forrása nincs az `apps/web` e2e
lefedettségének hatókörében, és a `Tooltip` az `apps/web` kódjából még sehol nincs importálva,
tehát a build kimenetébe sem kerül.

Utána: a jelen ág (`feat/spec-008-d1-tooltip`) teljes e2e futása a sandboxban, a 29. és 47.
szekció eljárásával: `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, a Playwright az
`apps/web` alatt közvetlenül, nyolc egymás utáni shardban (`--shard=k/8`, `flock` alatt, legfeljebb
3 worker), **477 teszt, mind zöld** (60 + 60 + 60 + 60 + 60 + 59 + 59 + 59), majd
`bun run coverage:e2e:report` (exit 0, a meglévő küszöbbel).

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1686 / 1701            | 1686 / 1701           | 15 -> 15                 |
| branches   | 784 / 795              | 784 / 795             | 11 -> 11                 |
| functions  | 562 / 565              | 562 / 565             | 3 -> 3                   |
| lines      | 1626 / 1641            | 1626 / 1641           | 15 -> 15                 |

A fedetlen helyek ugyanazon a hat fájlon és sorszámon állnak, mint a 47. szekcióban
(`mount-app.tsx` 16, 21-22; `read-frontend-config.ts`; `is-valid-connection.ts` 36;
`browser-history-location-port.ts` 21; `perform-route-request.ts` 89; `use-stream-connection.ts`
202). Az `apps/web/package.json` küszöbe nem változott.

### 14. Nem ellenőrzött

- A tipp valódi böngészőben, valódi hover és fókusz eseményekkel, **a repóban**: nincs e2e, mert nincs
  fogyasztó (a T-009-51 a két ikon gombbal hozza, az e2e a T-009-53). A hamis órás unit teszt a React
  eseménykezelőt hívja (`mouseover`, `focusin`, `keydown` az elemen), nem valódi bemenetet. A hover
  átvitelre és a letiltott gombra egy eldobott, nem verziókövetett Chromium próba készült (15.
  szekció), ami tájékoztató, nem tartós igazolás.
- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- Képernyőolvasó felolvasása: az `aria-describedby` jelenlétét a teszt ellenőrzi, a felolvasást nem.
- A nyitott tipp mostantól egér célpont (15. szekció), tehát egy mellette álló elemet takarhat, és
  egy e2e kattintást elfoghat. Hogy a T-009-51 két gombja mellett ez előfordul-e, nem ellenőrzött; a
  T-009-53 mérje.

### 15. Egérrel elérhető tipp: kiegészítő CSS (user döntés, 2026-10-14)

**A döntés.** A 10. szekció korlátjáról a PR #27 review-ja után a user ezt választotta: "Külön CSS
javítás: a bájtra azonos forrás CSS mellé egy kis kiegészítő fájl. A nyitott tippre rá lehet vinni
az egeret, a gomb és a tipp közti 10 px rést egy láthatatlan híd fedi. JS nem változik, de ez
eltérés a design systemtől."

**A megvalósítás.** `packages/ui/src/tooltip/tooltip-hover-bridge.css`, a komponens a `tooltip.css`
után importálja. Szabályai: `.tooltip.is-open` `pointer-events: auto`; egy közös `.tooltip.is-open::after`
(üres tartalom, abszolút pozíció); négy elhelyezésenként egy 10 px-es híd a tipp trigger felé néző
oldalán (`top`: `top: 100%; height: 10px`, `bottom`: `bottom: 100%`, `left`: `left: 100%; width: 10px`,
`right`: `right: 100%`), a másik tengelyen a teljes oldalt fedve. A 10 px a forrás `tooltip.css`
`calc(100% + 10px)` távolsága (220., 236., 251., 266. sor). A híd a `.tooltip` leszármazottja, tehát
az egér átvitele a triggerről a tippre nem hagyja el a `Tooltip` burkolóját, a JS záró logikája nem
változott (a `Tooltip.spec.tsx` "az egér átvitele a triggerről a tippre nem zár" tesztje őrzi).

**Védelem.** A `tooltip-hover-bridge.spec.ts` a kiegészítő fájl létezését és a komponens importját, a
fejléc három kötelező elemét (user döntés dátuma, WCAG forrás, design systemtől való eltérés), a
`pointer-events: auto` szabályt, a négy elhelyezés szabályát és azt őrzi, hogy a híd mérete a
`tooltip.css` aktuális távolsága; a bájtazonos blokkot a `tooltip-byte-identity.spec.ts`, és hogy a
`tooltip.css` nem hordozza a javítást, ugyanez a spec. Szándékos rontással igazolva (mindegyik
rontás után a megfelelő teszt elbukott, a rontás visszaállítva): a felső híd 12 px-re; a
`pointer-events: auto` `none`-ra; a komponens importjának törlése; az `onMouseLeave` cseréje
`onMouseOut`-ra (az átviteli teszt bukott); a fókusz és a `blur` időzítő lemondásának törlése (a 11. szekció szerinti viselkedés tesztje bukott).

**Böngészős tájékoztató mérés** (eldobott, nem verziókövetett próba, Chromium 151.0.7922.34
Playwrighttal, fejnélküli mód; a valódi `Tooltip.tsx` és a két CSS fájl `bun build` csomagban,
`delay` 50 ms; négy elhelyezés, az egér a trigger közepéről a megnyílt panel közepére 40 lépésben,
lépésenként egy képkocka várakozással). A review hasonló, szintén eldobott mérését ez a próba a saját
CSS-re megismétli:

| Változat                        | top                | bottom             | left              | right             |
| ------------------------------- | ------------------ | ------------------ | ----------------- | ----------------- |
| Forrás CSS (a javítás nélkül)   | zár a 13. lépésnél | zár a 12. lépésnél | zár a 8. lépésnél | zár a 9. lépésnél |
| Csak `pointer-events: auto`     | zár a 13. lépésnél | zár a 12. lépésnél | zár a 8. lépésnél | zár a 9. lépésnél |
| `auto` plusz híd (a jelen fájl) | nyitva             | nyitva             | nyitva            | nyitva            |

A harmadik sorban mind a 40 lépés alatt nyitva maradt, a végén a panel közepén az `elementFromPoint`
a panel eleme volt, és az egér teljes kivitele a burkolóból (a bal felső sarokba) zárt. A második
sor mutatja, hogy a `pointer-events: auto` a 10 px rés nélkül nem elég. **A letiltott gomb** (ugyanez a
próba, `disabled` `button` a `Tooltip`-ban): egér alatt a tipp nyílik (a burkoló `span` megkapja az
egéreseményt), a `focus()` hívás után az `activeElement` a `body` marad, tehát a letiltott gomb
nem fókuszálható. Ez a review mérésével egyezik. A tartós, verziókövetett igazolás a PLAN-009
T-009-53 e2e-jének elfogadási kritériuma ("a gombok tippje egérrel elérhető, a tippre vitt egér alatt
nyitva marad").

**Webes források** (a "Hoverable" feltételre és a rés áthidalására):

- W3C, Understanding SC 1.4.13, "Hoverable" és 2. példa:
  <https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html>. A szöveg: "If
  pointer hover can trigger the additional content, then the pointer can be moved over the
  additional content without the additional content disappearing".
- W3C, SCR39 technika (a mutató a megjelenő tartalom fölé vihető) és az F95 hiba (a hoverrel
  megjelenő tartalom nem vihető fölé): <https://w3c.github.io/wcag/techniques/client-side-script/SCR39>.
- W3C APG, Tooltip Pattern, 3. megjegyzés: <https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/>.
- NYU Accessibility Testing Standards, 1.4.13 ("The content remains visible when the pointer is
  hovered over the rendered content"): <https://digitalaccessibility.nyu.edu/testing/sc1413.html>.
- Curbcut, 1.4.13 útmutató (ha vizuális rés van a trigger és a felugró tartalom között, azt
  láthatatlan kitöltéssel kell áthidalni):
  <https://www.curbcutaccessibility.com/wcag/1-4-13-content-on-hover-or-focus/>.

## T-009-42

Az azonosító port és a böngészős megvalósítása, a kilenc típus kezdő konfigurációja, az új csomópont
függvénye, a nézet középpontjának függvénye és a csomópont törlése az éleivel (SPEC-008 5.8, 5.9);
a Start `deletable: false` jelölése. A kezelőfelület bekötése (menü gomb, helyi menü, Törlés gomb) nem
ennek a lépésnek a része (T-009-43, T-009-44).

### 16. Az azonosító forrása: `crypto.randomUUID()`

- MDN, `Crypto: randomUUID()`: "generate a v4 UUID using a cryptographically secure random number
  generator", visszatérési érték "a randomly generated, 36 character long v4 UUID"; a szolgáltatás
  csak biztonságos környezetben (HTTPS) áll rendelkezésre, "Baseline Widely available", 2022 márciusa
  óta minden böngészőben:
  <https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID>.
- W3C, Web Cryptography Level 2 (First Public Working Draft, 2025-04-22), a `Crypto-method-randomUUID`
  szakasz, amire az MDN specifikációként hivatkozik: <https://www.w3.org/TR/webcrypto-2/>.
- Can I use, `Crypto API: randomUUID()`: Chrome 92-től, Firefox 95-től, Safari 15.4-től támogatott:
  <https://caniuse.com/mdn-api_crypto_randomuuid>. Független megerősítés: a WICG/uuid 49. issue
  ("Firefox (version 95) and Safari (version 15.4) have now shipped `crypto.randomUUID()`"):
  <https://github.com/WICG/uuid/issues/49>.

A biztonságos környezet feltétele: a termék `localhost`-ról vagy HTTPS-ről szolgálódik ki. A
Playwright `webServer` a `vite preview` szervert a `http://localhost:4174` origin alatt indítja
(`apps/web/playwright.config.ts`), és a nyc fájlonkénti kimenete szerint a
`browser-graph-element-id-generator.ts` egyetlen függvénye a meglévő e2e futásban lefutott (21.
szekció), tehát a `crypto.randomUUID` ezen az origin alatt a valódi Chromiumban elérhető. **Nem
ellenőrzött**, hogy ugyanez igaz-e a `http://127.0.0.1` alakra és a nem Chromium böngészőkre; a
termék dokumentált origin-je `localhost`.

### 17. Az él azonosítója: `addEdge` és a `getEdgeId` beállítás

- React Flow dokumentáció, `addEdge()`: a `options.getEdgeId` "Custom function to generate edge IDs",
  és "If an edge with the same `target` and `source` already exists (and the same `targetHandle` and
  `sourceHandle` if those are set), then this util won't add a new edge even if the `id` property is
  different": <https://reactflow.dev/api-reference/utils/add-edge>.
- A telepített `@xyflow/system@0.0.82` forrása
  (`node_modules/.bun/@xyflow+system@0.0.82/node_modules/@xyflow/system/dist/esm/index.js`, 1117-1135.
  sor): az `edgeIdGenerator = options.getEdgeId || getEdgeId` hívása a duplikátum ellenőrzés
  (`connectionExists`) ELŐTT történik, tehát egy már létező kapcsolatra is lefut a generátor, és az
  eredménye eldobódik. A saját `getEdgeId` ezért a duplikátum esetében is hív egy azonosítót, ami
  mellékhatás nélküli (egy UUID), így a duplikátum teszt (`GraphEditorCanvas.spec.tsx`) azt állítja,
  hogy a meglévő él azonosítója és darabszáma változatlan marad.
- Az alapértelmezett azonosító alakja ugyanott (1097. sor): `xy-edge__<source><sourceHandle>-<target><targetHandle>`.
  A saját generátor oka a globális egyediség: a `workflow_node.id` és a `workflow_edge.id` globális
  elsődleges kulcs, és egy másik workflow gráfjában már létező azonosító `409 graph_id_conflict`
  hibát ad (SPEC-008 5.8, `.claude/CLAUDE.md` 12. szekció, "A TEXT elsődleges kulcs sértése"; mérés:
  `docs/research/2026-09-27-szerver-hibatorzs.md`).

### 18. A nézet középpontja: a tároló mezői és az átváltás

A középpont számítás tiszta függvény, bemenete a `{ width, height, transform: [x, y, zoom] }` alak,
a React Flow tárolójának mezői (`ReactFlowStore`, SPEC-008 M-99). A forrás: a telepített `@xyflow/system@0.0.82`
`pointToRendererPoint` (611-614. sor): `x: (x - tx) / tScale`, `y: (y - ty) / tScale`. A függvény
ennek a kártya fél méretével (a `graph-node-catalog` egyetlen méret konstansa, SPEC-008 5.7)
eltolt alakja, így a kártya KÖZEPE kerül a nézet közepére, nem a bal felső sarka. A függvény nem
olvas `measured.`-et és nem hív `getBoundingClientRect()`-et (15. invariáns), a bemenete szintetikus,
a unit teszt öt esetet fed (alap nézet, eltolt nézet, nagyított, kicsinyített, a kettő együtt).

**Nem ellenőrzött:** hogy a valódi Chromiumban a tároló `width`, `height` és `transform` mezői
mikor kapnak értéket (a vászon első mérése előtt `0` lehet), és hogy a `useStore` selector milyen
renderelési sorrendben adja őket. Az M-99 mezőlista valós Chromium igazolása a PLAN-009 T-009-45 e2e lépése (SPEC-008 77. kritérium); a jelen lépés függvénye a bemenetet nem értelmezi, csak számol.

### 19. Fordítási bizonyíték: a `start` nem vehető fel, a kimerítő switch hiányt jelez

Az `AddableNodeType = Exclude<NodeType, 'start'>` típus miatt a Start felvétele fordítási hiba. Az
elfogadási kritérium (2) szerint ideiglenes próbafájllal igazolva (a fájl nem került commitba):

```ts
// apps/web/src/graph-editor/probe-tmp.ts (törölve)
import { createGraphNode } from './create-graph-node';
import { createInitialNodeConfig } from './create-initial-node-config';

export const probeConfig = createInitialNodeConfig('start');
export const probeNode = createGraphNode('start', { x: 0, y: 0 }, () => 'x');
```

Parancs: `cd apps/web && bun x tsc --noEmit`. Kimenet:

```text
src/graph-editor/probe-tmp.ts(4,52): error TS2345: Argument of type '"start"' is not assignable to parameter of type 'AddableNodeType'.
src/graph-editor/probe-tmp.ts(5,42): error TS2345: Argument of type '"start"' is not assignable to parameter of type 'AddableNodeType'.
```

A kimerítő switch másik fele: a `create-initial-node-config.ts` `script` ágának ideiglenes
kivétele ugyanazzal a paranccsal:

```text
src/graph-editor/create-initial-node-config.ts(17,65): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

Mindkét próba után a fájlok az eredeti állapotra álltak vissza (`git status` tiszta).

### 20. Unit teszt és lefedettség

Új vagy bővített tesztek (a lépés fájljaiban, `vitest run`): `create-initial-node-config.spec.ts` 38,
`create-graph-node.spec.ts` 3, `compute-viewport-center-node-position.spec.ts` 5,
`delete-node-with-edges.spec.ts` 4, `browser-graph-element-id-generator.spec.ts` 1,
`default-agent-step-settings.spec.ts` 2, `graph-editor-node-mapping.spec.ts` 4 (típusonként a
`deletable` érték, a Start `false`), `GraphEditorCanvas.spec.tsx` 22 (köztük a port azonosítója az
éleken és a duplikátum), `GraphEditorScreen.spec.tsx` 25, `app-shell.spec.tsx` 14,
`greppable-invariants.spec.ts` 23 (az új, 23. invariáns: a `crypto.randomUUID(` hívás kizárólag a
`browser-stream-id-generator.ts` és a `browser-graph-element-id-generator.ts` fájlban áll). A kezdő konfiguráció tesztje mind a kilenc típusra négy állítást tesz (9 x 4 = 36, plusz a típuslista és a hívásonkénti új objektum): az eredmény a SPEC-008 5.8 táblázat szerinti, a `config.type` a kért típus, az olvasó séma (`NodeConfigSchema`) elfogadja (kivéve a `NaN` számot hordozó két típust), a mentési séma (`NodeConfigSaveSchema`) pedig elutasítja a típushoz tartozó mezőútvonalon.

A teljes `bun run test` (gyökér Vitest, v8 lefedettség): 569 fájl, 5168 teszt, mind zöld, a
lefedettség mind a négy metrikán 100 százalék.

### 21. Az e2e lefedettség előtte és utána

Előtte: a `main` `6539b09` állapotán, a jelen ággal azonos eljárással saját mérés (8 shard,
`flock` alatt, legfeljebb 3 worker, mind zöld).

Utána: a jelen ág (`feat/spec-008-d1-azonosito-port`, `aa361f7`) teljes e2e futása a sandboxban, a 29. és 47. szekció eljárásával: `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, a
Playwright az `apps/web` alatt közvetlenül, nyolc egymás utáni shardban (`--shard=k/8`, `flock`
alatt), **481 teszt, mind zöld** (61 + 60 + 60 + 60 + 60 + 60 + 60 + 60), majd
`bun run coverage:e2e:report` (exit 0, a meglévő küszöbbel).

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1778 / 1793            | 1780 / 1795           | 15 -> 15                 |
| branches   | 833 / 844              | 833 / 844             | 11 -> 11                 |
| functions  | 585 / 588              | 586 / 589             | 3 -> 3                   |
| lines      | 1717 / 1732            | 1718 / 1733           | 15 -> 15                 |

A fedetlen darabszám egyik metrikán sem nőtt; az összes darabszám növekedése (2 utasítás, 1 függvény,
1 sor) a `browser-graph-element-id-generator.ts` fájl, ami az `app-shell` importján át bekerül az
instrumentált csomagba, és mind fedett: a nyc fájlonkénti kimenete szerint
`browser-graph-element-id-generator.ts` 2/2 utasítás, 1/1 függvény, 1/1 sor; az `app-shell.tsx`,
a `GraphEditorCanvas.tsx`, a `graph-editor-node-mapping.ts`, a `JoinNodeFields.tsx` és a
`default-agent-step-settings.ts` minden eleme fedett. A tiszta függvények (`createGraphNode`,
`createInitialNodeConfig`, `computeViewportCenterNodePosition`, `deleteNodeWithEdges`) nincsenek
importálva a termékkódból (a bekötés a T-009-43 és T-009-44), tehát az instrumentált csomagba nem
kerülnek, a számokat nem érintik. Az `apps/web/package.json` küszöbe nem változott. A fedetlen
helyek ugyanazok, mint a 47. szekcióban (`mount-app.tsx` 16, 21-22; `read-frontend-config.ts`;
`is-valid-connection.ts` 36; `browser-history-location-port.ts` 21; `perform-route-request.ts` 89;
`use-stream-connection.ts` 202).

### 22. A kapuk és a sandbox memóriája

A 3,9 GB memóriájú közös gépen a gyökér `bun run typecheck` és a `bun run lint` párhuzamos turbo
futása a memóriakorlát miatt `SIGKILL`-lel (137) állt le; a kapuk ezért `bun x turbo run typecheck
--concurrency=1` és `bun x turbo run lint --only --concurrency=1` alakban futottak (a `lint` a
`typecheck` függőségét a `--only` kapcsolóval kihagyva, mert azt az előző lépés már lefuttatta). A
`format:check`, `docs:check`, `check:casing`, `check:graph`, `check:db-drift`, `test` és `build`
kapu a gyökér paranccsal, ugyanazon a commitolt fán futott; a `git ls-files` alapú tesztek
(em dash, komponens határ, kis-nagybetű) csak a commitolt fájlokat látják, ezért a kapuk a commit
UTÁN futnak.

### 23. Nem ellenőrzött

- A `crypto.randomUUID()` hívás Firefoxban és WebKitben: az `apps/web/playwright.config.ts` csak
  chromiumot definiál; a támogatásra a 16. szekció forrásai szólnak, saját mérés nincs.
- A nézet középpont függvényének és a tároló mezőinek viselkedése valódi böngészőben (18. szekció): a PLAN-009 T-009-45 e2e lépése fedi (M-99, 77. kritérium).
- A `deletable: false` hatása a Delete billentyűre és a kijelölt Start törlésére valódi
  Chromiumban: a React Flow `getElementsToRemove` forrása szerint (`dist/esm/index.js`, 474-484.
  sor) a `deletable === false` csomópont kimarad a törlésből; ezt a forrás olvasása igazolja, a tényleges billentyű nyomást a T-009-45 e2e-je fedi (82. kritérium).

## T-009-43

A felvétel bekötése (SPEC-008 5.8): a "Hozzáadás" menü gomb a lábléc akciósávjában, a "Mentés" split
button előtt, és a vászon jobb klikk menüje; mindkét út a `GraphEditorScreen` egyetlen kezelőjén át
veszi fel a csomópontot (`createGraphNode`), és kiválasztja, tehát a beállítás panel megnyílik.

### 24. A forrás: `onPaneContextMenu`, `screenToFlowPosition`, `ReactFlowProvider`, `useStore`

Saját olvasás a telepített `@xyflow/react@12.11.6` csomagon
(`node_modules/.bun/@xyflow+react@12.11.6+c647125726432005/node_modules/@xyflow/react/dist/esm/`).

- **`onPaneContextMenu` csak az üres vásznon.** A `Pane` komponens a `.react-flow__pane` elem
  `onContextMenu` eseményét `wrapHandler(onContextMenu, container)` alakban köti
  (`index.js` 1647. sor), a `wrapHandler` pedig csak akkor hívja a kezelőt, ha
  `event.target === containerRef.current` (1420-1427. sor); a `onContextMenu` a `panOnDrag` tömb 2-es
  gombjánál `preventDefault()` után kilép, különben `onPaneContextMenu?.(event)` (1462-1468. sor).
  A csomópont és az él tehát nem a vászon eleme, a jobb klikkjük nem jut a kezelőhöz. A prop típusa
  `(event: ReactMouseEvent | MouseEvent) => void`, a leírása "gets called when user right clicks
  inside the pane" (`types/component-props.d.ts` 195-196. sor); a hivatalos doksi ugyanezt mondja
  (SPEC-008 M-97).
- **`screenToFlowPosition`.** A `useReactFlow()` példányán (`index.js` 559-571. sor): a kliens pontból
  a `domNode.getBoundingClientRect()` bal felső sarkát vonja le, és a `pointToRendererPoint` a
  `transform` szerint vált (SPEC-008 M-98). Hivatalos doksi: "With this function you can translate a
  screen pixel position to a flow position"
  (<https://reactflow.dev/api-reference/types/react-flow-instance>); a forrás típus kommentje a
  `{ x: event.clientX, y: event.clientY }` példát adja
  (<https://github.com/xyflow/xyflow/blob/main/packages/react/src/types/general.ts>); a 11.10.0
  kiadás óta a konténer dobozát a hívónak nem kell levonnia
  (<https://reactflow.dev/whats-new/2023-11-10>).
- **`ReactFlowProvider` a `<ReactFlow>` komponensen kívüli olvasáshoz.** Hivatalos doksi: "a context
  provider that makes it possible to access a flow's internal state outside of the `<ReactFlow />`
  component" (<https://reactflow.dev/api-reference/react-flow-provider>). A telepített `Wrapper`
  (`index.js` 3748-3757. sor) a `StoreContext` meglétét nézi, és ha van, nem hoz létre saját
  providert, tehát a vászon a külső store-t használja. A `fitView` prop ebben az esetben is hat: a
  `StoreUpdater` a `fitView` mező változására a `fitViewQueued` értéket állítja (317-318. sor). A
  meglévő `fitView` e2e tesztek (`graph-editor.spec.ts`, `graph-auto-layout.spec.ts`,
  `showcase-graph.spec.ts`) a változás után zöldek (27. szekció).
- **`useStore`.** Hivatalos doksi: "This hook can be used to subscribe to internal state changes"
  (<https://reactflow.dev/api-reference/hooks/use-store>); a szignatúra
  `useStore(selector: (state: ReactFlowState) => StateSlice, equalityFn?)`
  (`hooks/useStore.d.ts` 25. sor), a `width`, `height`, `transform` mező a `types/store.d.ts`
  5-7. sorában. A `useReactFlow()` csak a `ReactFlow` vagy a `ReactFlowProvider` gyerekében hívható
  (<https://reactflow.dev/api-reference/hooks/use-react-flow>, "Notes").

### 25. A megvalósítás döntései

- **A provider helye.** A lábléc a `<ReactFlow>` komponensen kívül áll, ezért a `GraphEditorScreen`
  exportja a tartalmát `ReactFlowProvider` alá teszi (a JSX fa újratördelése nélkül, egy külön
  burkoló függvénnyel). A `GraphEditorCanvas` provider nélkül is működik: a jobb klikk menü a
  `<ReactFlow>` gyerekeként kapja a `screenToFlowPosition` átváltót, a `FitViewOnAutoLayout`
  mintájára, tehát a vászon unit tesztjei változatlan alakban renderelnek.
- **A gomb.** A "Hozzáadás" `Button` `size="sm"`, `variant="secondary"`, a látható felirat és a split
  button nyíl ikonja (`aria-hidden`), a `Menu`/`MenuItem` pár triggerje; a `--ep-screen-sm` tokenen és
  alatta csak ikon (28. szekció). A `secondary` az 5.8
  "az elsődleges művelet így a sor végén marad" mondatából következik: az elsődleges gomb a
  "Mentés". A store mezőit egy külön, a képernyőn belüli komponens olvassa három `useStore`
  szelektorral, hogy a nézet minden mozdulata csak ezt a gombot renderelje újra.
- **A jobb klikk menü.** Az `AddNodeContextMenu` a `ContextMenu` portját kapja "Hozzáadás"
  `label`-lel (user döntés 2026-10-14), a kattintás kliens pontjával és a befecskendezett
  átváltóval; a vászon a pontot állapotban tartja, és a menüt csak nyitott állapotban rendereli.
  Az átváltás a menüpont választásakor fut, a tárolt kattintási ponton. **Kimondott
  következmény:** ha a nyitott menü alatt a nézet a görgővel változik, a kártya bal felső sarka a
  kattintás képernyő pontja alá kerül (a menü bal felső sarkához), nem a kattintáskori flow pontra.
- **A rejtett menü panel a DOM-ban.** A `packages/ui` `Menu` a zárt panelt `hidden` attribútummal a
  `document.body`-ban tartja, tehát a lábléc menüjének kilenc típuscímkéje zárt állapotban is a
  DOM-ban áll. Ez két meglévő tesztet érintett, mindkettő szűkítve: a `GraphEditorScreen.spec.tsx`
  split button tesztje a nyitott panelt keresi (`:not([hidden])`), a `graph-node-card.spec.ts`
  típuscímke állítása a vászonra szűkül (`rf__wrapper`), mert a `getByText` a rejtett elemet is
  illeszti, és strict mode hibát adott.

### 26. Unit teszt és lefedettség

Új vagy bővített tesztek: `addable-node-menu-items.spec.ts` 2 (kilenc menüpont a katalógus kulcs
sorrendjében, a `start` nélkül; a magyar címkék), `AddNodeContextMenu.spec.tsx` 2 (a "Hozzáadás"
név és a kilenc menüpont; a választott típus helye pontosan a befecskendezett, nem azonos átváltó
eredménye a kattintás kliens pontján, 76. kritérium unit része), `GraphEditorCanvas.spec.tsx` +3 (a
vászon üres területén a `contextmenu` esemény `defaultPrevented`, és a kilenc menüpontos menü
nyílik; csomóponton nem nyílik és nem tilt; a választás a típust és a helyet adja tovább, a menü
bezárul, a vászon maga nem vesz fel), `GraphEditorScreen.spec.tsx` +3 (a gomb `sm`, a `.menu-anchor`
burkolója közvetlenül a split button előtt áll, kilenc menüpont; a gomb útja a store beállított
`width`, `height`, `transform` értékéből számolt középpontra vesz fel, kiválaszt, panelt nyit,
mentetlen jelzőt ad, kérés nélkül; a jobb klikk út ugyanezt adja).

A teljes `bun run test` (gyökér Vitest, v8 lefedettség): 572 fájl, 5190 teszt, mind zöld, a
lefedettség mind a négy metrikán 100 százalék.

Szándékos rontással igazolva, hogy a tesztek nem vakok (mindegyik visszaállítva):

| Rontás                                                               | Bukó teszt |
| -------------------------------------------------------------------- | ---------- |
| (a) az `AddNodeContextMenu` a kattintás pontját átváltás nélkül adja | 1          |
| (b) a `preventDefault()` hívás elhagyása a jobb klikk kezelőből      | 1          |
| (c) a gomb a store helyett nulla geometriával számol                 | 1          |
| (d) a felvett csomópont kiválasztásának elhagyása                    | 2          |

### 27. Az e2e lefedettség előtte és utána

Előtte: a `main` `b133b0e` állapotán saját mérés, a 6. szekció eljárásával
(`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, nyolc egymás utáni shard `flock` alatt,
legfeljebb 3 workerrel), **493 teszt, mind zöld**, majd `bun run coverage:e2e:report` (exit 0).

Utána: a jelen ág ugyanazzal az eljárással, **495 teszt, mind zöld** (62 + 62 + 62 + 62 + 62 + 62 +
62 + 61), `bun run coverage:e2e:report` exit 0, a meglévő küszöbbel. Az új e2e
(`apps/web/e2e/graph-node-add.spec.ts`, két teszt) a gomb útján mind a kilenc típust felveszi
(minden felvétel után a típus beállítás panelje látszik), a jobb klikk útján egy felvételt tesz,
és mindkettő a mentetlen jelzőt és a betöltés utáni nulla API kérést állítja.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1788 / 1803            | 1835 / 1850           | 15 -> 15                 |
| branches   | 835 / 846              | 846 / 857             | 11 -> 11                 |
| functions  | 592 / 595              | 611 / 614             | 3 -> 3                   |
| lines      | 1722 / 1737            | 1765 / 1780           | 15 -> 15                 |

A fedetlen helyek ugyanazon a hat fájlon és sorszámon állnak, mint a 21. szekcióban. Mérési
tanulság: az első utána futásban a két e2e teszt csak két típust vett fel, és a
`create-initial-node-config.ts` (ami a bekötéssel került az instrumentált csomagba) 7 utasítással,
7 ággal és 7 sorral növelte a fedetlen darabszámot; a gomb útjának kilenc típusos felvétele ezt
nullára vitte. Az `apps/web/package.json` küszöbe nem változott.

A szűk nézeti ikon gomb és a két új e2e (28. szekció) után ugyanezzel az eljárással, a `b133b0e`-ra
épülő ágon (a `main` összevonása előtt): **497 teszt, mind zöld** (63 + 62 + 62 + 62 + 62 + 62 + 62 +
62), `bun run coverage:e2e:report` exit 0, a meglévő küszöbbel.

| Metrika    | Fedett / összes | Fedetlen |
| ---------- | --------------- | -------- |
| statements | 1843 / 1858     | 15       |
| branches   | 847 / 858       | 11       |
| functions  | 616 / 619       | 3        |
| lines      | 1773 / 1788     | 15       |

A fedetlen darabszám a fenti táblával azonos (15 / 11 / 3 / 15), ugyanazon a hat fájlon
(`mount-app.tsx` 3/2/0/3, `read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1,
`browser-history-location-port.ts` 1/0/1/1, `perform-route-request.ts` 1/1/0/1,
`use-stream-connection.ts` 1/0/1/1); a fedett és az összes darabszám +8 / +1 / +5 / +8 nőtt, ez az
új `PlusIcon`, a `useIsAddNodeCompact` hook (T-009-51 óta `useIsFooterCompact`, 51.8) és a
`AddNodeMenuButton` új ága, mind fedett.

A `main` (T-009-44, #35) beolvasztása után, `9f9ed22` állapoton, ugyanezzel az eljárással: **515 teszt,
mind zöld** (65 + 65 + 65 + 64 + 64 + 64 + 64 + 64), `bun run coverage:e2e:report` exit 0, a meglévő
küszöbbel; az egység kapu (`bun run test`) 574 fájl, 100 százalék mind a négy metrikán.

| Metrika    | Fedett / összes | Fedetlen |
| ---------- | --------------- | -------- |
| statements | 1855 / 1870     | 15       |
| branches   | 850 / 861       | 11       |
| functions  | 625 / 628       | 3        |
| lines      | 1783 / 1798     | 15       |

A fedetlen darabszám a beolvasztás előtti és a `main` 44.5a mérésével is azonos (15 / 11 / 3 / 15),
ugyanazon a hat fájlon (`nyc` json-summary, fájlonként utasítás/ág/függvény: `mount-app.tsx` 3/2/0,
`read-frontend-config.ts` 8/7/1, `is-valid-connection.ts` 1/1/0, `browser-history-location-port.ts`
1/0/1, `perform-route-request.ts` 1/1/0, `use-stream-connection.ts` 1/0/1); az `apps/web/package.json`
küszöbe nem változott.

### 28. A lábléc gombsora szűk nézetben: ikonos "Hozzáadás" (user döntés, 2026-10-14)

**A hiba és a mérés** (valódi Chromium, `apps/web` preview build, a gombok `getBoundingClientRect()`
értéke és a lábléc `scrollWidth - clientWidth` különbsége, saját mérés 2026-10-14, a
`responsive.spec.ts` szerkesztő fixtúrájával). A "régi" a szöveges "Hozzáadás" gombbal, az "új" az
ikonos alakkal:

| Szélesség | Gombsor régi | Lábléc túllógás régi | Gombsor új | Lábléc túllógás új | "Hozzáadás" új (bal-jobb pixel) |
| --------- | ------------ | -------------------- | ---------- | ------------------ | ------------------------------- |
| 320       | 325          | 41                   | 246        | 0                  | 163-191                         |
| 340       | 325          | 21                   | 246        | 0                  | 183-211                         |
| 360       | 325          | 1                    | 246        | 0                  | 203-231                         |
| 375       | 325          | 0                    | 246        | 0                  | 218-246                         |
| 640       | 325          | 0                    | 246        | 0                  | 483-511                         |
| 641       | 325          | 0                    | 325        | 0                  | 405-512                         |

320 pixelen a régi alakban a "Mentés" split button a nézetablak 79 százalékában látszott (a
`toBeInViewport` aránya 0,788), a nyíl gomb teljesen kilógott. A dokumentum vízszintes túllógása közben
0 maradt, mert az `.app-content` `overflow: auto`, ezért a `responsive.spec.ts` meglévő "nem lóg túl
vízszintesen" tesztje erre vak volt. Az új alakban a legszélső gomb jobb széle 320 pixelen 296, azaz a
lábléc 24 pixeles jobb belső margója előtt áll.

**A döntés.** A user a három lehetőségből (a gombsor két sorba törik; a "Hozzáadás" ikon gomb
`aria-label`-lel; egy gomb a split button menüjébe kerül) ezt választotta: "Ikon gomb keskenyen. Keskeny
képernyőn a 'Hozzáadás' csak ikon, a neve felolvasónak marad. A spec 'látható felirat' mondata
módosul." A SPEC-008 5.8 mondata ennek megfelelően módosult.

**A töréspont.** A `--ep-screen-sm` token (`breakpoints.css`), a lekérdezés `(max-width: 640px)`,
tehát 640 pixelen még ikon, 641 pixeltől szöveg (az e2e mindkét oldalt igazolja). A mért túllógás
sávjára (320 ... 360 pixel) nincs token; a márkanév szövegének elrejtése (`topnav-shell.css`, SPEC-007
5.3) ugyanezt a tokent a legkisebb, a mért sávot lefedő tokenként választotta, és ez a precedens
dönt, kitalált szám nincs. A literált a `footer-compact-media-query.spec.ts` (T-009-51 előtt
`add-node-compact-media-query.spec.ts`, 51.8) a token fájlból olvasva hasonlítja össze.

**Miért JS (`matchMedia`) és nem CSS.** A `.btn--icon` osztály a `button` elemen áll, amit media query
nem tud rátenni, a szabályait pedig saját osztályba másolni nem szabad (szabálykönyv 11. szekció,
"Csak létező design system elem használható"). A váltást a `useIsFooterCompact` hook adja
(`useSyncExternalStore`, `MediaQueryList` `change` esemény), a `GraphEditorScreen` `AddNodeMenuButton`
komponense ágazik rá.

**Az ikon.** A vendorolt `lucide@0.525.0` `Plus` ikonja (saját olvasás:
`eggproject-design-components/assets/vendor/lucide.min.js`, a fejléc `lucide v0.525.0`, az ikon
leírója `["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]`, a `Plus` kulcson), 24x24 viewBox, 1.75
vonalvastagság, a repó meglévő inline SVG konvenciója szerint (`aria-hidden`). A gomb `size="sm"`,
`variant="secondary"`, `icon`, `aria-label="Hozzáadás"`; a menü ugyanaz.

**Teszt.** Unit: `footer-compact-media-query.spec.ts` 1 (a literál a token értéke),
`use-is-footer-compact.spec.tsx` 4 (illeszkedés, nem illeszkedés, `change` esemény, leiratkozás),
`GraphEditorScreen.spec.tsx` +1 (szűk nézetben `.btn--icon`, `btn--sm`, `aria-label`, üres szöveg,
ugyanaz a kilenc menüpont, a választás felvesz). E2E (`responsive.spec.ts`) +2: a lábléc négy gombja
(`Futás indítása`, `Hozzáadás`, `Mentés`, `További műveletek`) minden támogatott szélességen
`toBeInViewport({ ratio: 1 })`; és a "Hozzáadás" gomb a token szélességén `.btn--icon` osztályú és
üres szövegű, a token fölött egy pixellel szöveges és osztály nélküli.

**Bukás a régi alakon.** A `GraphEditorScreen.tsx` a `07fe349` állapotára állítva (a szöveges gomb) a
két új e2e teszt elbukik: a lábléc teszt az első támogatott szélességen, 320 pixelen
(`getByRole('button', { name: 'Mentés', exact: true })`, "Expected: in viewport, Received: viewport
ratio 0.7878788113594055"), a határ teszt a `.btn--icon` osztály hiányán. A javított alakon mindkettő
zöld. A fájl visszaállítva.

### 29. Nem ellenőrzött

- A két pozíció szabály valódi Chromiumban (a kattintás pontja az új kártya dobozán belül; a gomb
  útján a látható vászon középpontja a kártya dobozán belül, a panel megnyílása után is), az M-99
  mezőlista, a csomóponton és élen nem nyíló menü és a két téma: a PLAN-009 T-009-45 e2e lépése
  (75 ... 77. kritérium).
- Az él jobb klikkje: a szerkesztő nem köti be az `onEdgeContextMenu` eseményt (a kódban nincs), és az
  `onPaneContextMenu` a 24. szekció forrásolvasása szerint csak a vászon elemén fut. Ezt unit teszt
  nem tudja bizonyítani, mert az élek happy-dom alatt nem rajzolódnak ki (M-53), ezért a bizonyíték a
  PLAN-009 T-009-45 elfogadási kritériuma: "az él jobb klikkje nem nyit felvételi menüt (e2e)".

## T-009-44

A csomópont törlése billentyűvel és a beállítás panel "Törlés" gombjával (SPEC-008 5.9, 82-84.
kritérium): `deleteKeyCode={['Backspace', 'Delete']}`, a Start védelme, a törlés egyetlen
`onDelete` útja a vásznon. A szekciók számozása `44.x`, hogy a T-009-43 szekcióival ne ütközzön.

### 44.1 Források

A telepített `@xyflow/react` 12.11.6 és `@xyflow/system` 0.0.82 forrása (saját olvasás, a sorszámok
a `dist/esm/index.js` fájlokra szólnak):

- `useGlobalKeyHandler` (react, 1245-1259. sor): a `deleteKeyCode` a `useKeyPress` hívásnak megy
  (`actInsideInputWithModifier: false`), a lenyomásra a kiválasztott csomópontokat és éleket
  a `deleteElements` kapja.
- `useKeyPress` (react, 387. sortól): a `keyCode` prop a `useMemo` függőségi tömbjében áll
  (414-429. sor), a beviteli elem szűrése a 436-437. sorban, tehát egy minden renderen új tömb minden renderen újraépítené a figyelőt. Ezért a
  `GraphEditorCanvas.tsx` modul szintű `const DELETE_KEY_CODE` konstanst használ.
- `deleteElements` (react, 1129-1154. sor): a sorrend rögzített: előbb az éleken `onEdgesDelete`
  és `triggerEdgeChanges`, utána a csomópontokon `onNodesDelete` és `triggerNodeChanges`, legvégül
  `onDelete({ nodes, edges })`.
- `getElementsToRemove` (system, 475. sortól): a `deletable === false` csomópont kimarad
  (479. sor), a megmaradt csomópontok kapcsolt élei (`getConnectedEdges`) bekerülnek a törlendők
  közé (489-491. sor).
- `isInputDOMNode` (system, 915-923. sor): az `INPUT`, `SELECT`, `TEXTAREA` és `contenteditable`
  eseménycél, valamint a `.nokey` osztályú ős kiszűri a billentyűt.

Dokumentáció:

- <https://reactflow.dev/api-reference/react-flow> `deleteKeyCode`: "pressing the key or chord
  will delete any selected nodes and edges. Passing an array represents multiple keys", alapérték
  `'Backspace'`; az `onDelete` és az `onBeforeDelete` ugyanitt.
- <https://reactflow.dev/api-reference/types/on-delete> `OnDelete`: a paraméter
  `{ nodes: Node[]; edges: Edge[] }`, visszatérése `void`.
- A telepített forrás (fent) a két dokumentált alapértéket (`'Backspace'`, a tömbös alak) és az
  `onDelete` paraméterét megerősíti.
- A beviteli mezőn lenyomott billentyű szűrésének története a könyvtár saját issue-iban:
  <https://github.com/xyflow/xyflow/issues/2254> (a törlés billentyű az oldal más elemeiben
  gátolta a Backspace-t), <https://github.com/xyflow/xyflow/issues/3939> (a törlés nem a
  helyes eseménycélt ellenőrizte), <https://github.com/xyflow/xyflow/issues/1054> (a
  `deleteKeyCode` tömböt fogad). Mindhárom lezárt; a mostani viselkedést a telepített forrás és a
  44.4 szekció e2e mérése igazolja, nem az issue szövege.

### 44.2 A mért hiba: két változáslista, két kezelő

A hiba a `main`-en (`b133b0e`) már megvolt, az alapértelmezett `Backspace` billentyűvel: a
`deleteKeyCode` prop bekapcsolása nem okozta, csak a `Delete` billentyűt tette a hibás útra. A
`b133b0e` `onNodesChange` és `onEdgesChange` kezelője egyaránt a saját, azonos renderből való
propjaiból (`nodes`, `edges`) építette a teljes gráfot és hívta az `onGraphChange`-et; a könyvtár a
törlést két külön változáslistában jelzi (44.1), tehát a második hívás visszaírta az első
törlését.

Mérés (saját, ebben a munkamenetben futtatva, a `b133b0e` vászonkódjával és csak a
`deleteKeyCode` prop hozzáadásával):

| Út                                                                                             | Eredmény                                                                                                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| happy-dom, valódi `keydown` a `document`-en, `Backspace`, törlendő a `FAN_OUT_NODE` két élével | az `onGraphChange` 2 hívást kap (1 helyett)                                                                           |
| ugyanez `Delete`-tel                                                                           | 2 hívás (a `deleteKeyCode` beállítása után; a `HEAD` alapértelmezett `'Backspace'` kulcsán a `Delete` 0 hívást adott) |
| valódi Chromium, a n3 csomópont törlése `Backspace`-szel, majd mentés                          | a mentett gráfban az `e2` él (n2 -> n3) a törölt n3 csomópont nélkül marad: árva él                                   |
| ugyanez `Delete`-tel                                                                           | ugyanez az `e2`                                                                                                       |

A vásznon az árva él nem rajzolódott ki (az `edgeLocator(page, 'e2')` leválasztott volt), tehát a hiba
csak a szerkesztett állapotban és a mentés `PUT` törzsében látszott, a felhasználó számára nem.

Újramérés a prop nélkül (saját, 2026-10-14; a `b133b0e` `GraphEditorCanvas.tsx` fájlja `git show`-val a
munkafára másolva, a többi fájl a T-009-44 állapotán, a mérés után `git checkout HEAD -- <fájl>`):

| Út                                                                                                              | Eredmény                                                                 |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| happy-dom, `GraphEditorCanvas.spec.tsx` "törlés" csoport, `Backspace`                                           | az `onGraphChange` 2 hívást kap (1 helyett)                              |
| ugyanez `Delete`-tel                                                                                            | 0 hívás (a `Delete` a `main`-en nincs kötve)                             |
| valódi Chromium, `e2e/graph-node-delete.spec.ts` első tesztje: az n3 csomópont törlése `Backspace`-szel, mentés | a mentett gráf élei `["e1", "e2"]` az elvárt `["e1"]` helyett: árva `e2` |

### 44.3 A megoldás

- Az `onNodesChange` a `remove` változást nem dolgozza fel (a többi változás útja változatlan).
- Az `onEdgesChange` kizárólag a `select` változást dolgozza fel (a kiválasztás nézet állapot);
  az `applyEdgeChanges` import törölve.
- Az `onDelete` a törölt csomópontokat és éleket együtt kapja (44.1), és egyetlen `onGraphChange`
  hívásban szűri ki őket a vászon `nodes` és `edges` propjából.
- A panel "Törlés" gombja nem a könyvtáron át megy: a `GraphEditorScreen` a tiszta
  `deleteNodeWithEdges` függvényt hívja (T-009-42), a kiválasztást megszünteti, a panel bezárul.
  A gomb a Start panelen nem jelenik meg; a Startot a `deletable: false` mező védi a billentyű ellen.
- Megerősítés nincs (SPEC-008 5.9).

### 44.4 Teszt és rontás igazolás

Unit (a `GraphEditorCanvas.spec.tsx` "törlés" csoportja és a másik két spec):

- a `deleteKeyCode` értéke `['Backspace', 'Delete']`, és két render között azonos hivatkozás;
- az `onDelete` egyetlen hívásban törli a csomópontot és az éleit; csak élre is működik;
- a valódi könyvtár billentyű útja happy-dom alatt (`keydown` a `document`-en): `Backspace` és
  `Delete` egyetlen `onGraphChange` hívásban `([START_NODE], [])` eredményt ad;
- a Start egyik billentyűre sem törlődik; `Backspace` egy `<input>` elemen nem töröl csomópontot;
- a `NodeInspector` Törlés gombja (`danger`, `sm`, a fejlécben, kilenc törölhető típusra), a Start
  panelen nincs; a `GraphEditorScreen` Törlés gombja hálózati kérés és párbeszéd nélkül töröl;
- a 44.6 döntés (user, 2026-10-14): mind a tíz típusnál a panel gyökér `<aside>` eleme a `nokey`
  osztályt viseli (`NodeInspector.spec.tsx`); a valódi vászon és a valódi panel egy dokumentumban
  (`GraphEditorCanvas.spec.tsx`, "a beállítás panelen" csoport): a panel minden gombján és
  választóján lenyomott `Backspace` és `Delete` egyetlen `onGraphChange` hívást sem ad, a panelen
  kívüli gombról lenyomva ugyanaz a billentyű a kiválasztott csomópontot törli.

Rontás igazolás: a `b133b0e` vászonkódján, csak `deleteKeyCode={['Backspace', 'Delete']}` hozzáadásával
a "törlés" csoport `Backspace` és `Delete` tesztje elbukik ("expected vi.fn() to be called 1 times,
but got 2 times"), a Start tesztjei zöldek maradnak. Ugyanezzel a rontott vászonnal az
`e2e/graph-node-delete.spec.ts` mindkét billentyű tesztje elbukik: a mentett gráf élei
`["e1"]` helyett `["e1", "e2"]`.

E2E (`apps/web/e2e/graph-node-delete.spec.ts`, 8 teszt, ebből 2 a 44.6 döntésé): `Backspace` és `Delete` törli az n3
csomópontot és az `e2` élt, a mentés `PUT` törzse (a `ReplaceGraphRequestSchema` szerint értelmezve)
`n1, n2` csomópontot és `e1` élt tartalmaz; a Törlés gomb törli az n2 csomópontot és mindkét élét,
a panel bezárul, mentés előtt nincs kérés, párbeszéd nincs, a gomb teljesen látszik; a Start mindkét
billentyűre megmarad; a Prompt sablon szövegmezőjében a `Backspace` és a `Delete` a szöveget
szerkeszti, a csomópont megmarad; egy egérrel húzás csak az n2 mentett pozícióját változtatja
(a csomópont `graphChanges` ága, ami a törlés útjának átalakítása után csak e2e-ben marad fedett).
A 44.6 két tesztje (`Backspace` és `Delete`): az n2 csomópont kiválasztása után a panel "Bezárás"
és "Törlés" gombján, a "Kezeletlen hiba szabálya" választó triggerén, majd a választó nyitott
listája mellett a billentyű nem töröl (a csomópont és mindkét éle látszik, a mentetlen jelző nem
jelenik meg); utána a vásznon az n2 csomópontra kattintva ugyanaz a billentyű törli a csomópontot
és az éleit, a mentés `PUT` törzse `n1, n3` csomópontot és nulla élt tartalmaz.

### 44.5 Az e2e lefedettség előtte és utána

Saját mérés, 8 shard, `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e` után, a `main`
`b133b0e` állapotán (előtte) és a T-009-44 változtatásokkal (utána); 499 e2e teszt, mind zöld
(a `main` alapja 493; +6 a `graph-node-delete.spec.ts`):

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1788 / 1803            | 1800 / 1815           | 15 -> 15                 |
| branches   | 835 / 846              | 838 / 849             | 11 -> 11                 |
| functions  | 592 / 595              | 601 / 604             | 3 -> 3                   |
| lines      | 1722 / 1737            | 1732 / 1747           | 15 -> 15                 |

A `bun run coverage:e2e:report` a mostani állapoton nulla kilépési kóddal fut (összesen 99,17 /
98,7 / 99,5 / 99,14 százalék az `apps/web/package.json` változatlan 99,11 / 98,61 / 99,46 / 99,08
küszöbei ellen). A fedetlen helyek fájlonkénti listája (nyc json-summary) mindkét állapoton azonos:
`mount-app.tsx` 3 utasítás, `read-frontend-config.ts` 8, `is-valid-connection.ts` 1,
`browser-history-location-port.ts` 1, `perform-route-request.ts` 1, `use-stream-connection.ts` 1.

A fedetlen darabszám közben egyszer nőtt: a törlés útjának átalakítása után a csomópont
`graphChanges` ága (pozíció és dimenzió változás) az e2e-ben nem futott, és 20 / 13 / 5 / 20 fedetlen
tétel jött ki (utasítás / ág / függvény / sor). Az egérrel húzás tesztje (44.4) ezt az ágat fedi, így
a számok a fenti, a `main` alappal azonos értékre estek vissza; a küszöb nem módosult.

### 44.5a Az e2e lefedettség a 44.6 döntés után

Saját mérés, 2026-10-14, a `main` `f4e1440` (#33 és #34) beolvasztása után, 8 shard egymás után,
`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results` után, a számok a
`bun x nyc report --reporter=json-summary` kimenetéből: 511 e2e teszt, mind zöld (shardonként 64, a
nyolcadikon 63; a 44.5 fenti mérése 499 tesztet futtatott).

| Metrika    | Fedett / összes | Fedetlen |
| ---------- | --------------- | -------- |
| statements | 1800 / 1815     | 15       |
| branches   | 838 / 849       | 11       |
| functions  | 601 / 604       | 3        |
| lines      | 1732 / 1747     | 15       |

A számok azonosak a 44.5 "utána" oszlopával: a `NodeInspector.tsx` változása egy osztálynév, futtatható
utasítást nem ad, a fedetlen darabszám nem nőtt, a küszöb nem módosult. A `bun run coverage:e2e:report`
nulla kilépési kóddal fut (összesen 99,17 / 98,7 / 99,5 / 99,14 százalék az `apps/web/package.json`
változatlan 99,11 / 98,61 / 99,46 / 99,08 küszöbei ellen). A fedetlen helyek fájlonkénti listája is
azonos: `mount-app.tsx` 3 utasítás, `read-frontend-config.ts` 8, `is-valid-connection.ts` 1,
`browser-history-location-port.ts` 1, `perform-route-request.ts` 1, `use-stream-connection.ts` 1.

### 44.6 A Backspace és a Delete a panelen (user döntés, 2026-10-14)

A kérdés (korábban nyitva): ha egy csomópont ki van választva, és a beállítás panelen egy nem beviteli
vezérlőn áll a fókusz, a `Backspace` és a `Delete` törli-e a csomópontot. Mérve (saját, valódi
Chromium, a döntés előtt): az n3 csomópont kiválasztása után a panel "Bezárás" gombjára fókuszt
tenni és `Backspace`-t nyomni törölte az n3 csomópontot (a csomópont darabszáma a lenyomás után 0). A
könyvtár `isInputDOMNode` szűrője (44.1) csak az `INPUT`, `SELECT`, `TEXTAREA` és `contenteditable`
elemet és a `.nokey` osztályú őst védi; egy gomb, a design system `Select` triggere vagy bármely
más fókuszálható, nem beviteli elem nem. SPEC-008 5.9 és a 82-84. kritérium erről nem rendelkezett.

**A döntés (user, 2026-10-14):** "A panelen ne töröljön. A panel teljes területén a billentyű nem
töröl csomópontot (React Flow `nokey` osztály). A vásznon és fókusz nélkül továbbra is töröl." A
korábban felsorolt három lehetőségből a (b) valósult meg; az (a) és a (c) elvetve.

**A megvalósítás:** a `NodeInspector` gyökér `<aside>` elemén a `nokey` osztály (`NodeInspector.tsx`).
Új szűrő, billentyű kezelő vagy CSS nincs. A panel gombjai és a design system `Select` triggere (a
nyitott lista `createPortal`-lal a `document.body`-ban áll, a DOM fókusz a triggeren marad, a
`packages/ui` `SelectField` doksija szerint) az `aside` leszármazottjai, tehát a `.closest('.nokey')`
találja őket. A "Törlés" gomb egérrel vagy `Enter`/`Space` billentyűvel továbbra is töröl: az
kifejezett művelet, nem a törlés billentyű.

**A mechanizmus forrása.** A telepített kód az igazolás; a hivatalos dokumentáció a `nokey` osztályt
nem említi.

- Telepített `@xyflow/system` 0.0.82, `dist/esm/index.js` 914-923. sor: az `inputTags` lista
  (`INPUT`, `SELECT`, `TEXTAREA`), majd az `isInputDOMNode` függvény; a célelem az esemény
  `composedPath()[0]` eleme, a visszatérés a 922. sorban: `return isInput || !!target.closest('.nokey');`.
- Telepített `@xyflow/react` 12.11.6, `dist/esm/index.js`: a `useGlobalKeyHandler` (1245-1259. sor) a
  törlés billentyűt `useKeyPress(deleteKeyCode, { actInsideInputWithModifier: false })` hívással
  figyeli; a `useKeyPress` `downHandler`-e modifier nélküli lenyomásnál is az `isInputDOMNode(event)`
  eredményén dönt, és igaz esetén kilép (`return false`), tehát a `setKeyPressed(true)` nem fut.
- Upstream, `xyflow/xyflow` `main`, `packages/system/src/utils/dom.ts`: azonos `isInputDOMNode`, azonos
  `.nokey` sor (<https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/utils/dom.ts>,
  lekérve 2026-10-14).
- A karbantartók issue-beli megerősítése, három független szálon: xyflow/xyflow#3939 (peterkogo, a
  Svelte Flow szálon, ugyanabból a `@xyflow/system` kódból: az eseménycél és a dokumentum gyökér
  közti bármely elem `.nokey` osztálya számít, és a modális fókuszálása után a törlés billentyű
  figyelmen kívül marad), #5729 (moklick: a `nokey` osztály mint
  megkerülő megoldás), #5037 (bcakmakoglu: `className="nokey"` a figyelmen kívül hagyandó elemeken).
  A #5037 szálán egy felhasználó ki is mondja, hogy a hivatalos oldal a `nokey` használatát nem
  említi.
- A hivatalos dokumentáció: a <https://reactflow.dev/api-reference/react-flow>, a
  <https://reactflow.dev/learn/customization/utility-classes>, a
  <https://reactflow.dev/api-reference/types/key-code> és a
  <https://reactflow.dev/api-reference/hooks/use-key-press> oldalon a `nokey` szó nulla előfordulású
  (saját `curl` és `grep`, 2026-10-14), a `nodrag` ugyanazokon az első két oldalon dokumentált. A
  viselkedés tehát nem dokumentált API, hanem a telepített kód és a karbantartók által ajánlott
  megkerülő megoldás; a könyvtár frissítése előtt a 44.4 e2e tesztjének zöldnek kell maradnia.

**A mérés a döntés után (saját, valódi Chromium).** A `graph-node-delete.spec.ts` két új tesztje (44.4): az
n2 csomópont kiválasztása után a panel "Bezárás" és "Törlés" gombján, a "Kezeletlen hiba szabálya"
választó triggerén és nyitott listája mellett a `Backspace` és a `Delete` nem töröl; ugyanaz a
csomópont a vásznon rákattintva, ugyanazzal a billentyűvel törlődik (a fókusz helye az egyetlen
különbség).

**Rontás igazolás (saját, 2026-10-14).** Ideiglenesen a `NodeInspector.tsx` `nokey` osztálya nélkül:
az `e2e/graph-node-delete.spec.ts` 8-ból 6 teszt zöld, a 2 új elbukik ("element(s) not found" az n2
csomópontra, a "Bezárás" gombon lenyomott billentyű után); a `GraphEditorCanvas.spec.tsx` két új
tesztje elbukik ("expected vi.fn() to not be called at all, but actually been called 3 times": a
panel mind a három vizsgált vezérlőjén töröl); a `NodeInspector.spec.tsx` osztály tesztje mind a tíz
típusra elbukik. Az osztállyal mindhárom zöld. A rontást utána visszaállítottuk.

**Hatókör és következmény.**

- A `nokey` a panel gyökér `<aside>` elemére szól. A panel melletti `Resizable` elválasztó
  (`role="separator"`) nem a panel leszármazottja, így a `nokey` nem fedi; az ott álló fókusz
  melletti `Backspace` viselkedését nem mértük (44.7).
- A fókusz nélküli eset (`document.activeElement` a `body`) a döntés szerint változatlanul töröl; a
  telepített forrás szerint az `isInputDOMNode` az eseménycél ősláncát nézi, ami `body` célnál nem
  tartalmaz `.nokey` elemet.
- A SPEC-008 5.10 első szabálya szerint a visszavonás billentyű szűrője pontosan az `isInputDOMNode`
  körére épül (`INPUT`, `SELECT`, `TEXTAREA`, `contenteditable`, `.nokey`; M-102, M-117). Ha a szűrő
  a `.nokey` osztályt is kiszűri, a panelen belül lenyomott `Ctrl+Z` sem hat a gráfra. Ez a PLAN-009
  T-009-52 és T-009-53 lépésének hatóköre; a döntés ezt a kapcsolatot nem mondta ki, ezért ott
  külön ellenőrizendő.

### 44.7 Nem ellenőrzött

- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál, a billentyű útra
  egyik motoron sem futott mérés.
- A `Resizable` elválasztón (`role="separator"`) álló fókusz melletti `Backspace` és `Delete`: az
  elválasztó nem a panel leszármazottja, a viselkedést nem mértük.
- A `Delete` billentyű macOS-en (a `Backspace` helyett használt `Delete` gomb a laptop billentyűzeten
  `Fn` + `Backspace`): a Chromium `KeyboardEvent.key` értékeit nem mértük Mac hardveren.

## T-009-45

A D1 e2e lépése (SPEC-008 5.4, 5.8, 5.9; 74 ... 85., 100. és 111. kritérium e2e része) valós
Chromiumban, a szándékos rontásokkal. A szekciók számozása `45.x`, a T-009-44 mintájára.

### 45.1 A kiindulás: mit fedett már a meglévő e2e

A `main` `45f5af5` állapotán a kritériumok e2e részéből már fedett volt, ezért nem duplikáltam:

| Kritérium | Már fedett rész                                                                                                | Meglévő teszt                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 74., 78.  | a gomb és a jobb klikk menü kilenc menüpontja, a felvett típus panelje, mentetlen jelző, nulla kérés           | `graph-node-add.spec.ts` két tesztje                                                                                                    |
| 82.       | `Backspace` és `Delete` a csomópontot az éleivel törli; a szöveg mező, a panel gombjai és a választó nem töröl | `graph-node-delete.spec.ts` billentyű és panel tesztjei; a kiválasztott él `Backspace` törlése: `graph-edge-selection.spec.ts`          |
| 83.       | a Start mindkét billentyű után marad az élével, a panelén nincs Törlés gomb                                    | `graph-node-delete.spec.ts` "a Start nem törölhető ..."                                                                                 |
| 84., 85.  | a Törlés gomb megerősítés nélkül, a mentés `PUT` törzsében nincs árva él                                       | `graph-node-delete.spec.ts` Törlés gomb és billentyű tesztjei (`saveAndReadGraphIds`)                                                   |
| 111.      | a `null` kezeletlen hiba szabály mentése `PUT` nélkül, a választó alatt jelez, érték után a mentés lefut       | `graph-editor-validation.spec.ts`, de **betöltött** Starttal; a kritérium **felvett** csomópontot ír elő, ezért új teszt készült (45.2) |

Hiányzott: a két pozíció szabály és az M-99, a jobb klikk menü csomóponton és élen, az `Escape` és
a kívülre kattintás zárása, a böngésző menüjének tiltása, mindkét téma, az UUID a `PUT` törzsben, a
felvett `loop` mentése üres konfiggal, a régi gráf betöltése üres kötelező mezővel, a kiválasztott
él `Delete` törlése és a "Hozzáadás" helye a láblécben.

### 45.2 Az új e2e tesztek

- `apps/web/e2e/graph-node-add-placement.spec.ts` (új, 6 teszt): a gomb útja (77., 78., M-99), a
  jobb klikk útja (76., 78.), és a 75. kritérium két tesztje mindkét témában (üres terület: a menü
  nyílik, a `contextmenu` esemény `defaultPrevented`, `Escape` és kívülre kattintás zár; csomópont
  és él: nem nyílik, nem tilt).
- `apps/web/e2e/graph-node-required-fields.spec.ts` (új, 13 teszt): a felvett agent lépés (79., 111.),
  a felvett ciklus teljes útja (81.: egy kísérlet után mindhárom mező jelez, a lábléc üzenete mindhárom
  útvonalat megnevezi, kitöltés után a mentés lefut), a kilenc felvehető típus egy kísérletes mentése
  (81., táblázatos, típusonként egy teszt, plusz az esetszámot rögzítő teszt; 45.5), és a régi, üres
  `promptTemplate` mezőt hordozó gráf (100.).
- `apps/web/e2e/graph-node-delete.spec.ts` (+1): a kiválasztott él `Delete` billentyűvel (82.).
- `apps/web/e2e/graph-node-add.spec.ts` (+1): a "Hozzáadás" a lábléc akciósávjában, közvetlenül a
  "Mentés" split button előtt (74.).

A felvett csomópont azonosítója a böngészőben keletkezik, ezért a tesztek a React Flow `data-id`
attribútumából olvassák, és a `rf__node-<id>` fogódzón érik el (a `getByTestId` `rf__` kivétele,
SPEC-008 12.3). A `contextmenu` esemény `defaultPrevented` értékét egy `window` buborékoló figyelő
adja a `page.exposeFunction` útján, tehát a React kezelője után.

### 45.3 A mérések (saját, valódi Chromium, 1440x900, 2026-10-15)

**M-99, a gomb útja.** A fixtúra két csomópontja (`n1` a `(0, 0)`, `n2` az `(1000, 480)` ponton) a
`fitView` után: a `rf__wrapper` doboza `x 0, y 108, 1440 x 745`, a `.react-flow__renderer`
`offsetWidth`/`offsetHeight` értéke `1440 x 745` (a store `width`/`height` forrása, a telepített
`useResizeHandler`), a `.react-flow__viewport` inline stílusa `translate(65px, 89.8564px)
scale(0.964654)` (a store `transform` mezője, `toTransformString`). A felvett csomópont flow helye
`(500, 240)`; a DOM-ból olvasott értékeken futtatott `((width / 2 - x) / zoom - 358 / 2, (height /
2 - y) / zoom - 106 / 2)` képlet `(499.99991, 240)`. A különbség 0,0001 flow pixel alatti, és abból
jön, hogy a böngésző az inline `transform` értéket hat értékes jegyre írja vissza (`89.8564px`,
`0.964654`), a `DOMMatrixReadOnly` pedig ezt egyszeres pontossággal olvassa; a teszt ezért
`toBeCloseTo(..., 1)` (0,05 alatti eltérés) mellett állít. Ezzel az M-99 mezőlistája valós
Chromiumban igazolt: a store `width` és `height` mezője a vászon renderer elemének mérete, a
`transform` a nézet `[x, y, zoom]` alakja, és a gomb ezekből számol. A kártya kirajzolt doboza
`345,35 x 102,25` pixel, azaz a méret konstans (`358 x 106`, a `:root` custom propertyje) szorozva a
nagyítással; a látható vászon középpontja `(720, 480,5)`, a dobozon belül (`547,3 ... 892,7`,
`429,4 ... 531,6`). A panel megnyílása után a vászon 1004,5 pixel széles, a kártya jobb széle
892,7, tehát a teljes doboz a vásznon belül marad.

**M-98, a jobb klikk útja.** A kattintás pontja `(1080, 257)` (a vászon jobb felső negyede, egész
pixelre kerekítve), a felvett csomópont flow helye `(1052,19, 61,31)`, ami a `(pont - a vászon bal
felső sarka - eltolás) / nagyítás` képlet; a kártya doboza `x 1080, y 257` ponton kezdődik, tehát a
pont a bal felső sarok.

**A jobb klikk menü (75.).** Mindkét témában (`data-theme="dark"`, illetve nélküle): az üres
területen a `contextmenu` esemény `defaultPrevented` értéke `true`, a menü `toBeInViewport({ ratio:
1 })`, a fókusz az első menüponton; az `Escape` és a menün kívüli bal klikk zár, csomópont nem kerül
fel. Az `n2` csomóponton és az `e1` élen a `defaultPrevented` `false`, menü nem nyílik; ugyanabban a
futásban az üres területen `true` és a menü nyílik (kontroll).

**A felvett ciklus (81.), a 45.5 javítása előtt.** A kezdő `maxIterations` `NaN`: a szám mező `value` attribútuma `NaN`, a
`value` tulajdonsága `''`, a `validity.valid` `true`, tehát a mező üresen látszik (mérve). A mentés
gombra `PUT` nem indul, de **csak** a `maxIterations` mező jelez (`aria-invalid="true"`, a zod
saját "Invalid input" üzenetével), a lábléc üzenete: "A kérés törzse érvénytelen, hibás mező(k):
nodes.2.config.maxIterations (invalid_request)." A `continueExpression` és az `onUnhandledError`
mező ekkor **nem** jelez. A `maxIterations` kitöltése (`3`) után mindkettő azonnal jelez ("A mező
nem lehet üres."), új mentési kísérlet nélkül, és a következő mentés is `PUT` nélkül marad. A
felvett `error_handler` ugyanígy viselkedik: az első kísérlet után csak a `maxAttempts` mező jelez,
az `onUnhandledError` nem. Ez eltért a SPEC-008 5.8 "Mit jelez a mentés" bekezdésétől és a 81.
kritériumtól; a 45.5 javítása óta egy kísérlet mindet jelzi.

**Az ok, forrással.** A `NodeConfigSaveSchema` a három írás oldali szabályt egy, a
`NodeConfigSchema`-ra tett `superRefine` hívásban futtatja
(`packages/protocol/src/node-config/node-config-save-schema.ts`). A zod dokumentációja szerint "By
default, refinements don't run if any non-continuable issues have already been encountered. Zod is
careful to ensure the type signature of the value is correct before passing it into any refinement
functions" (<https://zod.dev/api>, "Refinements", `when`); a karbantartó megerősítése szerint "Refinements
run as long as no _non-continuable_ issues have occurred. Generally these are `invalid_type` errors"
(<https://github.com/colinhacks/zod/issues/4598>). A `z.number()` a `NaN` értéket típus hibával
utasítja el (M-104), tehát a `superRefine` ebben a mentési kísérletben nem fut.

**Az UUID (79.).** A felvett csomópont és az új él azonosítója a `PUT` törzsben a 4. verziós UUID
alakja: öt hexadecimális csoport, a harmadik `4`-gyel, a negyedik `8`, `9`, `a` vagy `b` értékkel
kezdődik (RFC 9562 4.2. szakasz: a verzió `0b0100`, a variáns `10xx`; 5.4. szakasz: a `ver` mező a 48
... 51. bit, a `var` a 64 ... 65. bit, <https://www.rfc-editor.org/rfc/rfc9562.html>; a 4. szakasz
szerint a betűk kis- és nagybetűsek is lehetnek, ezért a minta kis- és nagybetű független). `xy-edge__`
előtagú él nincs a törzsben. A felvett agent lépés minden más kötelező mezővel (a `promptTemplate`
kitöltve, él a Start kimenetéről) is `PUT` nélkül marad, amíg az `onUnhandledError` `null`, és a
választó alatt jelez (111.); a `fail_run` választása után a mentés egy kéréssel lefut.

**A régi gráf (100.).** Az üres `promptTemplate` mezőt hordozó `n2` csomóponttal a szerkesztő
betölt (a csomópont látszik, `role="alert"` nincs), a mentési kísérlet `PUT` nélkül a "Prompt sablon"
mező alatt jelez, a csak szóközből álló érték is, kitöltés után a mentés lefut.

### 45.4 Szándékos rontások (mindegyik visszaállítva, a commitban nincs)

| Rontás                                                                                               | Bukó e2e teszt                                                                                                                                                                                                                                                                   | Bukó unit teszt                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a1) `DELETE_KEY_CODE` = `['Backspace']` (`GraphEditorCanvas.tsx`)                                   | `graph-node-delete.spec.ts`: "a(z) Delete billentyű a kiválasztott csomópontot ...", "a Delete billentyű a kiválasztott élt törli ...", "a panel gombján és a választó triggerén lenyomott Delete nem töröl, a vásznon kiválasztott csomópontra viszont igen" (3 bukik, 10 zöld) | `GraphEditorCanvas.spec.tsx`: "a deleteKeyCode pontosan a Backspace és a Delete", "a(z) Delete billentyű a kiválasztott csomópontot ...", "a panelen kívüli gombon lenyomott Delete ..."                                                                                         |
| (a2) `DELETE_KEY_CODE` = `['Delete']`                                                                | `graph-node-delete.spec.ts`: a `Backspace` csomópont törlés és a `Backspace` panel teszt; `graph-edge-selection.spec.ts`: a három `Backspace` teszt (5 bukik, 8 zöld)                                                                                                            | ugyanaz a három teszt a `Backspace` változatával                                                                                                                                                                                                                                 |
| (b) a `deletable: workflowNode.type !== 'start'` sor törlése (`graph-editor-node-mapping.ts`)        | `graph-node-delete.spec.ts`: "a Start nem törölhető: a billentyűk után a vásznon marad ..." ("element(s) not found" az `n1` csomópontra; 1 bukik, 12 zöld)                                                                                                                       | `graph-editor-node-mapping.spec.ts` 2, `GraphEditorCanvas.spec.tsx` a két Start billentyű teszt                                                                                                                                                                                  |
| (c1) a középpont képletéből a `/ zoom` osztás elhagyása (`compute-viewport-center-node-position.ts`) | `graph-node-add-placement.spec.ts` gomb útja teszt: `Expected: 499.9999115804794, Received: 476` (1 bukik, 11 zöld)                                                                                                                                                              | `compute-viewport-center-node-position.spec.ts` 3                                                                                                                                                                                                                                |
| (c2) a kártya fél méretének elhagyása ugyanott                                                       | ugyanaz a teszt: `Expected: 499.9999115804794, Received: 679` (1 bukik, 11 zöld)                                                                                                                                                                                                 | `compute-viewport-center-node-position.spec.ts` 5                                                                                                                                                                                                                                |
| (d) a `NodeConfigSaveSchema` `when` feltételének elhagyása (a javítás előtti szerkezet, 45.5)        | `graph-node-required-fields.spec.ts`: a ciklus teljes útja (a `continueExpression` mezőn), a táblázat `Ciklus` és `Hibakezelő` esete (a `Kezeletlen hiba szabálya` mezőn); 3 bukik, 10 zöld                                                                                      | 14 bukik: a `node-config-save-schema.spec.ts` hét típushibás esete, a `NodeInspector.spec.tsx` két, a `create-initial-node-config.spec.ts` két, a `validate-graph-for-save.spec.ts` egy és az `apps/server` `replace-workflow-graph-error-response.spec.ts` két (i), (j) tesztje |
| (e) a `when` feltétel helyén `() => true` (a diszkriminátor ellenőrzés nélkül)                       | nem futtatva: a hiba nem felhasználói úton jön elő                                                                                                                                                                                                                               | `node-config-save-schema.spec.ts` hat esete (nem objektum, `null`, ismeretlen és nem szöveg `type`, ismeretlen és nem szöveg `join` mód): a finomítás `TypeError`-t dob                                                                                                          |

Tanulság a (c) rontásokból: a 77. kritérium "a középpont a kártya dobozán belül" állítása önmagában
egyik rontást sem fogná meg biztosan (0,96 nagyításnál a `/ zoom` elhagyása 24 flow pixeles, a fél
méret elhagyása a kártya sarkára tolja a középpontot); a bukást az M-99 képlet egyezésének állítása
adja, ezért a teszt mindkettőt állítja. A `GraphEditorScreen.spec.tsx` gomb útja tesztje egyik (c)
rontásra sem bukik, mert a várt helyet ugyanazzal a függvénnyel számolja; a képletet a saját unit
tesztje és ez az e2e őrzi.

### 45.5 Lezárva: a felvett ciklus és hibakezelő első mentési kísérlete (81. kritérium)

| Kérdés             | Válasz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mi volt az eltérés | a SPEC-008 5.8 és a 81. kritérium szerint a felvett csomópont mentési kísérlete minden üres kötelező mezőn jelez; mérve (45.3) a `loop` és az `error_handler` első kísérlete csak a `NaN` szám mezőn jelzett, mert a `NodeConfigSaveSchema` `superRefine` hívása típushiba mellett nem futott                                                                                                                                                                                                                                                                                   |
| a döntés           | user döntés 2026-10-16: "Egyszerre látsszon mind." A spec változatlan; a SPEC-008 15. szekciójának kritériumai állapotot nem jelölnek, ezért a 81. kritérium szövege sem változott                                                                                                                                                                                                                                                                                                                                                                                              |
| a javítás          | a `NodeConfigSaveSchema` `superRefine` hívása második paraméterként `when` feltételt kap (`packages/protocol/src/node-config/node-config-save-schema.ts`): a három szabály (kötelező szöveg mező, `null` `onUnhandledError`, `null` `join` mód) a konfig típushibája mellett is lefut, ha a bemenet ismert `type` és (a `join`-nál) ismert vagy `null` `mode` értékkel áll, azaz a diszkriminált unió ágat választott. Az ismert értékek forrása a `REQUIRED_TEXT_FIELD_PATHS` tábla kulcsai. A séma szerkezete, a `z.infer` eredménye és a négy séma írási szabály változatlan |
| miért ez az út     | ugyanaz a séma fut a kliensen (`validateGraphForSave`, a beállítás panel mezőnkénti hibája) és a szerveren (`PUT` törzs), tehát a két oldal ugyanazokat az útvonalakat adja; a két független ellenőrzés összefésülése egy második szabályforrást hozott volna. A `when` feltétel nélkül (`() => true`) a finomítás nem objektum vagy ismeretlen diszkriminátorú bemeneten `TypeError`-t dobna (45.4 (e)); a karbantartó szerint típushiba után a bemenet "possibly malformed", ezért a feltétel pontosan azt ellenőrzi, amit a finomítás típusosan olvas                        |
| a bizonyíték       | unit: `node-config-save-schema.spec.ts` (13 típushibás eset, a `when` minden ága), `create-initial-node-config.spec.ts` (a kilenc kezdő konfig teljes hibalistája), `NodeInspector.spec.tsx` (a ciklus és a hibakezelő mező alatti hibái), `validate-graph-for-save.spec.ts` (a lábléc üzenete); szerver: `replace-workflow-graph-error-response.spec.ts` (i), (j): `400 invalid_request`, az üzenet bájtra egyezik a kliens ellenőrzéséével (a kliens `NaN`, a drót `null` értékkel); e2e: 45.2; rontás: 45.4 (d), (e)                                                         |

**Források.** A zod dokumentációja: "By default, refinements don't run if any non-continuable issues have
already been encountered" és a `when` paraméter leírása, a "power user feature" figyelmeztetéssel
(<https://zod.dev/api>, "Refinements", `when`). A `superRefine` `when` paramétere: colinhacks/zod #5741
("feat: allow 'when' parameter in .superRefine", "Landed in Zod 4.4",
<https://github.com/colinhacks/zod/pull/5741>, commit `65fab33`), előzménye a #5739 issue
(<https://github.com/colinhacks/zod/issues/5739>). A karbantartó indoka, miért nem fut alapból: "If
validation has failed on the base schema, then Zod has no confidence in the fact that the input data agrees
with the inferred type signature" (<https://github.com/colinhacks/zod/issues/5197>), és a #4598
(<https://github.com/colinhacks/zod/issues/4598>). A telepített `zod@4.4.3` forrása: a
`src/v4/core/api.ts` `$ZodSuperRefineParams` interfésze (`when`) és `_superRefine` függvénye, ami a
paramétert a `_check` hívásnak adja; a `src/v4/core/schemas.ts` `runChecks` függvénye, ami `when`
megléte esetén az alapértelmezett kihagyás helyett a feltételt futtatja (`explicitlyAborted` esetén
nem); a telepített teszt: `src/v4/classic/tests/refine.test.ts` "should run superRefine validation even
when base schema validation fails when 'when' is defined and returns true". Saját mérés a telepített
verzión: a `NaN` `maxIterations` mellett a `when` nélküli finomítás nem fut (egy hiba), a `when`
feltétellel fut (három hiba), a `ReplaceGraphRequestSchema` útvonalain is.

### 45.6 Az e2e lefedettség előtte és utána

Saját mérés, a 6. szekció eljárásával (`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e
apps/web/test-results`, nyolc egymás utáni shard `flock` alatt, legfeljebb 3 workerrel, majd
`bun run coverage:e2e:report`, a darabszámok a `nyc report --reporter=json-summary` kimenetéből).
Előtte a `main` `45f5af5` állapota: **515 teszt, mind zöld** (65 + 65 + 65 + 64 + 64 + 64 + 64 + 64).
Utána a jelen ág: **526 teszt, mind zöld** (66 + 66 + 66 + 66 + 66 + 66 + 65 + 65), a riport exit 0
a meglévő küszöbbel.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1855 / 1870            | 1855 / 1870           | 15 -> 15                 |
| branches   | 850 / 861              | 850 / 861             | 11 -> 11                 |
| functions  | 625 / 628              | 625 / 628             | 3 -> 3                   |
| lines      | 1783 / 1798            | 1783 / 1798           | 15 -> 15                 |

A lépés termékkódot nem módosít, tehát az összes darabszám sem változott.

**A 45.5 javítása után** (ugyanaz az eljárás, 2026-10-16): **536 teszt, mind zöld** (8 x 67), a riport
exit 0 a meglévő küszöbbel. A javítás a `packages/protocol` csomagban áll, ami az `apps/web` e2e
istanbul hatókörén kívül esik (a `vite-istanbul-include-invariant` az `apps/web` saját `src/**/*`
mintáját rögzíti), az `apps/web` termékkódja nem változott: a négy metrika fedett és összes darabszáma
(1855 / 1870, 850 / 861, 625 / 628, 1783 / 1798) és a fedetlen darab (15, 11, 3, 15) változatlan, a
fedetlen helyek ugyanazon a hat fájlon állnak. A fedetlen helyek
ugyanazon a hat fájlon állnak, mint a 27. szekcióban (`mount-app.tsx` 3/2/0/3,
`read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1,
`browser-history-location-port.ts` 1/0/1/1, `perform-route-request.ts` 1/1/0/1,
`use-stream-connection.ts` 1/0/1/1). Az `apps/web/package.json` küszöbe nem változott.

### 45.7 Nem ellenőrzött

- A 74. kritérium sorrendjének a Visszavonás és az Újra gombhoz viszonyított része: a két gomb a
  párhuzamos T-009-51 lépéssel érkezik; a teszt a "Hozzáadás" utáni szomszédot állítja (a "Mentés"
  split button csoportja), ami a két gomb beérkezése után is igaz. A teljes sorrend e2e-je a 103.
  kritériumé.
- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- A böngésző saját helyi menüjének megjelenése: fejnélküli Chromiumban nem látható; a tiltását a
  `defaultPrevented` értéke igazolja, a menü kirajzolását nem.

## T-009-51

A visszavonás és az újra elvégzés (SPEC-008 5.10, O-22): a történet tiszta függvénye, a billentyű
szűrő, a figyelő, a rögzítés bekötése és a lábléc két ikon gombja. A lépés a lábléc szélességén
megállt (51.6): a két gomb a spec szerinti helyén 320 pixelen nem fért ki. **Lezárva a user két
2026-10-16-i döntésével (51.8):** a "Futás indítása" keskenyen ikon gomb, és a mentés alatt a
billentyű sem von vissza.

### 51.1 Források

**A `KeyboardEvent.key` és a `code`.**

- W3C UI Events KeyboardEvent key Values (Recommendation, 2025-04-22),
  <https://www.w3.org/TR/uievents-key/>: a `key` értéke a glif módosítón kívüli módosítók nélkül
  leütött karakter ("Set key to the key string that would have been generated by this event if it
  had been typed with all modifer keys removed except for glyph modifier keys"), a példák szerint
  amerikai kiosztáson a `Q` billentyűé `"q"`, `Shift` mellett `"Q"`, a `Control` + `Q` értéke
  `"q"`, Dvorak kiosztáson ugyanez a fizikai billentyű `"5"`.
- MDN, `KeyboardEvent: key property`,
  <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key>: a `key` a módosítók (például
  a `Shift`) és a kiosztás figyelembevételével adott érték; a `B` billentyűé `"b"`, `Shift` mellett
  `"B"`.
- MDN, `KeyboardEvent: code property`,
  <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code>: a `code` a fizikai
  billentyű, kiosztástól és módosítótól független; a `"KeyQ"` QWERTY-n a `Q`, Dvorakon az
  aposztróf, AZERTY-n az `A` billentyű, ezért a leütött karakterhez a `key` kell.
- W3C UI Events, Keyboard Events, <https://w3c.github.io/uievents/split/keyboard-events.html>: a
  `key` a billentyű értéke az összes módosító (például a shift állapot) után, a `code` a fizikai
  billentyű, a `ctrlKey`, `shiftKey`, `altKey` és `metaKey` a módosítók állapota.

Következmény a kódban (`resolve-undo-shortcut.ts`): a döntés a `key` kisbetűs alakján és a
`shiftKey` állapotán áll, mert a `Shift` és a bekapcsolt `CapsLock` a `key` értékét nagybetűre váltja,
a `Ctrl` nem; a `code` mezőt a szűrő típusa sem tartalmazza.

**A React `onBlur` buborékol.** A beállítás panel a mező menetét a gyökér `<aside>` elem `onBlur`
eseményén zárja, ami a panel minden mezőjének elhagyásakor fut.

- react.dev, Common components, <https://react.dev/reference/react-dom/components/common>: "Unlike
  the built-in browser blur event, in React the onBlur event bubbles."
- React v17.0 Release Candidate,
  <https://legacy.reactjs.org/blog/2020/08/10/react-v17-rc.html>, és a v17.0.0 kiadási jegyzék,
  <https://github.com/facebook/react/releases/tag/v17.0.0>: az `onFocus` és az `onBlur` a natív
  `focusin` és `focusout` eseményen fut (facebook/react#19186).

**A szöveg mező natív visszavonása.**

- W3C Input Events Level 2, <https://www.w3.org/TR/input-events-2/>: a `beforeinput` és az `input`
  esemény a `textarea` és a szöveges `input` elemen is szerkesztési hoszton fut, és a `historyUndo`
  ("undo the last editing action") és a `historyRedo` a szabványos `inputType` értékek között áll.
- MDN, `InputEvent: inputType property`,
  <https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/inputType>: a teljes lista a fenti
  spec Attributes szekciója.
- w3c/editing#509, <https://github.com/w3c/editing/issues/509>: a böngészőnek saját, natív
  visszavonás vereme van, a `historyUndo` csak akkor fut, ha abban van bejegyzés.

A szűrő ezért beviteli célponton nem lép működésbe és `preventDefault()` sem fut, tehát a natív
visszavonás érintetlen. **Nem ellenőrzött**, hogy a vezérelt React mezőn a natív visszavonás
ténylegesen visszaállítja-e az értéket: a SPEC-008 5.10 szerint a PLAN-009 T-009-53 méri.

**A telepített forrás** (saját olvasás, 2026-10-15):

- `@xyflow/system` 0.0.82, `dist/esm/index.js` 914-923. sor: az `isInputDOMNode` célpontja a
  `composedPath()` első eleme (`|| event.target` tartalékkal), beviteli az `INPUT`, `SELECT`,
  `TEXTAREA` nevű, a `contenteditable` attribútumú, és a `.closest('.nokey')` találatú elem. A saját
  szűrő ugyanezt a kört és célpontot használja; a tartalék ág egy `composedPath` nélküli
  környezetre szól, a projekt egyetlen e2e motorja (Chromium) és a happy-dom unit környezet
  ezen a hívásán fut, tehát a tartalék ág nálunk sosem futna, és nincs a kódban.
- `@xyflow/react` 12.11.6, `dist/esm/index.js` 3504. sor: az `updateNodePositions(nodeDragItems,
dragging = false)` minden pozíció változásba a `dragging` értéket írja. A húzás közben `true`
  (`@xyflow/system` `XYDrag`, `updateNodes`), a húzás végén, ha a pozíció változott, egyetlen
  `false` (`XYDrag` `end` ága), kattintásra (a `nodeDragThreshold` alatt) egy sem. A nyilas
  billentyűs mozgatás (`useMoveSelectedNodes`, 1767. sor) a `dragging` paraméter nélkül hív, tehát
  `false`. A vászon ezért a `dragging: true` változást nyitott, a `false` változást záró mozgatási
  menetnek adja át (`GraphEditorCanvas.tsx`), és a billentyűs mozgatás nyomásonként egy lépés.

### 51.2 A `nokey` kérdés

A 44.6 szekció utolsó pontja nyitva hagyta, hogy a panel gyökerének `nokey` osztálya a
visszavonás billentyűt is kiszűri. A SPEC-008 azóta kimondja: az 5.9 "A panel teljes területén a
billentyű nem töröl" bekezdése szerint "Az 5.10 első szabálya a visszavonás billentyűt ugyanerre a
körre szűri (a `.nokey` is benne van), tehát a panelen belül lenyomott `Ctrl+Z` sem hat a gráfra",
és a 102. kritérium unit része a `.nokey` célpont kiszűrését írja elő. Ellentmondás tehát nincs; a
megvalósítás ezt követi. A panelből a gráf a vászonra kattintva (a mező elhagyása után) vagy a
Visszavonás gombbal vonható vissza; a gomb kattintása előbb a mező `blur` eseményét adja, tehát a
mező menete a visszavonás előtt lezárul.

### 51.3 A megvalósítás döntései

- **A dokumentum és a történet egy állapot** (`GraphEditorScreen`, `GraphEditHistory`). Minden gráf
  változás függvény alakú frissítéssel, a korábbi dokumentumból rögzül, tehát egy renderbe vont két
  változás sem veszít lépést (szabálykönyv 12. szekció, "legutolsó érték alakú React állapot").
- **Lépések:** a felvétel (mindkét út egy kezelőn), a panel "Törlés" gombja és a billentyűs törlés
  (`onDelete`, egyetlen `onGraphChange`), az él létrehozás és az automatikus elrendezés menet nélküli,
  önálló lépés; a mozgatás a fenti mozgatási menet; a mező a csomópont szerinti kulcsú menet, amit a
  panel `onBlur` eseménye zár. Bármely más rögzítés, a visszavonás és az újra elvégzés is lezárja a
  nyitott menetet.
- **Kiválasztás:** ha a kiválasztott csomópont nincs a dokumentumban, egy hatás a kiválasztást
  megszünteti, tehát egy későbbi újra elvégzés sem nyitja meg újra a panelt.
- **Mentés:** sikeres mentés után a történet a jelenlegi dokumentumról üres listákkal újraindul; a
  sikertelen mentés a listákat nem érinti.
- **A két gomb:** `Button` `size="sm"`, `variant="secondary"` (a lábléc "Hozzáadás" ikon gombjának
  mintája), `icon`, `aria-label`, a vendorolt `lucide@0.525.0` `Undo2` és `Redo2` útvonal adata
  (saját olvasás: `lucide.min.js`, `Undo2` = `M9 14 4 9l5-5`, `M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5
5.5 0 0 1-5.5 5.5H11`; `Redo2` = `m15 14 5-5-5-5`, `M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0
9.5 20H13`), a `Tooltip` `shortcut` propjával. Tiltott, ha a lista üres, és a betöltés vagy a
  mentés alatt; a billentyű a mentés alatt sem hat (51.8).
- **A modális szabály (5.10, 4. pont)** a megerősítő modálissal együtt a T-009-52 lépésé; ma a
  szerkesztőben ilyen modális nincs.

### 51.4 Unit teszt és rontás igazolás

Új spec fájlok: `graph-edit-history.spec.ts` (15 teszt), `resolve-undo-shortcut.spec.ts` (20),
`use-undo-redo-shortcut.spec.tsx` (3); bővítve: `GraphEditorScreen.spec.tsx` (+15),
`GraphEditorCanvas.spec.tsx` (+2), `NodeInspector.spec.tsx` (+1). A `bun run test` 577 fájl, 5287
teszt, 100 százalék mind a négy metrikán.

Ideiglenes rontások (saját, 2026-10-15, utána visszaállítva): a mező menet kulcsának elhagyása
(`handleUpdateNode` menet nélkül) a mező menet tesztjét, a kiválasztás megszüntető hatás kiiktatása
a felvétel visszavonás tesztjét, a szűrő `.nokey` ágának törlése a `.nokey` célpont tesztjét buktatja
el; az eredeti alakon mindhárom zöld.

### 51.5 Az e2e lefedettség előtte és utána

Előtte: a `main` `45f5af5` állapotán saját mérés, `rm -rf apps/web/e2e/.nyc_output
apps/web/coverage-e2e apps/web/test-results` után nyolc egymás utáni shard `flock` alatt, legfeljebb
3 workerrel, **515 teszt, mind zöld** (65 + 65 + 65 + 64 + 64 + 64 + 64 + 64), majd
`bun run coverage:e2e:report` (exit 0).

Utána: a jelen ág ugyanazzal az eljárással, **516 teszt** (az új
`apps/web/e2e/graph-editor-undo.spec.ts`, egy teszt: egy felvétel visszavonása és újra elvégzése a
`Ctrl+Z`, a `Ctrl+Y`, a `Ctrl+Shift+Z` billentyűvel és a két gombbal, az üres listán hatástalan
billentyűvel), ebből **egy bukik**: a `responsive.spec.ts` lábléc tesztje 320 pixelen (51.6). A
`bun run coverage:e2e:report` exit 0 a meglévő küszöbbel.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1855 / 1870            | 1902 / 1917           | 15 -> 15                 |
| branches   | 850 / 861              | 887 / 898             | 11 -> 11                 |
| functions  | 625 / 628              | 649 / 652             | 3 -> 3                   |
| lines      | 1783 / 1798            | 1832 / 1847           | 15 -> 15                 |

A fedetlen helyek mindkét állapoton ugyanazon a hat fájlon állnak (`nyc` json-summary, utasítás /
ág / függvény / sor): `mount-app.tsx` 3/2/0/3, `read-frontend-config.ts` 8/7/1/8,
`is-valid-connection.ts` 1/1/0/1, `browser-history-location-port.ts` 1/0/1/1,
`perform-route-request.ts` 1/1/0/1, `use-stream-connection.ts` 1/0/1/1. Az `apps/web/package.json`
küszöbe nem változott.

### 51.6 A lábléc szélessége: a két gomb 320 pixelen nem fér ki

(Az állapot a lezárás előtti, a `146551c` commité; a döntés és a lezárás utáni mérés az 51.8
szekcióban áll.)

Saját mérés, 2026-10-15, valódi Chromium, a `responsive.spec.ts` szerkesztő fixtúrájával, a
gombok `boundingBox()` értéke (bal-jobb pixel) és a lábléc `scrollWidth - clientWidth` különbsége.
A gombsor szélessége a lábléc akciósávjáé. Az "A" oszlop a spec szerinti hely (Futás indítása,
Visszavonás, Újra, Hozzáadás, Mentés split button):

| Szélesség | Gombsor | Lábléc túllógás | Mentés (bal-jobb) | További műveletek (bal-jobb) |
| --------- | ------- | --------------- | ----------------- | ---------------------------- |
| 320       | 326     | 42              | 269-335           | 334-362                      |
| 340       | 326     | 22              | 269-335           | 334-362                      |
| 360       | 326     | 2               | 269-335           | 334-362                      |
| 375       | 326     | 0               | 269-335           | 334-362                      |
| 393       | 326     | 0               | 276-342           | 341-369                      |
| 640       | 326     | 0               | 523-589           | 588-616                      |
| 641       | 405     | 0               | 524-590           | 589-617                      |

A gombok szélessége: "Futás indítása" 101, a három ikon gomb egyenként 28, a split button 93
pixel, a gombok közti rés 12. 320 pixelen a "Mentés" `toBeInViewport` aránya 0,773, a nyíl gomb
teljesen kilóg; a teljes e2e futásban a `responsive.spec.ts` lábléc tesztje pontosan itt bukik
("viewport ratio 0.7727272510528564"). A támogatott szélességek közül csak a 320 bukik, 375
pixeltől minden gomb a nézetablakban áll.

Két, a döntéshez készült, nem commitolt mérés (a kód utána visszaállítva):

- "Futás indítása" ikon gombként a `--ep-screen-sm` alatt (a "Hozzáadás" mintájára): a gombsor 253
  pixel, 320 pixelen a legszélső gomb jobb széle 296, a lábléc túllógás 0.
- Az akciósáv tördelése (`flex-wrap`): 320 ... 375 pixelen két sor, a lábléc magassága 45 helyett
  85 pixel, a "Mentés" és a nyíl gomb a második sorban, túllógás 0.

### 51.7 Nem ellenőrzött

- A vezérelt mező natív visszavonásának tényleges viselkedése, a tipp egérrel elérhetősége és a
  hét művelettípus e2e-je: a PLAN-009 T-009-53 lépése.
- A tiltott gombon a `Tooltip` egér alatti nyitása: a tiltott gomb nem kap fókuszt, és az egér
  eseményeit nem mértük.
- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- A `Button` várakozás jelzése (`isLoading`) a négyzetes ikon gombon: a `button.css` a három
  pöttyöt `position: absolute; inset: 0` alakban középre teszi (forrásolvasás), vizuálisan nem
  mértem. A "Futás indítása" gomb sikeres indítás után a futás nézetre navigál, tehát a jelzés
  rövid ideig látszik.
- A "Futás indítása" ikon gomb tippje: nincs, a "Hozzáadás" ikon gombhoz hasonlóan (a user
  döntése "ahogy a Hozzáadás"); a név az `aria-label`.

### 51.8 A lábléc és a mentés alatti billentyű: a két user döntés (2026-10-16)

**A döntések**, szó szerint:

1. A 320 pixeles lábléc (51.6): "A 'Futás indítása' is ikon gomb lesz keskenyen, ahogy a
   'Hozzáadás'." Az 51.6 két mért alternatívája közül ez a "Futás indítása" ikon gombja; a
   `flex-wrap` tördelés nem készült el.
2. A billentyű a mentés alatt: "Mentés közben a billentyű sem von vissza, ahogy a gomb sem."

**A megvalósítás.**

- A "Hozzáadás" gomb konstansa és hookja két gombé lett, ezért átnevezve (`git mv`):
  `footer-compact-media-query.ts` (`FOOTER_COMPACT_MEDIA_QUERY`) és `use-is-footer-compact.ts`
  (`useIsFooterCompact`), a spec fájlokkal együtt. A literál változatlanul a `--ep-screen-sm` token
  értéke, a regressziós teszt (`footer-compact-media-query.spec.ts`) a `breakpoints.css` fájlból
  olvassa vissza. A `GraphEditorScreen` egyszer hívja a hookot, és az értéket átadja az
  `AddNodeMenuButton` `isCompact` propjának és a "Futás indítása" gombnak.
- A "Futás indítása" gomb a token szélességén és alatta `icon` (`.btn--icon`), `aria-label="Futás
indítása"`, tartalma a `PlayIcon`; a `disabled`, az `isLoading` és az `onClick` nem változott.
- A billentyű szűrő: `resolveUndoShortcut(event, { isSaving })`, futó mentésnél `undefined`,
  `preventDefault()` sem fut. A `useUndoRedoShortcut(onShortcut, isSaving)` a `saveState`
  állapotából kapja az értéket, a figyelő az `isSaving` váltásakor újrakötődik. Sikertelen mentés
  után a listák érintetlenek, a billentyű ismét hat; sikeres mentés után a listák üresek.

**Az ikon: lucide `Play`.** A vendorolt `lucide@0.525.0` készlet (`lucide.min.js`, a fejléc
`lucide v0.525.0`) `Play` kulcsa `["polygon",{points:"6 3 20 12 6 21 6 3"}]` (saját olvasás).
Megerősítés két független helyről, mindkettő a 0.525.0 verziót adja és ugyanezt a poligont:
a `lucide-static@0.525.0` npm csomag `icons/play.svg` fájlja
(<https://unpkg.com/lucide-static@0.525.0/icons/play.svg>, ugyanez a jsDelivr tükrön:
<https://cdn.jsdelivr.net/npm/lucide-static@0.525.0/icons/play.svg>), és a GitHub `0.525.0` címke
`icons/play.svg` fájlja
(<https://raw.githubusercontent.com/lucide-icons/lucide/0.525.0/icons/play.svg>). Az ikon
kiválasztása ízlés kérdése, dokumentált szabály nincs rá; a "Futás indítása" gomb szokásos jele.
24x24 viewBox, 1.75 vonalvastagság, a repó meglévő inline SVG konvenciója szerint (`aria-hidden`).

**A lábléc mérése.** A mérő eszköz a repóban van: `apps/web/measurement/footer-width.ts`
(`bun run measure:footer-width`), a bemutató szerkesztő fixtúrájával (`e2e/showcase-graph.ts`),
valódi Chromium. A hat gomb `boundingBox()` értékéből a gombsor szélessége (az első gomb bal és az
utolsó gomb jobb széle között), és a legkijjebb álló gomb jobb szélének túllógása a nézetablakhoz
képest; a lábléc `scrollWidth - clientWidth` különbsége. Az "előtte" sor ugyanezzel az eszközzel,
a "Futás indítása" gombot ideiglenesen szöveges alakban tartva készült (a kód utána
visszaállítva), és pontosan az 51.6 számait adja (326 pixel, 42 pixel túllógás 320 pixelen), tehát
az eszköz az akkori, nem commitolt méréssel egyezik.

| Szélesség | Gombsor előtte | Túllógás előtte | Gombsor utána | Túllógás utána | Legkijjebb álló jobb szél utána |
| --------- | -------------- | --------------- | ------------- | -------------- | ------------------------------- |
| 320       | 326            | 42              | 253           | 0              | 296                             |
| 340       | 326            | 22              | 253           | 0              | 316                             |
| 360       | 326            | 2               | 253           | 0              | 336                             |
| 375       | 326            | 0               | 253           | 0              | 351                             |
| 393       | 326            | 0               | 253           | 0              | 369                             |
| 640       | 326            | 0               | 253           | 0              | 616                             |
| 641       | 405            | 0               | 405           | 0              | 617                             |

320 pixelen a gombok (bal-jobb): "Futás indítása" 43-71, "Visszavonás" 83-111, "Újra" 123-151,
"Hozzáadás" 163-191, "Mentés" 203-269, "További műveletek" 268-296. A lábléc `scrollWidth -
clientWidth` különbsége minden szélességen 0.

**Unit teszt.** `resolve-undo-shortcut.spec.ts` 20 -> 23 (a `Ctrl+Z`, a `Ctrl+Shift+Z` és a `Ctrl+Y`
futó mentésnél nem kezelt, mentés nélkül ugyanaz kezelt), `use-undo-redo-shortcut.spec.tsx` 3 -> 4
(mentés alatt nincs hívás és `preventDefault`, a mentés végén ismét hat), `GraphEditorScreen.spec.tsx`
+3 (szűk nézetben a "Futás indítása" `.btn--icon`, `btn--sm`, `aria-label`, üres szöveg, `polygon`
az ikonban, és a kattintása elindítja a futást; sikertelen mentés után a billentyű visszavon;
futó mentés alatt a `Ctrl+Z`, a `Ctrl+Shift+Z` és a `Ctrl+Y` sem hat, a két lista nem üres). A
"szűk nézet" teszt csoport kikerült a "csomópont felvétel" csoportból, mert két gombot fed. A
`bun run test`: 577 fájl, 5294 teszt, 100 százalék mind a négy metrikán.

**Rontás igazolás** (saját, 2026-10-16, utána visszaállítva): a `state.isSaving ||` törlése a
szűrőből 5 tesztet buktat (3 a szűrőé, 1 a hooké, 1 a képernyőé); a `useUndoRedoShortcut` hívásban
az `isSaving` helyén `false` a képernyő mentés tesztjét; a "Futás indítása" gomb szöveges alakra
kényszerítése a képernyő szűk nézet tesztjét, és e2e-ben a `responsive.spec.ts` két tesztjét
(a lábléc teszt 320 pixelen: `viewport ratio 0.7727272510528564`, a 51.6-ban mért érték; a token
szélességű teszt: `Expected pattern: /btn--icon/`, `Received string: "btn btn--secondary
btn--sm"`).

**E2E.** `responsive.spec.ts`: a lábléc teszt hat gombra bővült (a "Visszavonás" és az "Újra"
is `toBeInViewport({ ratio: 1 })` minden támogatott szélességen), a "Hozzáadás" token határ tesztje
a "Futás indítása" gombra is kiterjed (a token szélességén `.btn--icon`, üres szöveg, látható
`svg`; egy pixellel fölötte szöveg és `.btn--icon` nélkül). A teljes e2e, az 51.5 eljárásával
(nyolc shard, `flock` alatt): **516 teszt, mind zöld** (65 + 65 + 65 + 65 + 64 + 64 + 64 + 64),
`bun run coverage:e2e:report` exit 0 a meglévő küszöbbel (`nyc`: statements 99.21, branches 98.78,
functions 99.54, lines 99.18).

| Metrika    | Fedett / összes | Fedetlen: `main` `45f5af5` (51.5) -> most |
| ---------- | --------------- | ----------------------------------------- |
| statements | 1903 / 1918     | 15 -> 15                                  |
| branches   | 892 / 903       | 11 -> 11                                  |
| functions  | 650 / 653       | 3 -> 3                                    |
| lines      | 1833 / 1848     | 15 -> 15                                  |

A fedetlen helyek ugyanazon a hat fájlon, ugyanazokkal a darabszámokkal állnak, mint az 51.5-ben
(`mount-app.tsx` 3/2/0/3, `read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1,
`browser-history-location-port.ts` 1/0/1/1, `perform-route-request.ts` 1/1/0/1,
`use-stream-connection.ts` 1/0/1/1). Az `apps/web/package.json` küszöbe nem változott.

## T-009-52

A változtatások elvetése és az elnavigálás megerősítése (SPEC-008 5.10, O-22): a "Változtatások
elvetése" menüpont, a `history-navigation` navigációs őre és a regisztráció továbbadása az
`app-shell`-ben, a megerősítő `Modal` a szerkesztőben, a `beforeunload` figyelő a mentetlen
változás idejére, és a billentyű szűrő 4. szabálya. A böngésző vissza és előre gombja (O-30) a
T-009-57, a betöltés normalizálása a T-009-55, a teljes O-22 e2e a T-009-53 lépése.

### 52.1 Források

**A `beforeunload` párbeszéd.** Három egybehangzó forrás szerint a figyelőben hívott
`preventDefault()` a böngésző saját megerősítő párbeszédét kéri, a szöveg nem vezérelhető, és a
párbeszéd csak a lapon történt felhasználói interakció (sticky activation) után jelenik meg:

- MDN, `beforeunload` (<https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event>):
  a párbeszéd kiváltható a `preventDefault()` hívással; a `returnValue` beállítása és a visszatérési
  érték régi (legacy) út; a figyelőt csak mentetlen változás idejére ajánlja felvenni.
- WHATWG HTML, "steps to fire `beforeunload`"
  (<https://html.spec.whatwg.org/multipage/browsing-the-web.html>): a párbeszéd feltétele, hogy az
  esemény kiváltásának eredménye hamis (a `preventDefault()` hívás) vagy a `returnValue` nem üres,
  és a dokumentum globális objektumának van sticky activationje; a megjelenő üzenetet a böngésző
  adja, a `returnValue` értéke figyelmen kívül marad.
- Chromium, "Intent to Ship: Change beforeunload handler dialog condition"
  (<https://groups.google.com/a/chromium.org/g/blink-dev/c/yi3GzzB6AtI>): a Chrome a
  `preventDefault()` hívásra is megerősítő párbeszédet mutat; az MDN példája szerint ez a Chrome 119
  óta áll ("Included for legacy support, e.g. Chrome/Edge < 119").

A megvalósítás a SPEC-008 5.10 2. pontja szerint kizárólag `preventDefault()` hívást tesz; a
`returnValue` régi útját nem állítja.

**A Playwright `beforeunload` párbeszéde.** A Playwright Dialogs oldala
(<https://playwright.dev/docs/dialogs>): a `page.close({ runBeforeUnload: true })` lefuttatja az
unload kezelőket, és ilyenkor nem várja meg a lap bezárását, mert a lap nyitva maradhat; a
párbeszéd `dialog.type() === 'beforeunload'` alakban kezelhető. Saját mérés (valódi Chromium,
2026-10-17, `graph-editor-discard-navigation.spec.ts`): egy "Hozzáadás" menüből felvett csomópont
után a hívás `beforeunload` típusú párbeszédet ad, tehát a Playwright kattintása sticky activationt
ad; a `dialog.dismiss()` után a lap nyitva marad, a vászon két csomópontja megvan, és a lefedettségi
fixtúra a teszt végén kiolvassa a lefedettséget.

### 52.2 A megvalósítás döntései

- **A navigációs őr** (`use-client-route.ts`): `NavigationGuard = (proceed: () => void) => void`,
  a `registerNavigationGuard` ref-ben tartja, egyszerre egyet; a visszaadott függvény eltávolítja.
  Regisztrált őrnél a `navigate` sem `pushState`-et nem hív, sem az állapotot nem frissíti, hanem a
  végrehajtást (`proceed`) adja az őrnek; a `proceed` ugyanazt teszi, amit őr nélkül a `navigate`
  tenne. Őr nélkül a kód útja a korábbi, a meglévő `use-client-route` tesztek változatlanul zöldek.
  Az eltávolító feltétel nélkül töröl: az egyetlen regisztráló a szerkesztő képernyő, aminek a
  hatás takarítása mindig az újraregisztrálás előtt fut, tehát egy "csak a saját őrét" ág sem
  unit, sem e2e úton nem futna a termékben.
- **A szerkesztő** a mentetlen jelző (`isGraphDirty`) igaz értéke alatt regisztrál, az őr a
  megerősítésre váró navigációt állapotba teszi, és a `NavigationConfirmationModal` addig áll a
  DOM-ban. A "Kilépés mentés nélkül" a `proceed`-et hívja, a "Mégse", a fejléc bezárás gombja és az
  `Escape` a modálist zárja; a gombok sorrendje és változata (`secondary`, `danger`) és a "Bezárás"
  felirat a `delete-workflow-modal.tsx` mintája, amire a SPEC-008 5.10 1. pontja hivatkozik. A
  gombok nem `sm` méretűek.
- **A `beforeunload`** a `useBeforeUnloadPrompt(isDirty)` hookban: hamis értéknél figyelő nincs.
- **A billentyű szűrő 4. szabálya**: a `UndoShortcutState` új mezője, az
  `isNavigationConfirmationOpen`; igaz értéknél a szűrő `undefined`-et ad, tehát `preventDefault()`
  sem fut. A szerkesztő a megerősítésre váró navigáció meglétét adja át.
- **A kiinduló dokumentum** a történet új mezője (`initialDocument`), a `startGraphEditHistory`
  második, elhagyható paramétere. Betöltéskor a betöltött dokumentum vetítése; sikeres mentés után a
  mentett dokumentum vetítése (a `PUT` válasza), mert a mentés futása alatt a vászon szerkeszthető,
  és a SPEC-008 5.10 a kiinduló dokumentumot "mentés után a mentett dokumentum"-ként határozza meg.
  A mentés alatti szerkesztés a jelenlegi dokumentumban marad, mindkét lista üres.
- **Az elvetés** (`discardGraphEdits`) a `recordGraphEdit` hívása a kiinduló dokumentummal, tehát
  egy lépés: a nyitott menetet lezárja, az újra listát kiüríti, és egy visszavonás a korábbi
  dokumentumot hozza vissza. A menüpont tiltott, ha a jelenlegi dokumentum tartalmilag (a
  `JSON.stringify` alakon, az `is-graph-dirty.ts` érvével) azonos a kiinduló dokumentummal
  (`canDiscardGraphEdits`). A kiválasztás a meglévő hatáson át szűnik meg, ha a kiválasztott
  csomópont az elvetés után nincs a dokumentumban.

### 52.3 Unit teszt és rontás igazolás

Új spec fájlok: `NavigationConfirmationModal.spec.tsx` (3), `use-before-unload-prompt.spec.tsx`
(4); bővítve: `use-client-route.spec.tsx` (+5), `graph-edit-history.spec.ts` (+6),
`resolve-undo-shortcut.spec.ts` (+3), `use-undo-redo-shortcut.spec.tsx` (+1),
`GraphEditorScreen.spec.tsx` (+8), `app-shell.spec.tsx` (+1). A `bun run test` 579 fájl, 5344
teszt, 100 százalék mind a négy metrikán.

Ideiglenes rontások (saját, 2026-10-17, utána visszaállítva): a szerkesztő őr hatásából a
`!isDirty` feltétel törlése két képernyő tesztet (őr és figyelő mentetlen változás nélkül, illetve
mentés után) buktat; a szűrő 4. szabályának törlése öt tesztet (három a szűrőé, egy a hooké, egy a
képernyőé); az elvetés lépés nélküli alakja (a dokumentum cseréje rögzítés nélkül) három tesztet
(kettő a történeté, egy a képernyőé). Az eredeti alakon mind zöld.

### 52.4 Az e2e lefedettség előtte és utána

Előtte: a `main` `68055bd` állapotán saját mérés, `rm -rf apps/web/e2e/.nyc_output
apps/web/coverage-e2e apps/web/test-results` után nyolc egymás utáni shard `flock` alatt,
legfeljebb 3 workerrel, **537 teszt, mind zöld** (68 + 67 + 67 + 67 + 67 + 67 + 67 + 67), majd
`bun run coverage:e2e:report` (exit 0).

Utána: a jelen ág ugyanazzal az eljárással, **540 teszt, mind zöld** (68 + 68 + 68 + 68 + 67 + 67

- 67 + 67); az új `apps/web/e2e/graph-editor-discard-navigation.spec.ts` három tesztje: az elvetés
  és a visszavonása, a belső navigáció megerősítése mindkét gombbal (a felső navigáció és a
  morzsamenü linkjén, nyitott modálisnál hatástalan `Control+z` billentyűvel), és a `beforeunload`
  párbeszéd. `bun run coverage:e2e:report` exit 0 a meglévő küszöbbel.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1903 / 1918            | 1942 / 1957           | 15 -> 15                 |
| branches   | 892 / 903              | 899 / 910             | 11 -> 11                 |
| functions  | 650 / 653              | 667 / 670             | 3 -> 3                   |
| lines      | 1833 / 1848            | 1872 / 1887           | 15 -> 15                 |

A fedetlen helyek mindkét állapoton ugyanazon a hat fájlon állnak (utasítás / ág / függvény / sor):
`mount-app.tsx` 3/2/0/3, `read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1,
`browser-history-location-port.ts` 1/0/1/1, `perform-route-request.ts` 1/1/0/1,
`use-stream-connection.ts` 1/0/1/1. Egy köztes futás a nyitott modálisnál lenyomott billentyű
nélkül a `resolve-undo-shortcut.ts` 4. szabályát fedetlenül hagyta (16/12/3/16); a második teszt
billentyű lépése ezt zárja. Az `apps/web/package.json` küszöbe nem változott.

### 52.5 A megerősítő modális címe és törzse (lezárva)

A SPEC-008 5.10 1. pontja a modális két gombját rögzítette ("Kilépés mentés nélkül", "Mégse"), a
címét és a törzsét nem; a megvalósítás ideiglenesen a lábléc státuszának "Mentetlen változtatások"
szövegét használta címként, törzs nélkül. **User döntés (2026-10-17):** a cím "Kilépés mentés
nélkül?", a törzs "A mentetlen változtatások elvesznek."; a gombok szövege változatlan. A döntés a
SPEC-008 5.10 1. pontjába és a 105. kritériumba átvezetve; a `NavigationConfirmationModal` a törzset
a `Modal` gyerekeként, `<p>` elemben rajzolja (a `delete-workflow-modal.tsx` mintája). A unit
(`NavigationConfirmationModal.spec.tsx`) és az e2e
(`graph-editor-discard-navigation.spec.ts`) a címet és a törzset állítja.

### 52.6 Nem ellenőrzött

- A `beforeunload` párbeszéd a kézzel beírt címre és az újratöltésre: csak a
  `page.close({ runBeforeUnload: true })` út mérve; a többi a T-009-53 lépése.
- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- A böngésző vissza és előre gombja mentetlen változásnál: ma megerősítés nélkül vált (a
  `popstate` ág az őrt nem kérdezi), és a T-009-57 lépése.

### 52.7 A változtatások elvetése mentés közben

A review hibát talált: a "Változtatások elvetése" menüpont mentés közben is választható volt, miközben
a Visszavonás gomb tiltott. A review mérése szerint mentés közben elvetve a `PUT` a régi állapotot
mentette, a képernyő viszont az elvetett állapotot mutatta "Mentetlen változtatások" jelzéssel. A user
2026-10-16-i döntése szerint mentés közben se a gomb, se a billentyű nem von vissza (SPEC-008 5.10, a
billentyűk 5. szabálya); az elvetés ugyanennek a szándéknak felel meg. Javítás: a menüpont `disabled`,
ha `isSaving`. Unit teszt: `GraphEditorScreen.spec.tsx`, "a mentés alatt a menüpont tiltott...";
a mentés indítása után a menüpont tiltott, a kattintás nem változtat a dokumentumon. **Rontás
igazolás:** az `isSaving ||` elhagyásával a fájl tesztjei közül pontosan ez az egy bukik (1 bukott, 57
sikeres), a javított állapoton mind a 58 zöld.

## T-009-53

A D1 e2e és mérés lépése az O-22-re (SPEC-008 5.10; a 101 ... 105. kritérium e2e része) valós
Chromiumban, a szándékos rontásokkal. A szekciók számozása `53.x`, a T-009-45 mintájára. A mérések
a Playwright 1.62.1 által telepített Chromiumon futottak (Chrome for Testing 151.0.7922.34, a
`playwright-core` `browsers.json` szerint), fejnélküli módban, Linuxon, a nem macOS felhasználói
ügynökkel (`Ctrl` módosító, O-31).

### 53.1 A kiindulás: mit fedett már a meglévő e2e

A `main` `f041052` állapotán:

| Kritérium | Már fedett rész                                                                                                                               | Meglévő teszt                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 101.      | egy felvétel a gombbal, a `Ctrl+Z`, a `Ctrl+Y`, a `Ctrl+Shift+Z` és a két gomb, a csomópontok száma szerint; üres listán hatástalan billentyű | `graph-editor-undo.spec.ts`                                |
| 103.      | a lábléc hat gombja minden támogatott szélességen a nézetablakban; a tipp fókuszra, a `kbd` jelöléssel                                        | `responsive.spec.ts`, `graph-editor-undo-modifier.spec.ts` |
| 104.      | az elvetés a betöltött dokumentumra állít, a jelző eltűnik, a menüpont utána tiltott, egy Visszavonás gomb visszahozza                        | `graph-editor-discard-navigation.spec.ts`                  |
| 105.      | a felső navigáció a "Mégse", a morzsamenü a "Kilépés mentés nélkül" gombbal; nyitott modálisnál hatástalan `Ctrl+Z`; a bezárás párbeszéde     | `graph-editor-discard-navigation.spec.ts`                  |

Hiányzott: a többi hat művelettípus és a jobb klikkes felvétel, a pontos (pozíció és `PUT` törzs
szerinti) visszaállítás, a 102. kritérium egésze, a gombsor sorrendje, a betöltés és a mentés
alatti tiltás, a sikeres mentés utáni tiltás, a tipp egérrel, a menüpont helye, a két link és a két
gomb másik két párosítása, a mentetlen változás nélküli navigáció, és a `beforeunload` párbeszéd
hiánya mentetlen változás nélkül, illetve az újratöltésre és a kézzel beírt címre.

### 53.2 Az új e2e tesztek

- `apps/web/e2e/graph-editor-undo-operations.spec.ts` (új, 12 teszt): kilenc eset (a felvétel a
  gombbal és a jobb klikk menüvel, a törlés billentyűvel és a "Törlés" gombbal, él létrehozás,
  mozgatás, automatikus elrendezés, a beállítás panel mező változása, elvetés). Minden eset után
  hat lépés: `Ctrl+Z`, `Ctrl+Shift+Z`, Visszavonás gomb, `Ctrl+Y`, `Ctrl+Z`, Újra gomb, és minden
  lépés után a vászon, a mentetlen jelző, a két gomb állapota és (menthető állapotban) a `PUT`
  törzs pontosan a művelet előtti, illetve utáni állapot. Mellette a lábléc gombsorának sorrendje,
  a betöltés és a mentés alatti tiltás (a billentyűvel és a "Változtatások elvetése" menüponttal
  együtt), a sikeres mentés utáni tiltás, és a tipp egérrel (53.5).
- `apps/web/e2e/graph-editor-undo-field.spec.ts` (új, 6 teszt): a 102. kritérium két tesztje
  (a szűrő a szöveg területen és a szöveges beviteli mezőn, táblázatosan; a mező menete gombbal és
  billentyűvel), és három mérés teszt (53.3).
- `apps/web/e2e/graph-editor-discard-navigation.spec.ts` (+7): a menüpont helye; a felső
  navigáció a "Kilépés mentés nélkül", a morzsamenü a "Mégse" gombbal, a cím a döntésig változatlan;
  mentetlen változás nélkül (a visszavont változás után is) modális nélküli navigáció; mentetlen
  változás nélkül párbeszéd nélküli bezárás; az újratöltés és a kézzel beírt cím párbeszéde (53.4).
- `apps/web/e2e/graph-editor-undo.spec.ts`: csak a fejléc komment mutat az új fájlokra.

**A vászon és a törzs olvasása.** A vászon állapota a csomópontok `data-id` értéke és a React
Flow által írt `transform` (folyam koordináta, a nagyítástól és a pásztázástól független), és az
élek `data-id` értéke a könyvtár hozzáférhető nevével ("Edge from n1 to n2"), DOM sorrendben. A
`PUT` törzs sikertelen mentéssel olvasható: a mock 500-at ad, és a sikertelen mentés a két listát
nem érinti (SPEC-008 5.10), tehát a mentés után is tovább lehet lépni a történetben. A felvett
csomópont utáni állapot nem menthető, mert a kezdő konfig kötelező mezői üresek (81. kritérium,
45.5), ezért ott a vászon (az új csomópont azonosítója és helye) a bizonyíték; a felvétel előtti
állapot mindkét úton a `PUT` törzzsel is igazolt. Minden eset elején egy horgony: a betöltés utáni
`PUT` törzs pontosan a fixtúra, az időbélyegek nélkül.

**Egy művelet egy lépés.** A mozgatás tíz közbenső pozíció változással megy, a billentyűs törlés a
csomópontot az élével együtt viszi; mindkettőnél egyetlen `Ctrl+Z` a művelet előtti pozíciót,
illetve a csomópontot és az élt adja vissza, és a művelet előtti állapotban a Visszavonás gomb
tiltott (a lista üres). A mező változás kilenc karakteres gépelés, a mező elhagyásáig egy lépés.

### 53.3 A vezérelt mező natív visszavonása (mérés, SPEC-008 5.10 nem ellenőrzött pontja)

Saját mérés (2026-10-17), a lenti eredményeket a `graph-editor-undo-field.spec.ts` három "mérés"
tesztje rögzíti, tehát a repóból újra előállíthatók. A natív művelet a dokumentum `beforeinput`
eseményének `inputType` értékéből látszik (`historyUndo`, `historyRedo`; W3C Input Events Level 2,
<https://www.w3.org/TR/input-events-2/>, és az 51.1 szekció forrásai).

1. **A natív visszavonás a vezérelt mező értékét visszaállítja.** A billentyű szűrő a beviteli
   célponton nem fut (`preventDefault()` sincs), a böngésző `historyUndo`, illetve `historyRedo`
   eseményt ad, a mező értéke változik, és a React `onChange` útján a szerkesztő állapotába jut: a
   mentés `PUT` törzse a mező látható értékét hordozza. Az újra elvégzés (`Ctrl+Shift+Z`, `Ctrl+Y`)
   ugyanígy natív.
2. **A lépés mérete mezőnként más.** A vezérelt szöveg területen (`textarea`, "Prompt sablon") a
   karakterenként begépelt `XYZ` után a `Ctrl+Z` karakterenként lép vissza (`XY`, majd `X`). A
   vezérelt szöveges beviteli mezőn (`input`, "Modell azonosító") ugyanez a gépelés egy lépés (egy
   `Ctrl+Z` után az érték üres). Egy eldobott, nem verziókövetett próba (tájékoztató, a repóban
   nincs eszköze) szerint egy nem vezérelt, a lapra szúrt `textarea` a gépelést egy lépésben vonja
   vissza, tehát a karakterenkénti lépés a vezérelt szöveg területé. Az ok **nem ellenőrzött**: a
   telepített `react-dom` 19.2.8 `updateTextarea` függvénye minden frissítéskor a `defaultValue`
   értéket is írja (`react-dom-client.production.js`, saját olvasás), de hogy a Chromium ettől bontja
   a gépelés lépését, nem mértem.
3. **A natív változás a mező menetébe vonódik.** A menet közbeni natív visszavonás és újra elvégzés
   a nyitott mező menet része: a gráf történetén egy lépés áll, az újra lista üres, és a mező
   elhagyása után egyetlen Visszavonás a teljes menetet (a natív lépésekkel együtt) visszavonja. Ez
   a SPEC-008 5.10 1. szabályának állítása, most mérve.
4. **A natív történet a dokumentum közös története.** Egy szöveg mezőben gépelés, majd egy másik
   szöveg mezőre lépés után a `Ctrl+Z` a korábbi mező utolsó lépését vonja vissza: a "Prompt sablon"
   gépelése után a "Modell azonosító" mezőben lenyomott `Ctrl+Z` a "Prompt sablon" utolsó karakterét
   veszi ki, a `beforeinput` célpontja a nem fókuszált "Prompt sablon". Mivel a "Prompt sablon"
   menete a mező elhagyásakor lezárult, ez a változás új gráf lépés: az első Visszavonás a teljes
   gépelést hozza vissza, a második a kiinduló értéket. A gráf visszavonása közben nem fut.
5. **Üres natív történetnél** a `Ctrl+Z` nem ad `beforeinput` eseményt, a mező és a gráf nem
   változik.

**A 4. pont forrásai.** A Chromium a visszavonás vermét keretenként vezeti, a keret minden
szerkesztésére közösen: "This patch changes UndoStack from per-page to per-frame, so that undos and
redos are consistently resolved by the frame where script is run or which gets focused" (Chromium
`512508f`, "Reland of Move UndoStack from Page to Editor",
<https://chromium.googlesource.com/chromium/src/+/512508f0d652a006407ce66aafcd339b296a5276>). A
`beforeinput` célpontja 2024 óta a visszavont lépés eleme, nem a fókuszált elem: "Type something
into the #one and move focus to the #two, when excuate undo command, `beforeinput` event is
triggered on #two ... it is possible that the node associated with the undo/redo command may not be
the currently focused node" (Chromium `debff86`,
<https://github.com/chromium/chromium/commit/debff860c6b692eb929b9d56afd6f941462e146d>), ami a
mérésünkkel egyezik. Független megerősítés: a WebKit szerkesztő mérnöke a W3C Editing munkacsoport
listáján: "Chrome certainly shares a single undo stack for the entire page"
(<https://lists.w3.org/Archives/Public/public-webapps-github/2016Sep/1411.html>, w3c/editing #150),
és egy fejlesztői beszámoló: "I can still undo the changes of the input by pressing CTRL+Z in another
input field" (<https://stackoverflow.com/questions/54238187>).

**Következmény a 102. kritériumra.** A kritérium zárójele ("egy korábbi, másik mezőn végzett és
lezárt szerkesztés változatlan marad") a gráf visszavonására igaz, a natív visszavonásra nem: egy
szöveg mezőben gépeléssel végzett korábbi szerkesztést a másik szöveg mezőben lenyomott `Ctrl+Z`
natívan visszavonja. Ezért a 102. kritérium e2e tesztje a korábbi, lezárt szerkesztést a
"Kezeletlen hiba szabálya" választón végzi, ami nem natív szerkesztés, tehát a natív történet nem
éri el, és a szűrő hatása elkülönül; a szöveg mezőkre vonatkozó viselkedést a mérés teszt rögzíti.
A kérdést a user lezárta: a böngésző viselkedése elfogadva (53.8).

### 53.4 A `beforeunload` párbeszéd Playwright alatt

**Források.** A Playwright Dialogs oldala (<https://playwright.dev/docs/dialogs>): "When
page.close() is invoked with the truthy runBeforeUnload value, the page runs its unload handlers",
a párbeszéd `dialog.type() === 'beforeunload'` alakban kezelhető, és figyelő nélkül minden
párbeszéd automatikusan elutasított; a `Page` osztály (<https://playwright.dev/docs/api/class-page>,
`close`): "if runBeforeUnload is passed as true, a beforeunload dialog might be summoned and should be
handled manually via page.on('dialog') event"; a `Dialog` osztály
(<https://playwright.dev/docs/api/class-dialog>): a típus `alert`, `beforeunload`, `confirm` vagy
`prompt`, és figyelő esetén a párbeszédet el kell fogadni vagy utasítani. Független megerősítés a
navigációs utakra: microsoft/playwright #20624 (<https://github.com/microsoft/playwright/issues/20624>):
a `page.reload()` `beforeunload` típusú párbeszédet ad, és elutasítás után a hívás a betöltésre vár
("if you have an beforeunload event handle on a page and reload and let Playwright dismiss it, it
will stall and timeout"); microsoft/playwright #23141
(<https://github.com/microsoft/playwright/issues/23141>): a `location.reload()` útján is `beforeunload`
párbeszéd jön, elutasítható.

**Mérés** (saját, 2026-10-17; a tesztek a `graph-editor-discard-navigation.spec.ts` fájlban):

| Út                                      | Mentetlen változás | Párbeszéd      | Kezelés  | Eredmény                                                                    |
| --------------------------------------- | ------------------ | -------------- | -------- | --------------------------------------------------------------------------- |
| `page.close({ runBeforeUnload: true })` | igen               | `beforeunload` | elutasít | a lap nyitva, a változás megmarad (52.1)                                    |
| `page.close({ runBeforeUnload: true })` | nem (visszavonva)  | nincs          | nincs    | a lap bezárul                                                               |
| `page.reload()` (újratöltés)            | igen               | `beforeunload` | elfogad  | a szerkesztő újratölt, a változás elveszik                                  |
| `page.goto('/runs')` (kézzel beírt cím) | igen               | `beforeunload` | elutasít | a hívás `net::ERR_ABORTED` hibával tér vissza, a cím és a változás megmarad |
| `page.goto('/runs')` (kézzel beírt cím) | igen               | `beforeunload` | elfogad  | a futás előzmények betölt                                                   |

A mentetlen változás nélküli bezárás külön lapon fut, mert a bezárt lapról a lefedettségi fixtúra
nem olvashat; a felvétel és a visszavonás felhasználói interakció, tehát a böngésző párbeszédének
feltétele (sticky activation, M-114, 52.1) teljesül, és a párbeszéd hiánya a figyelő hiányát
mutatja. Az újratöltés elutasító útja nincs tesztben: a `page.reload()` ilyenkor a betöltésre várva
lejár (a #20624 szerinti viselkedés, egy eldobott próbában is így mérve, 4000 ms-os hívás szintű
korláttal).

### 53.5 A tipp egérrel (WCAG 2.2 1.4.13, user döntés 2026-10-14)

A T-009-50 15. szekció tájékoztató mérését a `graph-editor-undo-operations.spec.ts` tipp tesztje a
két valódi gombon, verziókövetve teszi tartóssá. Mindkét gombra: az egér a gomb közepére (a fókusz
nem a gombon áll, tehát a tippet az egér nyitja), a tipp a felirattal és a `kbd` jelöléssel látszik;
az egér a gomb közepéről a tipp közepére húzva húsz lépésben, két pixeles lépésekkel halad át a
10 px-es résen, és a tipp végig nyitva marad; a végén a tipp `:hover` állapotú, és a közepén az
`elementFromPoint` a tipp eleme (a `pointer-events: auto` hat); az egér kivitele a burkolóból zár.

**A T-009-50 14. szekció nyitott pontja (a nyitott tipp takarhat-e egy lábléc gombot) lezárva a két
gombra:** nyitott tippnél a lábléc mind a hat gombjának közepén az `elementFromPoint` maga a gomb,
tehát a tipp és a híd a gombsor fölött áll, és kattintást nem fog el.

**Rontással igazolva:** a híd `content` értéke `none` (`tooltip-hover-bridge.css`, a híd nem
keletkezik) mellett a teszt a Visszavonás lépésén bukik (a tippre vitt egér alatt a tipp nem
látszik); visszaállítva zöld.

### 53.6 Szándékos rontások (mindegyik visszaállítva, a commitban nincs)

A hatókör minden rontásnál ugyanaz az öt fájl, 39 teszt: `graph-editor-undo-operations.spec.ts`,
`graph-editor-undo-field.spec.ts`, `graph-editor-discard-navigation.spec.ts`,
`graph-editor-undo.spec.ts`, `graph-editor-undo-modifier.spec.ts`.

| Rontás                                                                                                                          | Bukó e2e tesztek                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) a szűrő elhagyása: a `resolveUndoShortcut` beviteli célpont ága (`isKeyboardInputTarget`) kiiktatva                         | 5 bukik, 34 zöld: a 102. kritérium két szűrő tesztje (szöveg terület és beviteli mező; `Expected: "fail_branch"`, `Received: "fail_run"`, a mezőben lenyomott `Ctrl+Z` a gráfot vonta vissza) és a három mérés teszt (a natív lépés helyett a gráf menete fordult vissza) |
| (b) a mező menet összevonásának elhagyása: a `handleUpdateNode` `recordGraphEdit` hívása menet nélkül (`GraphEditorScreen.tsx`) | 4 bukik, 35 zöld: a mező menet tesztje (`Expected: "Foglald össze a bemenetet."`, `Received: "Foglald össze a bemenetet. Röviden"`), a műveletek tábla mező esete (az első `Ctrl+Z` után a jelző megmaradt), és két mérés teszt                                           |
| (c) az őr elhagyása: a szerkesztő őr regisztráló hatása mindig korán tér vissza (`GraphEditorScreen.tsx`)                       | 3 bukik, 36 zöld: a meglévő navigációs teszt és a két új párosítás (a megerősítő modális nem jelenik meg, a navigáció azonnal lefut)                                                                                                                                      |
| (d) kiegészítő: a `useBeforeUnloadPrompt` mindig hamis értéket kap                                                              | 3 bukik a `graph-editor-discard-navigation.spec.ts` 10 tesztjéből: a bezárás, az újratöltés és a kézzel beírt cím párbeszéde                                                                                                                                              |
| (e) kiegészítő: a tipp hídja nem keletkezik (53.5)                                                                              | a tipp teszt bukik                                                                                                                                                                                                                                                        |

Az eredeti alakon mind zöld. A (b) rontás mellett a műveletek tábla többi nyolc esete zöld marad,
mert csak a mező menete változik; az (a) mellett a nem beviteli célponton lenyomott billentyű
változatlanul hat, ezért a többi visszavonás teszt zöld.

### 53.7 Az e2e lefedettség előtte és utána

Eljárás (51.5 szerint): `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`,
nyolc egymás utáni shard `flock` alatt, legfeljebb 3 workerrel, majd `bun run coverage:e2e:report`,
a darabszámok a `nyc report --reporter=json-summary` kimenetéből.

Előtte: a `main` `f041052` állapotán **550 teszt, mind zöld** (69 + 69 + 69 + 69 + 69 + 69 + 68 +
68). Utána: a jelen ág **575 teszt, mind zöld** (72 + 72 + 72 + 72 + 72 + 72 + 72 + 71; a +25 a
12 + 6 + 7 új teszt). A `coverage:e2e:report` mindkét állapoton exit 0 a meglévő küszöbbel.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1960 / 1975            | 1960 / 1975           | 15 -> 15                 |
| branches   | 913 / 924              | 913 / 924             | 11 -> 11                 |
| functions  | 674 / 677              | 674 / 677             | 3 -> 3                   |
| lines      | 1890 / 1905            | 1890 / 1905           | 15 -> 15                 |

A lépés termékkódot nem módosít, a fedetlen helyek ugyanazon a hat fájlon, ugyanazokkal a
darabszámokkal állnak (utasítás / ág / függvény / sor): `mount-app.tsx` 3/2/0/3,
`read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1,
`browser-history-location-port.ts` 1/0/1/1, `perform-route-request.ts` 1/1/0/1,
`use-stream-connection.ts` 1/0/1/1. Az `apps/web/package.json` küszöbe nem változott.

### 53.8 Lezárva (user döntés 2026-10-17): a natív visszavonás egy másik szöveg mezőre is hat

| Mező                | Tartalom                                                                                                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| melyik két forrás   | a SPEC-008 5.10 billentyű szabályainak 1. pontja ("Szöveg mezőben a `Ctrl+Z` a mező natív visszavonása marad") és a 102. kritérium zárójele ("egy korábbi, másik mezőn végzett és lezárt szerkesztés változatlan marad"), szemben az 53.3 4. pontjának mérésével                       |
| a tényleges eltérés | a natív visszavonás nem a mezőé, hanem a dokumentumé: egy szöveg mezőben lenyomott `Ctrl+Z` egy másik szöveg mező gépelését is visszavonja, és ez új gráf lépésként a dokumentumba jut. A gráf visszavonása a mezőben nem fut, ez a kritérium lényegi állítása, és teljesül            |
| a döntés            | user döntés (2026-10-17): "Elfogadjuk." Az (A) út: a böngésző viselkedése elfogadva, kód nem változik. A (B) út (a natív visszavonás szűkítése a fókuszált mezőre) és a (C) út (a billentyű a panel szöveg mezőiben a gráfot vonja vissza) nem készül el                               |
| átvezetve           | a SPEC-008 5.10 1. pontja és a 102. kritérium a mért viselkedéshez igazítva (az 53.3 4. pontjának Chromium forrásaival); az e2e teszt változatlan: a korábbi szerkesztés a választón áll, a szöveg mezők közötti viselkedést a `graph-editor-undo-field.spec.ts` mérés tesztje rögzíti |

### 53.9 Nem ellenőrzött

- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál; a natív történet
  közös volta és a lépés mérete ott nem mért.
- Valódi macOS (a `Cmd` módosító és a `Cmd+Y`, M-122): változatlanul az 58.6 szerint.
- A vezérelt szöveg terület karakterenkénti natív lépésének oka (53.3 2. pont).
- Az újratöltés elutasító útja (53.4) és a valódi címsorba írt cím: a `page.goto` a böngészőből
  indított navigáció, hogy a felhasználó címsorba írt címével minden részletben egyezik-e, nem
  mértem; a párbeszéd és az elutasítás utáni megszakadás mindkettőnél a `beforeunload` szabálya.
- A tipp a tiltott gombon egér alatt (51.7): a teszt mindkét gombot engedélyezett állapotban méri.

## T-009-58

A visszavonás és az újra elvégzés billentyűjének módosítója (SPEC-008 5.10, O-31): az
`eggGraphEditorUndoModifier` tároló olvasása, az Automatikus feloldása a felhasználói ügynökből, a
billentyű szűrő a beállított módosítóra, és a két gomb tippjének szövege. A választó és a `/settings`
képernyő a T-009-59 lépése. **Az írás (`storeUndoModifierPreference`) ebben a lépésben nem készült
el** (58.4).

### 58.1 Források

**A módosítók és a `key`.** A SPEC-008 M-120 és M-116 sora és az 51.1 szekció (W3C UI Events, MDN
`KeyboardEvent`): a `metaKey` a `Meta` módosító (macOS-en a `Command`), a `ctrlKey` a `Control`; a
szűrő a `key` szerint dönt. Új külső állítás ebben a lépésben nem keletkezett.

**A React Flow macOS felismerése (SPEC-008 M-121, egy forrás).** Saját olvasás, 2026-10-17, a
telepített csomagokon:

- `@xyflow/system` 0.0.82, `dist/esm/index.js` 746. sor:
  `const isMacOs = () => typeof navigator !== 'undefined' && navigator?.userAgent?.indexOf('Mac') >= 0;`
- `@xyflow/react` 12.11.6, `dist/esm/index.js` 3767. sor (a `ReactFlow` paramétereinek alapértéke):
  `multiSelectionKeyCode = isMacOs() ? 'Meta' : 'Control'`, ugyanez a `zoomActivationKeyCode`.

A saját feloldás ugyanezt a szabályt használja (`userAgent.includes('Mac')`), hogy a szerkesztő két
billentyű szabálya egy platform döntésen álljon. **Nem ellenőrzött**, hogy a hivatalos doksi a
felismerés módját is rögzíti-e: a doksi csak az alapértékeket adja (SPEC-008 M-117), a felismerés
szabálya egy forrásból, a telepített kódból van.

**Az ügynök alapú felismerés korlátja.** Az MDN a `Navigator.userAgent` lapján kimondja, hogy az ügynökre
épülő felismerés "unreliable and is not recommended"
(<https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent>), a User-Agent reduction lap pedig
ugyanezt indokkal: a gyártók a sztringet szabadon alakíthatják, és a felhasználó is átírhatja ("UA spoofing";
<https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/User-agent_reduction>). Független megerősítés: a
jQuery Learning Center (OpenJS Foundation), "User Agents are unreliable ... In general, we do not recommend UA
string-based feature detection" (<https://learn.jquery.com/code-organization/feature-browser-detection/>), és a
Mozilla Hacks, "User-Agent sniffing is a future fail strategy"
(<https://hacks.mozilla.org/2013/09/user-agent-detection-history-and-checklist/>). Ezért az `auto` csak az
alapérték, az ellensúlya a `ctrl` és a `meta` választás, amelynél az ügynök nem számít (58.2).

**A mobil Apple ügynökök.** Az iPhone Safari ügynöke tartalmazza a `like Mac OS X` szöveget (MDN, User-Agent
fejléc, <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent>: `Mozilla/5.0 (iPhone;
CPU iPhone OS 18_6 like Mac OS X) ...`), az iPad mobil alakja ugyanígy (`iPad; CPU OS ... like Mac OS X`), az
iPadOS asztali módú Safari pedig `Macintosh` alakot küld (Apple Developer Forums,
<https://forums.developer.apple.com/forums/thread/119186>; ScientiaMobile,
<https://scientiamobile.com/detect-ipados-13/>; 51Degrees,
<https://51degrees.com/blog/missing-ipad-tablet-web-traffic>). A `Mac` szó tehát az iOS és az iPadOS minden
alakjában jelen van, az `auto` ezeken `meta`. Ez egyezik az Apple hardveres billentyűzetes iPad leírásával:
`Command-Z` visszavon, `Shift-Command-Z` újra elvégez (<https://support.apple.com/en-us/102393>). Az Android
ügynök (`Linux; Android 10; K`) nem tartalmazza a `Mac` szót, az `auto` ott `ctrl`.

**A Playwright `userAgent` opciója.**

- Elsődleges: Playwright, Emulation, "User Agent",
  <https://playwright.dev/docs/emulation>: "if you do need to test a different user agent you can
  override it with the `userAgent` property", példa: `test.use({ userAgent: 'My user agent' });`. Ugyanitt:
  "Pre-configured devices assume a specific platform. For example, "Desktop Chrome" will provide a
  Windows-specific user agent string."
- Megerősítés 1: Playwright, `test.use`, <https://playwright.dev/docs/api/class-test>: a `test.use` egyetlen
  teszt fájlra vagy egy `test.describe()` csoportra állít opciót, és a `userAgent` a `TestOptions` között
  szerepel (<https://playwright.dev/docs/api/class-testoptions>, "Alternatively, with test.use() you can
  override some options for a file"). Ugyanitt az opció azon kevés kontextus opció között áll, amelyek
  egymást követő tesztek között új kontextus nélkül is eltérhetnek.
- Megerősítés 2 (a Playwright projekttől független): Stack Overflow, "How to add custom headers in
  Playwright", <https://stackoverflow.com/questions/62605422/how-to-add-custom-headers-in-playwright>:
  `@playwright/test` esetén a `test.describe` blokkban hívott `test.use({ userAgent })` állítja be a
  felhasználói ügynököt. Ide tartozik a microsoft/playwright #16077 issue,
  <https://github.com/microsoft/playwright/issues/16077>: a `test.describe` blokk `test.use({ userAgent })`
  hívása a `navigator.userAgent` értékét átírta ("when I uncomment `test.use` it works"), és a
  config `use` blokkjában a `...devices['Desktop Chrome']` szétterítés a korábban megadott `userAgent`
  értéket felülírja. A Playwright saját tesztje,
  `tests/library/browsercontext-user-agent.spec.ts`
  (<https://github.com/microsoft/playwright/blob/main/tests/library/browsercontext-user-agent.spec.ts>),
  a `userAgent` kontextus opciót a kérés `user-agent` fejlécén is igazolja.

**A két rögzített felhasználói ügynök formátuma.**

- Chromium, User-Agent Reduction, <https://www.chromium.org/updates/ua-reduction/>: a csökkentett
  asztali alak `Mozilla/5.0 (<unifiedPlatform>) AppleWebKit/537.36 (KHTML, like Gecko)
Chrome/<majorVersion>.0.0.0 Safari/537.36`, a lehetséges `unifiedPlatform` értékek között
  `Macintosh; Intel Mac OS X 10_15_7` és `Windows NT 10.0; Win64; x64`.
- MDN, User-Agent reduction,
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/User-agent_reduction>: ugyanezek a fix
  platform értékek (`Macintosh; Intel Mac OS X 10_15_7` macOS-en, `Windows NT 10.0; Win64; x64`
  Windowson), és a kisebb verziószámok mindig `0.0.0`.

A két konstans (`apps/web/e2e/user-agent.ts`) ezt az alakot követi; a szerkesztő csak a `Mac` szót
keresi, a verzió token nem számít.

### 58.2 A megvalósítás döntései

- **A tároló olvasása befecskendezett, lusta elérővel** (`readUndoModifierPreference(getStorage)`,
  `getStorage: () => Pick<Storage, 'getItem'>`). Lusta, mert már a `localStorage` tulajdonság elérése is
  dobhat (`SecurityError`); a `try` ezért a `getStorage()` hívást és a `getItem` hívást is fedi. A
  hiányzó kulcs, az ismeretlen értékű (`cmd`, `CTRL`, üres szöveg, idézőjeles szöveg) és
  a dobó elérés vagy olvasás mind `auto`. Az éles elérő a `getBrowserLocalStorage()`.
- **A feloldás tiszta függvény** (`resolveUndoModifier(preference, userAgent)`): `ctrl` és `meta`
  esetén a felhasználói ügynök nem számít, `auto` esetén a `Mac` szó dönt. Kimerítő `switch`, a
  `UndoModifierPreference` uniójára.
- **A beállítás típusa egy forrásból:** `UNDO_MODIFIER_PREFERENCES = ['auto', 'ctrl', 'meta'] as const`,
  az `isUndoModifierPreference(value: unknown)` guard ezt a halmazt vizsgálja.
- **A szűrő** (`resolveUndoShortcut`) a `state.modifier` mezőt kapja (`UndoShortcutState`): csak a
  beállított módosító mellett kezel, ha a másik módosító vagy az `Alt` is le van nyomva, nem (5.10 2.
  pont). A `useUndoRedoShortcut(onShortcut, isSaving, modifier)` függőségi tömbje a módosítót is
  tartalmazza, tehát a váltás újrakötést ad.
- **A képernyő a beállítást egyszer, a betöltéskor olvassa** (`useState` lusta kezdeti érték): a
  módosító egy munkamenetben nem változik, a váltás a következő betöltéstől érvényes (5.10: "A
  szerkesztő a beállítást a képernyő betöltésekor olvassa").
- **A tipp szövege** a `formatUndoShortcutLabels(modifier)` kimenete: `Ctrl+Z` és `Ctrl+Shift+Z / Ctrl+Y`,
  illetve `Cmd+Z` és `Cmd+Shift+Z / Cmd+Y`.

### 58.3 Unit teszt és rontás igazolás

Új spec fájl négy: `undo-modifier-storage.spec.ts` (15 teszt), `is-undo-modifier-preference.spec.ts` (10),
`resolve-undo-modifier.spec.ts` (5), `format-undo-shortcut-labels.spec.ts` (2). Bővítve:
`resolve-undo-shortcut.spec.ts` (mindhárom billentyű, mindkét módosító, a másik módosító, a `Meta+Shift+Z` és a `Meta+Y` `Ctrl` módban, és az `Alt`),
`use-undo-redo-shortcut.spec.tsx` (a módosító váltása újrakötéssel), `GraphEditorScreen.spec.tsx` (hat
teszt: öt platform/tároló eset a tipp szövegével, és a hibás tárolt érték). `bun run test` (2026-10-17, az írás
nélküli állapoton): **581 fájl, 5369 teszt, 100 százalék mind a négy metrikán**.

**Szándékos rontások** (saját, 2026-10-17, utána visszaállítva; a kód a commitban nincs ilyen):

- **(A) a módosító rögzítése `ctrl` értékre** (a `resolveUndoModifier` mindig `ctrl`-t ad): 3 unit
  teszt bukik (`GraphEditorScreen.spec.tsx`), és az e2e-ből a 11 érintett teszt közül (az öt új eset
  10 tesztje és a meglévő `graph-editor-undo.spec.ts` egy tesztje) 6 bukik.
- **(B) a másik módosító kizárásának törlése** (az `isOnlyModifierPressed` a másik módosító hiányát nem követeli): 2 unit teszt bukik, az e2e-ből 5.

A (B) rontás első e2e változata zölden ment át: egy önmagában lenyomott másik módosító (`Control+z`
`meta` beállításnál) a szűrőben a beállított módosító hiánya miatt amúgy sem kezelt, tehát az
"kizárás" ága csak a **mindkét módosítós** billentyűn látszik. Ezért az e2e minden esete a
`Control+Meta+z` billentyűt is megnyomja, és a rontás ezzel buktat.

### 58.4 Az írás kihagyása: lezárt döntés

A PLAN-009 T-009-58 sora a döntés előtt és a 113. kritérium "a dobó írás nem dob tovább" tagmondata ide
írta volna a tároló írását is. Ebben a lépésben **nincs olyan alkalmazás útvonal, ami hívná**: a választó a
T-009-59 lépése. Egy olyan függvény, amit sem a termék, sem az e2e nem ér el, a 100 százalékos unit
lefedettség mellett az e2e lefedettségben fedetlen marad. Mérés: a `storeUndoModifierPreference`
függvénnyel az e2e fedetlen darabszáma 17 / 11 / 4 / 17 lett (statements / branches / functions /
lines; a `main` 15 / 11 / 3 / 15 értékéhez képest +2 / 0 / +1 / +2), a `coverage:e2e:report` **exit 1**
(functions 99.39 < 99.46 küszöb). A küszöb csökkentése tiltott (`.claude/CLAUDE.md` 8. szekció),
user döntés nélkül nem tehető.

**Döntés (user, 2026-10-17):** "A mentés a Beállítások képernyő lépésével kerül be, ott a teszt is lefedi. A
terv szövege ehhez igazodik." Az írás és a hozzá tartozó unit tesztek tehát a T-009-59 lépésére maradnak,
amelynek e2e-je (a választás a kulcsba ír) fedi; a PLAN-009 T-009-58 és T-009-59 sora és a 113. kritérium
tagmondatának helye ennek megfelelően átírva. A függvény és a tesztjei, a dobó írás tesztjével és a
körbejárási teszttel együtt, egyetlen commitként (`d1fe2b4`) a `feat/spec-008-d1-modosito-billentyu-iras`
ágon megőrizve, a T-009-59 használja majd; ebbe a PR-be nem kerül.

### 58.5 Az e2e lefedettség előtte és utána

Eljárás (51.5 szerint): `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`,
majd nyolc egymás utáni shard `flock` alatt, legfeljebb 3 workerrel, majd `bun run
coverage:e2e:report`.

Előtte: a `main` `68055bd` állapotán **537 teszt, mind zöld** (68 + 67 + 67 + 67 + 67 + 67 + 67 + 67).
Utána: a jelen ág `3243507` commitján **547 teszt, mind zöld** (69 + 69 + 69 + 68 + 68 + 68 + 68 +
68; a +10 az új `graph-editor-undo-modifier.spec.ts` öt esete, esetenként két teszt).
`bun run coverage:e2e:report` exit 0 a meglévő küszöbbel (`--statements 99.11 --branches 98.61
--functions 99.46 --lines 99.08`).

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Százalék utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | -------------- | ------------------------ |
| statements | 1903 / 1918            | 1921 / 1936           | 99.22          | 15 -> 15                 |
| branches   | 892 / 903              | 904 / 915             | 98.79          | 11 -> 11                 |
| functions  | 650 / 653              | 657 / 660             | 99.54          | 3 -> 3                   |
| lines      | 1833 / 1848            | 1851 / 1866           | 99.19          | 15 -> 15                 |

A fedetlen helyek mindkét állapoton ugyanazon a hat fájlon, ugyanazokkal a darabszámokkal állnak
(`nyc` json-summary, utasítás / ág / függvény / sor): `mount-app.tsx` 3/2/0/3,
`read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1,
`browser-history-location-port.ts` 1/0/1/1, `perform-route-request.ts` 1/1/0/1,
`use-stream-connection.ts` 1/0/1/1. Az új fájlok mind teljesen fedettek (`undo-modifier-storage.ts`
6/6, 2/2, 2/2, 6/6; `resolve-undo-modifier.ts` 4/4, 5/5, 1/1, 4/4; `resolve-undo-shortcut.ts` 8/8,
17/17, 3/3, 8/8; `format-undo-shortcut-labels.ts` és `is-undo-modifier-preference.ts` 100 százalék).
Az `apps/web/package.json` küszöbe nem változott.

### 58.6 Nem ellenőrzött

- **A `Cmd+Y` valós macOS Chrome-beli viselkedése (SPEC-008 M-122).** A Chrome macOS-en a `⌘ + y`
  kombinációra az Előzmények oldalt nyitja (<https://support.google.com/chrome/answer/157179>). Hogy a
  szerkesztő `preventDefault()` hívása ezt megelőzi-e, arra forrást nem találtunk, és a Linux alatti
  Chromium e2e nem méri: az e2e csak azt igazolja, hogy a `metaKey` + `y` esemény újra elvégez. Ha a
  böngésző a kombinációt maga kezeli, a `Cmd+Shift+Z` és az Újra gomb változatlanul újra elvégez.
- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál; a `navigator.userAgent`
  `Mac` szavának jelenléte macOS-en Firefoxban és Safariban nem mért.
- iPhone és iPad valódi eszközön, hardveres billentyűzettel: az Apple oldal az iPad alkalmazások parancsait
  adja, az, hogy a Safari a weboldalnak `metaKey` eseményt küld-e, nem mért. A feloldás csak a unit teszt
  ügynök sztringjein igazolt.
- Valódi macOS-en futtatott böngésző: a macOS viselkedést rögzített felhasználói ügynök és a Linux alatti
  Chromium mutatja, a fizikai `Cmd` billentyű lenyomása nem mért.
- A tároló viselkedése privát ablakban és letiltott tárolással valódi böngészőben: a dobó elérést és
  olvasást a unit teszt szimulálja, e2e nem méri.

## T-009-55

A betöltés normalizálása (SPEC-008 5.1, 5.5, 5.8, 5.10, O-27, O-28; a 108. kritérium szerkesztő
része és a 109. kritérium): a kulcs nélküli elágazás élek elhagyása és a Start nélküli gráfba egy
Start felvétele a szerkesztett, kiinduló dokumentumon; a mentetlen jelző alapja a szerver nyers
válasza marad. A futás nézet elhagyása (a 108. kritérium másik része) a T-009-54 lépése volt.

### 55.1 A megvalósítás döntései

- **A normalizáló** (`graph-editor/normalize-loaded-graph-document.ts`) tiszta függvény: a
  bemenete a betöltött dokumentum vetítése (`WorkflowNodeInput`, `WorkflowEdgeInput`) és a
  `GraphElementIdGenerator` port, az importjai a T-009-54 `omitKeylessBranchEdges` szűrője és két
  típus; DOM és `@xyflow/react` hivatkozás nincs benne. Előbb a szűrés fut, utána a Start vizsgálat
  (SPEC-008 5.8, "Mikor"); a szűrés a csomópontokat nem érinti, tehát a sorrend az eredményen nem
  változtat. Egy vagy több meglévő Start mellett a csomópont lista ugyanaz az objektum.
- **A Start helye a lista vége.** A SPEC-008 a felvett Start helyét a listában nem rögzíti; a
  választás a felvett csomópont meglévő mintája (`handleAddNode` a lista végére tesz). Az alakja az
  5.8 szerinti: azonosító a porton át, `label: ''`, origó, `{ type: 'start', inputFields: [],
onUnhandledError: null }`; nincs kiválasztva, a panel nem nyílik meg.
- **A képernyő** (`GraphEditorScreen`, a betöltés hatása) a `baseline` állapotba a szerver nyers
  válaszát teszi, a visszavonás történetét pedig a normalizált alakról indítja
  (`startGraphEditHistory`). Ebből következik minden kért viselkedés, új ág nélkül: az
  `isGraphDirty` a nyers alappal hasonlít, tehát az elhagyás és a felvétel azonnal mentetlen
  változás, az őr és a `beforeunload` figyelő a meglévő `isDirty` úton áll; a visszavonás lista
  üres, tehát a Visszavonás gomb `disabled`, és a billentyű sem vesz ki semmit; a kiinduló
  dokumentum a normalizált alak, tehát a "Változtatások elvetése" is azt állítja vissza. A
  generátor szándékosan nincs a hatás függőségi listáján, mert a változása a történetet nem
  indíthatja újra. Sikeres mentés után a `PUT` válasza lesz az alap és a kiinduló dokumentum
  (T-009-52), és a válaszban már nincs elhagyott él, és benne van a Start.

### 55.2 Egy meglévő e2e fixtúra igazítása

A `form-control-typography.spec.ts` gráfja egyetlen, az origón álló agent lépésből állt, Start
nélkül. A normalizálás az origóra egy Startot vett fel, ami az agent kártyát fedte: a fájl három
tesztje a `rf__node-n-agent` kattintásán 30 másodperc után időtúllépéssel bukott (saját mérés, a
teljes e2e 3. shardja). A Start a lista végén áll, tehát a vásznon az agent kártya fölött rajzolódik;
ez az 5.8 kimondott következménye ("a Start vele átfedésben rajzolódik"). A fixtúra ezért Startot
kapott (`positionX: -450`), mint minden mai workflow (O-20); a teszt tárgya (a vezérlők betűtípusa és
a bezáró gomb színe) nem változott, a fájl három tesztje zöld. A többi szerkesztő e2e fixtúrájában
van Start, és `branch` forrású kulcs nélküli él egyikben sincs; a `skeleton-theme.spec.ts` üres
gráfja a betöltés kiengedése előtt állít, tehát nem érintett.

### 55.3 Unit teszt és rontás igazolás

Új spec fájl: `normalize-loaded-graph-document.spec.ts` (4); bővítve: `GraphEditorScreen.spec.tsx`
(+6, "a betöltés normalizálása" csoport). A `bun run test` 584 fájl, 5411 teszt, 100 százalék mind a
négy metrikán.

Új e2e: `apps/web/e2e/graph-editor-load-normalization.spec.ts`, két teszt. (1) A 108. kritérium
szerkesztő része: a három élű válaszból a vászon kettőt rajzol (`.react-flow__edge` darabszám), a
`rf__edge-e-regi` nincs, a mentetlen jelző azonnal látszik, a Visszavonás gomb és az elvetés
menüpont `disabled`, a `Control+z` az élt nem hozza vissza, egy "Elrendezés" utáni elvetés után a
menüpont ismét `disabled` és az él továbbra sincs, egy második "Elrendezés" utáni mentés `PUT`
törzsének élei `e-start`, `e-igen`, és a mentés után a jelző eltűnik. (2) A 109. kritérium: a Start
kártya megjelenik, azonosítója 4. verziós UUID, a panel zárva, a mentetlen jelző azonnal látszik, a
Visszavonás gomb és az elvetés menüpont `disabled`, a `Control+z` és egy "Elrendezés" utáni elvetés
a Startot megtartja, a felső navigáció "Futás előzmények" linkje a megerősítő modálist nyitja (a cím
`/editor` marad), az üres kezeletlen hiba szabály mellett a mentés kérés nélkül a mező alatt jelez,
a kitöltés után a `PUT` törzse a Startot az 5.8 alakjával viszi, és a jelző eltűnik.

Ideiglenes rontások (saját, 2026-10-17, utána visszaállítva):

| Rontás                                                                                                                                | Unit (`GraphEditorScreen.spec.tsx`)                                 | E2E                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| a kulcs nélküli élek szűrése a mentetlen jelző alapja ELÉ (a `baseline` élei a szűrt lista)                                           | 2 bukik (az AC108 jelző és az elvetés teszt), 68 zöld               | az AC108 teszt bukik: a mentetlen jelző nem jelenik meg        |
| a Start felvétele visszavonható lépésként (`startGraphEditHistory` a Start nélküli alakról, utána `recordGraphEdit` a normalizálttal) | 2 bukik (az AC109 betöltés és a visszavonás/elvetés teszt), 68 zöld | az AC109 teszt bukik: a Visszavonás gomb nem `disabled`        |
| a `main` `f041052` képernyő kódja (normalizálás nélkül)                                                                               |                                                                     | mindkét teszt bukik: 3 él a 2 helyett, 1 csomópont a 2 helyett |

Az eredeti alakon a fájl mind a 70 unit tesztje és mindkét e2e teszt zöld.

### 55.4 Az e2e lefedettség előtte és utána

Eljárás (51.5 szerint): `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`,
majd nyolc egymás utáni shard `flock` alatt, legfeljebb 3 workerrel, majd `bun run
coverage:e2e:report`.

Előtte: a `main` `f041052` állapotán **550 teszt, mind zöld** (69 + 69 + 69 + 69 + 69 + 69 + 68 +
68). Utána: a jelen ág kódján (`34866e9`) **552 teszt, mind zöld** (8 x 69). A `bun run
coverage:e2e:report` mindkét állapoton exit 0 a meglévő küszöbbel.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Százalék utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | -------------- | ------------------------ |
| statements | 1960 / 1975            | 1966 / 1981           | 99.24          | 15 -> 15                 |
| branches   | 913 / 924              | 914 / 925             | 98.81          | 11 -> 11                 |
| functions  | 674 / 677              | 676 / 679             | 99.55          | 3 -> 3                   |
| lines      | 1890 / 1905            | 1895 / 1910           | 99.21          | 15 -> 15                 |

A fedetlen helyek mindkét állapoton ugyanazon a hat fájlon, ugyanazokkal a darabszámokkal állnak
(`nyc` json-summary, utasítás / ág / függvény / sor): `mount-app.tsx` 3/2/0/3,
`read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1,
`browser-history-location-port.ts` 1/0/1/1, `perform-route-request.ts` 1/1/0/1,
`use-stream-connection.ts` 1/0/1/1. Az új `normalize-loaded-graph-document.ts` teljesen fedett (5/5,
1/1, 2/2, 4/4), a `GraphEditorScreen.tsx` is (148/148, 62/62, 59/59, 140/140). Az `apps/web/package.json`
küszöbe nem változott.

### 55.5 Nem ellenőrzött

- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- Valódi `apps/server` ellen a normalizált gráf mentése nem futott: a `PUT` törzs csak a
  `page.route()` mockon mérve; a szerver oldali elfogadást (kötelező mezők, `onUnhandledError`) a
  meglévő protokoll és szerver tesztek fedik, nem ez a lépés.

## T-009-57

A böngésző vissza és előre gombja mentetlen változásnál (SPEC-008 5.10 3. pont, O-30, a 112.
kritérium): a `use-client-route` `popstate` figyelője a T-009-52 navigációs őrét kérdezi, regisztrált
őrnél a korábbi címet `pushState` hívással visszaírja, és a `popstate` utáni címet célként az őrnek
adja; a megerősítő modális kilépése a célra navigál az őr megkerülésével.

### 57.1 Források

**A `popstate` a bejegyzés váltása után fut, és csak ugyanannak a dokumentumnak a bejegyzései
között.**

- MDN, `popstate` (<https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event>): az
  esemény akkor fut, amikor az aktív előzmény bejegyzés a felhasználó navigációja közben változik; a
  kezelőben a `window.location` már az új állapotot mutatja; a `history.pushState()` és a
  `history.replaceState()` hívás nem vált ki `popstate` eseményt, a vissza és az előre gomb (és a
  `history.back()`, `history.forward()`) igen.
- MDN, `PopStateEvent` (<https://developer.mozilla.org/en-US/docs/Web/API/PopStateEvent>): az
  esemény minden olyan esetben fut, amikor az aktív bejegyzés ugyanannak a dokumentumnak két
  bejegyzése között vált.
- WHATWG HTML, "Session history and navigation"
  (<https://html.spec.whatwg.org/multipage/browsing-the-web.html>), a "URL and history update steps"
  megjegyzése: a `popstate` a fragment navigációra fut, a `history.pushState()` hívásra nem. Az
  "update document for history step application" algoritmus `popstate` lépését (csak akkor fut, ha a
  dokumentum nem új, `documentIsNew` hamis) a LibWeb böngészőmotor forrása szó szerint idézi
  (<https://git.etawen.dev/sleirsgoevy/serenity/commit/6c1944ee61bba982f033160ffed35b5c14cc36e9>,
  "5. If documentIsNew is false, then: ... 2. Fire an event named popstate"); a spec oldalt magát a
  mérete miatt nem olvastam végig, ezért ez a pont a 57.4 saját mérésére támaszkodik.

**A `pushState` az előre bejegyzéseket törli.** Forrás: SPEC-008 M-119 (WHATWG HTML "history
handling behavior", W3C HTML5 5.4). Saját mérés: a 57.4 második sora.

**A Playwright `page.goBack()` és `page.goForward()` működése.** Saját olvasás, a telepített
`playwright-core@1.62.1` `lib/coreBundle.js` fájlja: a Chromium oldali `_go(delta)` a
`Page.getNavigationHistory` CDP hívással lekéri az előzményeket, és a `currentIndex + delta` indexű
bejegyzésre a `Page.navigateToHistoryEntry` hívással lép; ha nincs ilyen bejegyzés, `null` a válasz.
A `goBack` a lépés után a navigációra vár (`waitForNavigation`, `waitUntil` alapértéke `load`),
tehát egy megszakított navigációnál az időkorlátig vár (57.4).

**A Chromium előzmény manipulációs beavatkozása (History Manipulation Intervention).** A Chromium
dokumentációja (<https://chromium.googlesource.com/chromium/src/+/main/docs/history_manipulation_intervention.md>)
és a blink-dev bejelentése
(<https://groups.google.com/a/chromium.org/g/blink-dev/c/T8d4_BRb2xQ/m/WSdOiOFcBAAJ>): ha egy
dokumentum felhasználói aktiváció nélkül vesz fel előzmény bejegyzést, a dokumentum minden
bejegyzése "kihagyható" jelölést kap, és a böngésző vissza és előre gombja (a felülete, nem a
`history.back()` API) ezeket átlépi; egy újabb felhasználói aktiváció a jelölést törli; az azonos
dokumentumon belüli vissza vagy előre lépés után a korábbi aktiváció új bejegyzésre nem számít. A
két forrás ugyanattól a kiadótól származik, tehát a következménye a 57.6 nem ellenőrzött pontja.
Az aktiváló bemenet köre: WHATWG HTML, "activation triggering input event"
(<https://html.spec.whatwg.org/multipage/interaction.html>): a `keydown` csak akkor aktiváló, ha a
billentyű nem az `Esc`; ugyanezt a WebKit `EventHandler.cpp` forrása idézi és valósítja meg
(<https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/EventHandler.cpp>).

### 57.2 A megvalósítás döntései

- **A `popstate` ág** (`use-client-route.ts`): őr nélkül a korábbi út (az állapot a `location`
  értékéből), változatlan kóddal. Regisztrált őrnél a figyelő a `location` értékét célként
  eltárolja, az állapotban álló útvonalat és query stringet `pushState` hívással visszaírja, az
  állapotot nem frissíti, és az őrt egy olyan `proceed` függvénnyel hívja, ami a célra `pushState`
  hívással és az állapot frissítésével navigál. A `NavigationGuard` típusa nem változott: a cél a
  `proceed` zárványában utazik, ugyanúgy, mint a `navigate` ágán.
- **A visszaírt cím az állapotból jön, nem a `location` értékéből**, mert a `popstate` idején a
  `location` már a célt mutatja (57.1). A hatás függősége ezért `[port, pathname, search]`: a
  figyelő minden megjelenített útvonal váltáskor újra feliratkozik, és mindig a legutóbbi címet írja
  vissza; a `[port]` függőségű alak a csatoláskori címet írná vissza (57.3 (c) rontás).
- **A szerkesztő oldala nem változott.** A T-009-52 őre a megerősítésre váró navigációt állapotba
  teszi (`setPendingNavigation({ proceed })`), tehát egy újabb vissza vagy előre lépés a nyitott
  modálisnál a legutóbbi célt veszi át, ahogy az 5.10 3. pontja kimondja.

### 57.3 Unit teszt és rontás igazolás

A `use-client-route.spec.tsx` hat új tesztje (13 -> 19): regisztrált őrnél a `popstate` után a
`pushState` a korábbi útvonallal és query stringgel hívódik, és a megjelenített útvonal nem vált; a
kilépés a `popstate` utáni címre (query stringgel) navigál, az őr megkerülésével; egy újabb `popstate`
a címet ugyanígy visszaírja, és az őr a legutóbbi célt kapja; a visszaírt cím a legutóbbi navigáció
utáni útvonal, nem a csatoláskori; őr nélkül a `popstate` a mai módon vált, visszaírás nélkül; az
eltávolított őr után ugyanígy. A hamis port a `pushState` hívásokat sorrendben rögzíti
(`pushedPaths`), és a bejegyzés váltást a cím átállításával és a `popstate` kiváltásával utánozza
(`traverseForTest`); a meglévő 13 teszt változatlan és zöld. A `bun run test` 583 fájl, 5407 teszt,
100 százalék mind a négy metrikán.

Ideiglenes rontások (saját, 2026-10-17, utána visszaállítva):

| Rontás                                                      | Unit (`use-client-route.spec.tsx`) | E2e (`graph-editor-back-forward.spec.ts`)                                            |
| ----------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| (a) a cím visszaírásának elhagyása                          | 4 bukik                            | 2 bukik: `toHaveURL` a szerkesztő címét várja, a cél áll (`/run?runId=...`, `/runs`) |
| (b) az őr kihagyása a `popstate` ágon                       | 4 bukik                            | 2 bukik: a megerősítő `Modal` nem jelenik meg, a navigáció megerősítés nélkül fut    |
| (c) a figyelő `[port]` függőséggel (a csatoláskori zárvány) | 1 bukik                            | nem futtatva                                                                         |

Az eredeti alakon mind zöld.

### 57.4 A mérések (saját, valódi Chromium, 1440x900, 2026-10-17)

| Helyzet                                                                                                     | Eredmény                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) futás nézet -> ős link -> szerkesztő, mentetlen változás, `page.goBack()`                               | a megerősítő `Modal` látszik, a cím a szerkesztőé; "Mégse" után a két csomópont és a mentetlen jelző marad; egy újabb `page.goBack()` és a "Kilépés mentés nélkül" után a futás nézet címe áll  |
| (2) szerkesztő -> "Futás előzmények" -> `page.goBack()` (őr nélkül), mentetlen változás, `page.goForward()` | a `Modal` látszik, a cím a szerkesztőé; "Mégse" után a `page.goForward()` válasza `null`, a cím a szerkesztőé: a visszaíró `pushState` az előre bejegyzést törölte (M-119)                      |
| (3) futás nézet -> ős link -> szerkesztő, mentetlen változás nélkül, `page.goBack()`                        | modális nélkül a futás nézet címe áll                                                                                                                                                           |
| (4) `page.goto('/runs')`, `page.goto(szerkesztő)`, mentetlen változás, `history.back()`, elutasítva         | `beforeunload` típusú párbeszéd; a cím a szerkesztőé, a két csomópont marad, alkalmazás modális nincs, `popstate` nem futott                                                                    |
| (5) ugyanez, `page.goBack()`, elutasítva                                                                    | `beforeunload` párbeszéd, utána a `page.goBack()` a meg nem történt navigációra vár, és a hívásnak adott időkorlátnál `TimeoutError`-ral tér vissza; a cím a szerkesztőé, `popstate` nem futott |
| (6) ugyanez, `page.goBack()`, elfogadva                                                                     | `beforeunload` párbeszéd, a `page.goBack()` a `/runs` dokumentumra lép; a szerkesztő dokumentumában `popstate` nem futott (a jel a `sessionStorage`-ban, ami a dokumentum váltását túléli)      |

**A SPEC-008 5.10 3. pontjának nem ellenőrzött állítása ezzel mérve:** a másik dokumentumra vezető
vissza lépésnél `popstate` nem fut, és a lap elhagyása a 2. pont `beforeunload` útján kér
megerősítést; elutasításnál a szerkesztő és a változás marad, elfogadásnál a böngésző a másik
dokumentumra lép. A spec mondata ennek megfelelően átvezetve.

Az (1) ... (4) és a (6) sort az állandó e2e (`apps/web/e2e/graph-editor-back-forward.spec.ts`, négy
teszt) állítja, `--repeat-each=3` mellett 12/12 zöld. Az (5) sor egy egyszeri, a mérés után törölt
spec fájlból jött, és csak azt indokolja, miért váltja ki az állandó e2e az elutasított ágat a
`history.back()` hívással: a `page.goBack()` itt csak időkorláttal térne vissza, időkorlátra váró
állítás pedig az e2e-ben nem állhat (`.claude/CLAUDE.md` 11. szekció).

### 57.5 Az e2e lefedettség előtte és utána

Saját mérés, a 6. szekció eljárásával (`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e
apps/web/test-results`, nyolc egymás utáni shard `flock` alatt, legfeljebb 3 workerrel, majd
`bun run coverage:e2e:report`, a darabszámok a `nyc report --reporter=json-summary` kimenetéből).
Előtte a `main` `f041052` állapota: **550 teszt, mind zöld** (69 + 69 + 69 + 69 + 69 + 69 + 68 + 68).
Utána a jelen ág: **554 teszt, mind zöld** (70 + 70 + 69 + 69 + 69 + 69 + 69 + 69), a riport exit 0
a meglévő küszöbbel.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1960 / 1975            | 1971 / 1985           | 15 -> 14                 |
| branches   | 913 / 924              | 914 / 925             | 11 -> 11                 |
| functions  | 674 / 677              | 676 / 678             | 3 -> 2                   |
| lines      | 1890 / 1905            | 1901 / 1915           | 15 -> 14                 |

A fedetlen darab egyik metrikán sem nőtt. A csökkenés oka a `browser-history-location-port.ts`
leiratkozó függvénye (21. sor, 1/0/1/1 előtte): a `popstate` figyelő a megjelenített útvonal minden
váltásakor újra feliratkozik (57.2), tehát a leiratkozás e2e úton is fut, és a fájl 100 százalékos
lett. A többi fedetlen hely ugyanazon az öt fájlon áll, mint előtte (`mount-app.tsx` 3/2/0/3,
`read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts` 1/1/0/1, `perform-route-request.ts`
1/1/0/1, `use-stream-connection.ts` 1/0/1/1). Az `apps/web/package.json` küszöbe nem változott (a
PLAN-009 T-009-57 sora a meglévő küszöböt írja elő; a százalékok előtte 99.24 / 98.8 / 99.55 /
99.21, utána 99.29 / 98.81 / 99.7 / 99.26).

### 57.6 Nem ellenőrzött

- **Ismert korlát (user döntés 2026-10-17): a böngésző felületének vissza gombja a Chromium előzmény
  manipulációs beavatkozása mellett.** A
  visszaíró `pushState` a `popstate` kezelőjében, felhasználói aktiváció nélkül fut, közvetlenül egy
  azonos dokumentumon belüli vissza lépés után; a 57.1 forrása szerint ilyenkor a dokumentum
  bejegyzései kihagyható jelölést kapnak, és csak egy újabb aktiváció törli őket. Ebből az
  következne, hogy a "Mégse" kattintása (aktiváció) után a következő vissza gomb a szerkesztő előtti
  bejegyzésre lép, ahogy az e2e méri; ha viszont a felhasználó a modálist `Esc` billentyűvel zárja
  (nem aktiváló, 57.1), vagy a nyitott modálisnál kattintás nélkül újra a vissza gombot nyomja, a
  böngésző a kihagyható bejegyzéseken átléphet, a lap elhagyásáig, ahol a 2. pont `beforeunload`
  párbeszéde kér megerősítést. A Playwright `page.goBack()` a `Page.navigateToHistoryEntry` hívással
  egy adott bejegyzésre lép (57.1), tehát a felület gombjának kihagyó logikáját nem futtatja: ez a
  pont ebben a környezetben nem mérhető. Mérni valódi Chrome-ban, kézzel lehetne.
  A user döntése szerint ez ismert korlát, nem hárítjuk el: `Esc`-kel zárt modálisnál vagy újabb
  vissza gombnál a böngésző saját `beforeunload` kérdése jöhet a mi modálisunk helyett, adat
  kérdés nélkül így sem vész el. A Chromium dokumentuma (57.1) a feltételt (aktiváció nélkül
  felvett bejegyzés) és a kihagyást egyaránt kimondja; a következmény a mi kódunkra levezetett,
  nem mért. Rögzítve: SPEC-008 5.10 "Ismert korlát" bekezdés.
- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- A kézzel beírt cím és az újratöltés `beforeunload` párbeszéde a T-009-53 lépése (52.6).

## T-009-59

A Beállítások képernyő és a visszavonás módosítójának választója (PLAN-009 T-009-59, SPEC-008 5.10,
5.11, O-31, O-32, 113. kritérium írás része, 114. és 115. kritérium). Az ág a `main` `f041052`
állapotára épül; a tároló írása (`storeUndoModifierPreference`) a `feat/spec-008-d1-modosito-billentyu-iras`
ág `d1fe2b4` commitjából átvéve (user döntés 2026-10-17, 58.4), a `d1fe2b4` `apps/web/CLAUDE.md`
változása nélkül.

### 59.1 Források

- **A `<label for>` a `<button>` elemet is címkézi.** A WHATWG HTML Living Standard "labelable elements"
  kategóriája a `button` elemet is felsorolja ("These are elements that can be associated with a `label`
  element. `button`, `input` ..."), és a `for` attribútum "the ID of a labelable element" lehet
  (<https://html.spec.whatwg.org/multipage/forms.html>, 4.10.2 és 4.10.4). Megerősítés: a WHATWG
  fejlesztői kiadás elem indexe a `button` kategóriái között a "labelable" szót adja
  (<https://html.spec.whatwg.org/dev/indices.html>), és az MDN `<label>` oldala szerint a `for`
  attribútum a dokumentum első egyező `id` elemét címkézi, ha az labelable
  (<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/label>). A `SelectField`
  triggere `<button role="combobox">`, a komponens `id` propja a gombra kerül, tehát a sor felirata
  `<label htmlFor>` kötéssel a trigger hozzáférhető neve. Mérve: az e2e `getByLabel` a felirattal megtalálja
  a triggert (`e2e/settings-screen.spec.ts`).
- **Az `addInitScript` minden navigációnál újra fut**: "Adds a script which would be evaluated in one of the
  following scenarios: Whenever the page is navigated. ..."
  (<https://playwright.dev/docs/api/class-page#page-add-init-script>). Ezért az e2e a kiinduló tárolt értéket
  `page.evaluate` és `page.reload` úton állítja be: egy init script a szerkesztő betöltésekor felülírná a
  választást.
- **A design system minta.** `eggproject-design-admin-app-examples/examples/settings.html`: a lap saját
  `<style>` blokkja adja a `.card` (40-46. sor) és a `.preference-row` (54-59. sor) szabályait; a "Preferences"
  kártya választós sora `<label class="preference-row__title" for>` plusz `select select--sm` (190. sor). A
  komponens `card` (`eggproject-design-components/components/card/card.css`) a `packages/ui` `card.css`
  forrása; a lap NEM tölti be (a `<link>` listán nincs), a saját `.card` szabálya belső térköz nélküli,
  szakaszokra (`card__header`, `card__body`) bontott változat.
- **A `flex: 1` alapmérete 0.** Az MDN `flex` oldala szerint az egy értékes, egység nélküli alak
  "expands to `flex: <number> 1 0%`"
  (<https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/flex>); megerősítés: a W3C CSS
  Flexible Box Layout Level 1 "flex: <positive-number>" leírása ("sets the flex basis to zero",
  <https://www.w3.org/TR/css-flexbox-1/#flex-common>) és a web-platform-tests `flex-shorthand.html` tesztje
  (`flex: 1` -> `flex-basis: 0%`,
  <https://github.com/web-platform-tests/wpt/blob/master/css/css-flexbox/parsing/flex-shorthand.html>). A
  `.preference-row__body` ezt a deklarációt viseli, tehát egy sorban a szabad helyből csak a trigger tartalmi
  szélessége után maradó rész jut neki (59.3, mérve).
- **Saját mérés**: `apps/web/measurement/settings-width.ts` (`bun run measure:settings-width`, 59.3).

### 59.2 A megvalósítás döntései

- **A kártya a `packages/ui` `Card` szerkezete, nem a komponens és nem a lap saját változata.** A `Card`
  React komponens a gyerekeit `<p>` elembe teszi, amiben a `SelectField` `<div class="field">` gyökere nem
  állhat. A lap saját `.card`, `.card__header` szabálya a komponens `card.css` szabályaival azonos
  osztálynéven ütközne, globálisan (a `not-found-route` a `Card` komponenst használja), és a komponens 18px
  belső térköze a lap `card__header` térközével összeadódna. A képernyő ezért a komponens DOM alakját írja
  (`<section class="card">`, `.card__header`, `<h3>`), a meglévő, globálisan betöltött `card.css`
  szabályokkal; saját kártya CSS nincs. Lásd 59.6, 1. kérdés.
- **A kártya címe** a `CLIENT_ROUTE_TABLE.graphEditor` felirata ("Szerkesztő"), mert a beállítás a
  szerkesztő billentyűire hat; a spec a címet nem nevezi meg. Lásd 59.6, 2. kérdés.
- **A `preference-row`** négy szabálya (`.preference-row`, `:last-child`, `__body`, `__title`) a forrás
  deklarációival áll az `apps/web` `settings-screen.css` fájlban; a két `__hint` szabály kimaradt, mert a
  sornak nincs magyarázó szövege. Nem `packages/ui` téma: a minta a lap saját stílusa, nem komponens, és a
  SPEC-008 11.4 szerint a `packages/ui` két új témája a `context-menu` és a `tooltip`.
- **Saját reszponzív szabály** a `--ep-screen-sm` (640px) alatt: `flex-direction: column` és
  `align-items: stretch`; a forrás oldal nem reszponzív (saját olvasás: a `settings.html` egyetlen `@media`
  blokkja a `forced-colors`, a `preference-row` szabályaihoz nincs reszponzív alak). A szükségességet a 59.3
  mérés adja; a SPEC-008 11.4 "Jelzés a usernek" bekezdése eltérésként nevezi meg (user döntés 2026-10-17).
- **A felirat `<label for>`, nem a `SelectField` `label` propja**: a prop a mező fölötti nagybetűs
  `field__label` címkét rajzolja, ami a `preference-row` bal oldali feliratával nem azonos alak.
- **A tároló**: a képernyő a `GraphEditorScreen` mintájára a `getBrowserLocalStorage` elérést adja a
  `readUndoModifierPreference` (betöltéskor, egyszer) és a `storeUndoModifierPreference` (választáskor)
  függvénynek. A választás hálózati kérést nem indít.
- **A `greppable-invariants` (9)** tiltott listájáról a `settings-screen` kikerült; a `skill-upload` és az
  `mcp-server-config` maradt. A SPEC-007 16. szekció 3. kritériumának lazítása a spec szövegében már a
  2026-09-28-i bővítéskor átvezetve állt, a kód oldali átvezetés ez a lista. A SPEC-008 1. szekció
  "Kimondott határeset" mondata még a lezárás előtti állapotot írta (a választó helye nyitott tétel), ez a
  talált helyen javítva (`.claude/CLAUDE.md` 14. szekció 1. pont).

### 59.3 A topnav és a Beállítások sor szélessége (mérés)

Eljárás: `cd apps/web && flock /tmp/playwright-gep.lock bun run measure:settings-width`, valódi Chromium, nem
instrumentált preview build, 900 pixel magas nézetablak, a `/settings` útvonal, üres tároló (a kiválasztott
érték az Automatikus). A `--ep-screen-md` (768px) alatt a navigáció a lenyíló menüben áll (a mérés előtt
kinyitva), fölötte a sávban.

**A topnav: a harmadik link minden mért szélességen elfér.** 320 pixelen a három link a lenyíló menüben
egymás alatt áll, mindegyik bal széle 8, jobb széle 312 pixel (a nézetablak 320), túllógás 0; a sáv
`scrollWidth - clientWidth` különbsége 0. A sávban (769 pixeltől) a "Beállítások" link jobb széle 575.39
(769) és 578.19 pixel (1023 ... 1440), túllógás és sáv túllógás 0. A mért szélességek: 320, 340, 360, 375,
393, 639, 640, 767, 768, 769, 1023, 1024, 1280, 1440.

**A sor: a saját szabály előtt a felirat összenyomódott.** A forrás deklarációival (a 640px alatti szabály
nélkül, a munkapéldányon mérve):

| Szélesség | Felirat szélessége | Trigger szélessége | Trigger túllógása | `.app-content` túllógás |
| --------- | ------------------ | ------------------ | ----------------- | ----------------------- |
| 320       | 0                  | 289                | 28                | 28                      |
| 340       | 0                  | 289                | 8                 | 8                       |
| 360, 375  | 0                  | 289                | 0                 | 0                       |
| 393       | 2                  | 289                | 0                 | 0                       |
| 639       | 248                | 289                | 0                 | 0                       |

A felirat törzse `flex: 1` alapú (0 alapméret), a trigger a tartalma szerinti 289 pixelt kéri, tehát egy
sorban a trigger minden helyet elvesz. Csak `flex-direction: column` mellett a trigger 320 pixelen 12 pixellel kilógott (a szélessége ekkor is 289 pixel maradt); `align-items: stretch` mellett nem.

**A szabállyal (a commitolt állapot):** 640 pixelig a felirat a trigger fölött áll, mindkettő a sor teljes
szélességén (320: 234, 340: 254, 360: 274, 375: 289, 393: 307, 639: 553, 640: 554 pixel), túllógás 0;
767 pixeltől egy sorban (felirat 376 ... 1017, trigger 289 pixel), átfedés 0. **Csonkolás**: 320, 340 és
360 pixelen a triggerben az "Automatikus (macOS-en Cmd, máshol Ctrl)" felirat három ponttal rövidül (55, 35
és 15 pixel rejtve), a kinyitott listában az opció szövege 320 és 340 pixelen (36 és 16 pixel rejtve);
375 pixeltől egyik sem. Ez a design system `select.css` és `menu.css` meglévő `text-overflow: ellipsis`
szabálya. Lásd 59.6, 3. kérdés.

A kapu nem a mért szám: a `responsive.spec.ts` két új tesztje minden támogatott szélességen (az eszköz
lista és a töréspont tokenek két oldala) a három linket és a sor két elemét `toBeInViewport({ ratio: 1 })`
állítással, a sor két elemét átfedés nélkül és a feliratot túllógás nélkül követeli.

### 59.4 Unit teszt és rontás igazolás

Új spec fájl egy: `settings-screen.spec.tsx` (11 teszt: a kártya és a hozzáférhető neve, a sor és a
`label for` kötés, `select--sm`, a három opció sorrendben, az alapérték, a három tárolt érték és az
ismeretlen érték, a három választás írása). Bővítve: `match-client-route.spec.ts` (öt bejegyzés, a
`settings` sor, a `/settings` illesztése), `app-shell.spec.tsx` (a `/settings` tartalma és morzsamenüje, a
harmadik link és az `is-on` jelölés), `undo-modifier-storage.spec.ts` (a `d1fe2b4` négy tesztje: a három
érték körbejárása, a dobó elérés és a dobó írás). `bun run test`: **584 fájl, 5420 teszt, 100 százalék
mind a négy metrikán** (előtte, a `main` `f041052` fájával azonos `5d7abce` fejen: 583 fájl, 5401 teszt).

**Szándékos rontások** (saját, 2026-10-17, utána visszaállítva; a kód a commitban nincs ilyen):

- **(A) a választás nem ír** (a `storeUndoModifierPreference` hívás törölve): 3 unit teszt és 7 e2e teszt
  bukik (a három írás teszt és a négy szerkesztő teszt).
- **(B) a 640px alatti szabály törlése**: a `responsive.spec.ts` sor tesztje 320 pixelen bukik
  (`toBeInViewport`).
- **(C) a `settings-screen` visszaírása a (9) tiltott listájára**: a (9) bukik ("expected [
  'settings-screen' ] to deeply equal []"); a javított listával egy ideiglenes `src/skill-upload/` mappa
  is bukást ad.
- **(D) a harmadik link törlése a topnavból**: 1 unit és 2 e2e teszt bukik (a link teszt és a navigáció
  reszponzív tesztje).

### 59.5 Az e2e lefedettség előtte és utána

Eljárás (51.5 szerint): `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`, nyolc
egymás utáni shard `flock` alatt, 3 workerrel, majd `bun run coverage:e2e:report`.

Előtte: a `main` `f041052` fájával azonos `5d7abce` fej (PR #41 helyi merge kapuja): **550 teszt**.
Utána: a jelen ág fején (a PR leírása adja a SHA-t) **562 teszt, mind zöld** (71 + 71 + 70 + 70 + 70 + 70 + 70 + 70; a
+12 az új `settings-screen.spec.ts` tíz és a `responsive.spec.ts` két tesztje). `bun run coverage:e2e:report`
exit 0 a meglévő küszöbbel.

| Metrika    | Fedett / összes előtte | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1960 / 1975            | 1974 / 1989           | 15 -> 15                 |
| branches   | 913 / 924              | 916 / 927             | 11 -> 11                 |
| functions  | 674 / 677              | 680 / 683             | 3 -> 3                   |
| lines      | 1890 / 1905            | 1904 / 1919           | 15 -> 15                 |

A fedetlen helyek mindkét állapoton ugyanazon a hat fájlon állnak (`mount-app.tsx`,
`read-frontend-config.ts`, `is-valid-connection.ts`, `browser-history-location-port.ts`,
`perform-route-request.ts`, `use-stream-connection.ts`). **Egy köztes futás bukott**: amíg a választás és a
szerkesztő betöltése egy tesztben állt, a `coverage-fixture.ts` a teszt végén csak a szerkesztő lapjáról
gyűjtött, tehát a Beállítások lap választása elveszett (+2 sor a `settings-screen.tsx`, +2 a
`undo-modifier-storage.ts` fájlban; exit 1: statements 99.04 < 99.11, functions 99.26 < 99.46, lines 99 <
99.08). Az írás állítása ezért külön, navigáció nélküli teszt. Az `apps/web/package.json` küszöbe nem
változott.

### 59.6 Lezárt kérdések (user döntés 2026-10-17) és nem ellenőrzött pontok

Három kérdés, amit a spec és a korábbi user döntések nem zártak le; a megvalósítás az első opciót követte, a user 2026-10-17-én mindháromnál ezt hagyta jóvá:

1. **A kártya változata. Lezárva: (a).** (a) a komponens kártyája, fejléc `<h3>` címmel (a mai állapot); (b) a lap saját,
   szakaszolt kártyája (`card__header` `<h2>` plusz leírás, `card__body`), a `settings-screen` alá
   hatókörözött szelektorokkal, ami a forrás szabályainak szelektor szintű módosítása; (c) a `packages/ui`
   `Card` bővítése nem `<p>` törzzsel, ami a `packages/ui` hatókörét bővíti.
2. **A kártya címe. Lezárva: (a).** (a) "Szerkesztő" (a mai állapot, a route tábla felirata); (b) más, a usertől kért szöveg
   (például "Billentyűk"); (c) leírás sor a cím alatt.
3. **A csonkolt felirat 320 ... 360 pixelen. Lezárva: (a).** (a) elfogadva, a design system ellipszise (a mai állapot; a
   hozzáférhető név teljes); (b) rövidebb opció felirat keskeny kijelzőn (termék szöveg döntés); (c) a
   trigger és a lista szövegének tördelése, ami a design system `select.css` és `menu.css` szabályától
   eltérés.

Nem ellenőrzött:

- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- A tároló viselkedése privát ablakban és letiltott tárolással valódi böngészőben: a dobó elérést és írást
  a unit teszt szimulálja, e2e nem méri; a felület ilyenkor a választást mutatja, de a következő betöltés az
  Automatikus értékkel indul.
- Képernyőolvasó tényleges bemondása a `label for` kötésű `combobox` gombra: a hozzáférhető nevet a
  Playwright `getByLabel` igazolja, valódi képernyőolvasó nem futott.
