# A select lenyíló chevronjának mérése (2026-09-09)

Felhasználói hibajelzés: "meg mindig nem jo! nem tudtok egyszeru elkeszitett kodot masolni ? nem
latod hogy a select lenyito chevron nem jo helyen van?"

A fájl azt méri meg, hol áll a chevron a design system referenciáján és a mi mezőnkön, és
dokumentálja a döntést, ami a kettő különbségét megszüntette.

## 1. Mérési felállás

| Tétel               | Érték                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| Böngésző            | `playwright-core@1.62.1` szállított chromium (a repo pinelt verziója)                   |
| `deviceScaleFactor` | 4 (a chevron néhány pixeles vonal, egyszeres nagyításban a súlypont mérése zajos lenne) |
| Színséma            | `light`                                                                                 |
| Referencia oldal    | a design system saját `Select.jsx` React triggere, `select.css` betöltésével            |
| Mért mennyiség      | a chevron középpontjának vízszintes távolsága a mező JOBB SZÉLÉTŐL, CSS pixelben        |
| Mérési mód          | (a) a DOM doboz geometriája, (b) a triggerről készült képernyőkép kifestett képpontjai  |

A (b) mérés a `.claude/CLAUDE.md` 11. szekció szabályát követi ("vizuális állítást csak kifestett
pixel bizonyít"): a trigger jobb harmadában megkeresi azokat a képpontokat, amik a mező hátterétől
eltérnek, és a súlypontjuk helyét adja vissza.

## 2. A korábbi állítás ellenőrzése

Egy korábbi munkamenet azt állította, hogy "az egyetlen maradó különbség a nyíl rajzolata: a
referencia a React trigger lucide chevronját mutatja, a mienk a platform indikátorát, amit a design
system `select.select` szabálya szó szerint előír a natív retrofithez".

A tényleges forrás (`eggproject-design-components/components/select/select.css`, 28-31. sor). A
szabály és a fölötte álló komment két, egymást követő mondata (a mondathatáron álló gondolatjelet
a projekt szabálya miatt nem másoljuk ide, a mondatokat külön idézzük):

- "Native `<select>` shares the .select shell but keeps the platform dropdown indicator"
- "no appearance:none, no custom caret. box-sizing keeps width:100% inside the field grid."

```css
select.select {
  box-sizing: border-box;
  max-width: 100%;
}
```

**Az állítás első fele IGAZ**: a forrás CSS tényleg nem ad `appearance: none` értéket és nem rajzol
saját háttérképes chevront a natív elemre, tehát a platform indikátorát hagyja meg. Az `appearance`
tulajdonság a teljes skill komponens készletben egyetlen `select` szabályban sem szerepel
(`grep -rn 'appearance' --include=*.css`: a `slider`, a `textarea`, a `data-table` és a
`theme-toggle` fájlban van találat, a `select.css`-ben csak a fenti komment prózájában).

**Az állításból levont KÖVETKEZTETÉS viszont hibás volt.** Ugyanannak a fájlnak a szomszédos
kommentje kimondja, kire vonatkozik ez az ág (26-27. sor):

```css
/* The button trigger (React Select) lays out the value + caret; the native <select> retrofit
   on static pages uses the platform control, so flex/gap stay button-only. */
```

A natív retrofit tehát a STATIKUS oldalak ága ("on static pages"), és a forrás valóban csak ott
használja: a `select class="select"` markup a skill családban kizárólag a
`eggproject-design-web-app-examples/examples/onboarding.html` és a
`eggproject-design-admin-app-examples/examples/settings.html` statikus oldalon fordul elő. A React
komponens változat (`Select.jsx`) a button trigger. Mi React alkalmazás vagyunk, tehát a forrás
React változata jár.

## 3. A mért számok

| Változat                                                     | Vezérlő mérete | Chevron középpontja a jobb széltől | Kifestett képpont |
| ------------------------------------------------------------ | -------------- | ---------------------------------- | ----------------- |
| Referencia: design system `Select` trigger (`md`)            | 360 x 46.8     | **22.0 px**                        | 282               |
| Mi, JAVÍTÁS ELŐTT: natív `<select class="select">` (`md`)    | 360 x 43.0     | **9.0 px**                         | 396               |
| Mi, JAVÍTÁS UTÁN: `SelectField` a valós alkalmazásban (`md`) | 464.0 x 46.8   | **22.0 px**                        | 282               |

A referencia 22 px értéke a forrás szabályaiból pontosan levezethető: 1 px szegély + 14 px jobb
belső térköz (`.select { padding: 10px 14px }`) + a 14 px széles `.select__caret` fele. A natív
retrofit 9 px-e a chromium platform indikátorának a helye, amit a CSS nem befolyásol.

A javítás utáni mindkét mérés PONTOSAN 22.0 px, és a kifestett képpontok SZÁMA is pontosan annyi
(282), mint a referencián, tehát a chevron nem csak ugyanoda került, hanem ugyanúgy is van
megrajzolva.

**A mérés determinisztikussá tétele.** Az első nekifutásnál a mért érték 21.7 és 23.3 között
ingadozott, futásról futásra. Az ok mérve: a modális belépő animációja a panelt `scale(0.98)`
értékről `scale(1)` értékre nagyítja (`modal.css` `modal-in` kulcskocka), és a
`getBoundingClientRect()` az animáció közbeni, kisebbített méretet adta vissza (a chevron
szélessége ilyenkor 13.81 px a névleges 14 helyett). A javítás nem kézi várakozás, hanem
`page.emulateMedia({ reducedMotion: 'reduce' })`: a `modal.css` erre a beállításra `animation:
none` értéket ad, tehát a panel azonnal a végállapotában jelenik meg. Ezzel a mérés három egymást
követő futáson bitre azonos.

## 4. A döntés

A `SelectField` a forrás `Select.jsx` button trigger plusz `.menu` listbox változatát építi meg. A
`.select*` szabályok bájtra a forrásból jönnek, három dokumentált kiegészítéssel (a `.select--error`
szabály, a `.select` `box-sizing: border-box` és a `.select__panel` `z-index` deklarációja;
mindhárom indoklása a CSS fájlban a helyén áll).
A `.menu` panel szabályait a `packages/ui/src/menu/menu.css` adja, ahogy a forrás `select.css`
`@import url('../menu/menu.css')` sora is előírja; a `.menu__check` szabály emiatt került vissza
abba a fájlba.

Két, kimondott eltérés a forrástól:

1. **Portál.** A panel `createPortal`-lal a `document.body`-ba kerül, `position: fixed` alakban, a
   trigger `getBoundingClientRect()`-jéből nyitáskor számított koordinátákkal. Ugyanaz a mért,
   valódi ok, ami a `Menu` komponensnél is: a mezők görgethető konténerekben ülnek (a node
   inspector jobb oldali sávja és a modális törzse egyaránt `overflow-y: auto`), ami a forrás
   relatív pozícionálású paneljét levágná.
2. **Gyökér `disabled` prop.** A forrás `Select` komponensének nincs ilyenje (csak a
   `Combobox`-nak), nálunk viszont a `loading` állapot ezen keresztül tiltja le a triggert.

A portál egy további, mért következménnyel járt: a `document.body`-ba portált panel a modális
TESTVÉRE lesz, tehát a `menu.css` `z-index: 600` értékével a modális `z-index: 1000` alá kerül. A
`workflow-list.spec.ts` ezt ténylegesen elő is idézte ("intercepts pointer events" a modális
beviteli mezőjétől). A `.select__panel` ezért kapott `z-index: 1100` értéket: ez a design system
saját rétegskáláján az az érték, ami a modális fölé kerül, az `alert-dialog` és a `toast`
komponens is ezt viseli.

A forrás `icon`, `meta` és `align` propja nincs átemelve, mert egyetlen felhasználási eset sem
igényli.

## 5. A regressziós teszt és a bukás igazolása

A tesztet az `apps/web/e2e/select-chevron-position.spec.ts` fájl tartalmazza. Mindkét mérési módot
elvégzi, és mindkettőre 1 px tűrést enged.

A javítás visszavonása mindkét ágon elbuktatja, mérve:

| Visszavont javítás                                                | Mit ad a teszt                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| `.select { padding: 10px 14px }` -> `padding: 10px 2px 10px 14px` | a geometriai mérés 22 helyett **10**, az állítás elbukik |
| `.select__caret { color: var(--ep-bg-elevated) }`                 | kifestett képpont: **0**, a `> 0` állítás elbukik        |

A második sor a lényeg: a háttér színével festő chevronra a `toBeVisible()` és a DOM meglét
TOVÁBBRA IS zöld marad, a kifestett képpont mérés viszont azonnal elbukik. Pontosan ezért kell a
kettő együtt.

## 6. Ami NEM MEGERŐSÍTETT

- A mérés kizárólag chromium ellen futott, mert az `apps/web/playwright.config.ts` ma csak azt
  definiálja. Ha a projektlista bővül, a natív retrofit platform indikátorának a helye motoronként
  eltérhet; a button trigger 22 px-e viszont tisztán CSS-ből következik, tehát motorfüggetlen.
- A 13.81 px-es tört chevron szélességre nincs hivatkozott böngésző dokumentációnk, csak a saját
  mérésünk; ezért enged a teszt 1 px tűrést ahelyett, hogy pontos egyezést követelne.
