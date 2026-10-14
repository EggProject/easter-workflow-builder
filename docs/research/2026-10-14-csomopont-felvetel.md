# D1: csomópont felvétel és törlés

A PLAN-009 F9 fázisának D1 munkacsomagja (SPEC-008 5.8, 5.9, 5.10, 11.4) ide vezeti a forrással
igazolt tényeit és a saját méréseit, lépésenként külön szekcióban. A kódban csak a forrás neve
vagy ez a fájl áll, a mérési próza és a nyers számok itt (`.claude/CLAUDE.md` 4. szekció 3. pont).
Az e2e lefedettség előtte és utána darabszáma lépésenként ide kerül (PLAN-009 F9, "Az e2e
lefedettségi küszöb kezelése").

## T-009-50

A design system `tooltip` komponensének átemelése a `packages/ui` csomagba, a `shortcut` propjával
(`packages/ui/src/tooltip/`).

### 1. A forrás

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

### 2. A hozzáférhetőségi szerződés forrásai

| Tény                                                                                                                                             | Forrás                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A tipp konténer `role="tooltip"`, a triggert `aria-describedby` köti hozzá                                                                       | [W3C APG, Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/), "WAI-ARIA Roles, States, and Properties"; [MDN, ARIA `tooltip` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tooltip_role) |
| Fókuszra és az egér fölé vitelére nyílik; a tipp nem kap fókuszt, a fókusz a triggeren marad                                                     | APG, "About This Pattern" és "Keyboard Interaction" 1. megjegyzés; MDN, "Description" és "Required JavaScript features"                                                                                                                           |
| Az `Escape` zárja                                                                                                                                | APG, "Keyboard Interaction"; MDN, "Keyboard interactions"                                                                                                                                                                                         |
| Fókusszal nyitott tipp a fókusz elvesztésekor (`onBlur`) záródik; egérrel nyitott tipp addig nyitva, amíg a kurzor a triggeren vagy a tippen van | APG, "Keyboard Interaction" 2. és 3. megjegyzés. A 3. megjegyzés második fele (a tipp fölött is nyitva marad) a forrás CSS-ével nem teljesül, lásd a 3. szekciót                                                                                  |
| A tipp elemre `aria-describedby` mutat, mielőtt vagy amikor megjelenik; a hívó meglévő leírása nem veszhet el                                    | MDN, "Description" ("Elements with the `tooltip` role should be referenced through the use of `aria-describedby` before or when the tooltip is displayed"); a meglévő hivatkozás megőrzése a forrás `Tooltip.jsx` viselkedése, saját olvasás      |

Az APG Tooltip minta oldala maga jelzi: "This design pattern is work in progress; it does not yet
have task force consensus". A tény sor tehát a W3C munkaanyagára és az MDN-re áll, két független
forrás.

### 3. A forrás korlátja: a panelre nem vihető át az egér

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

A port a CSS bájtazonossága miatt ezen nem változtat. **Nem ellenőrzött böngészőben**: a fenti a
CSS statikus olvasása és a két dokumentált forrás, valódi böngészős mérés nincs, mert a
komponensnek még nincs fogyasztója (T-009-51). Döntést igénylő pont, lásd a jelentés nyitott
kérdését.

### 4. A megvalósítás döntései

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
- **Forrás viselkedés, ami a portban is megvan** (saját unit mérés, happy-dom, hamis óra): ha az
  egér belép, 100 ms múlva a trigger fókuszt kap, majd a fókusz elvész, miközben az egér még
  bent van, a tipp záródik. A `focus` és a `blur` lemondja a függő egeres nyitást, így a `hovered`
  állapot sosem lesz igaz. A "az egyik nem zárja be azt, amit a másik tart" szabály ezért csak a
  már nyitva tartó állapotra igaz. Nem módosítottuk, a forrás szerint maradt.

### 5. Unit teszt és lefedettség

- `packages/ui/src/tooltip`: 34 teszt két fájlban (`Tooltip.spec.tsx` 33, `tooltip-byte-identity.spec.ts`
  1), mind zöld. Az egér alatti időzítő tesztjei a Vitest hamis óráját használják
  (`vi.useFakeTimers()`, `vi.advanceTimersByTime`).
- A teljes `bun run test`: 551 tesztfájl, 4847 teszt, zöld, a lefedettség mind a négy metrikán 100
  százalék, a `Tooltip.tsx` is.
- A kilenc kapu a commitolt fán zöld: `format:check`, `typecheck`, `lint`, `test`, `build`,
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

### 6. Az e2e lefedettség előtte és utána

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

### 7. Nem ellenőrzött

- A tipp valódi böngészőben, valódi hover és fókusz eseményekkel: nincs e2e, mert nincs fogyasztó
  (a T-009-51 a két ikon gombbal hozza). A hamis órás unit teszt a React eseménykezelőt hívja
  (`mouseover`, `focusin`, `keydown` az elemen), nem valódi bemenetet.
- Firefox és WebKit: az `apps/web/playwright.config.ts` csak chromiumot definiál.
- Képernyőolvasó felolvasása: az `aria-describedby` jelenlétét a teszt ellenőrzi, a felolvasást nem.
- A `disabled` gombra tett tipp: a T-009-51 Visszavonás és Újra gombja üres listánál `disabled`,
  és a letiltott `button` nem fókuszálható; hogy a burkolóra ilyenkor érkezik-e egéresemény, nem
  ellenőrzött. A viselkedést a T-009-51 mérje.
