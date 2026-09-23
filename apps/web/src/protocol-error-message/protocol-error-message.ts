import type { ProtocolErrorCode } from '@easter-workflow-builder/protocol';

/**
 * A `ProtocolErrorCode` mind a hat értékéhez tartozó magyar mondat (SPEC-007
 * 8.4). Kimerítő `switch`: egy hetedik kód a `protocol` csomagban fordítási
 * hibát adna (`switch-exhaustiveness-check`).
 */
export function protocolErrorMessage(code: ProtocolErrorCode): string {
  switch (code) {
    case 'invalid_request': {
      return 'A kérés nem volt érvényes.';
    }
    case 'not_found': {
      return 'A keresett elem nem létezik, esetleg időközben törölték.';
    }
    case 'conflict': {
      return 'Az elem állapota most nem engedi a műveletet.';
    }
    case 'unprocessable': {
      return 'A kérés rendben volt, de a rendszer nem tudja végrehajtani.';
    }
    case 'internal': {
      return 'Váratlan szerver hiba történt.';
    }
    case 'service_unavailable': {
      return 'A szerver átmenetileg nem érhető el, például éppen leáll.';
    }
  }
}
