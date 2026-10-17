import type { ProtocolErrorBody } from './protocol-error-body.ts';

/**
 * Egy sikertelen `.safeParse()` hívás `error` mezőjét fordítja
 * `ProtocolErrorBody` alakra (SPEC-005 7.5 és 8.4 szekció). Az üzenet a
 * hibás mező **útvonalát** nevezi meg (`issue.path`), a kapott értéket soha
 * nem tartalmazza: egy elutasított kérés törzsében titok is állhat, azt nem
 * visszhangozzuk (28. kritérium).
 *
 * A bemenet a Zod hiba szerkezeti alakja, csak a hibák útvonalával: egy
 * `z.ZodError` változtatás nélkül illeszkedik rá, az `apps/web` pedig zod
 * import nélkül is átadhatja a séma hibái mellett a saját, űrlap oldali
 * hibáit (az `agents` bejegyzés kötelező mezői, SPEC-008 5.4, O-38), hogy a
 * mentés előtti ellenőrzés egyetlen üzenetben nevezze meg mindet.
 */
export function zodErrorToProtocolErrorBody(error: {
  readonly issues: readonly { readonly path: readonly PropertyKey[] }[];
}): ProtocolErrorBody {
  if (error.issues.length === 0) {
    return {
      code: 'invalid_request',
      message: 'A kérés törzse nem illeszkedik az elvárt sémára (invalid_request).',
    };
  }

  const paths = error.issues.map((issue) => (issue.path.length === 0 ? '(gyökér)' : issue.path.join('.')));

  return {
    code: 'invalid_request',
    message: `A kérés törzse érvénytelen, hibás mező(k): ${paths.join(', ')} (invalid_request).`,
  };
}
