# A gráf szerkesztő csomópont felvétele: források és mérések (D1 munkacsomag, 2026-10-14)

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
  `pagination.css` öt és a `drawer.css` tíz ilyen karaktere.

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

- `packages/ui/src/context-menu`: 40 teszt három fájlban (`ContextMenu.spec.tsx` 31,
  `compute-context-menu-position.spec.ts` 8, `context-menu-byte-identity.spec.ts` 1), mind zöld.
- A teljes `bun run test` 546 tesztfájl, 4559 teszt, zöld, a lefedettség mind a négy metrikán 100
  százalék, a `ContextMenu.tsx` és a `compute-context-menu-position.ts` is.
- Szándékos rontással igazolva, hogy a tesztek nem vakok: a "nyitási ciklusonként egy zárás" őr
  eltávolítása hat tesztet buktat (a programozott fókusz visszaadás a happy-dom alatt is
  `focusout` eseményt vált ki, ami nélküle második zárási kérést adna); a visszaadási cél
  felülírása áthelyezéskor egy tesztet buktat.

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
