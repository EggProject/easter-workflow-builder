// Playwright fixture, ami minden teszt (minden `page` fixture hasznalat)
// utan kiolvassa a `window.__coverage__` objektumot - ezt a
// `vite-plugin-istanbul` altal instrumentalt build hozza letre futasidoben
// - es egyedi fajlba menti a `.nyc_output/` ala. Ez a `nyc` sajat,
// dokumentalt "raw coverage temp dir" konvencioja (alapertelmezett
// `temp-dir` erteke `./.nyc_output`,
// https://github.com/istanbuljs/nyc#readme, "Common Configuration
// Options" tablazat), amit a `coverage:e2e:report` npm script
// (`nyc report --temp-dir e2e/.nyc_output`) olvas ossze es jelent - ez a
// dokumentalt "Combining reports from multiple runs" mintat kovet, csak a
// `nyc --silent` helyett a Playwright fixture irja a raw JSON fajlokat.
//
// Az e2e coverage-re NINCS kuszob (SPEC-001 10. szekcio, elfogadasi
// kriterium 24. pont: "E2E kuszob nem kerul bevezetesre").
import { test as base } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

declare global {
  // Ambiens globalis valtozo deklaracio - a TypeScript ezt csak `var`
  // alakban engedi meg (nem `const`/`let`), ez a dokumentalt modja a
  // globalThis kiegeszitesenek.
  var __coverage__: unknown;
}

const COVERAGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.nyc_output');

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);
    const coverage = await page.evaluate(() => globalThis.__coverage__);
    if (coverage === undefined) {
      return;
    }
    mkdirSync(COVERAGE_DIR, { recursive: true });
    writeFileSync(path.join(COVERAGE_DIR, `${randomUUID()}.json`), JSON.stringify(coverage), 'utf8');
  },
});

export { expect } from '@playwright/test';
