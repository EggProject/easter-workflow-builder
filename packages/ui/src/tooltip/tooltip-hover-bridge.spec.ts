// Regressziós teszt a tooltip egérrel elérhetőségére (user döntés, 2026-10-14,
// WCAG 2.2 1.4.13 "Hoverable"). Megvalósítás fájl nélküli téma
// (SPEC-002 6.2 5. pont): a `tooltip-hover-bridge.css` kiegészítő fájl a
// bájtazonos `tooltip.css` mellett áll, és a híd mérete a `tooltip.css`
// aktuális távolságához kötött, tehát a forrás frissítése nem hagyhatja
// észrevétlenül résen a hidat. A tényleges egér átvitel valódi böngészős
// igazolása a T-009-53 e2e feladata.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

const BLOCK_COMMENT_PATTERN = /\/\*[\S\s]*?\*\//g;
const GAP_PATTERN = /^calc\(100%\s*\+\s*(\d+)px\)$/;

const WCAG_SOURCE_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html';

/**
 * Egy elhelyezés geometriája. A `sourceOffset` a `tooltip.css` azon
 * tulajdonsága, ami a tippet a triggertől eltolja (`calc(100% + Npx)`); a
 * híd a tipp trigger felé néző `bridgeSide` oldalán áll, `bridgeSize`
 * kiterjedéssel, és a másik tengelyen a teljes oldalt (`span`) fedi.
 */
interface PlacementGeometry {
  readonly placement: string;
  readonly sourceOffset: string;
  readonly bridgeSide: string;
  readonly bridgeSize: string;
  readonly span: readonly [string, string];
}

const GEOMETRIES = [
  { placement: 'top', sourceOffset: 'bottom', bridgeSide: 'top', bridgeSize: 'height', span: ['left', 'right'] },
  { placement: 'bottom', sourceOffset: 'top', bridgeSide: 'bottom', bridgeSize: 'height', span: ['left', 'right'] },
  { placement: 'left', sourceOffset: 'right', bridgeSide: 'left', bridgeSize: 'width', span: ['top', 'bottom'] },
  { placement: 'right', sourceOffset: 'left', bridgeSide: 'right', bridgeSize: 'width', span: ['top', 'bottom'] },
] as const satisfies readonly PlacementGeometry[];

function readCss(fileName: string): string {
  return readFileSync(path.join(directory, fileName), 'utf8');
}

function stripComments(css: string): string {
  return css.replaceAll(BLOCK_COMMENT_PATTERN, '');
}

/**
 * Az első, pontosan `selector` szelektorú szabály deklarációi. A `}` mentén
 * darabol, és a darab utolsó `{` jele előtti szöveg a szelektor lista, így a
 * `@media` blokkba ágyazott szabály is helyesen olvasható. Hiányzó szabályra
 * üres térképet ad, ami a hívó állításán bukik.
 */
function readDeclarations(css: string, selector: string): ReadonlyMap<string, string> {
  const declarations = new Map<string, string>();
  const chunks = stripComments(css).split('}');
  for (const chunk of chunks) {
    const openIndex = chunk.lastIndexOf('{');
    if (openIndex === -1) {
      continue;
    }
    const head = chunk.slice(0, openIndex);
    const selectors = head
      .slice(head.lastIndexOf('{') + 1)
      .split(',')
      .map((entry) => entry.trim());
    if (!selectors.includes(selector)) {
      continue;
    }
    const declarationTexts = chunk.slice(openIndex + 1).split(';');
    for (const declaration of declarationTexts) {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex !== -1) {
        declarations.set(declaration.slice(0, separatorIndex).trim(), declaration.slice(separatorIndex + 1).trim());
      }
    }
    break;
  }
  return declarations;
}

function readSourceGapPixels(placement: string, sourceOffset: string): number {
  const value = readDeclarations(readCss('tooltip.css'), `.tooltip--${placement}`).get(sourceOffset) ?? '';
  const gap = GAP_PATTERN.exec(value)?.[1];
  return gap === undefined ? NaN : Number(gap);
}

