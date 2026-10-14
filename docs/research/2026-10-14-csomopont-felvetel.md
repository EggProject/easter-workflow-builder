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
  button nyíl ikonja (`aria-hidden`), a `Menu`/`MenuItem` pár triggerje. A `secondary` az 5.8
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

### 28. Nyitott kérdés: a lábléc gombsora 320 pixelen nem fér ki

**A mérés** (valódi Chromium, `apps/web` preview build, a gombok `getBoundingClientRect()` értéke, a
lábléc `scrollWidth - clientWidth` különbsége):

| Szélesség | Állapot  | Gombok (bal-jobb pixel)                                                        | Lábléc túllógás |
| --------- | -------- | ------------------------------------------------------------------------------ | --------------- |
| 320       | `main`   | Futás indítása 90-191, Mentés 203-269, További műveletek 268-296               | 0               |
| 320       | jelen ág | Futás indítása 36-137, Hozzáadás 149-256, Mentés 268-334, További műv. 333-361 | 41              |
| 375       | jelen ág | Futás indítása 36-137, Hozzáadás 149-256, Mentés 268-334, További műv. 333-361 | 0               |

320 pixelen (a `responsive.spec.ts` támogatott szélességei között, Playwright `iPhone SE`) a "Mentés"
jobb széle és a split button nyíl gombja a nézetablakon kívül esik, az "Elrendezés" menü ott nem
érhető el. A dokumentum vízszintes túllógása 0, ezért a `responsive.spec.ts` szerkesztő tesztje
zöld marad; a `page-footer.css` kommentje szerint viszont "a gombsornak minden viewport
szélességen teljes egészében a képernyőn kell maradnia". A gombsor magában 325 pixel, tehát a belső
margó csökkentése nem elég. A SPEC-008 5.8 és 10. szekciója nem dönti el, mi legyen szűk nézetben.

- **Mi a viselkedés addig:** 375 pixeltől minden gomb a nézetablakon belül van; 320 pixelen a
  "Mentés" részben, a nyíl gomb teljesen kilóg.
- **Mi zárná le:** user döntés a lehetőségek közül (például: a gombsor a `--ep-screen-sm` alatt két
  sorba törik; a "Hozzáadás" ott ikon gombbá válik `aria-label`-lel; vagy egy gomb a split button
  menüjébe kerül), utána egy e2e állítás, hogy minden lábléc gomb `toBeInViewport({ ratio: 1 })`
  minden támogatott szélességen.

### 29. Nem ellenőrzött

- A két pozíció szabály valódi Chromiumban (a kattintás pontja az új kártya dobozán belül; a gomb
  útján a látható vászon középpontja a kártya dobozán belül, a panel megnyílása után is), az M-99
  mezőlista, a csomóponton és élen nem nyíló menü és a két téma: a PLAN-009 T-009-45 e2e lépése
  (75 ... 77. kritérium).
