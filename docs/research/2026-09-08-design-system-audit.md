# Design system audit: kizárólag design system elem használva-e, input mezők, card in card

**Dátum:** 2026-09-08
**Ág:** `feat/spec-008-grafszerkeszto` (HEAD `143f484`)
**Kiváltó ok:** felhasználói visszajelzés, amely szerint "csak olyan elemet hasznalhatsz amit tartalmazz [a design
skill], ha valami hianyzik jelezned kell! kepeken latszik hogy inputokra sem jot hasznaltal vagy a
css nagyon nincs rendben". Ez felderítés és ellenőrzés, kódot nem módosít.
**Vizsgált fájlok:** `.claude/skills/eggproject-design*` (mind a négy skill), `packages/ui/src/`,
`apps/web/src/node-inspector/`, `apps/web/src/graph-editor/`, `apps/web/src/graph-node-card/`,
`packages/ui/src/topnav-shell/`, `docs/spec/SPEC-007-frontend-alkalmazas.md`,
`docs/spec/SPEC-008-graf-szerkeszto-es-futas-nezet.md`, a három mellékelt képernyőkép
(`editor-node-inspector.png`, `editor-node-inspector-error.png`, `editor-desktop-light.png`).
**Módszer:** minden állítás vagy tényleges `diff`/`grep`/`Read` eredménye, vagy a fájlban álló,
szó szerint idézett dokumentáló komment. Ahol a projekt fájlja saját kommentben megnevezi a
forrást és az eltérést, azt ellenőriztem a tényleges forrásfájl elolvasásával, nem a kommentnek
hittem el.

---

## 1. A design system teljes komponens leltára

A négy skill közül az `eggproject-design-components` tartalmazza az egyedi komponenseket. A
`components/` alatt **52 komponens mappa** van, ami a felderítésben említett szám, saját
`find`/`ls` számlálással megerősítve, nem emlékezetből:

```
accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group,
calendar, card, carousel, charts, code-block, collapsible, command-palette, context-menu,
data-table, date-picker, divider, dot, drawer, empty, feed-indicator, file-upload, form-controls,
hover-card, input, input-group, input-otp, kbd, loading, menu, menubar, modal, nav, pagination,
popover, resizable, scroll-area, select, skeleton, slider, splash, stat, stepper, tabs, tag-input,
textarea, toast, toggle, tooltip
```

A `references/component-catalog.md` saját szóhasználata szerint ez "32 eredeti + 20 shadcn parity
kiegészítés" (a fájl 396. sora: "shadcn parity additions (20 components)"), összesen 52. A két
szám (könyvtárszámlálás és a katalógus própzája) egyezik.

A másik három skill nem önálló komponens, hanem sablon/keret:

| Skill                                                        | Mit ad                                                                                                                                                                                             | Releváns fájlok                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `eggproject-design`                                          | tokenek (szín, típus, spacing, radius, elevation, motion, **breakpoints**), betűtípus, logó                                                                                                        | `tokens/*.css`, `colors_and_type.css`, `references/token-reference.md` |
| `eggproject-design-app-common`                               | **öt** oldalkeret (`_shell.css`): sidebar, topnav, marketing, docs, focus                                                                                                                          | `_shell.css`, `skeletons/shell-*.html`                                 |
| `eggproject-design-admin-app-examples` / `-web-app-examples` | teljes, összeépített példaoldalak (analytics, billing, settings, signin, pricing, ...), amelyek NEM önálló, újrafelhasználható komponensek, hanem a fenti komponensekből összerakott minta-oldalak | `examples/*.html`, `examples/*.jsx`                                    |

---

## 2. A projekt frontend komponens leltára

### 2.1 A design system átemelt témái a `packages/ui/src/` mappában

| Téma mappa          | Forrás komponens                                                                        | Hatókör a forráshoz képest                                                                |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `button`            | `button/button.css`                                                                     | **teljes**, bájtra azonos (lásd 3. szekció)                                               |
| `badge`             | `badge/badge.css`                                                                       | részleges, mert a `.chip` család kimaradt                                                 |
| `card`              | `card/card.css`                                                                         | **teljes**, bájtra azonos                                                                 |
| `breadcrumb`        | `breadcrumb/breadcrumb.css`                                                             | részleges + dokumentált kiegészítés (`<ol>/<li>` szemantika)                              |
| `modal`             | `modal/modal.css`                                                                       | **teljes**, bájtra azonos                                                                 |
| `tab`               | `tabs/tabs.css`                                                                         | részleges, mert csak `UnderlineTabs` maradt meg, a Segmented/Pills kimaradt               |
| `toast`             | `toast/toast.css`                                                                       | **teljes**, bájtra azonos                                                                 |
| `loading-indicator` | `loading/loading.css`                                                                   | részleges, mert csak `ProgressBar` maradt meg, az indeterminate/LogoSpinner kimaradt      |
| `skeleton`          | `skeleton/skeleton.css`                                                                 | részleges, mert a `.skel-list*` (SkeletonList) kimaradt                                   |
| `text-field`        | `input/input.css`                                                                       | részleges + 1 dokumentált hozzáadott sor (`box-sizing`)                                   |
| `select-field`      | `select/select.css`                                                                     | részleges, mert csak a natív `<select>` retrofit maradt meg, a Combobox kimaradt          |
| `form-control`      | `form-controls/form-controls.css`                                                       | részleges, mert csak a Checkbox maradt meg, a Radio/Switch/ctrl-card kimaradt             |
| `data-table`        | `data-table/datatable.css`                                                              | részleges + dokumentált mobil-specifikus kiegészítés                                      |
| `menu`              | `menu/menu.css`                                                                         | részleges + dokumentált pozícionálási eltérés (`fixed` + portál)                          |
| `resizable`         | `resizable/resizable.css`                                                               | **teljes**, bájtra azonos                                                                 |
| `topnav-shell`      | `eggproject-design-app-common/_shell.css` (`.app-tn*`, `.app-pagehead`, `.app-content`) | részleges (csak a topnav shell, az 5-ből) + több dokumentált, mért hibajavító kiegészítés |
| `design-token/*`    | `eggproject-design/tokens/*.css`, `colors_and_type.css`                                 | teljes tokenkészlet átemelve                                                              |

