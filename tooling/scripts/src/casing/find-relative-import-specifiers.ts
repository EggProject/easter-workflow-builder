/**
 * Egyetlen forrásfájl relatív import/export specifikátorainak kigyűjtése a
 * TypeScript compiler API-val (ugyanaz a minta, mint a
 * `tools/wire-probe/src/no-shadowed-path-import.test.ts`-ben).
 *
 * Három alakot lát:
 *
 * - a modul szintű `import ... from '...'` és `export ... from '...'`
 *   deklarációt: ezek érvényes ESM-ben mindig a fájl tetején állnak, ezért
 *   elég a legfelső szintű utasításokat nézni;
 * - a dinamikus `import('...')` hívást, ha az első argumentuma STRING LITERÁL.
 *   Ez bárhol állhat (függvény törzsben, `await` mögött), ezért a teljes fát
 *   bejárjuk. A repóban két ilyen hívás van, mindkettő belépési pont teszt
 *   (`apps/server/src/main.spec.ts`, `apps/web/src/app-mount/main.spec.ts`);
 *   egy betűzési hiba bennük korábban átment a `check:casing` kapun, és csak
 *   a CI kis-nagybetű érzékeny checkoutján derült volna ki.
 *
 * **Amit nem lát, mert statikusan nem ellenőrizhető:** a template literál
 * argumentumú (a helyettesítés nélküli `` import(`./x.ts`) `` alakot is
 * beleértve) és a változó vagy más kifejezés argumentumú dinamikus importot,
 * mert a célja csak futásidőben dől el. Ilyen alak a repóban ma nincs.
 * `require(...)` relatív hívás sincs (ellenőrizve:
 * `git grep -nP "require\(['\"]\.\.?/"` nulla találatot ad).
 */
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isExportDeclaration,
  isImportDeclaration,
  isStringLiteral,
  ScriptTarget,
  SyntaxKind,
} from 'typescript';
import type { Node, SourceFile, Statement } from 'typescript';

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

// A dinamikus `import(...)` hívás első argumentuma, ha string literál és
// relatív útvonal; minden más csomópontra `undefined`.
function extractDynamicImportSpecifierText(node: Node): string | undefined {
  if (!isCallExpression(node) || node.expression.kind !== SyntaxKind.ImportKeyword) {
    return undefined;
  }
  const [argument] = node.arguments;
  if (argument !== undefined && isStringLiteral(argument) && isRelativeSpecifier(argument.text)) {
    return argument.text;
  }
  return undefined;
}

function getNodeLine(sourceFile: SourceFile, node: Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function collectDynamicImportSpecifiers(
  sourceFile: SourceFile,
  node: Node,
  specifiers: RelativeImportSpecifier[],
): void {
  const specifierText = extractDynamicImportSpecifierText(node);
  if (specifierText !== undefined) {
    specifiers.push({ specifier: specifierText, line: getNodeLine(sourceFile, node) });
  }
  forEachChild(node, (child) => {
    collectDynamicImportSpecifiers(sourceFile, child, specifiers);
  });
}

export function findRelativeImportSpecifiers(filePath: string, sourceText: string): readonly RelativeImportSpecifier[] {
  const sourceFile = createSourceFile(filePath, sourceText, ScriptTarget.Latest, true);
  const specifiers: RelativeImportSpecifier[] = [];

  for (const statement of sourceFile.statements) {
    const specifierText = extractRelativeSpecifierText(statement);
    if (specifierText === undefined) {
      continue;
    }
    specifiers.push({ specifier: specifierText, line: getNodeLine(sourceFile, statement) });
  }

  collectDynamicImportSpecifiers(sourceFile, sourceFile, specifiers);

  return specifiers;
}
