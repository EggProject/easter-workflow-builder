import Mustache from 'mustache';
import { MissingTemplateNameError } from './missing-template-name-error.ts';
import type { OwnPropertyContext } from './own-property-context.ts';
import { toText } from './to-text.ts';

/**
 * Egy változó tag tokenje: a második eleme a kért név. A `@types/mustache`
 * `string[]` alakot deklarál, a könyvtár viszont minden `name` és `&` tokent
 * `[típus, név, kezdet, vég]` alakban ad (`parseTemplate`), tehát a név mindig
 * jelen van; a szűkítés csak típusszintű, futásidejű ág nélkül.
 */
type VariableToken = [string, string, ...string[]];

/**
 * Saját `Mustache.Writer` (SPEC-010 6.1, 6.3, 6.7). A sima változó tag két ága
 * (`escapedValue`, `unescapedValue`) felülírva: a fel nem oldható név hibát ad,
 * a talált érték a 6.5 szerint szöveggé alakul, escape nélkül. A szakasz és a
 * fordított szakasz a könyvtár útján marad, tehát hiányzó névvel hiba nélküli.
 *
 * A `context` paraméter típusa szintén csak típusszinten szűkebb a bázisénál:
 * a gyártó függvény a `render` hívásnak `OwnPropertyContext` példányt ad, a
 * könyvtár a kapott példányt nem csomagolja újra, és a szakaszok belsejében a
 * felülírt `push` ugyanezt az osztályt adja (M-134). Így futásidejű `instanceof`
 * őr nem kell, ami a könyvtár útján sosem futó ágat hagyna.
 */
export class StrictWriter extends Mustache.Writer {
  // A `@types/mustache` a példány mezőjét nem deklarálja; a könyvtár
  // konstruktora bekapcsolt gyorsítótárat állít, a mező definíció felülírja
  // (research `2026-10-21-spec010-blokkolo-meresek.md` 3. (6), 7. (2)).
  templateCache: Mustache.TemplateCache | undefined = undefined;

  #plainValue([, name]: VariableToken, context: OwnPropertyContext): string {
    const value = context.lookup(name);
    if (value === undefined) {
      throw new MissingTemplateNameError(name);
    }
    return toText(value);
  }

  override escapedValue(token: VariableToken, context: OwnPropertyContext): string {
    return this.#plainValue(token, context);
  }

  override unescapedValue(token: VariableToken, context: OwnPropertyContext): string {
    return this.#plainValue(token, context);
  }
}
