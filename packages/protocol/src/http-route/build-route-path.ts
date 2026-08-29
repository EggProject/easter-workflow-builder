import type { Outcome } from '@easter-workflow-builder/core';
import { ROUTE_TABLE, type RouteId } from './route-table.ts';

/**
 * Egy útvonal sablonból a `:paramNév` helyőrzők nevét gyűjti ki, sorrendben.
 * Szegmensenként vizsgál (a sablon mindig `/`-tagolt, lásd `route-table.ts`),
 * nem regex `matchAll` és capture group indexeléssel: az utóbbi a
 * `noUncheckedIndexedAccess` miatt `string | undefined` típust adna egy
 * olyan ágra, ami logikailag sosem fut (a `:` mindig legalább egy karaktert
 * követ egy útvonal szegmensben), és egy garantáltan holt ág bevezetése a
 * 100 százalékos, kizárás nélküli lefedettségi küszöböt sértené
 * (`.claude/CLAUDE.md` 5. szekció).
 */
function extractParameterNames(template: string): readonly string[] {
  return template
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));
}

/**
 * A `routeId` sablonjába helyettesíti be a `parameters` értékeit (SPEC-005 9.
 * szekció, `http-route` téma "paraméter behelyettesítő tiszta függvény").
 * Tiszta függvény: nem ismer hálózatot, nem hív semmilyen portot.
 *
 * Hiányzó paraméterre (a sablon egy `:paramNév` helyőrzőjéhez nincs érték a
 * `parameters` objektumban) és fölös paraméterre (a `parameters` objektum
 * olyan kulcsot hordoz, ami nem szerepel a sablonban) egyaránt `Outcome`
 * hibaágat ad, nem csendben hagyja figyelmen kívül.
 */
export function buildRoutePath(routeId: RouteId, parameters: Readonly<Record<string, string>>): Outcome<string> {
  const { template } = ROUTE_TABLE[routeId];
  const requiredNames = extractParameterNames(template);
  const requiredNameSet = new Set(requiredNames);

  for (const providedName of Object.keys(parameters)) {
    if (!requiredNameSet.has(providedName)) {
      return {
        kind: 'error',
        message: `A(z) "${providedName}" paraméter nem szerepel a(z) "${routeId}" útvonal sablonjában (unknown_route_param).`,
      };
    }
  }

  let path: string = template;
  for (const name of requiredNames) {
    const value = parameters[name];
    if (value === undefined) {
      return {
        kind: 'error',
        message: `A(z) "${name}" paraméter hiányzik a(z) "${routeId}" útvonal felépítéséhez (missing_route_param).`,
      };
    }
    // Függvény alakú csereérték (SPEC-005 nyitott kérdés nélküli, tiszta megoldás
    // a `unicorn/no-unsafe-string-replacement` lint szabályra): a `String#replace`
    // különben a `value` tartalmában lévő `$&`/`$1` mintákat különleges
    // csereutasításként értelmezné, egy függvény visszatérési értékét viszont
    // szó szerint illeszti be.
    path = path.replace(`:${name}`, () => value);
  }

  return { kind: 'ok', value: path };
}
