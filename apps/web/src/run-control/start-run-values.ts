import type { StartInputField } from '@easter-workflow-builder/protocol';

/**
 * Egy bemeneti mező szerkesztett állapota. Mindhárom hely mindig megvan, és a
 * mező `valueKind` típusa dönti el, melyiket olvassa a felület és a kiértékelés
 * (SPEC-016 5.1): a `text`, a `choice`, a `list` és a `json` a `text` szöveget,
 * a `number` a `number` értéket (`NaN` = üres, a `valueAsNumber` üres mezőre
 * adott értéke), a `boolean` a `checked` értéket. A `number` mező a `text`
 * helyen a begépelt nyers szöveget is tárolja, mert a beviteli elem csak azt
 * mutathatja vissza gépelés közben (`1.0` nem írható vissza `1`-ként), az
 * olvasás viszont a `number` értékből megy. Így nincs olyan állapot, ami
 * egy másik típusú mező értékével nem egyezne.
 */
export interface StartRunFieldValue {
  readonly text: string;
  readonly number: number;
  readonly checked: boolean;
}

/**
 * A modális mezőinek szerkesztett értéke, mezőnév szerint.
 */
export type StartRunValues = Readonly<Record<string, StartRunFieldValue>>;

/**
 * Az üres mező állapota: üres szöveg, hiányzó szám, nem jelölt négyzet. Azért
 * explicit érték, és nem hiányzó kulcs, mert a vezérelt mezők `value` propja
 * nem lehet `undefined`.
 */
export const EMPTY_START_RUN_FIELD_VALUE: StartRunFieldValue = { text: '', number: NaN, checked: false };

/**
 * A modális nyitó állapota: minden mező üres.
 */
export function buildInitialStartRunValues(fields: readonly StartInputField[]): StartRunValues {
  const values: Record<string, StartRunFieldValue> = {};
  for (const field of fields) {
    values[field.name] = EMPTY_START_RUN_FIELD_VALUE;
  }
  return values;
}
