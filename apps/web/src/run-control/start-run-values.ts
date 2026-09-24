import type { StartInputField } from '@easter-workflow-builder/protocol';

/**
 * A modális mezőinek szerkesztett értéke, mezőnév szerint. Minden érték
 * szöveg, mert a `StartInputField.valueKind` értékkészletét EGYETLEN forrás
 * sem sorolja fel (a `packages/db` `node-config.ts` szó szerint kimondja:
 * "A `valueKind` értékkészletét a SPEC-003 nem sorolja fel, ezért itt szabad
 * szöveg marad; a felsorolás rögzítése külön termékdöntés"). Egy `valueKind`
 * szerint váltó mezőtípus tehát tippelés lenne, amit a projekt tilt
 * (`.claude/CLAUDE.md` 4. szekció).
 */
export type StartRunValues = Readonly<Record<string, string>>;

/**
 * A kötelező, üresen hagyott mező hibaüzenete. Egyetlen helyen áll, mert a
 * validáló és a teszt is ezt hasonlítja.
 */
export const REQUIRED_START_FIELD_MESSAGE = 'Kötelező mező.';

/**
 * A modális nyitó állapota: minden mező üres szöveg. Azért explicit üres
 * érték, és nem hiányzó kulcs, mert a `TextField` vezérelt mező, aminek
 * `value` propja nem lehet `undefined`.
 */
export function buildInitialStartRunValues(fields: readonly StartInputField[]): StartRunValues {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.name] = '';
  }
  return values;
}

/**
 * A kötelező mezők ellenőrzése: mezőnév a hibaüzenetre.
 *
 * A bejárás a SZERKESZTETT ÉRTÉKEKEN megy, nem a mezőlistán, és a mezőlista
 * csak a kötelezőség eldöntésére kell: a `values` rekord minden kulcsa a
 * mezőlistából származik (`buildInitialStartRunValues`), tehát egy "hiányzó
 * kulcsú kötelező mező" ág garantáltan sosem futna le, ami tiltott
 * (`.claude/CLAUDE.md` 5. szekció). A hiányzó bemenet végső ellenőrzése a
 * motoré: a `validateRunInput` (SPEC-004 4.8 4. lépés) az `undefined`
 * értéket hiányzó mezőnek számolja, és `missing_required_input` hibát ad.
 *
 * Csak a KÖTELEZŐ mezőket vizsgálja, mert a `valueKind` szerinti formai
 * ellenőrzésre nincs dokumentált szabály (lásd a `StartRunValues` doksiját).
 */
export function findStartRunValueErrors(
  fields: readonly StartInputField[],
  values: StartRunValues,
): ReadonlyMap<string, string> {
  const requiredNames = new Set(fields.filter((field) => field.required).map((field) => field.name));
  const errors = new Map<string, string>();
  for (const [name, value] of Object.entries(values)) {
    if (requiredNames.has(name) && value.trim() === '') {
      errors.set(name, REQUIRED_START_FIELD_MESSAGE);
    }
  }
  return errors;
}

/**
 * A `StartRunRequest.input` mezőjébe kerülő objektum (SPEC-008 6.5). Az
 * üresen hagyott mező KIMARAD, nem üres szövegként megy ki: a motor a hiányzó
 * kulcsot és az `undefined` értéket egyaránt "nincs érték" jelentéssel olvassa
 * (SPEC-004 4.8), egy üres szöveg viszont megadott értéknek számítana.
 *
 * A bemenete kizárólag a szerkesztett értékek rekordja: a mezőlistára nincs
 * szüksége, mert a rekord kulcsai onnan származnak
 * (`buildInitialStartRunValues`).
 */
export function buildStartRunInput(values: StartRunValues): Readonly<Record<string, unknown>> {
  const input: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value !== '') {
      input[name] = value;
    }
  }
  return input;
}
