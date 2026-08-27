// Regresszios teszt egy valos bugra (CLAUDE.md: minden javitott bugot teszt
// fed le). Korabban ket mereesi eset fajlban (m-20.ts, m-31.ts) egy helyi
// `const path = ...` valtozo -- a proxy artifact JSON `path` mezojebol
// szarmazo string -- eltakarta a modul szintu `import path from 'node:path'`
// kotest UGYANABBAN a fuggvenyben. A `const`/`let` kotesek a korulvevo
// scope tetejere hoistolodnak, es "temporal dead zone"-ban maradnak a
// deklaracios sorig -- ha a fuggveny korabban hivatkozott volna a `path`
// modulra (pl. `path.join(...)`), az futasidoben
// "ReferenceError: Cannot access 'path' before initialization" hibat
// dobott volna. A javitas a valtozo atnevezese volt `requestPath`-ra.
//
// Az erintett segedfuggvenyek (`parseMessagesTransactionFile`,
// `parseTransactionTiming`) nincsenek exportalva -- a sajat modul-privat
// hatarukon kivulrol nem hivhatok izoláltan anelkul, hogy csak a teszt
// kedveert exportot vezetnenk be a termekkodba (ami nem tartozna a
// feladathoz). Ezert ez egy statikus ellenorzes, ahogy a feladatleiras
// kifejezetten megengedi ("Ha a fuggveny nem hivhato izolaltan, akkor egy
// statikus ellenorzes is elfogadhato, ami az arnyekolast keresi"): a
// TypeScript compiler API-val feleparszolja a wire-probe TELJES `src/`
// fajat, es minden olyan fajlban, ami alapertelmezett `path` nevvel
// importalja a `node:path`-t, megkeresi, hogy van-e barhol egy fuggvenyen
// beluli `const`/`let`/`var path = ...` ujradeklaracio. Ez a hibas
// verzion (a valtozo `path` nevvel) elbukna, a javitott verzion
// (`requestPath`) pedig zoldre fut -- es barmely jovobeni ujra-bevezetest
// is elkap, nem csak az eredeti ket fajlt.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createSourceFile,
  forEachChild,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  isVariableDeclaration,
  ScriptTarget,
} from 'typescript';
import type { Node, SourceFile } from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));

function listTypeScriptFiles(directory: string): readonly string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Igaz, ha a fajl `import path from 'node:path'` alaku alapertelmezett
// importot tartalmaz (a wire-probe kodbazis meglevo konvencioja, lasd
// m-20.ts, m-31.ts, harness/runner.ts stb.).
function hasDefaultNodePathImport(sourceFile: SourceFile): boolean {
  return sourceFile.statements.some(
    (statement) =>
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'node:path' &&
      statement.importClause?.name?.text === 'path',
  );
}

// Az 1-alapu sorszamai minden olyan `const`/`let`/`var path = ...`
// valtozodeklaracionak, ami arnyekolna a modul szintu `path` importot.
function findShadowingPathDeclarations(sourceFile: SourceFile): readonly number[] {
  const lines: number[] = [];

  function visit(node: Node): void {
    if (isVariableDeclaration(node) && isIdentifier(node.name) && node.name.text === 'path') {
      lines.push(sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1);
    }
    forEachChild(node, visit);
  }

  visit(sourceFile);
  return lines;
}

describe('tools/wire-probe forrás: nincs helyi "path" változó, ami eltakarná a node:path importot', () => {
  const files = listTypeScriptFiles(SRC_DIR);

  it('talál forrásfájlokat az ellenőrzéshez', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);

    it(`${relativePath}: nincs árnyékoló "path" deklaráció`, () => {
      const text = readFileSync(file, 'utf8');
      const sourceFile = createSourceFile(file, text, ScriptTarget.Latest, true);

      if (!hasDefaultNodePathImport(sourceFile)) {
        // Ez a fájl nem importálja a node:path-t "path" néven, tehát
        // logikailag nem árnyékolhatja azt -- nincs mit ellenőrizni.
        return;
      }

      const shadowingLines = findShadowingPathDeclarations(sourceFile);
      expect(shadowingLines).toEqual([]);
    });
  }
});
