// Regressziós e2e: a design-token barrel (packages/ui/src/design-token/
// colors-and-type.css) definiálja a `--ep-*` CSS változókat, amiket MINDEN
// komponens CSS-e HASZNÁL, de korábban egyetlen fájl sem IMPORTÁLTA - a
// valódi `vite build` kimenetében a `:root` / `[data-theme="dark"]`
// definíciós blokk hiányzott, csak a felhasználási helyek (`var(--ep-bg)`)
// épültek be, tehát az egész design system (szín, betűtípus, sötét téma)
// inaktív volt, hibaüzenet vagy hiba nélkül. Ezt csak egy VALÓDI böngésző
// ellen futó build tudja megbízhatóan igazolni (happy-dom nem számol teljes
// CSS cascade-et), ezért e2e teszt, nem unit teszt.
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  // eslint-disable-next-line unicorn/no-null -- a WorkflowSummary nullable mezői a protokoll szerint ténylegesen `null` értéket hordoznak (packages/protocol/src/workflow/workflow-record.ts).
  description: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA])))]);
});

test('világos módban a --ep-bg token definiálva van, a --ep-tint (kizárólag sötét) nincs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();

  const tokens = await page.evaluate(() => {
    const style = globalThis.getComputedStyle(globalThis.document.documentElement);
    return { epBg: style.getPropertyValue('--ep-bg').trim(), epTint: style.getPropertyValue('--ep-tint').trim() };
  });

  expect(tokens.epBg).not.toBe('');
  expect(tokens.epTint).toBe('');
});

test('sötét módban a --ep-tint token (kizárólag [data-theme="dark"]) definiálva van', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem('eggTheme', 'dark');
  });
  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();

  const tokens = await page.evaluate(() => {
    const style = globalThis.getComputedStyle(globalThis.document.documentElement);
    return { epBg: style.getPropertyValue('--ep-bg').trim(), epTint: style.getPropertyValue('--ep-tint').trim() };
  });

  expect(tokens.epBg).not.toBe('');
  expect(tokens.epTint).not.toBe('');
});