Minden sor forrása a saját CSS fájl fejlécének "Forrás: ..." komментje, amit a 3. szekcióban
ténylegesen `diff`-eltem a skill fájljával.

### 2.2 Saját gyártmány az `apps/web/src/` mappában (nincs a design systemben)

| Téma                           | Mit csinál                                          | Van-e design system megfelelő                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph-editor`                 | a React Flow vászon kerete, elrendezés              | nincs, mert a React Flow saját komponens, amit a design system nem ismer                                                                                                                 |
| `graph-node-card`              | a vászon egyedi node-doboza                         | nincs önálló "graph node" komponens a design systemben; a `.graph-node-card` CSS-e a `.card` mintáját követi (border+radius+bg-elevated+shadow), de **nem** a `.card` osztályt használja |
| `node-inspector`               | a jobb oldali beállítás sáv, mezőnkénti szerkesztők | a `.field`/`.input`/`.select` osztályokra épül (`text-field`, `select-field` téma), de a `.inspector-section` doboz **saját, nem design system osztály** (lásd 5. és 7. szekció)         |
| `workflow-list`, `run-history` | listaképernyők                                      | a design system komponenseire épülnek (`data-table`, `modal`, `badge`, `Button`)                                                                                                         |
| `app-shell`                    | a topnav shell React kerete                         | a `topnav-shell` témára épül                                                                                                                                                             |

---

## 3. Tételes eltérések, annak vizsgálatával, hogy bájtra egyeznek-e a source-szal

Minden `packages/ui/src/**/*.css` fájlt szó szerint összevetettem a megfelelő
`eggproject-design-components` / `eggproject-design-app-common` forrásfájllal (`diff`, a
projekt saját fejléc-kommentjének kihagyásával). Eredmény: **minden egyes eltérés dokumentálva
van a fájl tetején**, egy indoklással. Nem találtam egyetlen néma (dokumentálatlan) eltérést sem.

| Fájl                                                                                                  | Eltérés a forrástól                                                                                                                                                     | Indokolt-e                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text-field/text-field.css`                                                                           | +1 sor: `.input { box-sizing: border-box; }`                                                                                                                            | **igen**, mert a fájl saját kommentje szerint mért hiba javítása: a projekt nem emeli át a forrás univerzális `* { box-sizing: border-box }` resetjét, enélkül a mező 30px-szel túlnyúlt a szülőjén |
| `select-field/select-field.css`                                                                       | +1 szabály: `.select--error { border-color: var(--ep-danger); }`; a Combobox szakasz és a `menu.css` import kihagyva                                                    | **igen**, mert a forrás Select komponense nem ismer hibaüzenetet, a `SelectField` viszont a `TextField` hibamintáját veszi át; a Combobox nincs használva                                           |
| `form-control/form-control.css`                                                                       | csak Checkbox marad, Radio/Switch/ctrl-card kihagyva                                                                                                                    | **igen**, mert a SPEC-007 6.1 szerint a felület egyedül a törlés megerősítő jelölőnégyzetét használja                                                                                               |
| `tab/tab.css`                                                                                         | csak `.tabs` (UnderlineTabs) marad, `.seg`/`.pills` kihagyva                                                                                                            | **igen**, mert a felület a futás előzmények fülezésére csak a tablist változatot használja                                                                                                          |
| `select-field`, `loading-indicator`, `skeleton`, `badge`, `breadcrumb`, `data-table`                  | további részleges kihagyások                                                                                                                                            | **igen**, minden esetben a fel nem használt al-komponensre hivatkozva                                                                                                                               |
| `menu/menu.css`                                                                                       | a `.menu` pozíciója `position: fixed` + portál, a forrásban relatív/abszolút                                                                                            | **igen**, ugyanis mért hiba állt fenn: a táblázat sor műveletek triggere egy görgethető törzsben ül, a relatív pozíciós panel levágódott volna                                                      |
| `breadcrumb/breadcrumb.css`                                                                           | `.breadcrumb__list`/`.breadcrumb__listItem` új osztály, `<ol>/<li>` szemantikával                                                                                       | **igen**, a11y okból, mert a forrás JSX-e nem `<ol>/<li>` szerkezetű                                                                                                                                |
| `topnav-shell/topnav-shell.css`                                                                       | 8 különálló, dokumentált "ÚJ blokk" (faltól falig felülírás, magasságkitöltés, alsó légtér, page-head térköz, reszponzív navigáció, hamburger gomb, márkanév csonkolás) | **igen**, mindegyik mért hibára vagy felhasználói kérésre hivatkozik                                                                                                                                |
| `button/button.css`, `card/card.css`, `modal/modal.css`, `toast/toast.css`, `resizable/resizable.css` | **nincs eltérés**, mert bájtra azonos (az `@import` sor kivételével, ami a globálisan betöltött tokenek miatt marad ki mindenhol)                                       | nem releváns                                                                                                                                                                                        |

