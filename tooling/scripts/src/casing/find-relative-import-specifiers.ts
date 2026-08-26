/**
 * Egyetlen forrásfájl relatív import/export specifikátorainak kigyűjtése a
 * TypeScript compiler API-val (ugyanaz a minta, mint a
 * `tools/wire-probe/src/no-shadowed-path-import.test.ts`-ben).
 *
 * Csak a modul szintű `import ... from '...'` és `export ... from '...'`
 * deklarációkat nézi - ezek mindig a fájl tetején állnak érvényes ESM-ben,
 * mélyebb bejárás (`forEachChild`) ezért nem kell. A repóban nincs dinamikus
 * `import('./...')` relatív hívás és nincs `require(...)` sem (ellenőrizve:
 * `git grep -nP "import\(['\"]\.\." -- '*.ts' '*.tsx' '*.js' '*.mjs' '*.cjs'`
 * és `git grep -nP "require\(['\"]\.\.?/"` nulla találatot ad), tehát ez a két
 * deklarációtípus a teljes felületet fedi.
 */
import { createSourceFile, isExportDeclaration, isImportDeclaration, isStringLiteral, ScriptTarget } from 'typescript';
import type { SourceFile, Statement } from 'typescript';

export interface RelativeImportSpecifier {
  readonly specifier: string;
  readonly line: number;
}

function isRelativeSpecifier(text: string): boolean {
  return text.startsWith('./') || text.startsWith('../');
}

// Az `import ... from '...'` alakban a `moduleSpecifier` mindig van, az
// `export { x } from '...'` alakban opcionális (a forrás nélküli
// `export { x }` re-exportnak nincs). Csak akkor ad vissza szöveget, ha a
// specifikátor relatív útvonal.
function extractRelativeSpecifierText(statement: Statement): string | undefined {
  if (
    isImportDeclaration(statement) &&
    isStringLiteral(statement.moduleSpecifier) &&
    isRelativeSpecifier(statement.moduleSpecifier.text)
  ) {
    return statement.moduleSpecifier.text;
  }

  if (
    isExportDeclaration(statement) &&
    statement.moduleSpecifier !== undefined &&
    isStringLiteral(statement.moduleSpecifier) &&
    isRelativeSpecifier(statement.moduleSpecifier.text)
  ) {
    return statement.moduleSpecifier.text;
  }

  return undefined;
}

function getStatementLine(sourceFile: SourceFile, statement: Statement): number {
  return sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
}

export function findRelativeImportSpecifiers(filePath: string, sourceText: string): readonly RelativeImportSpecifier[] {
  const sourceFile = createSourceFile(filePath, sourceText, ScriptTarget.Latest, true);
  const specifiers: RelativeImportSpecifier[] = [];

  for (const statement of sourceFile.statements) {
    const specifierText = extractRelativeSpecifierText(statement);
    if (specifierText === undefined) {
      continue;
    }
    specifiers.push({ specifier: specifierText, line: getStatementLine(sourceFile, statement) });
  }

  return specifiers;
}
