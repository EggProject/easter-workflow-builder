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
új `PlusIcon`, a `useIsAddNodeCompact` hook és a `AddNodeMenuButton` új ága, mind fedett.

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
dönt, kitalált szám nincs. A literált a `add-node-compact-media-query.spec.ts` a token fájlból
olvasva hasonlítja össze.

**Miért JS (`matchMedia`) és nem CSS.** A `.btn--icon` osztály a `button` elemen áll, amit media query
nem tud rátenni, a szabályait pedig saját osztályba másolni nem szabad (szabálykönyv 11. szekció,
"Csak létező design system elem használható"). A váltást a `useIsAddNodeCompact` hook adja
(`useSyncExternalStore`, `MediaQueryList` `change` esemény), a `GraphEditorScreen` `AddNodeMenuButton`
komponense ágazik rá.

**Az ikon.** A vendorolt `lucide@0.525.0` `Plus` ikonja (saját olvasás:
`eggproject-design-components/assets/vendor/lucide.min.js`, a fejléc `lucide v0.525.0`, az ikon
leírója `["path",{d:"M5 12h14"}],["path",{d:"M12 5v14"}]`, a `Plus` kulcson), 24x24 viewBox, 1.75
vonalvastagság, a repó meglévő inline SVG konvenciója szerint (`aria-hidden`). A gomb `size="sm"`,
`variant="secondary"`, `icon`, `aria-label="Hozzáadás"`; a menü ugyanaz.

**Teszt.** Unit: `add-node-compact-media-query.spec.ts` 1 (a literál a token értéke),
`use-is-add-node-compact.spec.tsx` 4 (illeszkedés, nem illeszkedés, `change` esemény, leiratkozás),
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

## T-009-51

A visszavonás és az újra elvégzés (SPEC-008 5.10, O-22): a történet tiszta függvénye, a billentyű
szűrő, a figyelő, a rögzítés bekötése és a lábléc két ikon gombja. **A lépés a lábléc szélességén
megállt** (51.6): a két gomb a spec szerinti helyén 320 pixelen nem fér ki.

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
  mentés alatt.
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