**Összefoglaló verdikt a 3. szekcióra:** a `packages/ui` szinten **nincs "elsodródott", indokolatlan
CSS eltérés**. Minden sor, ami nem egyezik a forrással, saját kommentben meg van indokolva, a
projekt szabálykönyve (`.claude/CLAUDE.md` 5. szekció "Csak azt írod át, amit muszáj") szerint.

---

## 4. Az input mezők részletes összevetése

### 4.1 A `text-field` (`<input>`) mező RENDBEN van

`packages/ui/src/text-field/text-field.css` a `TextField.tsx`-szel együtt pontosan a design
system `.field`/`.input`/`.field__label`/`.field__error` mintáját adja, natív `<input>`-ra építve
(`TextField.tsx` `<input className={joinClassNames('input', hasError && 'input--error', ...)}>`).
Ez a helyes, dokumentált átemelés.

### 4.2 A `select-field` (`<select>`) mező RENDBEN van

`SelectField.tsx` natív `<select class="select">` elemet ad ki, ami **pontosan az a változat, amit
maga a forrás CSS megnevez és támogat** ("Native `<select>` shares the .select shell", lásd a
`select.select` szabály a design system `select.css`-ében). A `SelectField.tsx` fejléc-kommentje
ezt explicit ki is mondja: a forrás `Select.jsx` egyedi listbox változatát (button trigger + `.menu`
panel) tudatosan nem választották, mert az a hatókörön kívüli `Menu` komponens CSS-ét igényelné.

> **HELYESBÍTÉS (2026-09-09).** Ez a "rendben van" minősítés a JELÖLÉS és a CSS FORRÁSSZÖVEG
> szintjén helyes, a KIRAJZOLT eredmény szintjén viszont hamis volt, és az audit módszere
> emiatt elégtelen: a számított stílust nem mérte. A `.select` szabály `font-family: inherit`
> deklarációja a `body` betűcsaládjától függ, ami a projektben nem volt beállítva (a forrás
> `_shell.css` `body` szabályából csak a `margin: 0` került át), ezért a natív `<select>`
> chromium alatt mérten `"Times New Roman"` TALPAS betűvel jelent meg, miközben a design
> system saját példáján `Roboto`. Ugyanez érintette a `.btn` gombokat és minden más elemet,
> ami az öröklésre támaszkodott. Javítva a `topnav-shell.css` `body` szabályával; a
> regresszió a tényleges, számított stílust állítja:
> `apps/web/e2e/form-control-typography.spec.ts`.

### 4.3 A `form-control` (jelölőnégyzet) RENDBEN van

Csak a Checkbox alrészt emeli át, dokumentáltan (lásd 3. szekció).

### 4.4 A többsoros mezők **NEM design system elemet használnak**

Ez a súlyos találat. A design systemben **létezik egy önálló, kész `textarea` komponens**
(`eggproject-design-components/components/textarea/textarea.css`), saját `.textarea` osztállyal,
`min-height: 80px`, `resize: vertical`, `--sm`/`--lg`/`--ghost` méretvariánsokkal, saját
fókusz/hiba/letiltott állapotokkal. Ez a komponens **soha nem lett átemelve** a `packages/ui`-ba
(nincs `packages/ui/src/textarea/` mappa).

Ehelyett a projekt saját, `packages/ui`-n kívüli komponenst írt
(`apps/web/src/node-inspector/TextAreaField.tsx`), ami a **`text-field` téma `.input`
osztályát** (az egysoros mező stílusát) alkalmazza egy `<textarea>` elemre:

```tsx
// apps/web/src/node-inspector/TextAreaField.tsx, 48-55. sor
<textarea
  {...rest}
  id={resolvedId}
  rows={rows ?? 3}
  className={joinClassNames('input', hasError && 'input--error', className)}
  ...
/>
```

A fájl saját kommentje (16-23. sor) beismeri, hogy ez nem a design system bővítése: _"A
`packages/ui` csomagnak nincs saját textarea komponense ... Ez a `node-inspector` téma saját,
egyedi fogyasztóra szabott mezője, nem a design system bővítése"_. Ez az állítás **csak a
`packages/ui`-ra igaz**, hiszen a tényleges forrás design systemben (`eggproject-design-components`)
VAN dedikált `textarea` komponens, csak azt soha nem emelték át. A `.node-inspector` saját CSS-e
ezt tovább toldozza (`node-inspector.css` 158-160. sor: `.node-inspector textarea.input { resize:
vertical; }`), mert az `.input` osztálynak nincs a design systemben `min-height`je vagy natív
többsoros geometriája.

