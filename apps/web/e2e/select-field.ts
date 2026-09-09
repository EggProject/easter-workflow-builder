import { expect, type Locator, type Page } from '@playwright/test';

/**
 * A `SelectField` a design system `Select` komponensét építi meg: a trigger
 * egy `role="combobox"` gomb, a lenyíló egy `role="listbox"` panel, tehát a
 * natív `<select>` elemre szabott `locator.selectOption()` és
 * `toHaveValue()` NEM alkalmazható rá (a Playwright mindkettőt natív
 * `<select>`/`<input>` elemhez köti).
 *
 * A panel `createPortal`-lal a `document.body`-ba kerül, és zárva a `hidden`
 * attribútum rejti, tehát a hozzáférhetőségi fából is kiesik: egyszerre
 * legfeljebb egy `role="listbox"` látszik az oldalon, ezért a `page`
 * szintjéről kereshető, a triggert tartalmazó régió nélkül is.
 */
export async function chooseSelectOption(page: Page, select: Locator, optionLabel: string): Promise<void> {
  await select.click();
  await page.getByRole('listbox').getByRole('option', { name: optionLabel, exact: true }).click();
  await expect(select).toHaveAttribute('aria-expanded', 'false');
}

/**
 * A kiválasztott opció FELIRATÁT állítja: a trigger szövege a `.select__value`
 * felirat (a chevron SVG nem ad szöveget). Ez a `toHaveValue()` megfelelője
 * a gomb alapú triggeren.
 */
export async function expectSelectedLabel(select: Locator, optionLabel: string): Promise<void> {
  await expect(select).toHaveText(optionLabel);
}
