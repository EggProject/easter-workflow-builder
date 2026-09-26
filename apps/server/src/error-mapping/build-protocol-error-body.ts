import { ProtocolErrorClassSchema, type ProtocolErrorBody } from '@easter-workflow-builder/protocol';
import { extractTrailingErrorClass } from './extract-trailing-error-class.ts';
import { mapOutcomeMessageToErrorCode } from './map-outcome-message-to-error-code.ts';

/**
 * Egy végpont kezelő `Outcome` hibaágának üzenetéből a REST hiba törzs
 * (SPEC-005 8.1, 8.3, 8.5). A `code` a 8.3 leképezésből jön; az `errorClass`
 * csak akkor kerül a törzsbe, ha a záró zárójel hibaosztálya a protokoll zárt
 * szótárában áll, különben a kulcs hiányzik (a kliens ilyenkor a `code`
 * mondatát mutatja). A `message` változatlan: a drótszintű szerződés része,
 * a felület nem jeleníti meg (SPEC-007 8.4).
 */
export function buildProtocolErrorBody(message: string): ProtocolErrorBody {
  const code = mapOutcomeMessageToErrorCode(message);
  const errorClass = ProtocolErrorClassSchema.safeParse(extractTrailingErrorClass(message));
  if (!errorClass.success) {
    return { code, message };
  }
  return { code, message, errorClass: errorClass.data };
}