**Ez a mintázat nem elszigetelt**: **16 fájl** használja a `TextAreaField`-et (`grep -rl
"TextAreaField" apps/web/src/node-inspector --include="*.tsx"`): `SystemPromptField.tsx`,
`BranchNodeFields.tsx`, `AgentDefinitionEntryFields.tsx`, `ErrorHandlerNodeFields.tsx`,
`JsonTextAreaField.tsx`, `LoopNodeFields.tsx`, `JoinNodeFields.tsx`, `ScriptNodeFields.tsx`,
`AgentStepConfigFields.tsx`, `NodeInspector.tsx`, `HumanApprovalNodeFields.tsx`,
`StructuredOutputField.tsx`, `FanOutNodeFields.tsx`, `SubWorkflowNodeFields.tsx`,
`SandboxField.tsx`, vagyis **minden** többsoros mező a node inspectorban (prompt sablon, JSON
szerkesztő, szkript törzs, stb.) ezt a nem design system elemet használja. Ez a felhasználó
gyanújának pontos megerősítése: az inputokra valóban nem a helyes elemet használták, mert a
helyes elem (`.textarea`) létezik a design systemben, csak sosem lett bevezetve.

### 4.5 A szám mező natív spinnere nem stílusozott, de ez a design system saját hiánya is

A "Max. próbálkozások száma" mező (`ErrorHandlerNodeFields.tsx:28-36`) egy natív
`<input type="number">` a `TextField`-en keresztül. A `TextField.tsx` a `type` propot változtatás
nélkül továbbadja (`{...rest}` a natív `<input>`-ra, 36-57. sor), különleges kezelés nélkül.
Sem a projekt `text-field.css`-e, sem az **eredeti forrás** `input.css`-e nem tartalmaz
`::-webkit-inner-spin-button`/`::-webkit-outer-spin-button`/`appearance: textfield` szabályt, amit
grep-pel ellenőriztem, nulla találat mindkét fában (`apps/web/src`, `packages/ui/src`). A mellékelt
`editor-node-inspector-error.png` képen látható, natívan kirajzolt fel/le nyilas doboz emiatt
**nem projekt-specifikus eltérés a forrástól**, hanem a design system `Input` komponensének saját,
dokumentálatlan hiánya `type="number"` esetére, mert a forrás `input.html` demója sem mutat be
`type="number"` mezőt.

### 4.6 Összefoglaló verdikt az input mezőkre

| Mező                                              | Helyes design system elemet használ-e                           | Megjegyzés                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Egysoros szöveg (`TextField`)                     | igen                                                            | `.field`/`.input`, natív `<input>`                                                                                                                           |
| Legördülő (`SelectField`)                         | igen                                                            | natív `<select class="select">`, a forrás megnevezett retrofit útja                                                                                          |
| Jelölőnégyzet                                     | igen                                                            | `.ctrl`/`.ctrl__box`                                                                                                                                         |
| **Többsoros szöveg** (`TextAreaField`, 16 helyen) | **NEM**                                                         | a design system saját `.textarea` komponensét helyette az `.input` (egysoros) osztály viseli egy `<textarea>`-n; a `.textarea` komponens sosem lett átemelve |
| Szám mező spinnere                                | vizuálisan zavaró, de forrás-eredetű hiány, nem projekt-eltérés | a design system `Input`-ja sem kezeli                                                                                                                        |

---

## 5. A most kért öt elem verdiktje

### 5.1 A split button / button group komponens **LÉTEZIK**

`eggproject-design-components/components/button-group/button-group.css` + `.html`. Osztály:
`.button-group` (`.button-group--vertical` a függőleges variáns). A demo fájl kifejezetten
"Mixed (split button)" címmel mutatja be a mintát:

```html
<div class="button-group" role="group" aria-label="Publish actions">
  <button type="button" class="btn btn--primary">Publish</button>
  <button type="button" class="btn btn--primary btn--icon" aria-label="More options">
    <svg ...><path d="m3 5 4 4 4-4" /></svg>
  </button>
</div>
```

A `packages/ui`-ba **nincs átemelve** (nincs `packages/ui/src/button-group/` mappa), így a projekt
egyelőre nem használja, de a design system eleme létezik és pontosan a kért split button mintát adja.

### 5.2 Az Accordion komponens **LÉTEZIK**

Az `eggproject-design-components/components/accordion/` mappában található `Accordion.jsx`, `accordion.css`,
`accordion.html`. Osztályok: `.accordion`, `.accordion__item`, `.accordion__heading` (natív
`<h3>`), `.accordion__header` (gomb, `aria-expanded`), `.accordion__chevron`, `.accordion__body`
(natív `hidden` attribútummal rejtett). Három vizuális variáns: `.accordion--bordered`,
`.accordion--separated` (kártyánként külön doboz), `.accordion--subtle`. A SPEC-007 6.1 szekció 409. sora ezt kifejezetten a "kimarad, később pótlandó" 40 komponens között sorolja fel, vagyis a
hiánya **dokumentáltan tudatos döntés**, nem felfedezetlen hiány. A `packages/ui`-ba **nincs
átemelve**.

### 5.3 Az icon button variáns **LÉTEZIK, és a `Button` komponens már be is köti**

