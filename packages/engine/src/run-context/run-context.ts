/**
 * A futás kontextus objektuma, szó szerint a SPEC-004 6.1 szekció alakjában.
 * Ugyanezt kapja a kifejezés port és a sablon port is, tehát ez az a felület,
 * amin a felhasználó által írt kifejezések a futás adataihoz férnek.
 *
 * A mezők forrása:
 *
 * - `input`: a futás bemenete, ami egyben a `start` node kimenete (5. szekció
 *   1. sora).
 * - `steps`: node azonosító -> a **látható** példány kimenete, a 6.2 szekció
 *   feloldási szabálya szerint (`buildRunContext`).
 * - `item`, `itemIndex`: a legbelső `fan_out` hatókör eleme és sorszáma.
 * - `iteration`: a legbelső `loop` hatókör iterációja.
 * - `joinInputs`: kizárólag `join` node végrehajtásakor, a beérkezett ág
 *   kimenetek listája (5.6).
 * - `error`: kizárólag `error_handler` node végrehajtásakor, a hibázó lépés
 *   hibaosztálya és üzenete (8.2).
 *
 * **Az `item` típusa `unknown`, nem `unknown | undefined`.** A spec a "nincs
 * érték" állapotot `undefined` értékkel írja le, az `unknown` viszont már
 * tartalmazza az `undefined` értéket, tehát a két alak azonos; a `| undefined`
 * kiírása csak egy felesleges unió tagot adna. A `kind` mező típusa a spec
 * szerint `string`, nem `EngineErrorKind`, mert a kifejezés nyelv felé kimenő
 * érték, nem a motor belső szótára.
 */
export interface RunContext {
  readonly input: unknown;
  readonly steps: Readonly<Record<string, unknown>>;
  readonly item: unknown;
  readonly itemIndex: number | undefined;
  readonly iteration: number | undefined;
  readonly joinInputs: readonly unknown[] | undefined;
  readonly error: { readonly kind: string; readonly message: string } | undefined;
}
