import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Az elem teljes szélessége a nézetablakon belül van. Nem `toBeInViewport`:
 * az függőleges görgetést is számolná, a Beállítások kártyái pedig 320
 * pixelen a nézetablak alá nyúlnak. A dokumentum `scrollWidth` mérése erre
 * vak (az `.app-content` `overflow: auto`, `.claude/CLAUDE.md` 12. szekció),
 * ezért az elem saját doboza a mért mennyiség.
 */
export async function expectHorizontallyInside(page: Page, locator: Locator): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? Infinity) + (box?.width ?? Infinity)).toBeLessThanOrEqual(viewport?.width ?? 0);
}
