// Regressziós teszt, megvalósítás fájl nélkül (SPEC-002 6.2 5. pont, ugyanaz a minta, mint a
// `playwright-worker-limit` téma): az `apps/web/playwright.config.ts` `webServer.env` blokkja
// MIND A NÉGY `VITE_` változót megadja (SPEC-012 4.6, 7.). Ok: a kliens config olvasója a hiányzó
// változóra ma az alapértéket adja (SPEC-012 4.2), és a Vite a már létező folyamat változót
// előnyben részesíti a `.env` fájllal szemben, tehát egy helyi `apps/web/.env` az e2e buildet
// csak akkor hagyja érintetlenül, ha a `webServer.env` mind a négyet beállítja. Egy kihagyott
// változó csendben a 4.2 alapértékre (vagy a helyi `.env` értékére) esne, és az e2e a
// fejlesztő gépén mást mérne, mint a CI-ban.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FRONTEND_VARIABLES = ['VITE_API_ORIGIN', 'VITE_STREAM_ORIGIN', 'VITE_LIST_LIMIT', 'VITE_STREAM_REPLAY_LIMIT'];
const ENVIRONMENT_BLOCK_START = 'env: {';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A `webServer.env` objektum literál szövege a nyitó kapcsos zárójeltől az
 * első záróig (a blokkban nincs beágyazott objektum).
 */
function readEnvironmentBlock(configSource: string): string {
  const start = configSource.indexOf(ENVIRONMENT_BLOCK_START);
  if (start === -1) {
    return '';
  }
  const end = configSource.indexOf('}', start);
  return end === -1 ? configSource.slice(start) : configSource.slice(start, end);
}

/**
 * A blokk kulcsai: a `NÉV:` alakú sorok, a sor elején álló behúzás után.
 */
function readEnvironmentKeys(environmentBlock: string): readonly string[] {
  return environmentBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes(':'))
    .map((line) => line.slice(0, line.indexOf(':')));
}

describe('a Playwright webServer.env mind a négy VITE_ változót megadja', () => {
  it('az apps/web/playwright.config.ts env blokkja tartalmazza a négy változót', () => {
    const configSource = readFileSync(path.join(directory, '..', '..', 'playwright.config.ts'), 'utf8');
    const keys = readEnvironmentKeys(readEnvironmentBlock(configSource));
    expect(FRONTEND_VARIABLES.filter((variable) => !keys.includes(variable))).toEqual([]);
  });

  it('a kulcs olvasó a hiányzó változót észreveszi (negatív eset)', () => {
    const withoutListLimit =
      "env: {\n  VITE_API_ORIGIN: A,\n  VITE_STREAM_ORIGIN: B,\n  VITE_STREAM_REPLAY_LIMIT: '100',\n},";
    const keys = readEnvironmentKeys(readEnvironmentBlock(withoutListLimit));
    expect(FRONTEND_VARIABLES.filter((variable) => !keys.includes(variable))).toEqual(['VITE_LIST_LIMIT']);
  });

  it('env blokk nélküli forrásra üres kulcslista jön, tehát mind a négy hiányzik', () => {
    expect(readEnvironmentKeys(readEnvironmentBlock('export default {};'))).toEqual([]);
  });
});
