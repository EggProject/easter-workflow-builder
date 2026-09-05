# A lebegő Menu panel áttetszősége, 2026-09-05

Kérdés: felhasználói bejelentés szerint a táblázat sor műveletek hárompontos triggeréből
nyíló `Menu` panelje (`packages/ui/src/menu/`) áttetsző, a mögötte álló táblázat sor átüt
rajta (`shell-action-menu-open.png`). Honnan jön az áttetszőség, és mi a javítás.

## 1. Mérési környezet

Egy Playwright teszt (`apps/web/e2e/tmp-debug-menu.spec.ts`, eldobható, nem része a reponak,
ez a dokumentum az egyetlen tartós nyoma) a projekt saját `rest-mock.ts`/`sse-mock.ts`
mockjaival betölti a workflow listát (két sor, hogy a második sor `LÉTREHOZVA` cellája a
menü mögé essen, pontosan mint a bejelentett screenshoton), megnyitja az első sor
"Műveletek" triggerét, és a panelen, illetve a szülőláncán (`document.body`, `<html>`)
`getComputedStyle`-lal olvassa ki a `background-color`, `opacity`, `backdrop-filter`,
`filter`, `mix-blend-mode`, `isolation` értékeket. A build a projekt pinelt Playwright
verziója (`1.62.1`), chromium, `vite build && vite preview` ellen fut (`playwright.config.ts`
`webServer`), rootless sandboxban, `LD_LIBRARY_PATH` a hiányzó `libXdamage.so.1`-hez
igazítva (`.claude/CLAUDE.md` 12. szekció) - a repóban emiatt semmi nem változott.

## 2. Mérés: a NYUGALMI állapot (a nyitási animáció lefutása után) átlátszatlan

A trigger kattintás után `300ms` várakozással (a `--ep-dur-fast: 140ms` animáció duplája)
mért `getComputedStyle`:

- **Világos téma**: `.menu` `background-color: rgb(255, 255, 255)`, `opacity: 1`,
  `backdrop-filter: none`. A szülőlánc (`BODY`, `HTML`) `opacity: 1`, nincs
  `backdrop-filter`/`filter`/`mix-blend-mode`/`isolation` hatás.
- **Sötét téma** (`document.documentElement.dataset.theme = 'dark'`): `.menu`
  `background-color: oklab(0.234469 -0.000292671 -0.0124669)` (a `--ep-bg-elevated`
  `color-mix(in oklab, #131720 95%, var(--ep-tint))` kiszámított értéke), `opacity: 1`.

Vagyis a **nyugalmi állapotban egyik témában sincs áttetsző háttér, `opacity` vagy
`backdrop-filter`** - a `--ep-bg-elevated` token mindkét témában opak színt ad.

## 3. Mérés: a NYITÁS PILLANATÁBAN (animáció közben) ténylegesen áttetsző

Ugyanaz a teszt, várakozás NÉLKÜL, közvetlenül a trigger kattintás és a panel
`toBeVisible()` várakozása után screenshotolva (`e2e-debug-immediate.png`): a panel
láthatóan áttetsző, a mögötte lévő "1:00:00" szöveg átüt rajta - **bájtra ugyanaz a hiba,
mint a bejelentett `shell-action-menu-open.png` screenshoton**.

**Ok, azonosítva**: a `packages/ui/src/menu/menu.css` `@keyframes menu-in` szabálya

```css
@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

a `.menu:not([hidden]) { animation: menu-in var(--ep-dur-fast) var(--ep-ease-out); }`
szabályon keresztül a PANEL EGÉSZÉT (háttér, szegély, tartalom, árnyék) `opacity: 0`-ról
animálja `opacity: 1`-re, `--ep-dur-fast` (140ms) alatt. Az `opacity` a panel elem SAJÁT
CSS tulajdonsága, tehát az animáció ideje alatt a ténylegesen opak `--ep-bg-elevated`
háttér is részlegesen áttetszővé válik - ez a mért, konkrét forrása a bejelentett hibának.
A screenshot módszer (kattintás után azonnal screenshot, várakozás nélkül) pontosan ezt a
140ms-os ablakot kapja el.

## 4. Szándékos-e a forrás design systemben

**Igen.** A `packages/ui/src/menu/menu.css` fejléce szerint a `.menu` szabályai (a
pozíció kivételével) bájtra azonosak az `eggproject-design-components` forrással. A forrás
`components/menu/menu.css` `@keyframes menu-in` szabálya szó szerint ugyanezt az
`opacity: 0 -> 1` belépő animációt tartalmazza - ez tehát egy szándékos, a legtöbb
felugró/lenyíló menüben szokásos fade-in effekt a forrás design systemben, nem hiba.

**A felhasználó kérése ennél erősebb**: a panel egyetlen pillanatra se legyen áttetsző,
tehát a nyitási animáció `opacity` komponensét el kell hagyni, míg a `transform`
(csúszó belépés) megmaradhat.

## 5. A javítás

`packages/ui/src/menu/menu.css` `@keyframes menu-in`: az `opacity: 0`/`opacity: 1` sorok
törölve, csak a `transform: translateY(-4px) -> translateY(0)` marad. Ettől a panel a
nyitási animáció MINDEN pillanatában a `--ep-bg-elevated` token tényleges, opak színét
mutatja, mindkét témában - a `box-shadow` (`--ep-shadow-lg`) és a `border`
(`--ep-border-subtle`) érintetlen marad, mert azok a `.menu` szabályban vannak, nem az
animációban.

## 6. Regresszió, ami elkapja

`apps/web/e2e/action-menu-opacity.spec.ts`: a `page.waitForTimeout()` tiltott
(`.claude/CLAUDE.md` 11. szekció), és egy találomra választott várakozási idő gépi
sebességtől függően flaky is lenne, ezért a teszt a Web Animations API-val
determinisztikusan a nyitási animáció KEZDŐ kockájára (`progress = 0`) kényszeríti a
panelt: `panel.getAnimations()`, majd minden animáción `pause()` + `currentTime = 0`.
Ezen a pilanaton olvassa ki a panel `background-color`-ját (állítja, hogy nem hordoz
1-nél kisebb alfát), valamint a panel és teljes szülőlánca saját `opacity` értékét
(állítja, hogy mindegyik `"1"`), mindkét témában. A javítás visszavonásával (az
`opacity: 0`/`opacity: 1` sorok visszaírásával a kulcskockákba) mindkét teszt igazoltan
elbukik - mért érték: `panelOpacity` `"0"` `"1"` helyett -, majd a javítás
visszaállításával mindkettő zöld.
