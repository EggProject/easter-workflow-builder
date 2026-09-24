// Regressziós teszt, megvalósítás fájl nélkül (SPEC-002 6.2 5. pont, ugyanaz a minta, mint a
// `vite-istanbul-include-invariant` és az `e2e-coverage-threshold` téma): a Playwright lokálisan
// legfeljebb HÁROM workert engedhet, mert a sandbox és a fejlesztői gép ennél többet nem visel el
// (user kérés 2026-09-24, `docs/research/2026-09-24-playwright-worker-korlat.md`,
// `.claude/CLAUDE.md` 11. szekció). A kapu minden `apps/web/playwright*.config.ts` fájlt vizsgál,
// nem csak a jelenlegi kettőt, hogy egy jövőbeli új config se maradjon ellenőrizetlen.
//
// A `workers` mező sorát sima szöveges műveletekkel (nem regexszel) keresi meg és bontja szét:
// egy `^\s*workers:\s*...` alakú regex a `sonarjs/super-linear-regex` szabály szerint
// backtracking kockázatot hordozna, a sortördelés + `startsWith`/`split` viszont ugyanazt
// determinisztikusan, lineáris időben adja.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const LOCAL_WORKER_LIMIT = 3;
const WORKERS_FIELD_PREFIX = 'workers:';

const directory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(directory, '..', '..');

function findPlaywrightConfigFileNames(): readonly string[] {
  return readdirSync(webRoot).filter((entry) => entry.startsWith('playwright') && entry.endsWith('.config.ts'));
}

function findWorkersLine(content: string): string | undefined {
  return content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(WORKERS_FIELD_PREFIX));
}

function stripTrailingComma(value: string): string {
  const trimmed = value.trim();
  return trimmed.endsWith(',') ? trimmed.slice(0, -1).trim() : trimmed;
}

// A `workers` mező lokális (nem CI) ágának értékét adja vissza, két alakban:
//   1. ternary, a projekt saját stílusában: `Boolean(process.env['CI']) ? <ci> : <local>`
//   2. sima szám, ha a fájl nem ágaztat CI szerint: `workers: <local>`
function extractLocalWorkersValue(workersLine: string): number {
  const valuePart = stripTrailingComma(workersLine.slice(WORKERS_FIELD_PREFIX.length));
  const ternaryBranches = valuePart.split('?');
  const [, localBranchAndAfter] = ternaryBranches;
  if (localBranchAndAfter === undefined) {
    return Number(valuePart);
  }
  const [, localBranch] = localBranchAndAfter.split(':', 2);
  return Number((localBranch ?? '').trim());
}

describe('Playwright worker korlát invariáns', () => {
  const configFileNames = findPlaywrightConfigFileNames();

  it('legalább egy playwright config fájl létezik, amit ellenőrizni lehet', () => {
    expect(configFileNames.length).toBeGreaterThan(0);
  });

  it.each(configFileNames)('%s tartalmaz explicit workers mezőt', (configFileName) => {
    const content = readFileSync(path.join(webRoot, configFileName), 'utf8');
    expect(findWorkersLine(content)).toBeDefined();
  });

  it.each(configFileNames)('%s lokálisan legfeljebb három workert enged', (configFileName) => {
    const content = readFileSync(path.join(webRoot, configFileName), 'utf8');
    const workersLine = findWorkersLine(content);
    expect(workersLine, `${configFileName}: hiányzik a workers mező`).toBeDefined();
    const localValue = extractLocalWorkersValue(workersLine ?? '');
    expect(Number.isNaN(localValue), `${configFileName}: a workers lokális értéke nem szám`).toBe(false);
    expect(localValue).toBeLessThanOrEqual(LOCAL_WORKER_LIMIT);
  });
});
