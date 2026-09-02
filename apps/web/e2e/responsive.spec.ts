// Reszponzív e2e (T-008-29): a topnav lenyíló menüje mobil viewporton, és a
// tábla másodlagos oszlopainak elrejtése a --ep-screen-lg (1024px)
// töréspont alatt (packages/ui/src/topnav-shell/topnav-shell.css,
// packages/ui/src/data-table/data-table.css).
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: 'leírás',
  providerId: 'claude-subscription',
  createdAtMs: 1,
  updatedAtMs: 1,
};

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA])))]);
});

test('768px fölött a navigáció a barban látszik, a hamburger gomb rejtett', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Futás előzmények' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Navigáció megnyitása' })).toBeHidden();
});

test('768px alatt a hamburger gomb nyitja a lenyíló navigációt', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const toggleButton = page.getByRole('button', { name: 'Navigáció megnyitása' });
  const navigationLink = page.getByRole('link', { name: 'Futás előzmények' });

  await expect(toggleButton).toBeVisible();
  await expect(navigationLink).toBeHidden();

  await toggleButton.click();
  await expect(navigationLink).toBeVisible();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
});

test('768px alatt a navigációra kattintva bezárul a lenyíló menü', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Navigáció megnyitása' }).click();
  await page.getByRole('link', { name: 'Futás előzmények' }).click();

  await expect(page.getByRole('heading', { name: 'Futás előzmények' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Futás előzmények' })).toBeHidden();
});

test('1024px alatt a másodlagos oszlopok (Leírás, Provider) elrejtőznek', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/');

  const table = page.getByRole('table', { name: 'Workflow-k' });
  await expect(table.getByRole('columnheader', { name: 'Név' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Leírás' })).toBeHidden();
  await expect(table.getByRole('columnheader', { name: 'Provider' })).toBeHidden();
});

test('1024px fölött minden oszlop látszik', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const table = page.getByRole('table', { name: 'Workflow-k' });
  await expect(table.getByRole('columnheader', { name: 'Leírás' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Provider' })).toBeVisible();
});