`button.css` `.btn--icon` szabálya (négyzet geometria, minden szín-variánssal és mérettel
kombinálható, lásd a 249-268. sor a forrásban). A `packages/ui/src/button/Button.tsx` **már
támogatja** ezt props szinten:

```tsx
// packages/ui/src/button/Button.tsx, 17. és 60. sor
readonly icon?: boolean; // ".btn--icon (forrás button.css)"
...
icon && 'btn--icon',
```

Vagyis az icon button variáns nemcsak létezik a design systemben, hanem a projekt saját `Button`
wrappere is kész rá. Csak a `NodeInspector.tsx` "Bezárás" gombja (134. sor) nem ezt használja,
hanem egy szöveges `size="sm"` gombot. Az elem tehát **rendelkezésre áll, csak nincs ehhez a
konkrét gombhoz alkalmazva**.

### 5.4 A sticky page footer (státusz + gombsor lehelyezése) **HIÁNYZIK**

A design system egyetlen skilljében sincs "oldal-szintű, lenn rögzített akciósáv" minta.
Konkrétan, ami VAN:

- `.app-side__footer` (`eggproject-design-app-common/_shell.css`), ami a **sidebar shell**
  alján álló, felhasználó-kártya jellegű doboz (avatar + név + téma váltó), nem egy tetszőleges
  tartalmú, gombsort hordozó sáv, és nem is `position: sticky`/`fixed` a viewporthoz, mert a sidebar
  saját `position: sticky; top: 0; height: 100vh` konténerén belül van.
- `.modal__footer` (`eggproject-design-components/components/modal/modal.css`, 89-95. sor), ami
  **modális dialógushoz** tartozó lábléc, nem oldal-szintű.
- `.design-mark-footer` (`eggproject-design-app-common/index.html`), ami marketing oldal lábléce,
  nem sticky.

Egyik sem a kért minta (egy teljes szélességű, a viewport aljához rögzített, görgetés közben is
látható sáv állapot- és akció-elemekkel). **Ez ténylegesen hiányzó elem.**

### 5.5 A small gomb méret variáns **LÉTEZIK**, de a projekt nem következetesen alkalmazza

`.btn--sm` létezik (`button.css` 244. sor: `padding: 7px 12px; font-size: 12px`), és a
`packages/ui` `Button.tsx` `size` propján keresztül elérhető. Tényleges használat
(`grep -rn "<Button" apps/web/src`, 22 előfordulás):

| Kontextus                                                                                       | Méret                      |
| ----------------------------------------------------------------------------------------------- | -------------------------- |
| Sor-szintű akciók (törlés, átnevezés, összecsukás, menü trigger, futás megszakítás/újraindítás) | **`sm`** (10 előfordulás)  |
| Node inspector "Bezárás"                                                                        | **`sm`**                   |
| Szerkesztő felső eszköztár "Mentés", "Elrendezés"                                               | **`md` (alapértelmezett)** |
| "Agent hozzáadása", "Bemeneti mező hozzáadása", "Ág hozzáadása" (lista-sor felvevő gombok)      | **`md` (alapértelmezett)** |
| "Új workflow" (lista fejléc akció)                                                              | **`md` (alapértelmezett)** |
| Mindhárom modális (`create-`/`rename-`/`delete-workflow-modal.tsx`) lábléc gombjai              | **`md` (alapértelmezett)** |

