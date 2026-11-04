import type { HostCallOutcome } from './host-call-outcome.ts';

/**
 * A `/proc` vagy `/dev` alá mutató útvonal elutasítása (SPEC-014 5.4 "Fájl");
 * az üzenet a szkript saját útvonalát mondja, a gazda feloldott útvonalát nem.
 */
export function forbiddenPathRejection(requested: string): Extract<HostCallOutcome, { kind: 'rejected' }> {
  return {
    kind: 'rejected',
    name: 'Error',
    message: `az útvonal a tiltott /proc vagy /dev könyvtárba mutat: ${requested}`,
  };
}
