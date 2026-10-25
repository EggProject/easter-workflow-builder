import Mustache from 'mustache';
import { resolveOwnDataProperty } from './resolve-own-data-property.ts';

/**
 * A `Mustache.Context` alosztálya (SPEC-010 6.6). A `render` egy kapott
 * `Context` példányt változatlanul használ, a `push` viszont alap `Context`
 * példányt hozna létre (M-134), ezért mindkét metódus felülírva.
 *
 * A bázis `view` mezője `any` típusú, ezért az alosztály saját `#` mezőkben
 * tartja a nézetet és a szülőt, és a `lookup` `unknown` értéket ad (research
 * `2026-10-21-spec010-blokkolo-meresek.md` 7. szekció (2)).
 */
export class OwnPropertyContext extends Mustache.Context {
  readonly #ownView: unknown;
  readonly #ownParent: OwnPropertyContext | undefined;

  constructor(view: unknown, parent?: OwnPropertyContext) {
    super(view, parent);
    this.#ownView = view;
    this.#ownParent = parent;
  }

  override push(view: unknown): OwnPropertyContext {
    return new OwnPropertyContext(view, this);
  }

  /**
   * A név feloldása, függvényhívás nélkül. A `.` név csak a saját nézet; a
   * pontozott név teljes útja egy kontextuson belül oldódik fel, különben a
   * szülő kontextus következik, a könyvtár gyári bejárási sorrendjében
   * (research 3. szekció (7)). Az `undefined` jelentése: nincs találat.
   */
  override lookup(name: string): unknown {
    if (name === '.') {
      return resolveOwnDataProperty(this.#ownView, []);
    }
    const value = resolveOwnDataProperty(this.#ownView, name.split('.'));
    return value === undefined ? this.#ownParent?.lookup(name) : value;
  }
}
