# packages/ui

## Mi ez a mappa

Az `eggproject-design` design system átemelt, TypeScript plusz TSX alakú komponenskönyvtára
(SPEC-007). Domain mentes: egyetlen komponense sem ismer workflow-t, futást, eseményt vagy
providert. A tokenek, a self-hosted fontok, a topnav shell és a téma mód mellett csak azok a
komponensek kerülnek át, amiket az `apps/web` ténylegesen használ.

## Fájlok

| Téma                               | Tartalom                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-token`                     | a token barrel (`colors-and-type.css`) és 11 token CSS fájl, bájtra azonosan az `eggproject-design` skillből átemelve (SPEC-007 4.2), plusz a bájtazonosságot őrző regressziós teszt                                                                                                                                 |
| `self-hosted-font`                 | a `fonts.css` és 20 `.woff2` fájl (Roboto + JetBrains Mono, latin plusz latin-ext), bájtra azonosan átemelve, plusz a bájtazonosságot őrző regressziós teszt                                                                                                                                                         |
| `topnav-shell`                     | a `topnav-shell.css` (az átemelt `.app-pagehead`/`.app-content`/`.app-tn` blokk, a "faltól falig" override és a --ep-screen-md alatti lenyíló navigáció reszponzív szabálya), az `AppShellFrame` domain mentes React komponens és mindkét spec                                                                       |
| `media-query-breakpoint-invariant` | megvalósítás fájl nélküli téma (SPEC-002 6.2 5. pont): regressziós teszt, ami minden CSS média lekérdezés `min-width`/`max-width` literálját a `design-token/breakpoints.css` `--ep-screen-*` tokenjeihez méri                                                                                                       |
| `component-boundary-invariant`     | megvalósítás fájl nélküli téma (SPEC-002 6.2 5. pont): regressziós teszt a csomag határaira, ami a default `React` importot, a workspace importot, a `ResizeObserver`/`IntersectionObserver` hivatkozást és a barrel `export *` alakját tiltja                                                                       |
| `theme-mode`                       | a háromállapotú (`light`/`dark`/`system`) téma mód: a `ThemeMode` típus és típusőr, a `useThemeMode` hook (DOM `data-theme` és `localStorage['eggTheme']` szinkronban tartása, `matchMedia` figyelés kizárólag `system` módban) és a `ThemeModeToggle` gomb                                                          |
| `class-name-list`                  | `joinClassNames`: feltételes CSS osztálynév lista összefűzése, minden komponens téma újrahasznosítja                                                                                                                                                                                                                 |
| `aria-token-list`                  | `joinAriaTokenList`: ARIA id-hivatkozás lista (`aria-describedby`, `aria-labelledby`) összefűzése duplikátum nélkül, hogy a komponens belső azonosítója a hívóé mellé kerüljön, ne a helyére                                                                                                                         |
| `button`                           | a `.btn` gomb, öt variánssal (`primary`/`secondary`/`ghost`/`ink`/`danger`) és három mérettel (`sm`/`md`/`lg`)                                                                                                                                                                                                       |
| `badge`                            | a `.badge` jelvény, hét variánssal; a forrás `Chip` komponense nincs átemelve, mert nem tagja a tizenkét komponens listájának                                                                                                                                                                                        |
| `card`                             | a `.card` felület, `feature` (sötét, invertált) variánssal, opcionális fejléc/ikon/meta sorral                                                                                                                                                                                                                       |
| `skeleton`                         | a `.skel` betöltés-jelző, nyolc alakkal; `shape="text"` és `lines` esetén rekurzívan rajzolt sor-stack; a forrás `SkeletonList` komponense nincs átemelve                                                                                                                                                            |
| `loading-indicator`                | a `.progress` determinisztikus sávjelző (`ProgressBar`); a forrás indeterminált/logó-spinner/demo blokkjai nincsenek átemelve, mert nem tagjai a tizenkét komponens listájának                                                                                                                                       |
| `toast`                            | a `.toast-viewport`/`.toast` értesítés család: `Toast` primitív kártya, `ToastViewport` (hat pozíció) és a `useToasts` push/dismiss hook, befecskendezett időzítő porttal; a forrás `ManagedToast` hover/fókusz-szüneteltetése nincs átemelve                                                                        |
| `text-field`                       | a `.field`/`.input` szöveges mező (`TextField`): címke, hibaüzenet, vezető ikon, és a hívó `aria-describedby` értékét megőrző ARIA hivatkozás lista                                                                                                                                                                  |
| `select-field`                     | a `.select` választó (`SelectField`) **natív `<select>` alakban**, letiltott és betöltő állapottal; a forrás egyedi listbox változata (button trigger plusz `.menu` panel) nincs átemelve, mert a hatókörön kívüli Menu komponens CSS-ét igényelné                                                                   |
| `form-control`                     | a `.ctrl` jelölőnégyzet (`Checkbox`); a forrás Radio, RadioGroup és Switch exportja nincs átemelve, mert a felület egyedül a törlés megerősítő jelölőnégyzetét használja                                                                                                                                             |
| `modal`                            | a `.modal-overlay`/`.modal` modális (`Modal`): `role="dialog"`, `aria-modal`, cím és alcím ARIA hivatkozással, bezárás gombbal, `Escape` billentyűvel és háttérkattintással; a forrás megosztott dialógus verme és fókusz csapdája nincs átemelve                                                                    |
| `tab`                              | a `.tabs` aláhúzott fülsor (`Tabs`): `tablist`/`tab`/`tabpanel` szemantika, kontrollált és nem kontrollált mód, roving tabindex; a forrás `Segmented` és `Pills` exportja nincs átemelve                                                                                                                             |
| `data-table`                       | a `.data-table` tábla (`DataTable`), `@tanstack/react-table` motorral (natív v9 API, csak a rendezés funkcióval); a másodlagos oszlopok elrejtése a `--ep-screen-lg` alatt CSS-ben történik, nem JavaScriptben; a forrás demó oldal többi funkciója (eszköztár, szűrők, lapozó, rögzítés, átrendezés) nincs átemelve |

## Függőségi irány

Az `ui` L2 réteg (SPEC-002 4. szekció). A `dependencies` mezője **nem tartalmaz workspace
csomagot**: a `core` és a `protocol` bejegyzés törölve, mert a csomag domain mentes, egyetlen
fájlja sem importálja őket (SPEC-007 3.1). A `react`, a `react-dom` és a `@tanstack/react-table`
külső csomagokra épül, mindhárom a gyökér `package.json` `catalog` mezőjéből.

## Szabályok

A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi (SPEC-002 6. szekció): egy
szint mély, tárgykör mappa nélkül. Az átemelt CSS fájlok bájtra azonosak a forrással (a
`design-token` barrel `@import` útvonalai az egyetlen kivétel); a bájtazonosságot a forrásból
egyszer kiszámított SHA-256 lenyomatokhoz hasonlító regressziós teszt őrzi, mert a forrás skill
könyvtár futásidőben (CI-ben, más gépen) nem érhető el (SPEC-007 4.2). Licencállítás egyik
fájlban sincs (SPEC-007 4.4, M-34); a származást a `fonts.css` már ma meglévő fejléce nevezi
meg, a `design-token` és a `topnav-shell` provenienciáját ez a `CLAUDE.md` és a
`docs/research/2026-09-01-spec007-f0-meresek.md` dokumentálja. A `.prettierignore` kizárja a
`design-token` és a `self-hosted-font` mappát, plusz a `topnav-shell.css` és a komponens CSS
fájlokat, fájlonként (SPEC-007 4.5).

**Az F3 fázis nyitott pontja lezárva.** A `design-token/colors-and-type.css` token barrelt
korábban egyetlen fájl sem importálta: a komponens CSS-ek csak HASZNÁLTÁK a `--ep-*` változókat
(pl. `background:var(--ep-bg-sunken)`), a DEFINÍCIÓ (`:root`, `[data-theme="dark"]`) soha nem
jutott be a `vite build` kimenetébe, tehát az egész design system (szín, betűtípus, sötét téma)
inaktív volt minden képernyőn, hiba nélkül - a build + preview + Playwright screenshot vizuális
ellenőrzés fedte fel (F3 lezárása, gyökér `CLAUDE.md`). A három korábban mérlegelt út közül a
harmadikat választottuk: az `AppShellFrame.tsx` (a legkülső, minden alkalmazás-összeszerelésben
garantáltan jelen lévő komponens) importálja a barrelt, ugyanolyan mellékhatás-import mintával,
mint minden más komponens a saját CSS-ét. A barrel mellékhatás import útja kizárva marad (SPEC-007 16. szekció 5. kritériuma: a barrel csak nevesített újraexportot tartalmazhat), az önálló
`exports` bejegyzés útja is kizárva marad (a repo-szintű "`exports` a `src/index.ts`-re mutat"
konvenciót törné). Regresszió: `topnav-shell/AppShellFrame.spec.tsx` (forrás-szintű import
ellenőrzés) és `apps/web/e2e/design-tokens.spec.ts` (valódi böngésző + valódi build ellen igazolja
a `--ep-bg` és a kizárólag sötét `--ep-tint` tényleges feloldását).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-007-frontend-alkalmazas.md`](../../docs/spec/SPEC-007-frontend-alkalmazas.md)
- [`../../docs/plan/PLAN-008-frontend-alkalmazas.md`](../../docs/plan/PLAN-008-frontend-alkalmazas.md)
- [`../../docs/research/2026-09-01-spec007-f0-meresek.md`](../../docs/research/2026-09-01-spec007-f0-meresek.md)
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
