// Regressziós teszt: az e2e lefedettségi küszöb KAPU MARADJON.
//
// Megvalósítás fájl nélküli téma (`.claude/CLAUDE.md` 5. szekció, SPEC-002
// 6.2 5. pont): a konfigurációs invariánst őrzi, nem egy exportált egységet.
// Ugyanaz a minta, mint a `vite-istanbul-include-invariant` és a
// `turbo-e2e-coverage-outputs` téma.
//
// Két dolog együtt teszi kapuvá a küszöböt, és külön-külön mindkettő
// észrevétlenül elveszhet egy átszervezésben:
//   1. az `apps/web/package.json` `coverage:e2e:report` scriptje
//      `--check-coverage` kapcsolóval fut, mind a négy metrikára megadott
//      küszöbbel (enélkül a parancs csak riportál, ahogy 2026-09-05 előtt);
//   2. az összesítő `ci` job `needs` listája tartalmazza az `e2e` jobot
//      (enélkül az `e2e` bukása nem bukná meg a ruleset által kötelezőnek
//      kért egyetlen státuszcsekket, tehát a küszöb nem lenne kapu).
//
// A számok forrása és a származtatás:
// `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const THRESHOLD_FLAGS = ['--statements', '--branches', '--functions', '--lines'] as const;

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function readCoverageReportScript(): string {
  const content = readFileSync(path.join(repoRoot(), 'apps', 'web', 'package.json'), 'utf8');
  const match = /"coverage:e2e:report":\s*"([^"]+)"/.exec(content);
  if (match?.[1] === undefined) {
    throw new Error('Az apps/web/package.json nem tartalmaz coverage:e2e:report scriptet.');
  }
  return match[1];
}

function readContinuousIntegrationWorkflow(): string {
  return readFileSync(path.join(repoRoot(), '.github', 'workflows', 'ci.yml'), 'utf8');
}

describe('e2e lefedettségi küszöb invariáns', () => {
  it('a coverage:e2e:report script --check-coverage kapcsolóval fut', () => {
    expect(readCoverageReportScript()).toContain('--check-coverage');
  });

  it('mind a négy metrikára áll küszöb, pozitív számmal', () => {
    const script = readCoverageReportScript();
    for (const flag of THRESHOLD_FLAGS) {
      const match = new RegExp(String.raw`${flag} (\d+(?:\.\d+)?)`).exec(script);
      expect(match?.[1], `hiányzó küszöb: ${flag}`).toBeDefined();
      expect(Number(match?.[1])).toBeGreaterThan(0);
    }
  });

  it('az összesítő ci job needs listája tartalmazza az e2e jobot', () => {
    const workflow = readContinuousIntegrationWorkflow();
    // A `ci:` job blokkjának `needs:` sora. A workflow egyetlen `needs`
    // sora sem használ több soros YAML listát, tehát az egy soros alak
    // illesztése elég.
    const match = /\n {2}ci:\n(?:.*\n)*? {4}needs: \[([^\]]+)\]/.exec(workflow);
    expect(match?.[1], 'a ci job needs sora nem található').toBeDefined();
    expect((match?.[1] ?? '').split(',').map((entry) => entry.trim())).toContain('e2e');
  });

  it('a workflow egyetlen jobja sem kap continue-on-error kapcsolót', () => {
    // A `continue-on-error: true` dokumentáltan "Prevents a workflow run
    // from failing when a job fails" - egy kapu nem lehet elnéző. A minta
    // a TÉNYLEGES YAML kulcsot keresi (sor eleji behúzás plusz kulcsnév),
    // nem a puszta szöveget: a fájl egy megjegyzésben leírja, miért került
    // ki annak idején ez a kapcsoló az `e2e` jobból.
    const workflowLines = readContinuousIntegrationWorkflow().split('\n');
    expect(workflowLines.filter((line) => /^\s+continue-on-error:/.test(line))).toEqual([]);
  });
});
