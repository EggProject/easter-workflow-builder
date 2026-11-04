import type { HostCallOutcome } from './host-call-outcome.ts';

/**
 * A gyökéren kívülre mutató útvonal elutasítása (SPEC-014 5.4 "Fájl"); az
 * üzenet a szkript saját útvonalát mondja, a gazda gyökerét nem.
 */
export function outsideRootRejection(requested: string): Extract<HostCallOutcome, { kind: 'rejected' }> {
  return { kind: 'rejected', name: 'Error', message: `az útvonal a hozzáférés gyökerén kívülre mutat: ${requested}` };
}
