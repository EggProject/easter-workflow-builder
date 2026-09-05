/* eslint-disable unicorn/no-null -- a WorkflowSummary nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/workflow/workflow-record.ts). */
// Regresszió (felhasználói bejelentés, docs/research/
// 2026-09-05-menu-atlatszatlansag.md): a sor műveletek hárompontos
// triggeréből nyíló `Menu` panelje a nyitási animáció (`packages/ui/src/menu/
// menu.css` `menu-in` kulcskocka) MINDEN pillanatában átlátszatlan kell
// legyen - a mögötte álló táblázat sor semmilyen pillanatban ne üssön át
// rajta. A mérés szerint a hiba forrása az volt, hogy a `menu-in` az
// `opacity` tulajdonságot is animálta `0`-ról `1`-re; a nyitás PILLANATÁBAN
// (progress = 0) a panel emiatt ténylegesen áttetsző volt, holott a
// `--ep-bg-elevated` háttér token önmagában mindkét témában opak.
//
// A teszt ezt a LEGROSSZABB pillanatot (az animáció induló kockáját) méri,
// nem egy találomra választott várakozási idővel (ami `page.waitForTimeout()`
// lenne, a projektben tiltott, és a gépi sebességtől függően flaky is lenne),
// hanem a Web Animations API-val determinisztikusan: `getAnimations()` +
// `pause()` + `currentTime = 0` az elemet PONTOSAN az animáció kezdő
// kockájára állítja, függetlenül a tényleges renderelési időzítéstől.
//
// Igazoltan elbukik a javítás nélkül: a `menu-in` kulcskocka `opacity: 0`/
// `opacity: 1` sorainak ideiglenes visszaírásával lefuttatva ez a teszt a
// `panelOpacity` mezőre `"0"`-t mért a `progress = 0` pillanatban (lásd a
// research dokumentum 3. szekcióját) - a jelen, javított kódon a mért érték
// `"1"`.
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: 'Az első teszt workflow',
  providerId: 'claude-subscription',
  createdAtMs: 1_735_689_600_000,
  updatedAtMs: 1_735_689_600_000,
};

interface MenuOpacitySnapshot {
  readonly found: boolean;
  readonly panelOpacity: string;
  readonly panelBackground: string;
  readonly ancestorOpacities: readonly string[];
}

/**
 * A nyitott menü panelt az animáció KEZDŐ kockájára (`progress = 0`)
 * kényszeríti (`pause()` + `currentTime = 0`), majd a panel és teljes
 * szülőlánca (a `document.body`-ig, mert a panel `createPortal`-lal oda
 * kerül) SAJÁT (nem öröklött - a CSS `opacity` nem öröklődő tulajdonság)
 * számított `opacity` értékét, valamint a panel hátterét olvassa ki.
 */
function readMenuOpacitySnapshotAtAnimationStart(): MenuOpacitySnapshot {
  const panel = globalThis.document.querySelector('[role="menu"]:not([hidden])');
  if (panel === null) {
    return { found: false, panelOpacity: '', panelBackground: '', ancestorOpacities: [] };
  }
  for (const animation of panel.getAnimations()) {
    animation.pause();
    animation.currentTime = 0;
  }
  const panelStyle = globalThis.getComputedStyle(panel);
  const ancestorOpacities: string[] = [];
  let current = panel.parentElement;
  while (current !== null) {
    ancestorOpacities.push(globalThis.getComputedStyle(current).opacity);
    current = current.parentElement;
  }
  return {
    found: true,
    panelOpacity: panelStyle.opacity,
    panelBackground: panelStyle.backgroundColor,
    ancestorOpacities,
  };
}

/** Igaz, ha a színérték NEM hordoz 1-nél kisebb alfa csatornát: a Chromium
 * mind az `rgb()`, mind az `oklab()` (a sötét téma `color-mix` eredménye)
 * alakot alfa nélkül szerializálja, ha az alfa 1 - a `/ <alfa>` szakasz
 * kizárólag 1-nél kisebb alfára jelenik meg. */
function isOpaqueColor(computedColor: string): boolean {
  return !computedColor.includes('/') && !computedColor.startsWith('rgba(');
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA])))]);
});

test('világos témában a menü panel az animáció kezdő pillanatában is átlátszatlan', async ({ page }) => {
  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await expect(page.locator('[role="menu"]:not([hidden])')).toBeVisible();

  const snapshot = await page.evaluate(readMenuOpacitySnapshotAtAnimationStart);

  expect(snapshot.found).toBe(true);
  expect(snapshot.panelOpacity).toBe('1');
  expect(isOpaqueColor(snapshot.panelBackground)).toBe(true);
  for (const ancestorOpacity of snapshot.ancestorOpacities) {
    expect(ancestorOpacity).toBe('1');
  }
});

test('sötét témában a menü panel az animáció kezdő pillanatában is átlátszatlan', async ({ page }) => {
  // Ugyanaz a minta, mint a design-tokens.spec.ts sötét téma tesztjében: a
  // `useThemeMode` hook a `localStorage['eggTheme']` kulcsot olvassa
  // kezdőértékként, navigáció ELŐTT beállítva.
  await page.addInitScript(() => {
    globalThis.localStorage.setItem('eggTheme', 'dark');
  });
  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await expect(page.locator('[role="menu"]:not([hidden])')).toBeVisible();

  const snapshot = await page.evaluate(readMenuOpacitySnapshotAtAnimationStart);

  expect(snapshot.found).toBe(true);
  expect(snapshot.panelOpacity).toBe('1');
  expect(isOpaqueColor(snapshot.panelBackground)).toBe(true);
  for (const ancestorOpacity of snapshot.ancestorOpacities) {
    expect(ancestorOpacity).toBe('1');
  }
});
