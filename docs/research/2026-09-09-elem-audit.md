# Elem- és osztályszintű audit: design system hűség, `select`, `field`

**Dátum:** 2026-09-09
**Ág:** `feat/spec-008-grafszerkeszto`
**Kiváltó ok:** felhasználói visszajelzés, szó szerint: "editora ha jol latom meg mindig nem
minden a mi elemunk! peldaul select! azt kertem minden elem a mienk legyen, az rendben van ami
hianyzik potoltad es leirtad de select elem van a designban! ugyan azt a css class field -et
kell hasznalni a mezokhoz stb ! ellenoriztesd". Ez a `docs/research/2026-09-08-design-system-audit.md`
UTÁNI állapotot vizsgálja: az akkori audit `textarea`/card-in-card/button-group találatai időközben
javítva lettek (lásd lent), a kérdés az, maradt-e még eltérés, KÜLÖNÖS TEKINTETTEL a `select`-re és
a `field` osztály következetes használatára.
**Módszer:** kizárólag `Read`/`Grep`/`diff` eredménye vagy a fájlban álló, szó szerint idézett
komment. Minden állítás mellett fájl és sor. Nem módosítottam semmit a repóban ezen a fájlon
kívül.
**Vizsgált fájlok:** a teljes `eggproject-design-components/components/` (52 mappa, minden
`.html`/`.css`), az `eggproject-design/tokens/*.css` és `colors_and_type.css`, a teljes
`packages/ui/src/**/*.{tsx,css}` és `apps/web/src/**/*.{tsx,css}`.

---

## 1. A design system teljes, kimért osztálykészlete

A feladat által kijelölt hatókörön (`eggproject-design-components/components/*.css` +
`eggproject-design/tokens/*.css`) `grep -ohE "\.[a-zA-Z][a-zA-Z0-9_-]*"` futtatva, egyedi névre
szűrve (a `colors_and_type.css` maga egy `@import` barrel, nem definiál osztályt, lásd a fájl
saját fejléce: "This file is a THIN @import barrel [...] NO tokens are defined inline here"):

| Réteg                                                                                                            | Fájlok                                                                                                                                | Egyedi osztálynév |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `eggproject-design-components/components/*.css` (52 komponens mappa)                                             | pl. `select/select.css`, `input/input.css`, `textarea/textarea.css`, `button/button.css`                                              | **827**           |
| `eggproject-design/tokens/*.css` (`typography.css`, `theme-toggle.css`, a többi tokenfájl nem definiál osztályt) | `.ep-h1`...`.ep-h4`, `.ep-body`, `.ep-lead`, `.ep-small`, `.ep-meta`, `.ep-overline`, `.ep-code`, `.ep-display*`, `.ep-theme-toggle*` | **17**            |
| **Összesen**                                                                                                     |                                                                                                                                       | **844**           |

(A `eggproject-design-app-common/_shell.css` egy TESTVÉR skill, nem tagja a feladat által
megjelölt "components + design tokens" hatókörnek; a belőle átemelt `topnav-shell` témát a
2026-09-08-i audit már külön tárgyalta, ezért itt nem duplikálom.)

A mezőkhöz tartozó kulcsosztályok, a design system saját definíciója szerint:

- **`.field`** (`input/input.css:12`): `display: flex; flex-direction: column; gap: 6px;` - "wrapper
  (label + input + optional error)" (a fájl saját fejléc-kommentje, `input.css:4`).
- **`.field__label`** (`input/input.css:13-18`): nagybetűs overline címke.
- **`.field__error`** (`input/input.css:100`): hibaüzenet a mező alatt.
- **`.input`** (`input/input.css:20-42`): egysoros mező.
- **`.select`** (`select/select.css:9-22`): "visual trigger (looks like `.input` but with chevron)"
  (a komponens fejléc-kommentje szerint, `select.css:4-8`).
