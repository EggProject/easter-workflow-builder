import { fromNumberFieldValue } from './nullable-number-field-value.ts';

/**
 * A szkript `timeoutMs` mezőjének oda-vissza leképezése a másodpercben
 * szerkesztett számmezőre (SPEC-014 5.9, O-4): a tárolt érték ezredmásodperc,
 * a mező a tizedes másodpercet mutatja, üresen `null` (alapérték).
 */
export function toTimeoutSecondsFieldValue(timeoutMs: number | null): string {
  return timeoutMs === null ? '' : String(timeoutMs / 1000);
}

/**
 * A másodperc szöveg ezredmásodpercre váltása. Az ezerszeres egész értéket
 * csak akkor kerekíti egészre, ha az a megadott szám pontos ezredmásodperc
 * alakja (`1.1` s -> `1100` ms, mert a `1.1 * 1000` lebegőpontos zaja nem
 * számít); az ezredmásodpercnél finomabb bemenet (`1.0004` s) tört marad, és
 * a mentési séma a mező alatt elutasítja, nem kerekítődik csendben.
 */
export function fromTimeoutSecondsFieldValue(value: string): number | null {
  const seconds = fromNumberFieldValue(value);
  if (seconds === null) {
    return seconds;
  }
  const roundedMilliseconds = Math.round(seconds * 1000);
  return roundedMilliseconds / 1000 === seconds ? roundedMilliseconds : seconds * 1000;
}
