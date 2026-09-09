import { createContext } from 'react';

/**
 * Megkísérelték-e már beküldeni azt az űrlapot, amiben a mező áll.
 *
 * A mezők (`TextField`, `SelectField`, `TextAreaField`) hibaüzenete
 * KÉTFÉLE úton válik láthatóvá: a mező saját, elhagyáskor (`blur`) felvett
 * "érintett" állapotán át, vagy ezen a kontextuson át, ha az űrlapot már
 * legalább egyszer megpróbálták beküldeni, és a beküldés hiba miatt nem
 * sikerült. A második ág azért kell, mert a felhasználó olyan mezőt is
 * üresen hagyhat, amit soha nem érintett meg - beküldés után annak a
 * hibáját is látnia kell.
 *
 * Alapértéke `false`, tehát szolgáltató nélkül (önálló komponens tesztben,
 * és minden olyan képernyőn, aminek nincs beküldése) a mező kizárólag az
 * érintettség után mutat hibát. Ez a `field-errors-context.ts` és a
 * `resizable-context.ts` mintáját követi: kontextus objektum saját fájlban,
 * `.spec` pár nélkül, mert nem tartalmaz futásidejű elágazást.
 */
export const FieldErrorVisibilityContext = createContext<boolean>(false);
