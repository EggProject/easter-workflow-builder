// Regressziós teszt, greppes alakban (SPEC-012 O-20 (b), user döntés 2026-10-26; SPEC-013 4.7, user
// döntés 2026-10-27): a `tools/wire-probe` a lefedettségből kizárt mérő eszköz (`vitest.config.ts`),
// ezért a kulcs neveit forrásszinten őrzi ez a teszt. A szerver a MiniMax kulcsot az
// `ANTHROPIC_AUTH_TOKEN` vagy az `ANTHROPIC_API_KEY` néven fogadja (az előbbi nyer), a mérő eszköz
// ugyanezt a két nevet olvassa ugyanebben a sorrendben, és a proxy mindkét név értékét maszkolja; a
// régi `MINIMAX_API_KEY` név egyetlen kódfájlban sem állhat. Valódi hívás nincs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OLD_NAME = 'MINIMAX_API_KEY';
const KEY_NAMES_LITERAL = "['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'] as const";

const harnessDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.join(harnessDirectory, '..');

function readSource(...segments: readonly string[]): string {
  return readFileSync(path.join(sourceDirectory, ...segments), 'utf8');
}

function listTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return listTypeScriptFiles(fullPath);
    }
    return fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts') ? [fullPath] : [];
  });
}

describe('a wire-probe a MiniMax kulcsot a két elfogadott néven olvassa', () => {
  it('az environment.ts a két nevet az ANTHROPIC_AUTH_TOKEN elsőbbségével, a process.env-ből és a .env fájlból olvassa', () => {
    expect(readSource('harness', 'minimax-key-names.ts')).toContain(
      `export const MINIMAX_KEY_NAMES = ${KEY_NAMES_LITERAL};`,
    );
    const source = readSource('harness', 'environment.ts');
    expect(source).toContain('for (const name of MINIMAX_KEY_NAMES)');
    expect(source).toContain('process.env[name]');
    expect(source).toContain('trimmed.startsWith(`${name}=`)');
    expect(source).not.toContain(OLD_NAME);
  });

  it('a proxy mindkét név értékét maszkolja', () => {
    const source = readSource('proxy.ts');
    expect(source).toContain('MINIMAX_KEY_NAMES.flatMap');
    expect(source).toContain('process.env[name]');
    expect(source).not.toContain(OLD_NAME);
  });

  it('a régi név a wire-probe egyetlen kódfájljában sem áll', () => {
    const offenders = listTypeScriptFiles(sourceDirectory).filter((file) =>
      readFileSync(file, 'utf8').includes(OLD_NAME),
    );
    expect(offenders.map((file) => path.relative(sourceDirectory, file))).toEqual([]);
  });
});
