# Playwright e2e teszt szabályok, 2026-08-29

Kérdés: mi a Playwright hivatalos, jelenleg érvényes ajánlása e2e teszt íráshoz, és hogyan
valósítható meg a felhasználó kérése ("tilos bármilyen timeout, helyette `attached` és
`detached` kell") a gyakorlatban. A projekt pinelt verziója `@playwright/test@1.62.1`
(`package.json`), ezért minden API-szintű forrás, ahol lehetett, a Playwright hivatalos
GitHub repójának `release-1.62` ágáról lett lekérve, nem a `main` ágról, hogy a szöveg
biztosan a telepített verzióval egyezzen. A guide-oldalak (`playwright.dev/docs/...`)
verziómentesek, mert a `stable` dokumentáció mindig az aktuális kiadást tükrözi.

Kontextus, ami a repóban ellenőrizve lett: az `apps/web/playwright.config.ts` és az
`apps/web/e2e/` alatt jelenleg csak egy `smoke.spec.ts` van, és egy `coverage-fixture.ts`
fixture már kiterjeszti a `page` fixture-t a `vite-plugin-istanbul` `window.__coverage__`
kiolvasására. A `docs/spec/SPEC-005-api-protokoll.md` (mai dátummal) megerősíti, hogy a
valós idejű csatorna **Server-Sent Events**, `EventSource`-on keresztül, a `GET /events`
végponton, nem WebSocket (ez felülírja a gyökér `.claude/CLAUDE.md` 7. szekciójának
korábbi, `ws` csomagra hivatkozó mondatát, ami a WebSocket-tervből maradt ott; a SPEC-005 2. döntése kimondja: "az eredeti WebSocket kérés az érvek alapján SSE-re változott").

---

## 1. A hivatalos "Best Practices" oldal

Forrás: <https://playwright.dev/docs/best-practices>

**Teszt filozófia**

- **Felhasználó által látott viselkedést tesztelj**, ne implementációs részletet
  (függvénynevet, CSS osztályt, azt hogy valami tömb-e). Szó szerint: "Automated tests
  should verify that the application code works for the end users."
- **Izolált tesztek.** Minden teszt saját local storage-dzsal, session storage-dzsal,
  cookie-val fusson; erre a `beforeEach` hook vagy a `storageState` alapú setup projekt a
  javasolt eszköz.
- **Ne teszteld a harmadik fél függőségeit.** Külső linkre, külső szerverre ne építs
  tesztet; helyette `page.route()`-tal garantált választ adj.
- **Adatbázissal dolgozó teszt** esetén a doksi staging környezetet és kontrollált adatot
  javasol, vizuális regressziónál azonos OS/böngésző verziót.

**A konkrét "Best Practices" lista**

1. **Locatorokat használj**, ne nyers szelektort; a locator auto-waitinggel és
   retry-ability-vel jön.
2. **Chaining és filtering** a locatorokon (`.filter({ hasText })`, `.filter({ has })`) a
   lista elemek pontos kiválasztására.
3. **Felhasználó által látott attribútumot részesíts előnyben CSS/XPath helyett** (részletek
   a 2. szekcióban).
4. **Generáltasd a locatort** a `codegen` paranccsal vagy a VS Code extension-nel, ami
   role/text/testid alapján épít.
5. **Web-first assertion-t használj**, ne manuális, nem várakozó ellenőrzést (részletek a 4. szekcióban).
6. **Debug eszközök:** VS Code extension élő debug, `--debug` flag, CI-n Trace Viewer
   videó és screenshot helyett ("For CI failures, use the Playwright trace viewer instead
   of videos and screenshots").
7. **Minden böngészőn tesztelj** (`chromium`, `firefox`, `webkit` projekt), hogy a
   felhasználók teljes köre le legyen fedve.
8. **Tartsd naprakészen a Playwright verziót.**
9. **CI-n futtass minden commit/PR-en**, Linuxon (olcsóbb), sharding-gal nagy suite-nál.
10. **Lintelj:** `@typescript-eslint/no-floating-promises` ESLint szabály, hogy ne
    maradjon hiányzó `await` a Playwright hívások előtt; CI-n `tsc --noEmit`.
11. **Párhuzamosítás és sharding** kihasználása (`test.describe.configure({ mode:
'parallel' })`, `--shard`).
12. **Soft assertion** (`expect.soft`) produktivitási tipp: nem állítja meg azonnal a
    tesztet, a hibák a teszt végén gyűlnek össze.

A doksi **nem** említ Page Object Modelt vagy fixture-t a "Best Practices" oldalon saját
szekcióként; azok külön guide oldalak (<https://playwright.dev/docs/pom>,
<https://playwright.dev/docs/test-fixtures>), amikre a 6. és 12. szekció tér ki.

---

## 2. Locator stratégia

Forrás: <https://playwright.dev/docs/locators> ("Quick Guide" szekció, szó szerint,
sorrendben)

> "These are the recommended built-in locators."
>
> - `page.getByRole()` "to locate by explicit and implicit accessibility attributes."
> - `page.getByText()` "to locate by text content."
> - `page.getByLabel()` "to locate a form control by associated label's text."
> - `page.getByPlaceholder()` "to locate an input by placeholder."
> - `page.getByAltText()` "to locate an element, usually image, by its text alternative."
> - `page.getByTitle()` "to locate an element by its title attribute."
> - `page.getByTestId()` "to locate an element based on its `data-testid` attribute."

Ez a doksi saját, dokumentált sorrendje. Kiegészítő döntési szabályok, szintén a doksiból:

- **`getByRole` az elsődleges javaslat.** "We recommend prioritizing role locators to
  locate elements, as it is the closest way to how users and assistive technology
  perceive the page." Interaktív elemekre (`button`, `a`, `input`) ez az ajánlott
  választás.
- **`getByText` nem interaktív elemre való.** "We recommend using text locators to find
  non interactive elements like `div`, `span`, `p`, etc. For interactive elements ... use
  role locators."
- **`getByLabel`** kifejezetten form mezőkre: "Use this locator when locating form
  fields."
- **`getByTestId`** akkor, ha a role/text nem elég egyedi, vagy a csapat kifejezetten a
  test id módszertant választja: "You can also use test ids when you choose to use the
  test id methodology or when you can't locate by role or text." Fontos árnyalás: "testing
  by test ids is not user facing."
- **CSS és XPath csak végső eset.** "CSS and XPath are not recommended as the DOM can
  often change leading to non resilient tests." A doksi kifejezett rossz példaként hoz
  hosszú, DOM-struktúrához kötött CSS/XPath láncot.
- **`.first()`/`.last()`/`.nth()` kerülendő**, mert "when your page changes, Playwright
  may click on an element you did not intend."

---

## 3. Auto waiting (actionability)

Forrás: <https://playwright.dev/docs/actionability>

Minden akció (pl. `locator.click()`) előtt Playwright ellenőrzi, hogy az elem megfelel-e a
szükséges feltételeknek, és csak akkor hajtja végre a műveletet, ha mind teljesül; ha a
megadott `timeout`-on belül nem teljesül, `TimeoutError`-t dob. Az öt ellenőrzött feltétel:

| Feltétel            | Pontos definíció (szó szerint)                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Visible**         | "Element is considered visible when it has non-empty bounding box and does not have `visibility:hidden` computed style." Nulla méretű és `display:none` elem **nem** számít láthatónak; `opacity:0` elem **igen**. |
| **Stable**          | "Element is considered stable when it has maintained the same bounding box for at least two consecutive animation frames."                                                                                         |
| **Enabled**         | "Element is considered enabled when it is not disabled" (natív `disabled` attribútum, `fieldset[disabled]` őse, vagy `aria-disabled=true` leszármazottja hiánya).                                                  |
| **Editable**        | "Element is considered editable when it is enabled and is not readonly" (`readonly` attribútum vagy `aria-readonly=true` hiánya).                                                                                  |
| **Receives Events** | Az elem a hit-target a kattintás pontjában, azaz nincs felette átfedő overlay.                                                                                                                                     |

Az akciónkénti táblázat (mely feltétel melyik metódushoz kell) a doksi forrásában
(`docs/src/actionability.md`) teljes egészében fel van sorolva; a gyakorlatban fontos
minta: `click`/`check`/`tap` mind az öt feltételt megköveteli, `fill`/`clear` a Visible +
Enabled + Editable hármast, `focus`/`press`/`dispatchEvent` egyiket sem (ezek szándékosan
nem várnak semmire).

Ez a mechanizmus a válasz arra, miért nem kell kézi várakozás egy akció előtt: a locator
metódusok saját maguk implementálják az újrapróbálást a `timeout` lejártáig.

---

## 4. Web-first assertion-ök

Forrás: <https://playwright.dev/docs/test-assertions>,
<https://playwright.dev/docs/api/class-locatorassertions>

> "Playwright will be re-testing the element ... until the fetched element has the
> ... text. It will re-fetch the element and check it over and over, until the condition
> is met or until the timeout is reached."

Ez a "web-first" vagy "auto-retrying" assertion: `await expect(locator).toBeVisible()`
maga vár, míg a manuális `expect(await locator.isVisible()).toBe(true)` egyszer kérdez le
és azonnal bukik vagy megy tovább, várakozás nélkül. A doksi ezt kifejezetten "👎"
jelöléssel rossz mintaként hozza.

**Az összes auto-retrying (web-first) assertion**, a hivatalos lista szerint:
`toBeAttached`, `toBeChecked`, `toBeDisabled`, `toBeEditable`, `toBeEmpty`, `toBeEnabled`,
`toBeFocused`, `toBeHidden`, `toBeInViewport`, `toBeVisible`, `toContainText`,
`toContainClass`, `toHaveAccessibleDescription`, `toHaveAccessibleName`,
`toHaveAttribute`, `toHaveClass`, `toHaveCount`, `toHaveCSS`, `toHaveId`,
`toHaveJSProperty`, `toHaveRole`, `toHaveScreenshot`, `toHaveText`, `toHaveValue`,
`toHaveValues`, `toMatchAriaSnapshot` (locatoron és page-en is), `toHaveTitle`, `toHaveURL`
(page-en), `toBeOK` (response-on).

**Nem auto-retrying (sima) assertion-ök** (`toBe`, `toEqual`, `toContain`, `toBeTruthy`
stb.) nem várnak; a doksi ajánlása ezekre: "Prefer auto-retrying assertions whenever
possible. For more complex assertions that need to be retried, use `expect.poll` or
`expect.toPass`."

**Soft assertion:** `expect.soft(locator).toHaveText(...)` nem állítja meg a tesztet
bukás esetén, a hibák a teszt végén gyűlnek össze; `test.info().errors` mérete alapján
lehet utólag elágazni.

---

## 5. A `waitForTimeout` tilalma, szó szerint

Forrás: `https://playwright.dev/docs/api/class-page#page-wait-for-timeout` (a Page
metódus a Frame metódus "Shortcut"-ja, a szöveg azonos), ellenőrizve a
`microsoft/playwright` `release-1.62` ág `docs/src/api/class-frame.md` fájljában
(2325-2334. sor):

> `* discouraged: Never wait for timeout in production. Tests that wait for time are inherently flaky. Use [Locator] actions and web assertions that wait automatically.`
>
> "Waits for the given timeout in milliseconds."
>
> "Note that `page.waitForTimeout()` should only be used for debugging. Tests using the
> timer in production are going to be flaky. Use signals such as network events,
> selectors becoming visible and others instead."

Ez a `discouraged` címke (nem "deprecated", a metódus nem szűnik meg, csak explicit
elkedvetlenítve van) minden legacy, szelektor alapú `Frame`/`Page` metódusra rá van
téve a `release-1.62` forrásban (`click`, `fill`, `hover`, `isVisible`, `waitForSelector`
stb.), mindegyik a `Locator` alapú megfelelőre mutat. A `waitForSelector`-nál (2192.
sor) a pontos szöveg:

> `* discouraged: Use web assertions that assert visibility or a locator-based [Locator.waitFor] instead.`

Tehát a `waitForSelector` sem "tilos" formálisan, de a hivatalos ajánlás explicit a
`locator.waitFor()` és a web-first assertion-ök felé mutat helyette.

---

## 6. `toBeAttached` és `toBeDetached` szemantikája

Forrás: <https://playwright.dev/docs/api/class-locatorassertions>

**`toBeDetached()` néven nem létezik önálló assertion.** A `LocatorAssertions`
osztály metódus listájában nincs `toBeDetached` bejegyzés; a "nincs csatolva a DOM-hoz"
állítást a hivatalos API kizárólag `toBeAttached({ attached: false })` alakban tudja
kifejezni.

| Assertion                           | Pontos definíció (szó szerint)                                                                    | Mit ellenőriz                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `toBeAttached()`                    | "Ensures that Locator points to an element that is connected to a Document or a ShadowRoot."      | Kizárólag DOM-hoz csatoltság, láthatóságtól függetlenül.                                    |
| `toBeAttached({ attached: false })` | ugyanaz, negálva (nincs dokumentált külön mondat az `attached` opcióhoz, csak a `boolean` típus)  | "detached" ellenőrzés helyettesítője.                                                       |
| `toBeVisible()`                     | "Ensures that Locator points to an **attached and visible** DOM node."                            | Csatoltság **és** láthatóság együtt.                                                        |
| `toBeHidden()`                      | "Ensures that Locator either does not resolve to any DOM node, or resolves to a non-visible one." | Vagy nincs a DOM-ban, vagy ott van, de nem látható. Tágabb, mint egy sima "detached" teszt. |

A `toBeAttached` bevezetésének hivatalos indoklása (release notes, 1.33): "Use new
web-first assertion `toBeAttached` to ensure that the element is present in the page's
DOM. Do not confuse with `toBeVisible` that ensures that element is both attached &
visible." Forrás: `microsoft/playwright` `release-1.62` ág,
`docs/src/release-notes-js.md`, "Version 1.33" szakasz.

**Gyakorlati különbség a felhasználó kérése szempontjából:** ha egy elem `display:none`-nal
van elrejtve, de a DOM-ban van, a `toBeAttached()` sikeres, a `toBeVisible()` bukik. Ha az
elem teljesen ki van véve a DOM-ból (React unmount), mindkettő `toBeAttached()` bukik és
`toBeHidden()`/`toBeAttached({attached:false})` sikeres.

---

## 7. Egyéb, időzítés nélküli várakozási eszközök

Forrás: <https://playwright.dev/docs/network>, `release-1.62` ág `docs/src/api/params.md`
és `class-page.md`/`class-frame.md`, `docs/src/test-assertions-js.md`.

| Eszköz                                       | Mit csinál                                                                                                                                                                                                                                                                                                                                                                                                                                       | Rejtett timeout                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `locator.waitFor({ state })`                 | Megvárja, hogy a locator elérje az `attached`/`detached`/`visible`/`hidden` állapotot. A hivatalos ajánlás ez váltja a `waitForSelector`-t.                                                                                                                                                                                                                                                                                                      | Igen, az assertion/action timeout logikáját követi, de nem "idő alapú" várakozás, hanem állapot alapú.          |
| `page.waitForLoadState(state)`               | Megvárja a `load`/`domcontentloaded`/`networkidle` állapotot. Doksi megjegyzés: "Most of the time, this method is not needed because Playwright auto-waits before every action." A `networkidle` értékre explicit figyelmeztetés van a megosztott paraméter-leírásban: **"DISCOURAGED wait until there are no network connections for at least 500 ms. Don't use this method for testing, rely on web assertions to assess readiness instead."** | Igen, a navigáció timeoutját örökli.                                                                            |
| `page.waitForResponse(urlOrPredicate)`       | Megvár egy konkrét hálózati választ URL string/regex/predikátum alapján. Az SSE kezdő kérésének (`GET /events`) megnyílására is használható, magukra az egyes SSE keretekre nem (lásd 9. szekció).                                                                                                                                                                                                                                               | Igen, dokumentált alapértelmezett 30 másodperc, `timeout: 0` kikapcsolja.                                       |
| `page.waitForFunction(fn, arg, { polling })` | Tetszőleges böngésző oldali predikátumra vár, amíg igaz értéket ad. `polling: 'raf'` (alapértelmezett, `requestAnimationFrame`) vagy egy számmal megadott intervallum.                                                                                                                                                                                                                                                                           | Igen (JS-ben dokumentáltan `0`, azaz nincs timeout alapértelmezésben, forrás: `params.md`).                     |
| `locator.waitForFunction(fn)`                | **Új az 1.62-ben.** A megegyező elemre hívott predikátum-várakozás, locator-scope-ban. Release notes: "New Locator.waitForFunction waits until a function, called with the matching element, returns a truthy value."                                                                                                                                                                                                                            | A locator/assertion timeout logikáját követi.                                                                   |
| `expect.poll(fn, opts).toBe(x)`              | Bármilyen szinkron `expect`-et aszinkron, pollozó variánssá alakít. Doksi: "Poll for 10 seconds; defaults to 5 seconds. Pass 0 to disable timeout."                                                                                                                                                                                                                                                                                              | Igen, explicit **kikapcsolható** `timeout: 0`-val.                                                              |
| `expect(callback).toPass(opts)`              | Egy teljes kódblokkot ismétel, amíg minden benne lévő assertion sikeres nem lesz. Doksi: **"by default `toPass` has timeout 0 and does not respect custom expect timeout."**                                                                                                                                                                                                                                                                     | Alapból **nincs** timeout (0), a próbálkozási intervallum növekvő: `[100, 250, 500, 1000]` ms, testre szabható. |
| `page.route()` / `page.routeFromHAR()`       | Hálózati kérés mockolása vagy HAR-ból való visszajátszás, így a teszt nem valós hálózatra vár, hanem szinkron, azonnali választ kap.                                                                                                                                                                                                                                                                                                             | Nem alkalmazandó (nincs várakozás, mert nincs valós hálózati késleltetés).                                      |

---

## 8. Globális és per-assertion timeout, a tilalom gyakorlati határa

Forrás: `release-1.62` ág `docs/src/test-timeouts-js.md` és
`docs/src/test-api/class-testconfig.md`

| Timeout típus                                | Alapérték                                                                      | Hol állítható                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Test timeout (`TestConfig.timeout`)          | 30 000 ms                                                                      | config `{ timeout }`, tesztben `test.setTimeout()`                     |
| Expect timeout (`TestConfig.expect.timeout`) | 5 000 ms                                                                       | config `{ expect: { timeout } }`, assertion-önként `{ timeout }` opció |
| Global timeout (`TestConfig.globalTimeout`)  | **0 (nincs)**, dokumentáltan: "Zero timeout (default) disables this behavior." | config `{ globalTimeout }`                                             |
| Action timeout (`use.actionTimeout`)         | **"no timeout"** (a táblázat szó szerinti értéke)                              | config `use.actionTimeout`, akciónként `{ timeout }`                   |
| Navigation timeout (`use.navigationTimeout`) | **"no timeout"**                                                               | config `use.navigationTimeout`, hívásonként `{ timeout }`              |

A felhasználó "tilos bármilyen timeout" kérése kétféleképp értelmezhető, és a doksi
alapján a kettő nem ugyanaz:

1. **A kézi, idő alapú várakozás tilalma** (`page.waitForTimeout()`, `setTimeout`,
   `sleep`). Ez **teljesen lefedhető** kizárólag állapot alapú eszközökkel: locatorok,
   web-first assertion-ök, `waitFor`, `waitForResponse`, `waitForFunction`. A hivatalos
   doksi ezt kifejezetten és következetesen ajánlja (5. és 7. szekció).
2. **A Playwright saját, beépített timeout mezőinek (assertion timeout, action timeout,
   test timeout) kikapcsolása vagy nullázása.** Ez **nem ugyanaz**, mint az 1. pont, és a
   doksi nem ajánlja általánosan.
   - Az `expect.poll` és a `toPass` esetén a `timeout: 0` **dokumentált, támogatott**
     érték, és a `toPass` alapból is `0`. Ezek nem "idő alapú várakozás", hanem
     "próbálkozz újra, amíg a feltétel (állapot) igaz nem lesz", tehát összhangban vannak
     az 1. pont szellemével: nem egy fix ideig várnak, hanem addig, amíg az állítás nem
     teljesül, felső korlát nélkül.
   - A sima assertion timeout (`TestConfig.expect.timeout`, alapból 5000 ms) és a test
     timeout (alapból 30000 ms) kikapcsolására a `release-1.62` `TestConfig.expect` és
     `TestConfig.timeout` dokumentált szövegében **nincs explicit "0 kikapcsolja" mondat**
     (ellentétben a `globalTimeout`, a `waitForResponse` és az `expect.poll` mezőkkel,
     ahol ez szó szerint le van írva). Ez a pont **NEM MEGERŐSÍTETT**: nem találtunk
     hivatalos szöveget, ami kimondaná, mi történik `expect: { timeout: 0 }` esetén.
   - A `TestConfig.globalTimeout` alapértéke már eleve `0`, azaz nincs globális
     korlát, dokumentáltan.
   - Az action és navigation timeout alapértéke a táblázat szó szerinti szövege szerint
     "no timeout", tehát ezekre a projekt szintjén nincs is mit kikapcsolni, már
     alapból nyitottak.

**A gyakorlati következtetés, forrással alátámasztva:** a felhasználó kérése maradéktalanul
teljesíthető úgy, hogy egyetlen kézi `waitForTimeout`/`setTimeout`/`sleep` hívás sem kerül
a tesztekbe, kizárólag locator/assertion/`waitFor`/`waitForResponse`/`waitForFunction`
eszközökkel. Ehhez **nem szükséges** a beépített assertion vagy test timeout nullázása
vagy végtelenre állítása; sőt a doksi egyetlen helyen sem ajánlja az `expect.timeout`
felső korlátjának globális eltávolítását éles tesztekben, ez a `expect.poll`/`toPass`
speciális, dokumentáltan indokolt esetére van fenntartva. Az assertion timeout felső
korlátja (5000 ms) egy **biztonsági háló** flaky teszt esetén: ha valami sosem következik
be, a teszt bukik ahelyett hogy örökre lógna. Ennek eltávolítása nem old meg semmit a
"nincs timeout" cél szempontjából (a cél már state alapú várakozással teljesül), viszont
elveszíti ezt a biztonsági hálót, és egy hibás teszt a teljes CI worker-t akaszthatja meg a
test timeout (alapból 30 mp) határáig.

---

## 9. Server-Sent Events tesztelése

Forrás: <https://playwright.dev/docs/network>, <https://playwright.dev/docs/mock>
(`release-1.62` ág `docs/src/mock.md`, teljes egészében elolvasva), GitHub
`microsoft/playwright` #15353 issue.

**Nincs hivatalos Playwright doksi oldal vagy szakasz kifejezetten SSE/`EventSource`
mockolásáról.** A `docs/src/mock.md` fájl (a "Mock APIs" guide teljes forrása) három
mintát dokumentál részletesen: sima HTTP kérés mockolás (`page.route` + `route.fulfill`),
HAR alapú visszajátszás (`page.routeFromHAR`), és WebSocket mockolás
(`page.routeWebSocket`). Az `EventSource`/`text/event-stream` szó egyszer sem fordul elő
ebben a fájlban.

**Ismert korlát, közösségi forrás (NEM hivatalos doksi, hanem GitHub issue):**
`microsoft/playwright` #15353, "[Question] How to mock an event stream response / support
for EventSource?" (nyitva 2022, azóta lezárva). A bejelentő kérdése szó szerint: a
`page.route('**/myroute*', route => route.fulfill({status: 200, contentType:
"text/event-stream"}))` minta a bejelentő szerint nem működött, mert a `Content-Type` az
`EventSource` oldalán `null`-ként érkezett. Az issue lezárt állapotú, de a lezárás
indoklását (megoldódott-e később, vagy elavult kérdésként zárták) **nem sikerült
megerősíteni**: a lekérés csak az eredeti issue törzsét adta vissza, a
kommentszálat nem. **NEM MEGERŐSÍTETT, hogy a `page.route` + `route.fulfill({ contentType:
'text/event-stream' })` minta megbízhatóan működik-e Playwright 1.62 ellen valódi
`EventSource`-szal szemben.** Ha a csapat erre a mintára akar építeni, azt saját méréssel
kell igazolni, mielőtt bevezetik (a projekt saját "bizonyíték kényszer" szabálya szerint
ez `docs/research/` alá írandó mérési tény lenne, nem feltételezés).

**Az ajánlott, dokumentumokkal alátámasztott gyakorlati megközelítés** nem transzport
szintű mockolásra épül, hanem az általános best-practice elvre ("Test user-visible
behavior", 1. szekció): az SSE által vezérelt DOM frissülés a felhasználó szempontjából
ugyanolyan aszinkron UI változás, mint bármi más, amit a web-first assertion-ök (`toHaveText`,
`toBeVisible`, `toHaveCount` stb.) már eleve, transzporttól függetlenül, retry-olva
várnak. A projekt `playwright.config.ts`-e amúgy is valós szervert indít
(`webServer: { command: 'vite build && vite preview ...' }`), tehát az e2e réteg valós
`EventSource` kapcsolaton keresztül, valós szerver (vagy egy célra írt könnyű teszt
szerver) ellen futtatva, a **DOM végállapotára** várakozva tesztelhető, kézi timeout
nélkül. Ez konzisztens azzal, hogy a `packages/protocol` csomag már külön, Vitest szinten
teszteli a keret kódolást/dekódolást és a kurzor szabályt determinisztikusan, idő nélkül
(`docs/spec/SPEC-005-api-protokoll.md` 10.2 szekció), tehát az e2e rétegnek nem kell
duplikálnia ezt a felelősséget.

Ahol a csapat mégis kontrollálni akarja a pontos kereteket (pl. újracsatlakozás
`Last-Event-ID` viselkedésének tesztelése), a `page.waitForResponse()` használható annak
megvárására, hogy a kliens ténylegesen elindította a `GET /events` kérést, de az
egyes, folyamatosan érkező SSE keretekre ez a hívás nem alkalmazható (egy `Response`
objektumot ad vissza, nem a stream teljes élettartamát).

---

## 10. `@xyflow/react`: DOM alapú, nem canvas

Forrás: <https://reactflow.dev/learn/advanced-use/testing> (hivatalos xyflow doksi,
"Testing" oldal)

> "React Flow needs to measure nodes in order to render edges and for that relies on
> rendering DOM elements."
>
> "If you are using Cypress or Playwright no additional setup is needed. You can refer to
> the getting started guide for Cypress here and for Playwright here."

Tehát a node-ok és élek DOM elemek, nem egy `<canvas>`-ra rajzolt bitmap, ezért a szokásos
locator stratégia (2. szekció) közvetlenül alkalmazható rájuk (`getByRole`, `getByTestId`,
CSS class szelektor a `.react-flow__node`/`.react-flow__edge` osztályokon, ha nincs jobb
felhasználó-központú attribútum). A doksi Playwrighthoz kifejezetten **nem ír elő extra
setupot** (a Jest-hez igen: `ResizeObserver`/`DOMMatrixReadOnly` mock, mert azok jsdom
alatt hiányoznak, de ez Playwrightra, ami valós böngészőt futtat, nem vonatkozik).

A doksi külön kiemeli, hogy él (edge) tesztelésénél meg kell várni, amíg a node-ok
lemérődnek, mielőtt az élek DOM-ba kerülnek; Jest/Testing Library alatt ehhez saját
`waitFor`-t ajánl. Playwright alatt ez a probléma automatikusan megoldott, mert a
web-first assertion-ök (`toHaveCount`, `toBeVisible` az `.react-flow__edge` locatoron)
ugyanezt a retry-oló várakozást adják, kézi `waitFor`/timeout nélkül.

---

## 11. Coverage (`vite-plugin-istanbul`) hatása a teszt írásra

A repóban ellenőrizve (`apps/web/e2e/coverage-fixture.ts`): a projekt már most a hivatalos
fixture minta szerint terjeszti ki a `page` fixture-t (lásd 12. szekció,
"Fixture-ök" a `test-fixtures` guide szerint), hogy minden teszt után kiolvassa a
`window.__coverage__` objektumot és `.nyc_output/` alá írja. Ebből egy konkrét,
ellenőrizhető szabály következik: **minden új `.spec.ts` fájlnak a
`./coverage-fixture.ts`-ből importált `test`/`expect` párost kell használnia**, nem a
`@playwright/test` csomagból közvetlenül importáltat, különben az adott spec teszt nem
íródik bele a lefedettségi riportba (a `smoke.spec.ts` ezt már helyesen csinálja). Ez
projektspecifikus, saját olvasásból származó tény, nem Playwright hivatalos ajánlás; a
Playwright doksi maga nem foglalkozik a `vite-plugin-istanbul`-lal.

A lefedettségi kényszer önmagában nem módosítja a teszt **írás módját** a fenti
szabályokhoz képest: a DOM-ra váró, web-first assertion alapú tesztelés ugyanúgy fut a
valós, instrumentált build ellen (`VITE_COVERAGE=true` a `webServer.env`-ben), tehát nincs
külön "coverage-barát" locator vagy waiting minta, amit be kellene tartani.

---

## 12. Mi új 2026-ban (Playwright 1.62, illetve a legutóbbi néhány kiadás)

Forrás: `microsoft/playwright` `release-1.62` ág, `docs/src/release-notes-js.md`, teljes
egészében elolvasva 1.24-ig visszamenőleg.

**1.62-ben új, a teszt írás módját közvetlenül érintő elemek:**

- **`signal` opció (`AbortSignal`) a legtöbb akción és web-first assertion-ön.** "Most
  operations and web-first assertions now accept a `signal` option ... letting you cancel
  long-running actions, navigations, waits, and assertions." Fontos árnyalás, szó
  szerint: "Providing a signal does not disable the default timeout; pass `timeout: 0` to
  disable it." (Ez közvetett megerősítés arra, hogy legalább egyes akció/assertion
  hívásokon a `timeout: 0` explicit, dokumentált módja a kikapcsolásnak, de ez az
  AbortSignal-lal együtt van dokumentálva, nem önmagában a `TestConfig.expect.timeout`
  mezőn; a 8. szekció NEM MEGERŐSÍTETT megjegyzése emiatt marad érvényben a globális
  config mezőre nézve.)
- **`Locator.waitForFunction`, új metódus.** Locator-scope-ban futó predikátum-várakozás
  (7. szekció táblázata).
- **`retryStrategy: 'isolated'`**, új `TestConfig` mező: a retry-olt tesztek a futás
  végén, egyesével futnak, nem a többi teszttel keveredve; alapérték `'immediate'` marad.
- **Component testing: "stories és galleries" modell**, új `mount` fixture. A projekt
  jelenleg nem használ Playwright component testinget (a `playwright.config.ts` csak
  `testDir: './e2e'`-t definiál), ezért ez most nem releváns, de érdemes tudni, hogy a
  korábbi component test API ebben a verzióban lecserélődött.

**Korábbi, még mindig érvényes és a napi teszt íráshoz releváns újítások (verziószámmal):**

- **1.33: `toBeAttached` bevezetése**, kifejezetten a `toBeVisible`-től való
  megkülönböztetés indoklásával (6. szekció).
- **1.29: `expect(callback).toPass()` bevezetése**, retry blokk minta.
- **1.42/1.44: `toPass` timeout és `intervals` konfigurálhatóvá tétele** globálisan
  (`expect.toPass.timeout`, `expect.toPass.intervals`).
- **1.48: `page.routeWebSocket`/`context.routeWebSocket` bevezetése** (a projekt jelenleg
  nem használ WebSocketöt, SSE-t használ, lásd bevezető).
- **1.44: `toHaveAccessibleName`, `toHaveAccessibleDescription`, `toHaveRole`** új
  assertion-ök, ARIA alapú ellenőrzésekhez, ha a csapat a role-alapú locator stratégiát
  (2. szekció) assertion szinten is végig akarja vinni.
- **1.49: `toMatchAriaSnapshot`** bevezetése, teljes akadálymentességi fa YAML alapú
  összehasonlítására.
- **1.51: `TestStepInfo`** a `test.step`-ben (`step.skip()`, `step.attach()`).

---

## Alkalmazható szabálylista

Ez a lista közvetlenül követhető egy tesztet író agent által, és forrása minden pontnak a
fenti szekciók valamelyike.

1. Locator sorrend: elsőként `getByRole`, utána `getByLabel` (form mezőn),
   `getByPlaceholder`, `getByAltText`, `getByTitle`, `getByText` (csak nem interaktív
   elemen), végül `getByTestId`. CSS/XPath szelektor csak akkor, ha egyik sem alkalmazható,
   és akkor is a lehető legrövidebb, felhasználó-közeli formában. (2. szekció)
2. Tilos `page.$`, `page.$$`, `page.click(selector)` és a többi legacy, szelektor alapú
   `Page`/`Frame` metódus; mindenhol `Locator`-t kell építeni és azon hívni a metódust.
   (5. szekció)
3. Minden állítás web-first assertion (`expect(locator).toXxx()`) legyen, `await`-tel;
   tilos a `expect(await locator.isVisible()).toBe(true)` minta. (4. szekció)
4. Tilos `page.waitForTimeout()`, `setTimeout`, `sleep` vagy bármilyen fix idejű várakozás
   a spec fájlokban. (5. szekció)
5. Elem eltűnésének/megjelenésének várására `toBeVisible()`/`toBeHidden()`; a DOM-hoz
   kötöttség (render/unmount) ellenőrzésére `toBeAttached()`/`toBeAttached({ attached:
false })`. A kettő nem felcserélhető: `toBeVisible` a `toBeAttached`-nál szigorúbb
   (attached ÉS visible). (6. szekció)
6. `waitForSelector` helyett `locator.waitFor({ state })` vagy web-first assertion.
   (5., 7. szekció)
7. Hálózati eseményre `page.waitForResponse()`, nem idő alapú várakozás utána; a
   kezdeti `GET /events` kapcsolat megnyílásának megvárására is ez használható. (7., 9.
   szekció)
8. Összetett, több lépéses feltételre `expect.poll()` vagy `expect(callback).toPass()`,
   nem kézzel írt retry ciklus `setTimeout`-tal. (7., 8. szekció)
9. A globális `TestConfig.expect.timeout` (5000 ms) és `TestConfig.timeout` (30000 ms)
   értékét **nem kell és nem javasolt** nullázni vagy kikapcsolni a "nincs timeout" cél
   eléréséhez; a cél kézi várakozás nélküli, állapot alapú teszteléssel már teljesül, a
   beépített felső korlát biztonsági háló marad. (8. szekció)
10. SSE-vezérelt UI változásra a DOM végállapotára kell várni web-first assertion-nel,
    nem a stream transzportját kell mockolni; `page.route`/`text/event-stream` mockolás
    Playwright 1.62 ellen jelenleg NEM MEGERŐSÍTETT működésű, csak saját méréssel vezethető
    be. (9. szekció)
11. Az `@xyflow/react` node-jaira és éleire a szokásos DOM locator stratégia
    (1-2. pont) vonatkozik, canvas-specifikus API nem kell. (10. szekció)
12. Minden `apps/web/e2e/*.spec.ts` fájl a `./coverage-fixture.ts`-ből importálja a
    `test`/`expect` párost, nem közvetlenül a `@playwright/test`-ből. (11. szekció)
13. Minden teszt saját, izolált állapotból induljon (`beforeEach` vagy `storageState`),
    ne épüljön korábbi teszt mellékhatására. (1. szekció)
14. Új locator vagy komplex interakció felvétele előtt `codegen`-nel vagy a VS Code
    extension-nel érdemes ellenőrizni a generált, ajánlott locatort. (1. szekció)
15. CI hibakereséshez Trace Viewer az elsődleges eszköz, nem videó/screenshot
    utólagos nézegetése. (1. szekció)

---

## A "tilos bármilyen timeout" kérés megvalósítása és a határa

**Amit maradéktalanul, hivatalos forrással alátámasztva meg lehet valósítani:** egyetlen
kézi, idő alapú várakozás (`waitForTimeout`, `setTimeout`, `sleep`, polling ciklus fix
`delay`-jel) sem kerül egyetlen spec fájlba sem. Minden várakozás vagy (a) egy Playwright
akció beépített actionability várakozása, vagy (b) egy web-first assertion retry-ja, vagy
(c) egy explicit, állapotra figyelő eszköz (`waitFor`, `waitForResponse`,
`waitForFunction`, `expect.poll`, `toPass`). Ez pontosan az, amit a Playwright hivatalos
doksija következetesen, több oldalon (best practices, actionability, assertions, a
`waitForTimeout` API referencia) is állít: a manuális időzítés flaky tesztet eredményez,
és mindig van helyette állapot alapú alternatíva.

**A határ:** a fenti eszközök (locator akciók, web-first assertion-ök, `waitForResponse`,
`expect.poll`) mindegyike **saját, beépített felső korlátot** hordoz (assertion timeout
5000 ms, action/navigation timeout alapból "no timeout" de a `TestConfig.timeout`
30000 ms-es teszt timeout mindenképp közbelép). Ez a felső korlát **nem ugyanaz**, mint a
felhasználó által kifogásolt kézi `waitForTimeout` hívás: nem a teszt szerzője dönt úgy,
hogy "várjunk 3 másodpercet, mert gondolom addigra kész lesz", hanem a keretrendszer véd
attól, hogy egy sosem teljesülő feltétel örökre lógó tesztet és lefagyott CI workert
eredményezzen. Ezt a felső korlátot céltalan és a doksi által sehol nem javasolt módon
nullázni vagy végtelenre állítani: az `expect.poll`/`toPass` esetében a `timeout: 0` (vagy
alapérték `0` a `toPass`-nál) dokumentált, mert ott a "cél state" maga is potenciálisan
sosem teljesül determinisztikusan (pl. külső API pollozása), és ez a projekt design
döntése, nem alapbeállítás. A sima `TestConfig.expect.timeout`/`TestConfig.timeout` mezőkre
nincs dokumentált "0 kikapcsolja" viselkedés (8. szekció, NEM MEGERŐSÍTETT), tehát ezekhez
nyúlni kockázatos és forrás nélküli lenne, ami a projekt saját "bizonyíték kényszer"
szabálya alapján is tiltott lépés lenne konkrét szám vagy kikapcsolás bevezetésére.

Összefoglalva: a felhasználó kérése a **kézi időzítés tilalmaként** értelmezve teljesen
megvalósítható és a Playwright saját ajánlásával egybevág; a **beépített timeout mezők
kikapcsolásaként** értelmezve viszont a doksi nem támogatja, és nincs is rá szükség a cél
eléréséhez.
