// Trivialis smoke teszt: az apps/web MEG NEM a tenyleges alkalmazas (lasd
// ../vite.config.ts megjegyzese), ez csak azt igazolja, hogy a Playwright
// infrastruktura (webServer inditas, navigacio, egyszeru assertion)
// mukodik.
import { test, expect } from './coverage-fixture.ts';

test('betölti a kezdőlapot és megjeleníti a helyőrző szöveget', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toHaveText('easter-workflow-builder');
});