describe('tooltip egérrel elérhetősége (kiegészítő CSS)', () => {
  const bridgeCss = readCss('tooltip-hover-bridge.css');

  it('a komponens behúzza a kiegészítő fájlt a bájtazonos tooltip.css mellett', () => {
    const component = readCss('Tooltip.tsx');

    expect(component).toContain("import './tooltip.css';");
    expect(component).toContain("import './tooltip-hover-bridge.css';");
  });

  it('a fejléc kimondja a user döntés dátumát, a WCAG forrást és a design systemtől való eltérést', () => {
    const header = bridgeCss.slice(0, bridgeCss.indexOf('*/'));

    expect(header).toContain('SZÁNDÉKOS ELTÉRÉS A DESIGN SYSTEMTŐL');
    expect(header).toContain('user döntés, 2026-10-14');
    expect(header).toContain(WCAG_SOURCE_URL);
  });

  it('a nyitott tipp pointer-events értéke auto', () => {
    expect(readDeclarations(bridgeCss, '.tooltip.is-open').get('pointer-events')).toBe('auto');
  });

  it('a híd közös szabálya üres tartalmú, abszolút pozícionált pszeudo elem', () => {
    const declarations = readDeclarations(bridgeCss, '.tooltip.is-open::after');

    expect(declarations.get('content')).toBe("''");
    expect(declarations.get('position')).toBe('absolute');
  });

  it.each(GEOMETRIES)(
    'a(z) $placement elhelyezés hídja a tipp trigger felé néző oldalán áll és a teljes oldalt fedi',
    ({ placement, bridgeSide, span }) => {
      const declarations = readDeclarations(bridgeCss, `.tooltip--${placement}.is-open::after`);

      expect(declarations.get(bridgeSide)).toBe('100%');
      expect(declarations.get(span[0])).toBe('0');
      expect(declarations.get(span[1])).toBe('0');
    },
  );

  it.each(GEOMETRIES)(
    'a(z) $placement elhelyezés hídjának mérete a tooltip.css távolsága',
    ({ placement, sourceOffset, bridgeSize }) => {
      const gap = readSourceGapPixels(placement, sourceOffset);

      expect(gap).toBeGreaterThan(0);
      expect(readDeclarations(bridgeCss, `.tooltip--${placement}.is-open::after`).get(bridgeSize)).toBe(
        `${String(gap)}px`,
      );
    },
  );

  it('a tooltip.css nem tartalmazza a javítást, az a bájtazonos blokkon kívül áll', () => {
    const sourceCss = stripComments(readCss('tooltip.css'));

    expect(sourceCss).not.toContain('pointer-events: auto');
    expect(sourceCss).not.toContain('::after');
  });

  it('a szabály olvasó a @media blokkba ágyazott szabályt is megtalálja', () => {
    const css = '@media (a: b) { .a, .b { x: 1px; } .c { y: 2px; } }';

    expect([...readDeclarations(css, '.b')]).toEqual([['x', '1px']]);
    expect([...readDeclarations(css, '.c')]).toEqual([['y', '2px']]);
  });

  it('a szabály olvasó hiányzó szelektorra üres térképet ad, és a komment deklarációt nem számít', () => {
    const css = '.a { x: 1px; /* y: 2px; */ z: 3px; }';

    expect(readDeclarations(css, '.b').size).toBe(0);
    expect([...readDeclarations(css, '.a')]).toEqual([
      ['x', '1px'],
      ['z', '3px'],
    ]);
  });

  it('a távolság minta a calc értékre illeszkedik, a sima pixelre nem', () => {
    expect(GAP_PATTERN.exec('calc(100% + 10px)')?.[1]).toBe('10');
    expect(GAP_PATTERN.exec('10px')).toBeNull();
  });
});
