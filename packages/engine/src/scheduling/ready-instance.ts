import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';

/**
 * Egy futtathatóvá vált node példány az érkezési sorban (SPEC-004 7.1,
 * "Érkezési sorrend (FIFO)"): "Minden futtathatóvá vált lépés egy monoton
 * növekvő sorszámot kap a beérkezéskor, és a sor szigorúan e szerint ürül."
 *
 * **A sorszám nem idő és nem azonosító**, tehát nem a `clock` és nem az
 * `idGenerator` porton keresztül keletkezik: kizárólag a futtathatóvá válások
 * **sorrendjét** kódolja, ami magukból a hívásokból adódik. Ezért az ütemező
 * állapotában álló számláló adja, és a determinizmus a spec 14.2 szekciója
 * szerint enélkül is teljesül.
 */
export interface ReadyInstance {
  readonly instance: StepInstanceReference;
  readonly arrivalSequence: number;
}
