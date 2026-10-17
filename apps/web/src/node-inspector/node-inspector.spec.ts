// Regressziós teszt a panel bezáró X gombjának mozgáscsökkentő szabályára
// (`node-inspector.css`). Megvalósítás fájl nélküli téma (SPEC-002 6.2 5. pont,
// a minta a `tooltip-hover-bridge.spec.ts`): a CSS kommentje szerint a gomb
// szabályai a design system `drawer.css` `.drawer__close` deklarációival
// azonosak, köztük a `@media (prefers-reduced-motion: reduce)` blokk
// `transition: none` deklarációja. A teszt ezt a forrás fájlból olvasott
// értékkel hasonlítja, és azt is őrzi, hogy a fájl egyetlen átmenete sem marad
// kikapcsolás nélkül. Az `@media` blokk tényleges hatása a böngészőben nem
// ellenőrzött: a happy-dom nem értékeli a médialekérdezéseket.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

const REDUCED_MOTION_HEADER = '@media (prefers-reduced-motion: reduce)';
const BLOCK_COMMENT_PATTERN = /\/\*[\S\s]*?\*\//g;
const WHITESPACE_PATTERN = /\s+/g;

function readCss(...segments: readonly string[]): string {
  return readFileSync(path.join(directory, ...segments), 'utf8').replaceAll(BLOCK_COMMENT_PATTERN, '');
}

/**
 * Az `@media (prefers-reduced-motion: reduce)` blokkok törzse és a fájl többi
 * része, a blokkok nélkül. A zárójelpárokat számolja, mert a blokk szabályokat
 * ágyaz.
 */
function splitReducedMotion(css: string): { readonly outside: string; readonly inside: readonly string[] } {
  const inside: string[] = [];
  let outside = '';
  let cursor = 0;
  let start = css.indexOf(REDUCED_MOTION_HEADER);
  while (start !== -1) {
    const open = css.indexOf('{', start);
    let depth = 1;
    let end = open + 1;
    while (depth > 0 && end < css.length) {
      depth += css.charAt(end) === '{' ? 1 : 0;
      depth -= css.charAt(end) === '}' ? 1 : 0;
      end += 1;
    }
    outside += css.slice(cursor, start);
    inside.push(css.slice(open + 1, end - 1));
    cursor = end;
    start = css.indexOf(REDUCED_MOTION_HEADER, cursor);
  }
  return { outside: outside + css.slice(cursor), inside };
}

/**
 * A CSS szabályai szelektor szerint, szóközökre normalizált szelektorral és
 * törzzsel. A `}` mentén darabol, és a darab utolsó `{` jele előtti
 * szövegnek az utolsó `{` utáni része a szelektor (a minta a `tooltip-hover-bridge.spec.ts`
 * `readDeclarations` függvénye), így a `@media` blokkba ágyazott szabály is
 * helyesen olvasható. Azonos szelektornál az első szabály nyer (a `drawer.css`
 * `.drawer__close` szabálya a `forced-colors` blokkjában még egyszer áll).
 */
function readRules(css: string): ReadonlyMap<string, string> {
  const rules = new Map<string, string>();
  for (const chunk of css.split('}')) {
    const openIndex = chunk.lastIndexOf('{');
    const head = chunk.slice(0, openIndex);
    const selector = head
      .slice(head.lastIndexOf('{') + 1)
      .replaceAll(WHITESPACE_PATTERN, ' ')
      .trim();
    if (openIndex !== -1 && !rules.has(selector)) {
      rules.set(
        selector,
        chunk
          .slice(openIndex + 1)
          .replaceAll(WHITESPACE_PATTERN, ' ')
          .trim(),
      );
    }
  }
  return rules;
}

/**
 * Egy szabálytörzs `transition` deklarációjának értéke, vagy `undefined`.
 */
function readTransition(body: string | undefined): string | undefined {
  const declaration = (body ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('transition:'));
  return declaration?.slice('transition:'.length).trim();
}

describe('a panel bezáró gombjának mozgáscsökkentő szabálya (node-inspector.css)', () => {
  const nodeInspector = splitReducedMotion(readCss('node-inspector.css'));
  const drawer = splitReducedMotion(readCss('..', '..', '..', '..', 'packages', 'ui', 'src', 'drawer', 'drawer.css'));
  const nodeInspectorRules = readRules(nodeInspector.outside);
  const reducedMotionRules = readRules(nodeInspector.inside.join('\n'));

  it('a fájl pontosan egy mozgáscsökkentő blokkot tartalmaz, a forrás drawer.css is egyet', () => {
    expect(nodeInspector.inside).toHaveLength(1);
    expect(drawer.inside).toHaveLength(1);
  });

  it('a bezáró gomb átmenete a forrás .drawer__close átmenetével azonos', () => {
    const source = readTransition(readRules(drawer.outside).get('.drawer__close'));

    expect(source).toBeDefined();
    expect(readTransition(nodeInspectorRules.get('.node-inspector__close'))).toBe(source);
  });

  it('a mozgáscsökkentő blokk a bezáró gomb átmenetét kikapcsolja, a forrás .drawer__close szabályával azonosan', () => {
    const source = readTransition(readRules(drawer.inside.join('\n')).get('.drawer__close'));

    expect(source).toBe('none');
    expect(readTransition(reducedMotionRules.get('.node-inspector__close'))).toBe(source);
  });

  it('a fájl minden átmenetes szabályát a mozgáscsökkentő blokk kikapcsolja', () => {
    const withTransition = [...nodeInspectorRules]
      .filter(([, body]) => readTransition(body) !== undefined)
      .map(([selector]) => selector);

    expect(withTransition).toContain('.node-inspector__close');
    expect(withTransition.filter((selector) => readTransition(reducedMotionRules.get(selector)) !== 'none')).toEqual(
      [],
    );
  });
});
