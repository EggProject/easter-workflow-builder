import { ROUTE_TABLE, isRouteId, type HttpMethod, type RouteId } from '@easter-workflow-builder/protocol';

/**
 * Egy illesztett útvonal: a végpont azonosítója és a sablonból kinyert
 * `:paramNév` értékek (SPEC-006 `route-dispatch` téma).
 */
export interface RouteMatch {
  readonly routeId: RouteId;
  readonly parameters: Readonly<Record<string, string>>;
}

/**
 * Az illesztés három kimenete: talált végpont, ismeretlen útvonal (404), és
 * ismert útvonal, de nem támogatott metódus (405, az `Allow` fejléchez
 * szükséges metódus listával).
 */
export type RouteMatchResult =
  | { readonly kind: 'matched'; readonly match: RouteMatch }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'method_not_allowed'; readonly allowedMethods: readonly HttpMethod[] };

interface CompiledRoute {
  readonly routeId: RouteId;
  readonly method: HttpMethod;
  readonly pattern: RegExp;
}

/**
 * A regex speciális karaktereinek escape-elése (a `.`, ami a SPEC-005 4.2
 * táblázat útvonal szegmenseiben ma sehol nem fordul elő, de a sablon nem
 * garantáltan karakterkészlet-zárt a jövőben).
 */
function escapeRegExpLiteral(segment: string): string {
  return segment.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Egy útvonal sablonból (`/api/workflows/:workflowId`) névvel ellátott
 * capture group-os regexet épít (`(?<workflowId>[^/]+)`), hogy az illesztés
 * a paramétereket egyetlen `exec` hívással, indexelt tömbelérés nélkül adja
 * vissza (`noUncheckedIndexedAccess` miatt egy indexelt tömbelérés itt
 * garantáltan sosem `undefined` ágat vezetne be, ami a 100 százalékos
 * lefedettségi küszöböt sértené, ugyanaz az elv, mint a protokoll
 * `build-route-path.ts` `extractParameterNames`-ében).
 */
function buildTemplatePattern(template: string): RegExp {
  const segments = template
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => (segment.startsWith(':') ? `(?<${segment.slice(1)}>[^/]+)` : escapeRegExpLiteral(segment)));
  return new RegExp(`^/${segments.join('/')}$`);
}

/**
 * A `ROUTE_TABLE` mind a 26 sora, egyszer, modul betöltéskor lefordítva. Az
 * `isRouteId` guard szűkíti az `Object.entries` kulcsát `RouteId`-re, `as`
 * kényszerítés nélkül.
 */
const COMPILED_ROUTES: readonly CompiledRoute[] = Object.entries(ROUTE_TABLE)
  .filter((entry): entry is [RouteId, (typeof ROUTE_TABLE)[RouteId]] => isRouteId(entry[0]))
  .map(([routeId, definition]) => ({
    routeId,
    method: definition.method,
    pattern: buildTemplatePattern(definition.template),
  }));

interface PathMatch {
  readonly route: CompiledRoute;
  readonly parameters: Readonly<Record<string, string>>;
}

function matchPath(pathname: string): readonly PathMatch[] {
  const matches: PathMatch[] = [];
  for (const route of COMPILED_ROUTES) {
    const executed = route.pattern.exec(pathname);
    if (executed !== null) {
      matches.push({ route, parameters: { ...executed.groups } });
    }
  }
  return matches;
}

/**
 * A `ROUTE_TABLE` alapú illesztő (SPEC-006 9.1 `route-dispatch` téma): a
 * metódus és az útvonal alapján megkeresi a végpontot, kinyeri a
 * paramétereket, és megkülönbözteti a 404 (nincs ilyen útvonal) és a 405
 * (van ilyen útvonal, de nem ezzel a metódussal) esetet. A `method` bemenet
 * szándékosan sima `string`, nem `HttpMethod`: a valódi HTTP kérés metódusa
 * (`node:http` `IncomingMessage.method`) bármi lehet (`OPTIONS`, `HEAD`,
 * elgépelt érték), a szűkítést maga az illesztés végzi el, nem a hívónak
 * kell előtte typeguardolnia.
 */
export function matchRoute(method: string, pathname: string): RouteMatchResult {
  const pathMatches = matchPath(pathname);
  if (pathMatches.length === 0) {
    return { kind: 'not_found' };
  }

  const methodMatch = pathMatches.find((match) => match.route.method === method);
  if (methodMatch === undefined) {
    return {
      kind: 'method_not_allowed',
      allowedMethods: pathMatches.map((match) => match.route.method),
    };
  }

  return {
    kind: 'matched',
    match: { routeId: methodMatch.route.routeId, parameters: methodMatch.parameters },
  };
}
