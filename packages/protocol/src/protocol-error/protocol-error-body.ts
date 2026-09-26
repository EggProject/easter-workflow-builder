import { z } from 'zod';
import { ProtocolErrorClassSchema } from './protocol-error-class.ts';
import { ProtocolErrorCodeSchema } from './protocol-error-code.ts';

/**
 * Az egységes hiba alak, REST-en és SSE-n egyaránt (SPEC-005 8.1 szekció).
 * Nincs `details` szabad objektum, nincs `stack`, nincs `sql`, nincs `path`
 * mező: a séma szándékosan zárt (40. kritérium). A `protocol_error` SSE
 * keret ugyanezt az alakot hordozza, egy `runId` mezővel kiegészítve
 * (`event-stream` téma, 5.4 szekció).
 *
 * Az `errorClass` a hibaosztály géppel olvasható neve, de csak akkor áll a
 * törzsben, ha a `ProtocolErrorClassSchema` zárt szótárában szerepel (8.5):
 * a kliens ebből választ saját mondatot, a `message` szövegét nem elemzi.
 * Elhagyható, nem `null`: a szótáron kívüli hibaosztálynál és a mező előtti
 * szerver válaszánál egyaránt hiányzik, és a kliens mindkettőre a `code`
 * mondatát mutatja.
 */
export const ProtocolErrorBodySchema = z
  .strictObject({
    code: ProtocolErrorCodeSchema,
    message: z.string(),
    errorClass: ProtocolErrorClassSchema.optional(),
  })
  .readonly();

export type ProtocolErrorBody = z.infer<typeof ProtocolErrorBodySchema>;
