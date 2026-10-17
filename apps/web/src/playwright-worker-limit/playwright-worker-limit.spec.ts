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
//
// A CLI kapcsoló a config értéke elé kerül (`docs/research/2026-09-24-playwright-worker-korlat.md`
// 3. szekció), tehát egy scriptben álló `--workers`/`-j` a fenti korlátot csendben megkerülné. A
// worker számot ezért kizárólag a config adhatja: a kapcsoló a repó minden commitolt
// `package.json` fájljában, shell scriptjében és YAML fájljában (a `_github` workflow és action
// fájlok is) értéktől függetlenül tiltott, mert a `50%` vagy egy változó értéke a korláthoz nem
// is hasonlítható. A hosszú `--workers` alak minden sorban tilos; a rövid `-j` alak csak a
// `playwright` vagy `test:e2e` szót tartalmazó sorban, mert más eszközök (`make -j4`, `jq -j`)
// ugyanezt a betűt mással jelölik. A teljes soros shell és YAML komment kimarad, mert az nem fut le.
// A sortöréses (`\`) folytatósorokat a vizsgálat összefűzve nézi: egy `playwright test \` sor után
// álló `-j 6` sor önmagában nem tartalmazza a `playwright` szót, és a rövid alak átcsúszott volna.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const LOCAL_WORKER_LIMIT = 3;
const WORKERS_FIELD_PREFIX = 'workers:';

const SCRIPT_FILE_PATTERN = /(?:^|\/)package\.json$|\.(?:sh|bash|ya?ml)$/;
// A szavakra bontás elválasztója: minden, ami egy kapcsolóban nem állhat
// (szóköz, idézőjel, `=`, `$`, zárójel), így a `--workers=6`, a `"-j 6"` és a
// `--workers ${{ matrix.n }}` is külön szóként adja a kapcsolót.
const SCRIPT_WORD_SEPARATOR_PATTERN = /[^\w.%-]+/;
// A rövid alak önállóan (`-j`), hozzáírt értékkel (`-j6`) és összevont
// rövid kapcsolók végén (`-xj`) is; a `-jar`-hoz hasonló, `j` betűvel kezdődő
// más kapcsoló nem.
const SHORT_WORKERS_OPTION_PATTERN = /^-[A-Za-z]*j\d*$/;

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

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listTrackedScriptFiles(root: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return output.split('\n').filter((line) => SCRIPT_FILE_PATTERN.test(line));
}

const PLAYWRIGHT_COMMAND_PATTERN = /playwright|test:e2e/;

function hasWorkersOption(line: string): boolean {
  const words = line.split(SCRIPT_WORD_SEPARATOR_PATTERN);
  if (words.includes('--workers')) {
    return true;
  }
  return PLAYWRIGHT_COMMAND_PATTERN.test(line) && words.some((word) => SHORT_WORKERS_OPTION_PATTERN.test(word));
}

/**
 * A szöveg logikai sorai: a végén `\` jelet viselő sor a következővel összefűzve
 * áll (a shell is így olvassa). A `#` kezdetű teljes soros komment kimarad
 * (shell és YAML), és a végén álló `\` nem fűzi tovább a következő sort, mert a
 * megjegyzés a sor végén véget ér; a `package.json` fájlban ilyen sor nem áll,
 * tehát ott nem szűr.
 */
function toLogicalLines(content: string): readonly string[] {
  const logicalLines: string[] = [];
  let pending: string | undefined;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (pending !== undefined || !line.startsWith('#')) {
      const isContinued = line.endsWith('\\');
      const lineText = isContinued ? `${line.slice(0, -1).trimEnd()} ` : line;
      const text = `${pending ?? ''}${lineText}`;
      pending = isContinued ? text : undefined;
      if (!isContinued) {
        logicalLines.push(text);
      }
    }
  }
  return pending === undefined ? logicalLines : [...logicalLines, pending];
}

/**
 * A szöveg minden olyan logikai sora, ami worker szám kapcsolót tartalmaz.
 */
function findWorkersOptionLines(content: string): readonly string[] {
  return toLogicalLines(content).filter((line) => hasWorkersOption(line));
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

  it('egyetlen commitolt script sem ad át worker szám kapcsolót a Playwrightnak', () => {
    const root = repoRoot();
    const offenders = listTrackedScriptFiles(root).flatMap((relativePath) =>
      findWorkersOptionLines(readFileSync(path.join(root, relativePath), 'utf8')).map(
        (line) => `${relativePath}: ${line}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it.each([
    'playwright test --workers=6',
    'playwright test --workers 6',
    'playwright test -j 6',
    'playwright test -j6',
    'bun run test:e2e -- --workers=50%',
    '"test:e2e": "playwright test -xj 6"',
    'run: bun run test:e2e -- --workers ${{ matrix.workers }}',
  ])('a "%s" alak worker szám kapcsolónak számít', (line) => {
    expect(findWorkersOptionLines(line)).toEqual([line]);
  });

  it.each([
    ['playwright test \\\n  -j 6', 'playwright test -j 6'],
    [
      'bun x playwright test --reporter=dot \\\n  --grep smoke \\\n  -j6',
      'bun x playwright test --reporter=dot --grep smoke -j6',
    ],
    ['# megjegyzés \\\nplaywright test -j 6', 'playwright test -j 6'],
    ['playwright test \\\n  --workers=6', 'playwright test --workers=6'],
  ])('a sortöréses "%s" alak összefűzve worker szám kapcsolónak számít', (content, logicalLine) => {
    expect(findWorkersOptionLines(content)).toEqual([logicalLine]);
  });

  it.each([
    'java -jar app.jar',
    'vitest run --maxWorkers=2',
    '# playwright test --workers=6',
    'make -j4',
    'jq -j .name package.json',
    'make \\\n  -j4',
    '# playwright test \\\nmake -j4',
    'playwright test \\\n  --reporter=dot',
  ])('a "%s" alak nem számít worker szám kapcsolónak', (line) => {
    expect(findWorkersOptionLines(line)).toEqual([]);
  });
});
