import type { Fact } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';

/**
 * Részleges üzenetek kérése az élő nézethez (SPEC-004 11.3 táblázat 13. sora,
 * leíró mező: `streaming.sse`). A visszatérési érték a kimenő
 * `Options.includePartialMessages` mező:
 *
 * - `known` igaz: `true`.
 * - `known` hamis: `false`.
 * - `unknown`: `false`.
 *
 * A `known` hamis és az `unknown` ág tehát ugyanoda vezet, de két különböző
 * okból: az egyik mért tény, a másik a konzervatív visszaesés. A delta
 * perzisztálás kapcsolója erre az értékre nincs hatással (F-23).
 *
 * A név `should` előtagot visel a téma többi, `resolve`/`validate` előtagú
 * függvényétől eltérően, mert a visszatérési értéke logikai, és az
 * `unicorn/consistent-boolean-name` szabály a logikai értéket adó függvényektől
 * ezt a névalakot kéri.
 */
export function shouldIncludePartialMessages(sse: Fact<boolean>): boolean {
  return isKnownFact(sse) && sse.value;
}
