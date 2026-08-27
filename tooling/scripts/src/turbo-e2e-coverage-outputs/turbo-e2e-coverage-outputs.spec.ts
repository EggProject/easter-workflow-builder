// Regressziós teszt egy valós CI hibára (V-20,
// `docs/research/2026-08-26-spec001-ellenorzesek.md`).
//
// A `turbo.json` `test:e2e` taskja nem sorolta fel az `outputs` között a nyers
// e2e coverage könyvtárat (`e2e/.nyc_output/**`). Turborepo cache találatkor a
// Playwright ezért nem indult el, a nyers coverage adat nem került vissza a
// lemezre, és a rákövetkező `nyc report` `ENOENT ... scandir` hibával bukott -
// a CI E2E jobja elszállt, miközben az előző, cache nélküli futás zöld volt.
//
// Lokálisan a hiba láthatatlan, amíg a `.nyc_output` véletlenül ott hever az
// előző futásból, ezért nem elég egy futtatásra épülő ellenőrzés: ez a teszt
// magát a konfigurációt őrzi.
//
// A második állítás (az `inputs` negációja) ugyanennyire fontos: explicit
// `inputs` glob esetén a Turborepo dokumentáltan nem veszi figyelembe a
// `.gitignore`-t (https://turborepo.com/docs/reference/configuration#inputs),
// tehát negáció nélkül a visszaállított, UUID nevű nyers JSON bekerülne a
// hash-be, és a task soha többé nem kapna cache találatot.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A `test:e2e` task azon két mezője, amit ez a teszt őriz.
interface TurboTaskConfig {
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
}

const NYC_OUTPUT_GLOB = 'e2e/.nyc_output/**';
const NYC_OUTPUT_INPUT_NEGATION = '!**/e2e/.nyc_output/**';

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isTurboTaskConfig(value: unknown): value is TurboTaskConfig {
  return (
    isObject(value) &&
    'inputs' in value &&
    'outputs' in value &&
    isStringArray(value.inputs) &&
    isStringArray(value.outputs)
  );
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a check-casing.test.ts-ben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function readPlaywrightTaskConfig(): TurboTaskConfig {
  const configPath = path.join(repoRoot(), 'turbo.json');
  const rawConfig = readFileSync(configPath, 'utf8');
  const parsed: unknown = JSON.parse(rawConfig);

  if (!isObject(parsed) || !('tasks' in parsed) || !isObject(parsed.tasks)) {
    throw new Error('a turbo.json nem tartalmaz `tasks` objektumot');
  }
  if (!('test:e2e' in parsed.tasks)) {
    throw new Error('a turbo.json nem tartalmaz `tasks["test:e2e"]` bejegyzést');
  }

  const task: unknown = parsed.tasks['test:e2e'];
  if (!isTurboTaskConfig(task)) {
    throw new Error('a `test:e2e` taskból hiányzik az `inputs` vagy az `outputs` lista');
  }
  return task;
}

describe('turbo.json test:e2e task', () => {
  it('az `outputs` tartalmazza a nyers e2e coverage könyvtárat', () => {
    expect(readPlaywrightTaskConfig().outputs).toContain(NYC_OUTPUT_GLOB);
  });

  it('az `inputs` kizárja a nyers e2e coverage könyvtárat', () => {
    expect(readPlaywrightTaskConfig().inputs).toContain(NYC_OUTPUT_INPUT_NEGATION);
  });
});
