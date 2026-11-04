import type { StartInputField } from '@easter-workflow-builder/protocol';
import { fromStringListFieldValue } from '../node-inspector/string-list-field-value.ts';
import type { StartRunFieldValue } from './start-run-values.ts';

/**
 * Egy mező szerkesztett állapotának olvasata: van érték (az 5.1 táblázat JSON
 * alakja), nincs érték (a kulcs kimarad), vagy a JSON szöveg nem értelmezhető.
 */
export type StartRunFieldReading =
  | { readonly status: 'present'; readonly value: unknown }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid_json' };

const MISSING: StartRunFieldReading = { status: 'missing' };

/**
 * A szöveg és a választó mező olvasata a mai szabály szerint (SPEC-016 5.4,
 * "ugyanúgy, mint ma"): a kötelező mezőt a csak szóköz is üresnek számít, a nem
 * kötelezőt csak az üres szöveg, a csak szóközt tartalmazó szövegként megy ki.
 */
function presentText(text: string, isRequired: boolean): StartRunFieldReading {
  const emptiness = isRequired ? text.trim() : text;
  return emptiness === '' ? MISSING : { status: 'present', value: text };
}

function readJsonText(text: string): StartRunFieldReading {
  if (text.trim() === '') {
    return MISSING;
  }
  try {
    const value: unknown = JSON.parse(text);
    return { status: 'present', value };
  } catch {
    return { status: 'invalid_json' };
  }
}

/**
 * A mező szerkesztett állapotából a `StartRunRequest.input` mezőjébe kerülő
 * JSON érték (SPEC-016 5.1, 5.4). Az üres mező kulcsa kimarad: a motor a
 * hiányzó kulcsot és az `undefined` értéket egyaránt "nincs érték"
 * jelentéssel olvassa (SPEC-004 4.8), egy üres szöveg viszont megadott értéknek
 * számítana. Üres a szöveges mező, ha nincs benne semmi (kötelező mezőnél a csak szóköz is üres), a szám mező `NaN` értéke, a
 * lista, ha a soronkénti felbontás után nincs elem, és a JSON mező, ha a
 * szöveg csak szóközt tartalmaz. A `boolean` mező mindig ad értéket.
 */
export function readStartRunField(field: StartInputField, value: StartRunFieldValue): StartRunFieldReading {
  switch (field.valueKind) {
    case 'text':
    case 'choice': {
      return presentText(value.text, field.required);
    }
    case 'number': {
      return Number.isNaN(value.number) ? MISSING : { status: 'present', value: value.number };
    }
    case 'boolean': {
      return { status: 'present', value: value.checked };
    }
    case 'list': {
      const items = fromStringListFieldValue(value.text);
      return items.length === 0 ? MISSING : { status: 'present', value: items };
    }
    case 'json': {
      return readJsonText(value.text);
    }
  }
}
