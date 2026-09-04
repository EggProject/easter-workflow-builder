/* eslint-disable unicorn/no-null -- a WorkflowSummary nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/workflow/workflow-record.ts). */
// Modal fókusz csapda és fókusz visszaállítás e2e (packages/ui Modal.tsx
// dokumentált viselkedése): nyitáskor az első fókuszálható elemre kerül a
// fókusz, a Tab a dialóguson belül körbeér mindkét irányban, Escape zár, és
// záráskor a fókusz visszatér a megnyitó elemre. Az átnevezés modálist
// használja: a Név mező előre ki van töltve, tehát a "Mentés" gomb a
// nyitástól kezdve engedélyezett, a fókuszálható elemek listája stabil.
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: 'leírás',
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA])))]);
  await page.goto('/');
});

test('nyitáskor az első fókuszálható elemre (a bezárás gombra) kerül a fókusz', async ({ page }) => {
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  // A sor műveletek 2026-09-04 óta egy hárompontos triggerből nyíló, portálon
  // (`document.body`) át renderelt menü mögé kerültek (felhasználói kérés).
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Átnevezés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow átnevezése' });
  await expect(dialog.getByRole('button', { name: 'Bezárás' })).toBeFocused();
});

test('Shift+Tab az első elemről az utolsóra ugrik, Tab az utolsóról vissza az elsőre', async ({ page }) => {
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Átnevezés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow átnevezése' });
  const closeButton = dialog.getByRole('button', { name: 'Bezárás' });
  const saveButton = dialog.getByRole('button', { name: 'Mentés' });

  await expect(closeButton).toBeFocused();
  // A Név mező a `workflow` propból egy `useEffect`-ben töltődik ki
  // (rename-workflow-modal.tsx), tehát a legelső renderen még üres, és a
  // "Mentés" gomb emiatt átmenetileg letiltott (disabled={... || name.trim()
  // === ''}) - letiltott elem nincs a tabsorrendben. A tesztnek a
  // fókuszálható elemek VÉGLEGES, stabil halmazára kell várnia, mielőtt a
  // Tab bejárást elkezdi.
  await expect(saveButton).toBeEnabled();
  await page.keyboard.press('Shift+Tab');
  await expect(saveButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
});

test('Escape bezárja a dialógust, és a fókusz visszatér a megnyitó gombra', async ({ page }) => {
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  // A "megnyitó gomb" itt a hárompontos trigger: az "Átnevezés" menüitem a
  // kiválasztáskor bezárja a menüt (ekkor a Menu saját fókusz-visszaállítása
  // a triggerre kerül), és csak EZUTÁN nyílik meg a modális - a Modal a
  // MOUNT pillanatában rögzíti a `document.activeElement`-et
  // (packages/ui/src/modal/Modal.tsx), ami emiatt a trigger, nem a
  // (már bezárt menüből eltűnt) menüitem.
  const triggerButton = row.getByRole('button', { name: /^Műveletek/ });
  await triggerButton.click();
  await page.getByRole('menuitem', { name: 'Átnevezés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow átnevezése' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(triggerButton).toBeFocused();
});
