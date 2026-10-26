// Regressziós teszt, greppes alakban (SPEC-012 O-20 (b), user döntés 2026-10-26): a `tools/wire-probe`
// a lefedettségből kizárt mérő eszköz (`vitest.config.ts`), ezért az átnevezést forrásszinten őrzi
// ez a teszt. A MiniMax kulcsot a szerver is az `ANTHROPIC_AUTH_TOKEN` néven kapja, ezért a mérő
// eszköz sem olvashat más nevet: a `loadMinimaxApiKey` és a proxy maszkolási értéke is ezt a nevet
// használja, a régi `MINIMAX_API_KEY` név egyetlen kódfájlban sem állhat. Valódi hívás nincs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OLD_NAME = 'MINIMAX_API_KEY';
const NEW_NAME = 'ANTHROPIC_AUTH_TOKEN';

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

describe('a wire-probe a MiniMax kulcsot az ANTHROPIC_AUTH_TOKEN néven olvassa', () => {
  it('az environment.ts a process.env-ből és a .env fájlból is az új nevet olvassa', () => {
    const source = readSource('harness', 'environment.ts');
    expect(source).toContain(`process.env['${NEW_NAME}']`);
    expect(source).toContain(`startsWith('${NEW_NAME}=')`);
    expect(source).not.toContain(OLD_NAME);
  });

  it('a proxy a maszkolandó titkot az új név alatt olvassa', () => {
    const source = readSource('proxy.ts');
    expect(source).toContain(`process.env['${NEW_NAME}']`);
    expect(source).not.toContain(OLD_NAME);
  });

  it('a régi név a wire-probe egyetlen kódfájljában sem áll', () => {
    const offenders = listTypeScriptFiles(sourceDirectory).filter((file) =>
      readFileSync(file, 'utf8').includes(OLD_NAME),
    );
    expect(offenders.map((file) => path.relative(sourceDirectory, file))).toEqual([]);
  });
});
