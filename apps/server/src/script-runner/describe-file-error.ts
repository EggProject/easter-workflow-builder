import { errorCodeOf } from './error-code-of.ts';
import type { HostCallOutcome } from './host-call-outcome.ts';

/**
 * A fájl gazda függvény hibája a sandbox felé (SPEC-014 5.4 "Fájl"): a Node
 * hiba `message` mezője a gazda abszolút útvonalát tartalmazza, ezért nem kerül
 * át; az üzenet a hibakódot és a szkript saját, relatív útvonalát mondja.
 */
export function describeFileError(error: unknown, requested: string): HostCallOutcome {
  const code = errorCodeOf(error);
  const reason = code === undefined ? '' : ` (${code})`;
  return { kind: 'rejected', name: 'Error', message: `a fájl művelet nem sikerült${reason}: ${requested}` };
}
