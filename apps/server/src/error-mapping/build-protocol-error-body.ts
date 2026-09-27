import { ProtocolErrorClassSchema, type ProtocolErrorBody } from '@easter-workflow-builder/protocol';
import { extractTrailingErrorClass } from './extract-trailing-error-class.ts';
import { mapOutcomeMessageToErrorCode } from './map-outcome-message-to-error-code.ts';

/**
 * A `db` réteg (`describe-transaction-error.ts`) az `Outcome` üzenetben
 * megtartja a driver szövegét, hogy az eredeti ok naplózható legyen (SPEC-006
 * 7.2). A válasz TÖRZSÉBEN viszont ez soha nem jelenhet meg (SPEC-005 8.4):
 * emiatt pontosan ez a két, driver szöveget hordozó hibaosztály saját,
 * azonosító és driver szöveg nélküli mondatot kap a határon (user döntés
 * 2026-09-27, "Saját mondat, ok a naplóba").
 */
const UNSAFE_MESSAGE_ERROR_CLASS_SENTENCES: ReadonlyMap<string, string> = new Map([
  ['foreign_key_violation', 'A kérés nem létező elemre hivatkozik (foreign_key_violation).'],
  ['graph_id_conflict', 'A gráf egy azonosítója már foglalt (graph_id_conflict).'],
]);

const CLASSLESS_INTERNAL_MESSAGE = 'Váratlan szerver hiba történt (internal).';

/**
 * Egy végpont kezelő `Outcome` hibaágának üzenetéből a REST hiba törzs
 * (SPEC-005 8.1, 8.3, 8.4, 8.5). A `code` a 8.3 leképezésből jön; az
 * `errorClass` csak akkor kerül a törzsbe, ha a záró zárójel hibaosztálya a
 * protokoll zárt szótárában áll, különben a kulcs hiányzik (a kliens
 * ilyenkor a `code` mondatát mutatja).
 *
 * **A `message` mező NEM mindig az eredeti `Outcome` üzenet (2026-09-27).**
 * Két eset kap saját, a `UNSAFE_MESSAGE_ERROR_CLASS_SENTENCES` szótárban álló
 * mondatot ahelyett, hogy az eredeti (driver szöveget hordozó) üzenet
 * kimenne; egy harmadik eset (a valóban OSZTÁLY NÉLKÜLI, azaz záró zárójel
 * nélküli üzenet) a kivétel ág meglévő, általános mondatát kapja. Minden más,
 * ma is saját (authored) mondatú hibaosztály üzenete változatlan marad -
 * ezeknél a záró zárójel megvan, csak nincs a `ProtocolErrorClassSchema`
 * szótárában (pl. `database_closed`, `not_found`, `invalid_request`).
 */
export function buildProtocolErrorBody(message: string): ProtocolErrorBody {
  const code = mapOutcomeMessageToErrorCode(message);
  const rawErrorClass = extractTrailingErrorClass(message);

  if (rawErrorClass !== undefined) {
    const unsafeMessageSentence = UNSAFE_MESSAGE_ERROR_CLASS_SENTENCES.get(rawErrorClass);
    if (unsafeMessageSentence !== undefined) {
      return { code, message: unsafeMessageSentence };
    }
  }

  if (rawErrorClass === undefined) {
    return { code, message: CLASSLESS_INTERNAL_MESSAGE };
  }

  const errorClass = ProtocolErrorClassSchema.safeParse(rawErrorClass);
  if (!errorClass.success) {
    return { code, message };
  }
  return { code, message, errorClass: errorClass.data };
}