- **`.textarea`** (`textarea/textarea.css:8-23`): többsoros mező, saját `min-height`, saját
  `resize: vertical`, saját `.is-error` hibaosztály (NEM `--error`, lásd `textarea.css:5`, "States:
  `:focus`, `:disabled`, `:invalid` / `.is-error`").

A tényleges HTML szerkezet, amit a design system SAJÁT valódi oldalpéldái (nem az elszigetelt
komponens demó) használnak - ez a mérvadó minta, mert ez a "hogyan épül be egy űrlapba" válasz:

```html
<!-- eggproject-design-admin-app-examples/examples/settings.html:177 -->
<div class="field">
  <label class="field__label">Email</label>
  <input class="input" value="anna@northbeam.co" />
</div>
<div class="field">
  <label class="field__label" for="settings-timezone">Timezone</label>
  <select id="settings-timezone" name="timezone" class="select">
    <option value="Europe/London">Europe / London (UTC+1)</option>
    <option value="Europe/Budapest" selected>Europe / Budapest (UTC+2)</option>
    ...
  </select>
</div>
```

```html
<!-- eggproject-design-web-app-examples/examples/onboarding.html:263-271 -->
<div class="field">
  <label class="field__label" for="primary-contact">Primary contact</label>
  <select id="primary-contact" name="primaryContact" class="select">
    <option value="anna" selected>Anna Kovács - Director of product</option>
    ...
  </select>
</div>
```

**Ez a lényeg: a design system két valódi, összeépített oldalán (`settings.html`,
`onboarding.html`) MINDEN `<select class="select">` kivétel nélkül `<div class="field">` +
`<label class="field__label" for="...">` párban áll - pontosan ugyanabban a `.field` burkolóban,
mint az `<input class="input">`.** Ez a felhasználó által idézett szabály ("ugyan azt a css class
field-et kell hasznalni a mezokhoz") szó szerinti forrása.

A `select/select.css` emellett explicit dokumentálja a natív `<select>` retrofit szabályát:

```css
/* select/select.css:26-30 */
/* The button trigger (React Select) lays out the value + caret; the native <select> retrofit
   on static pages uses the platform control, so flex/gap stay button-only. */
button.select {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
/* Native <select> shares the .select shell but keeps the platform dropdown indicator -
   no appearance:none, no custom caret. box-sizing keeps width:100% inside the field grid. */
select.select {
  box-sizing: border-box;
  max-width: 100%;
}
```

A `references/component-catalog.md:139` ezt így nevezi meg: "**Native static consumers**
(`onboarding.html`, `settings.html`) intentionally use native `<select class="select">` /
`.select--sm` [...] - **not** React `Select`".

---

## 2. A mi osztálykészletünk

`grep -ohE "\.[a-zA-Z][a-zA-Z0-9_-]*"` a teljes `packages/ui/src/**/*.css` + `apps/web/src/**/*.css`
fán, egyedi névre szűrve: **285 egyedi CSS osztálynév**.

Ebből a 285-ből **239 pontosan megegyezik** egy design system osztállyal (`comm` metszet a fenti
844-es listával), a maradék **46** nem szerepel sem a `components/`, sem a token réteg 844
osztálya között. Ez a 46 három csoportra bomlik (részletek a 6. szekcióban):

1. **a `topnav-shell`/`app-shell` család** (`.app-tn*`, `.app-content`, `.app-pagehead*`, `.pill`
   a navigációban stb.) - ezek NEM hiányoznak a design systemből, csak egy TESTVÉR skillből
   (`eggproject-design-app-common/_shell.css`) jönnek, amit a feladat kijelölt "components +
   tokens" hatóköre nem fed le. Ezt a 2026-09-08-i audit már tételesen tárgyalta.
2. **oldal-specifikus, kizárólag elrendezést adó saját osztályok**, amiknek nincs és nem is lehet
   design system megfelelője (`.node-inspector*`, `.graph-editor-screen*`, `.graph-editor-canvas`,
   `.graph-node-card*`, `.page-footer*`, `.workflow-list__toolbar`,
   `.agents-field-editor__entry-header`).
3. **dokumentáltan indokolt, kis számú kiegészítő szabály** egy egyébként átemelt komponensen
   belül (`.select--error`, `.breadcrumb__list`, `.breadcrumb__listItem`,
   `.data-table__cell--secondary`, `.data-table__cell--tertiary`,
   `.data-table__label--visually-hidden`).

**Egyetlen egy saját osztályt sem találtam dokumentálatlanul**: mindegyik fejléc-kommentje vagy a
szabály fölötti komment megnevezi az okot (lásd 6. szekció táblázata).

---

## 3. A `select` kérdés részletes válasza

### 3.1 Van-e natív `<select>` a repóban, és hányszor?

**Pontosan egyetlen egy** `<select` elem áll a teljes `packages/ui/src` + `apps/web/src` fában:

```tsx
// packages/ui/src/select-field/SelectField.tsx:104-112
<select
  className={joinClassNames('select', size === 'sm' && 'select--sm', isErrorVisible && 'select--error', className)}
  {...rest}
  id={resolvedId}
  disabled={isLoading || disabled === true}
  onBlur={handleBlur}
  aria-invalid={isErrorVisible ? 'true' : ariaInvalid}
  aria-describedby={joinAriaTokenList(ariaDescribedBy, isErrorVisible ? errorId : undefined)}
>
```

Minden más `<select` szómegjelenés a repóban vagy kommentben áll (`SelectField.tsx:23,59,69`,
`StructuredOutputField.tsx:43`, `AgentStepConfigFields.tsx:148`), vagy teszt DOM-lekérdezés
(`create-workflow-modal.spec.tsx:152,177` - `container.querySelector('select')`). Nincs második,
kézzel épített "select-szerű" widget (nincs `role="listbox"`/`aria-haspopup` a repóban a `Menu`
komponensen kívül, ami akció-menü, nem érték-választó).

### 3.2 A `select.select` retrofit szabály - bájtra megvan

```css
/* packages/ui/src/select-field/select-field.css:51-53 */
/* Native <select> shares the .select shell but keeps the platform dropdown indicator -
   no appearance:none, no custom caret. box-sizing keeps width:100% inside the field grid. */
select.select {
  box-sizing: border-box;
  max-width: 100%;
}
```

Ez betűre azonos a forrás `select/select.css:29-30` szabályával. `diff`-fel ellenőrizve: a teljes
`select-field.css` a forrástól **kizárólag** a fejléc-kommentben, a hozzáadott `.select--error`
szabályban (54-60. sor) és a Combobox szakasz + a `menu.css` import hiányában tér el - mindhárom
a fájl saját fejlécében megnevezve és indokolva. A `.select`, `button.select`, `select.select`,
`.select__icon`, `.select__value`, `.select__caret`, `.select__panel`, `.select--sm`,
`.select--open` szabályok szó szerint, formázásra is azonosak a forrással.

### 3.3 A `SelectField` React komponens szerkezete - MEGFELEL a forrásnak, EGY kivétellel

`packages/ui/src/select-field/SelectField.tsx:126-136`, ha van `label` vagy `error`:

```tsx
<label className="field">
  {label !== undefined && <span className="field__label">{label}</span>}
  {selectElement}
  {isErrorVisible && (
    <span className="field__error" id={errorId} role="alert">
      {error}
    </span>
  )}
</label>
```

Ez pontosan a design system Input.jsx mintáját követi (`components/input/Input.jsx:29-38`:
`<label className={fieldClassNames}>` majd `field__label`, mező, `field__error`), csak `<select>`-re
alkalmazva. **Ez a helyes szerkezet.**

**A kivétel - ez az egyetlen valódi hiba, amit ez az audit talált.** A `SelectField.tsx:122-124`:

```tsx
if (label === undefined && error === undefined) {
  return selectElement;
}
```

Ha se `label`, se `error` nincs megadva, a komponens **teljesen kihagyja a `.field` burkolót**, és
csupasz `<select class="select">`-et ad vissza. Ez az egyetlen a három mezőkomponens
(`TextField`, `SelectField`, `TextAreaField`) közül, amelyiknek van ilyen kihagyási útja:

| Komponens       | `.field` burkoló mindig kiadva?                                                                                                    | Forrás                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `TextField`     | **igen, mindig** - a `<label className={joinClassNames('field', className)}>` feltétel nélkül fut                                  | `text-field/TextField.tsx:80`                |
| `TextAreaField` | **igen, mindig** - a `label` prop **kötelező** (`readonly label: string;`, nincs `?`), tehát nincs is olyan hívás, ami kihagyhatná | `textarea/TextAreaField.tsx:24,83`           |
| `SelectField`   | **NEM mindig** - `label` ÉS `error` egyszerre `undefined` esetén bare `<select>` jön                                               | `select-field/SelectField.tsx:24-26,122-124` |

Ez az API-szintű aszimmetria önmagában nem hiba (a komponens doksija, `SelectField.tsx:65-70`,
kifejezetten megengedi a saját elrendezést hozó hívóknak, hogy `aria-label`-lel dolgozzanak), de
**pontosan egy hívási hely él is ezzel a kihagyással**, és az a hely éppen megsérti a felhasználó
kért szabályát.

### 3.4 A tényleges hiba: a "Provider" mező a `create-workflow-modal`-ban

```tsx
// apps/web/src/workflow-list/create-workflow-modal.tsx:105-130
<TextField
  label="Név"
  value={name}
  ...
/>
<TextField
  label="Leírás"
  value={description}
  ...
/>
<SelectField
  aria-label="Provider"
  options={providerOptions}
  placeholder="Nincs megadva"
  loading={isProvidersLoading}
  loadingLabel="betöltés"
  value={providerId}
  onChange={...}
/>
```

Ugyanabban az űrlapban a "Név" és a "Leírás" mező `label` propot kap, tehát mindkettő
`<label class="field"><span class="field__label">Név</span><input class="input" .../></label>`
alakban jelenik meg - LÁTHATÓ, nagybetűs felirattal a mező fölött. A "Provider" mező viszont csak
`aria-label="Provider"`-t kap, `label` propot nem, tehát a 3.3 szekció szerinti kihagyási ág fut:
**a "Provider" `<select>` egyáltalán nem kap `.field`/`.field__label` burkolót, nincs látható
felirata**, miközben a design system mindkét valódi oldalpéldája (settings.html, onboarding.html,

1. szekció) MINDIG látható `field__label`-lel látja el a select mezőt, méghozzá pont ugyanabban a
   `.field` dobozban, mint a szomszédos `.input` mezőket.

**Ez a felhasználó panaszának pontos, tételes megfelelője**: "ugyan azt a css class field-et kell
hasznalni a mezokhoz" - a Név/Leírás mező igen, a Provider mező nem kapja meg ugyanazt a `.field`
szerkezetet, noha mindhárom ugyanabban az űrlapban áll, ugyanolyan jelentőségű mező.

**Ez az EGYETLEN hely a teljes repóban, ahol ez előfordul.** A többi 9 `<SelectField>` hívás
(lásd táblázat) mind kap `label`-t:

| Fájl:sor                                               | `label` érték                                               |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `node-inspector/SystemPromptField.tsx:68,82,102,116`   | "Rendszer prompt módja" (×3), "Dinamikus szekciók kizárása" |
| `node-inspector/AgentDefinitionEntryFields.tsx:119`    | `field.label` (dinamikus)                                   |
| `node-inspector/JoinNodeFields.tsx:104`                | "Összefésülés módja"                                        |
| `node-inspector/AgentStepConfigFields.tsx:139,174,212` | "Provider felülírás", "Session mód", "Thinking mód"         |
| `node-inspector/StructuredOutputField.tsx:39`          | "Strukturált kimenet stratégiája"                           |
| `workflow-list/create-workflow-modal.tsx:120`          | **nincs `label`, csak `aria-label`** ← EGYETLEN kivétel     |

### 3.5 Verdikt

A `select` ELEM és a `select.select`/`.select--sm`/`.select--error` OSZTÁLYKÉSZLET helyesen, a
design system dokumentált retrofit útján épül fel - ez a korábbi (2026-09-08-i) audit óta nem
változott hibásan, és ma is megfelel. **A hiba nem a `select` osztályban vagy elemben van, hanem
egyetlen konkrét hívási helyen: a `create-workflow-modal.tsx` Provider mezője nem kapja meg a
`.field`/`.field__label` burkolót**, mert nem ad át `label` propot a `SelectField`-nek. Ez
pontosan az az eltérés, amit a felhasználó a képernyőn észrevehetett.

---

## 4. A `field` osztály tételes ellenőrzése minden mezőn

| Mező / hívás                                                                                      | Fájl:sor                                                | `.field` burkoló?                                                                                                                 | Látható `field__label`?                      |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `TextField` minden hívása (11 db, pl. "Név", "Leírás", node-inspector mezők)                      | `text-field/TextField.tsx:80-81`                        | **igen, mindig**                                                                                                                  | igen, ha `label` megadva (mindenhol megadva) |
| `SelectField` - "Rendszer prompt módja" ×3, "Dinamikus szekciók kizárása"                         | `node-inspector/SystemPromptField.tsx:67-121`           | igen                                                                                                                              | igen                                         |
| `SelectField` - dinamikus `agents` mező                                                           | `node-inspector/AgentDefinitionEntryFields.tsx:118-131` | igen                                                                                                                              | igen                                         |
| `SelectField` - "Összefésülés módja"                                                              | `node-inspector/JoinNodeFields.tsx:103-109`             | igen                                                                                                                              | igen                                         |
| `SelectField` - "Provider felülírás", "Session mód", "Thinking mód"                               | `node-inspector/AgentStepConfigFields.tsx:138-219`      | igen                                                                                                                              | igen                                         |
| `SelectField` - "Strukturált kimenet stratégiája"                                                 | `node-inspector/StructuredOutputField.tsx:38-47`        | igen                                                                                                                              | igen                                         |
| **`SelectField` - "Provider"**                                                                    | `workflow-list/create-workflow-modal.tsx:120-130`       | **NEM**                                                                                                                           | **NEM (csak `aria-label`)**                  |
| `TextAreaField` mind a 16 hívás (SystemPromptField, BranchNodeFields, stb.)                       | lásd a 3.3 táblázatot - a `label` KÖTELEZŐ prop         | **igen, mindig**                                                                                                                  | igen, mindig                                 |
| `Checkbox` (`.ctrl`, nem `.field` - más design system komponens, a jelölőnégyzet saját burkolója) | `form-control/Checkbox.tsx:31`                          | n/a (`.ctrl`, helyesen, mert ez nem `.field`-alapú mező a forrásban sem)                                                          | `.ctrl__label`                               |
| `ScriptNodeFields` "Futásidő (runtime)" - csak olvasható érték, nem szerkeszthető mező            | `node-inspector/ScriptNodeFields.tsx:39-42`             | igen, kézzel épített `<div className="field">`                                                                                    | igen                                         |
| `AgentDefinitionEntryFields` "readonly" ág                                                        | `node-inspector/AgentDefinitionEntryFields.tsx:136-140` | igen, kézzel épített                                                                                                              | igen                                         |
| `AgentStepConfigFields` "Skillek", "MCP szerverek" - csak olvasható                               | `node-inspector/AgentStepConfigFields.tsx:328,333`      | igen, kézzel épített                                                                                                              | igen                                         |
| `InspectorFieldGroup` (mezőCSOPORT címe, nem egyetlen mező)                                       | `node-inspector/InspectorFieldGroup.tsx:53-56`          | NEM `.field` (`.node-inspector__group`, szándékosan, mert ez több mezőt fog össze, nem egy mező), de a címke maga `.field__label` | igen (a csoport címe)                        |

**Összefoglaló:** a `packages/ui` mind a három mezőkomponense (`TextField`, `SelectField`,
`TextAreaField`) ugyanazt a `.field`/`.field__label`/`.field__error` hármast adja ki, amikor
felcímkézve hívják őket, és a 10 `SelectField` hívásból 9 helyesen fel is címkézi. **Az egyetlen
kivétel a 3.4 szekcióban tárgyalt "Provider" mező.** A `node-inspector` kézzel épített
`<div className="field">` blokkjai (csak olvasható értékekhez) konzisztensen ugyanazt az osztályt
használják, mint a valódi mezők - ez a design system saját tipográfiai osztályának (nem
form-elemhez kötött) legális újrafelhasználása, nem kitalált osztály.

---

## 5. `text-field`, `textarea`, `form-control` (Checkbox) - bájtra ellenőrizve

`diff` a design system forrás és a `packages/ui` fájl között (fejléc-komment nélkül):

| Fájl                                                                        | Eltérés                                                                                                                                                                                                           | Indokolt-e                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `text-field/text-field.css` vs `input/input.css`                            | +1 sor: `.input { box-sizing: border-box; }` (42-52. sor, a fejléc fölötte megnevezi: mért 30px túllógás javítása)                                                                                                | igen                                                         |
| `select-field/select-field.css` vs `select/select.css`                      | +1 szabály (`.select--error`, 54-60. sor), a Combobox szakasz és a `menu.css` import hiányzik, a forced-colors blokk emiatt szűkebb                                                                               | igen, mindegyik megnevezve                                   |
| `textarea/textarea.css` vs `textarea/textarea.css` (forrás)                 | +1 sor: `.textarea { box-sizing: border-box; }` (39-48. sor, ugyanaz a mért hiba, mint az inputnál)                                                                                                               | igen                                                         |
| `form-control/form-control.css` vs `form-controls/form-controls.css`        | a Radio (`.ctrl__radio`, `.radio-group`), Switch (`.ctrl__switch*`) és kártya-választó (`.ctrl-card*`) szakasz hiányzik                                                                                           | igen, a SPEC-007 6.1 csak a törlés jelölőnégyzetét használja |
| `button/button.css` vs `button/button.css` (forrás)                         | **nincs eltérés** a fejléc-kommenten kívül                                                                                                                                                                        | bájtra azonos                                                |
| `button-group/button-group.css` vs `button-group/button-group.css` (forrás) | **nincs eltérés** a fejléc-kommenten kívül                                                                                                                                                                        | bájtra azonos, ÚJ, 2026-09-09-én emelve át                   |
| `accordion/accordion.css` vs `accordion/accordion.css` (forrás)             | **nincs eltérés** a fejléc-kommenten kívül; a `--bordered`/`--separated`/`--subtle` variáns szabályai bájtra átkerülnek, de az `Accordion.tsx` nem exponál hozzájuk propot (szándékosan, card-in-card elkerülése) | bájtra azonos, propon keresztül nem elérhető variáns         |
| `resizable/resizable.css` vs `resizable/resizable.css` (forrás)             | **nincs eltérés** a fejléc-kommenten kívül                                                                                                                                                                        | bájtra azonos                                                |

A `textarea`-t korábban (2026-09-08-i audit 4.4 szekció) az `.input` osztály viselte egy
`<textarea>`-n - ez **ma már javítva van**: a `packages/ui/src/textarea/` téma 2026-09-09-én
készült el, a `TextAreaField.tsx` saját `.textarea`/`.is-error` osztályt ad
(`TextAreaField.tsx:89`), a `node-inspector.css:98-102` pedig kifejezetten dokumentálja a
váltást: "A `<textarea>` MA a saját `.textarea` osztályát viseli, nem az egysoros `.input`
osztályt".

A card-in-card probléma (2026-09-08-i audit 6. szekció, `.inspector-section`) szintén javítva:
a `.inspector-section` osztály ma sehol nem áll CSS szabályként, csak történeti említésben
(`InspectorFieldGroup.tsx:18` komment) és HÁROM regressziós teszt kifejezetten az ELTŰNÉSÉT
ellenőrzi (`expect(container.querySelector('.inspector-section')).toBeNull()`,
`AgentsFieldEditor.spec.tsx:53`, `NodeInspector.spec.tsx:201`, `InspectorFieldGroup.spec.tsx:43`).
A `node-inspector.css:9-16` fejléce szó szerint kimondja: "NINCS CARD IN CARD".

---

## 6. Saját gyártású osztályok - mindegyik tételesen

| Osztály(csoport)                                                                                                                                      | Hol                                        | Indokolt-e, miért                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.select--error`                                                                                                                                      | `select-field/select-field.css:60`         | **igen** - a forrás Select nem ismer hibaüzenetet, a `SelectField` a `TextField` `.input--error` mintáját veszi át bájtra azonos formában                                                                                                                                                       |
| `.breadcrumb__list`, `.breadcrumb__listItem`                                                                                                          | `breadcrumb/breadcrumb.css`                | **igen** - a11y okból (`<ol>/<li>` szemantika), a forrás JSX-e nem ilyen szerkezetű; korábbi audit már jóváhagyta                                                                                                                                                                               |
| `.data-table__cell--secondary`, `.data-table__cell--tertiary`                                                                                         | `data-table/data-table.css:146,187`        | **igen** - mért reszponzív hiba javítása (SPEC-007 5.3), a töréspont a design-token `--ep-screen-lg`/`--ep-screen-md` tokenje, kitalált szám nincs                                                                                                                                              |
| `.data-table__label--visually-hidden`                                                                                                                 | `data-table/data-table.css:204`            | **igen** - W3C WAI C7 technika szó szerinti implementációja, ugyanaz, amit a `topnav-shell.css` is használ                                                                                                                                                                                      |
| `.node-inspector*` (9 osztály: `__header`, `__identity`, `__title`, `__node-id`, `__body`, `__group`, `__list-row`, `__reason`, kártya-recept NÉLKÜL) | `node-inspector/node-inspector.css`        | **igen** - nincs design system megfelelő egy "csomópont beállítás panel" elrendezésre; a fájl saját feje kimondja: nincs kártya-recept egyik szabályon sem                                                                                                                                      |
| `.graph-editor-screen*`, `.graph-editor-canvas`, `.graph-node-card*`                                                                                  | `graph-editor/`, `graph-node-card/`        | **igen** - a React Flow (`@xyflow/react`) vászon kerete, amit a design system nem ismerhet (harmadik féltől jövő könyvtár)                                                                                                                                                                      |
| `.page-footer`, `.page-footer__status`, `.page-footer__actions`                                                                                       | `page-footer/page-footer.css`              | **igen, dokumentáltan** - a fejléc-komment tételesen megnevezi: nincs design system megfelelő ("sticky, oldal-szintű akciósáv" egyik skillben sincs, 2026-09-08-i audit 5.4/8.1), a recept két LÉTEZŐ mintából (`.app-tn__bar`, `.modal__footer--split`) áll össze, kizárólag design tokenekkel |
| `.workflow-list__toolbar`                                                                                                                             | `workflow-list/workflow-list-screen.css:5` | **igen, triviális** - egyszerű flex konténer, nincs saját szín/szegély/lekerekítés, tehát nincs mit "design system elemre" cserélni                                                                                                                                                             |
| `.agents-field-editor__entry-header`                                                                                                                  | `node-inspector.css:174-180`               | **igen, triviális** - ugyanaz, mint fent: elrendezés, kártya-chrome nélkül                                                                                                                                                                                                                      |
| `.app-tn*`, `.app-content`, `.app-pagehead*`, `.pill` (a navigációban)                                                                                | `topnav-shell/topnav-shell.css`            | **igen, de más réteg**: ezek a `eggproject-design-app-common/_shell.css` TESTVÉR skill byte-azonos átemelt osztályai, nem saját találmány; a 2026-09-08-i audit ezt már külön, "topnav-shell" témaként tárgyalta 8 dokumentált kiegészítéssel                                                   |

**Nem találtam egyetlen dokumentálatlan vagy indokolatlan saját osztályt sem.**

---

## 7. Gombméret - a 2026-09-08-i audit egyik találata még mindig fennáll

A `.claude/CLAUDE.md` 11. szekció szabálya: "A gombok `sm` méretűek, kivéve modálisban és
popupban." A `Button.tsx:44` alapértelmezése `size = 'md'`, tehát a `size` prop kihagyása `md`-t
ad.

A node-inspector és a szerkesztő eszköztár gombjai a 2026-09-08-i audit óta **mind** `size="sm"`
lettek (ellenőrizve: `BranchNodeFields.tsx:83`, `StartNodeFields.tsx:87`,
`AgentsFieldEditor.tsx:98,117,131,162`, `GraphEditorScreen.tsx:324,327`,
`run-history-screen.tsx:311,325`, `workflow-list-screen.tsx` sor-menü trigger,
`NodeInspector.tsx:149`). **Két gomb, egyik sem modálisban, mégis kimaradt, és `md` méretű
maradt:**

| Fájl:sor                                         | Gomb szövege                | Kontextus                       |
| ------------------------------------------------ | --------------------------- | ------------------------------- |
| `workflow-list/workflow-list-screen.tsx:205-211` | "Új workflow"               | lista fejléc akció, nem modális |
| `not-found-route/not-found-route.tsx:21-28`      | "Vissza a workflow listára" | 404 oldal, nem modális          |

Ez nem `select`/`field` téma, de a "minden elem a mienk legyen, következetesen" elv ugyanide
tartozik, ezért tételesen rögzítem.

---

## 8. Amit NEM találtam (explicit negatív eredmény)

- Nincs második, kézzel épített "select-szerű" widget a repóban (nincs `role="listbox"`,
  `aria-haspopup="listbox"` a `Menu` komponensen kívül, ami akció-menü, nem érték-választó).
- A `DataTable.tsx`-ben (`packages/ui/src/data-table/DataTable.tsx`) nincs oldalméret-választó
  `<select>` - a forrás `DataTable.jsx` demójában van (`data-table/DataTable.jsx:810`), de ez a mi
  komponensünkben nincs átemelve, tehát itt nincs is mit ellenőrizni.
- A `node-inspector/` egyetlen fájlja sem épít natív `<input>`/`<select>`/`<textarea>` elemet
  közvetlenül - mindegyik a `packages/ui` `TextField`/`SelectField`/`TextAreaField`/`Checkbox`
  komponenseit importálja.
- Nincs olyan CSS fájl a `packages/ui`/`apps/web` fában, ami byte-identity regressziós teszt
  NÉLKÜL, de a fejlécében "bájtra azonos" állítást tesz, és ami közben ténylegesen eltérne - minden
  ellenőrzött `diff` megegyezett a fejléc állításával.
- **Megjegyzés, nem hiba**: byte-identity regressziós teszt ma csak öt témára van
  (`topnav-shell`, `self-hosted-font`, `design-token`, `resizable`, `brand-mark`) - a `select-field`,
  `text-field`, `textarea`, `button`, `button-group`, `accordion`, `form-control` fájlokra nincs
  ilyen automatikus védelem, tehát egy jövőbeli szerkesztés némán elsodródhatna a forrástól. Ez
  javaslat, nem talált hiba.

---

## 9. Zárás

A `select` ELEM ma helyesen, a design system dokumentált natív retrofit útján épül (`select.select`
szabály, `.select`/`.select--sm`/`.select--error` osztályok, bájtra hű CSS). A `textarea` és a
card-in-card probléma, amit a 2026-09-08-i audit talált, azóta javítva van. **Az egyetlen ma is
fennálló, a felhasználó által leírt tünetet okozó eltérés**: a `create-workflow-modal.tsx` Provider
mezője nem kapja meg a `.field`/`.field__label` burkolót, mert a `SelectField` hívás nem ad át
`label` propot, csak `aria-label`-t - miközben a `SelectField` API-ja ezt megengedi (a `TextField`
és a `TextAreaField` nem engedné meg, mert azok mindig kiadják a `.field` burkolót). Emellett két,
nem modális gomb (`workflow-list-screen.tsx` "Új workflow", `not-found-route.tsx` "Vissza a
workflow listára") még mindig `md` méretű a szabálykönyv `sm`-alapértelmezése helyett.