A felhasználó szabálya szerint ("a gombok alapból kicsik legyenek, és csak indokolt esetben,
például modálisban, legyenek default vagy large") **a modális gombok md mérete megfelel** a
kimondott kivételnek. Viszont a szerkesztő eszköztár (Mentés/Elrendezés) és a lista-sor felvevő
gombok (Agent/Bemeneti mező/Ág hozzáadása, Új workflow) **nem modálisban** vannak, mégis `md`
méretűek, ami **nem hiányzó design system elem**, hanem következetlen alkalmazás: a `.btn--sm`
elem megvan, csak nincs mindenhol alkalmazva, ahol a felhasználó szabálya szerint kellene.

---

## 6. Card in card előfordulások

A `.card` React komponenst/osztályt a teljes `apps/web/src` fában **egyetlen egy hely** használja
ténylegesen: `not-found-route/not-found-route.tsx:20` (`<Card title="Az oldal nem található">`).
Ez nincs beágyazva másik kártyába.

A `node-inspector`/`graph-editor` területen viszont **valódi, vizuálisan igazolt doboz-a-dobozban
elrendezés** áll, három egymásba ágyazott, bordered+rounded+background szabállyal:

1. **Legkülső: `.resizable-group`** (`packages/ui/src/resizable/resizable.css`, byte-azonos a
   forrással), ami a teljes vászon + node inspector elrendezést fogja körbe:

   ```css
   .resizable-group {
     border-radius: var(--ep-radius-xl);
     border: 1px solid var(--ep-border);
     background: var(--ep-bg-elevated);
   }
   ```

   Ez pontosan a kártya vizuális receptje (lekerekített sarok + szegély + emelt háttér), csak nem
   `.card` néven. A mellékelt `editor-desktop-light.png` és `editor-node-inspector.png` képen ez a
   világos, lekerekített keret látszik a teljes szerkesztő terület körül, a szürke oldal-háttértől
   elválasztva, ami maga a felhasználó által kifogásolt "kártya a szerkesztő köré".

2. **Középen: `.node-inspector`** (`apps/web/src/node-inspector/node-inspector.css`, 12-19. sor)
   `background: var(--ep-bg-elevated)` tulajdonsággal rendelkezik, de **nincs saját szegélye/lekerekítése**, tehát önmagában
   nem card-szerű, csupán a `.resizable-group` jobb paneljét tölti ki.

3. **Legbelül: `.inspector-section`** (`node-inspector.css`, 110-118. sor), aminek hatására minden mezőcsoport
   (pl. "prompt és provider", "hibakezelő") saját dobozba kerül:
   ```css
   .inspector-section {
     border: 1px solid var(--ep-border-subtle);
     border-radius: var(--ep-radius-md);
     background: var(--ep-bg);
   }
   ```
   A közvetlenül fölötte álló komment és a SPEC-008 253. sora is kimondja, hogy ez **szándékosan**
   "kártya alakú szakasz", a design system `settings.html` `.card`/`.card__header` mintáját
   követve. **Csakhogy ez NEM a ténylegesen átemelt `.card` osztály.** A `packages/ui/src/card/
card.css`-ben lévő, byte-azonos `.card` szabály `border-radius: var(--ep-radius-lg)`,
   `background: var(--ep-bg-elevated)` és `box-shadow: var(--ep-shadow-sm)` hármast ad, az
   `.inspector-section` viszont más radius tokent (`md`, nem `lg`), más háttér tokent (`--ep-bg`,
   nem `--ep-bg-elevated`) használ, és nincs `box-shadow`-ja. Vagyis az `.inspector-section` egy
   **a design systemben nem létező, saját kitalált osztály**, ami csak témájában ("kártyaszerű
   doboz") hasonlít a valódi `.card`-ra.

**A tényleges beágyazási lánc** (`NodeInspector.tsx` és `InspectorSection.tsx` JSX-e alapján):

```
.resizable-group                              (kártya-recept, byte-azonos forrás)
 └─ .resizable-panel (jobb oldal)
     └─ .node-inspector                       (nincs saját kártya-recept)
         └─ .node-inspector__body
             └─ <típus szerinti Fields komponens, pl. AgentStepConfigFields>
                 └─ .inspector-section          (kártya-recept, DE NEM a .card osztály)
                     └─ .inspector-section__fields
```

Egy adott képernyőn (`editor-node-inspector.png`) ez konkrétan **két, egymásba ágyazott,
látható kártya-keretet** eredményez: a teljes szerkesztő+panel köré vont keret, és azon belül
minden egyes mezőcsoport (pl. "prompt és provider") köré vont második keret. A
`node-inspector__errors` (73-81. sor, `.node-inspector__errors`) egy harmadik, hasonló receptű
doboz (szegély + lekerekítés, háttér nélkül), ami hibás mezőknél az `.inspector-section` mellett/
fölött jelenik meg (lásd `editor-node-inspector-error.png`).

**Verdikt:** a "tilos a card in card design" szabály jelenleg **sérül**, mégpedig két külön módon:
(a) egy design system kártya-szerű elem (`.resizable-group`) tartalmaz egy másik, kártya-szerű
dobozt (`.inspector-section`); (b) ez a belső doboz **nem is a design system valódi `.card`
eleme**, hanem egy attól eltérő tokenkombinációjú, projekt-saját osztály.

---

## 7. Nagy felbontású elrendezés és "slim" design

### 7.1 Amit a `breakpoints.css` ténylegesen ad

`eggproject-design/tokens/breakpoints.css` (a `design-token/breakpoints.css`-ként byte-azonosan
átemelve a `packages/ui`-ba):

| Token                                                   | Érték        | Jelentés                                                                       |
| ------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `--ep-screen-sm` … `--ep-screen-2xl`                    | 640 … 1536px | Tailwind v4 alapértelmezett töréspontok                                        |
| `--ep-screen-3xl`                                       | **1920px**   | FHD / nagy monitor                                                             |
| `--ep-screen-4xl`                                       | **2560px**   | QHD / ultrawide                                                                |
| `--ep-layout-max-wide`                                  | 1440px       | "data-dense dashboards / wide tables"                                          |
| `--ep-layout-max-fhd`                                   | 1920px       | kemény felső korlát FHD/ultrawide-on                                           |
| `--ep-layout-max-full`                                  | `none`       | full-bleed szentinel, mert maga a token hordozza a "nincs max-width" jelentést |
| `--ep-layout-measure`                                   | 65ch         | tipográfiai olvasási mérték                                                    |
| `--ep-layout-gutter-fluid`, `--ep-layout-section-fluid` | `clamp(...)` | fluid térköz                                                                   |

A fájl saját kommentje és a `SKILL.md` (143. és 169-171. sor) **kifejezetten kimondja**: _"4K
(3840px) is NOT a separate breakpoint. It is handled via the max-width cap and full-bleed
sentinel"_. Vagyis **nincs 4K-specifikus token** (nincs 3840px érték sehol egyik skillben sem, amit
grep-pel ellenőriztem), a rendszer szándékosan a meglévő max-width sapkával (`--ep-layout-max-fhd`,
`--ep-layout-max-wide`) és a full-bleed szentinellel (`--ep-layout-max-full: none`) oldja meg az
ultrawide/4K esetet, nem egy új méret-tokennel.

A projekt `topnav-shell.css` ezt már **használja is**: a "faltól falig" felülírás (91-98. sor)
pontosan a `--ep-layout-max-full` szentinelre állítja a `--ep-layout-max-app` értékét.

### 7.2 A "Slim"/sűrű (compact) minta nem globális, hanem csak komponensenkénti

A négy skillben **nincs egyetlen globális "slim mode" vagy sűrűségi kapcsoló** (nincs olyan
token vagy osztály, ami az egész felület térközét egyszerre sűrítené). Ami VAN, komponensenkénti
`--sm`/`compact` módosító:

- A `.btn--sm`, `.input--sm`, `.select--sm`, `.textarea--sm` osztályok kompakt méretvariánsok
- `FeedIndicator` `compact` prop (csak a pötty, felirat nélkül)
- `.pagination--compact`
- `LineChart` `compact`/`--h-sm` magasság variáns

A `DESIGN.md` 652. sora ezt nevesíti: _"Compact: `--sm` variant (7px 11px) for dense rows like
data-table filters."_, vagyis a "slim" design system szinten **komponensenkénti `sm`
mérettel valósítható meg**, nem egy külön globális módban. Ez összecseng az 5.5 szekció
találatával: a `.btn--sm` már létezik, "csak" következetesen kellene alkalmazni.

### 7.3 A szerkesztő köré vont kártya és a "faltól falig" ütközése

A `.resizable-group` (6. szekció) mindig `border-radius: var(--ep-radius-xl)` + `1px` szegély +
emelt háttér, ami a **design system Resizable komponensének** beépített, forrásból örökölt
tulajdonsága, és nincs hozzá "keret nélküli" variáns egyik skillben sem (ellenőrizve: a `resizable.css`
forrásban egyetlen módosító osztály sincs a `.resizable-group`/`.resizable-group--vertical`
kettőn kívül). Emellett az `.app-content` (a topnav shell átemelt, byte-azonos szabálya)
`padding: 8px 40px 80px` értéket ad minden oldalon (a szerkesztő screen-re szűkítve az alsó padding
már csökkentve van, lásd `topnav-shell.css` 172-174. sor, de az oldalsó 40px nem). A design system
**nem ad zéró-térközű oldal-tartalom mintát**, mert kizárólag a max-width sapkát engedi el
(`--ep-layout-max-full`), a `--ep-layout-gutter`/oldalsó padding elhagyására nincs dokumentált
token vagy minta egyik skillben sem.

---

## 8. Záró lista arról, mi hiányzik ténylegesen a design systemből, és mi csak rossz alkalmazás

### 8.1 Ténylegesen hiányzó design system elem (a projekt nem tud mit átemelni)

- **Sticky, oldal-szintű akció-sáv** (a kért "sticky page footer" minta), amelyhez egyik skillben sincs
  ilyen minta; a legközelebbi létező elemek a `.modal__footer` (csak modálishoz) és az
  `.app-side__footer` (csak a sidebar shell alján, nem is sticky a viewporthoz vízszintesen).
- **Globális "slim mode" / oldal-szintű sűrűségi kapcsoló** nincs, csak komponensenkénti `--sm`
  variáns létezik.
- **4K-specifikus breakpoint token**, amit a design system szándékosan nem ad (a `SKILL.md` szerint
  a max-width sapka + full-bleed szentinel a hivatalos minta helyette), tehát ez nem hiány, hanem
  tudatos tervezési döntés a forrásban.
- **Keret nélküli (borderless) Resizable variáns**, mivel a design system `.resizable-group`-ja mindig
  kártya-receptű (szegély+lekerekítés+emelt háttér), nincs hozzá "sima" módosító.

### 8.2 Van a design systemben, csak a projekt nem emelte át vagy nem használja

- A **`textarea` komponens** létezik, teljes CSS-sel, de sosem lett a `packages/ui`-ba átemelve; a
  projekt helyette az `.input` (egysoros) osztályt viseli 16 helyen `<textarea>`-n (4.4 szekció).
- Az **`accordion` komponens** létezik, és a SPEC-007 dokumentáltan "később pótlandó"-nak jelölte; a
  node inspector ritkán szerkesztett mezőihez alkalmas lenne, de ma nincs bevezetve.
- A **`button-group` (split button)** létezik, de a `packages/ui`-ba nincs átemelve.
- A **`.btn--icon` variáns** létezik ÉS a projekt `Button` komponense már támogatja is, csak a
  konkrét "Bezárás" gombhoz nincs alkalmazva.
- A **`.btn--sm`** létezik és helyenként helyesen használt, de a szerkesztő eszköztár és a lista-
  sor felvevő gombjai (nem modálisban) `md` méretűek maradtak.

### 8.3 Saját, a design systemben nem létező elem, amit a projekt bevezetett

- Az **`.inspector-section`** (`node-inspector.css`) kártya-szerű doboz, de más token-
  kombinációval, mint a valódi `.card`; nem a design system eleme (6. szekció).
- **A `.node-inspector textarea.input` minta**, vagyis az `.input` osztály többsoros mezőn való
  felhasználása geometriai toldozással (`resize: vertical`), miközben a design system saját,
  erre szánt `.textarea` osztálya kihasználatlan marad (4.4 szekció).

---

## 9. Az audit alapján elvégzett elrendezés átalakítás (2026-09-09)

Ez a szekció az audit 5. és 8. pontjának **végrehajtását** rögzíti a gráf szerkesztő KERETÉRE
és ELRENDEZÉSÉRE (a node inspector belseje külön munkamenet hatóköre). Forrás: felhasználói
kérés, 2026-09-09 (szó szerint: "faltol falig, slim designt csinaljunk, es felesleges a kartya
a szerkeszto kore", "a gomboknak a szerkeszto feluleten egy split button(button group tipus)
kene lennie", "tilos a card in card design!", "ez a jobb oldali panel akkor jelenjen meg ha egy
elemre kattintok", "legyen a layout ha lehet resizable ... localstorage -be le kell menteni").

### 9.1 Amit a design systemből átemeltünk (létező elem)

| Elem            | Hova került                     | Hatókör                                                                                                                                                                                                                                         |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.button-group` | `packages/ui/src/button-group/` | a CSS bájtra azonos a forrással (a `@import` sor nélkül); a `ButtonGroup` React alak `role="group"` és kötelező `aria-label`; a függőleges variáns és az `is-active` szegmentált állapot nincs propként kivezetve, mert a felület nem használja |
| `.btn--sm`      | `apps/web/src/graph-editor/`    | a "Mentés" és az "Elrendezés" gomb `size="sm"` lett, az audit 5.5 pontja szerint (a modális gombok `md` mérete a kimondott kivétel, változatlan)                                                                                                |

### 9.2 Amit saját kiegészítésként építettünk (a design systemben NINCS)

**`packages/ui/src/page-footer/`, a sticky page footer.** Az audit 5.4 és 8.1 pontja tételesen
kimondja, hogy oldal szintű, a viewport aljához tapadó akciósáv a négy `eggproject-design*`
skill egyikében sincs. A `page-footer.css` ezért **saját kiegészítés**, és ezt a fájl fejléc
kommentje is kimondja. A recept két LÉTEZŐ forrásból áll össze, kizárólag design system
tokenekkel, kitalált szám nélkül:

| Amit átvesz                                                                                                                | Honnan                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `position: sticky`, `z-index: 10`, `background: var(--ep-bg-elevated)`, elválasztó szegély                                 | `.app-tn__bar` (`eggproject-design-app-common/_shell.css`), `bottom`/`border-top` irányba fordítva      |
| `display: flex`, `align-items: center`, `justify-content: space-between`                                                   | `.modal__footer` és `.modal__footer--split` (`eggproject-design-components/components/modal/modal.css`) |
| minden térköz (`--ep-space-2`, `--ep-space-3`, `--ep-space-6`), a `--ep-text-small` betűkészlet és az `--ep-fg-muted` szín | `eggproject-design/tokens/spacing.css`, `typography.css`, a téma színtokenek                            |

A forrás két receptjének pixel literálja (a `.app-tn__bar` 28px oldalsó és a `.modal__footer`
20/28/24px belső margója) **szándékosan nem** került át: azok a saját kontextusukhoz vannak
szabva, és a 4px alapú skálán nincs is 28px lépcső.

### 9.3 A card in card megszüntetése

Az audit 6. szekciója szerint a legkülső kártya a `.resizable-group` volt (szegély, `--ep-radius-xl`
lekerekítés, `--ep-bg-elevated` háttér). A design systemnek **nincs keret nélküli Resizable
variánsa** (8.1 pont), a `resizable.css` pedig bájtazonossági regressziós teszt alatt áll
(`packages/ui/src/resizable/resizable-byte-identity.spec.ts`), tehát új módosító osztály nem
vehető fel bele az átemelés garanciájának elvesztése nélkül. A törlés ezért a **fogyasztó
oldalán**, erre az egy képernyőre szűkítve áll (`apps/web/src/graph-editor/graph-editor-screen.css`),
dokumentáló kommenttel. Regresszió: `apps/web/e2e/graph-editor-layout.spec.ts` "NINCS card in
card" tesztje, ami számított stílusból méri, hogy a szegély, a lekerekítés és a saját háttér is
eltűnt.

A "faltól falig" másik fele az `.app-content` belső margója: a `topnav-shell.css`
`.app-content:has(> .graph-editor-screen)` szabálya 2026-09-06 óta létezett (akkor csak az alsó
80px csökkentésére), most a TELJES paddingot nullázza ezen az egy screen-en. Kitalált szám így
nincs, az egyetlen érték a `0`.

### 9.4 Nagy felbontás

Az audit 7.1 pontjának megállapítását követjük: **4K-specifikus töréspontot nem vezettünk be**,
mert a design system szándékosan nem ad ilyet. A szerkesztő a `--ep-layout-max-full` full-bleed
szentinelre álló `.app-tn` láncot használja (`topnav-shell.css`, 2026-09-01 óta), tehát FHD-n,
QHD-n és afölött is a teljes szélességet kapja, `max-width` sapka nélkül. Új media query nem
került be; a meglévő `--ep-screen-md` (768px) sáv a `graph-editor-screen.css` egyetlen media
queryje, változatlanul.
