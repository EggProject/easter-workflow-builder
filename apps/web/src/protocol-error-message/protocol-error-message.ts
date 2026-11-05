import type { ProtocolErrorCode } from '@easter-workflow-builder/protocol';

/**
 * A `ProtocolErrorCode` mind a hét értékéhez tartozó magyar mondat (SPEC-007
 * 8.4). Kimerítő `switch`: egy nyolcadik kód a `protocol` csomagban fordítási
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
    case 'forbidden': {
      // A szerver a kérés forrását utasította el (SPEC-017 5.): a saját
      // felületről ez csak eltérő beállításnál fordul elő, például ha a
      // felület más címen nyílt meg, mint az `EASTER_STREAM_DEV_ORIGIN`.
      return 'A szerver elutasította a kérést, mert nem a beállított felület címéről érkezett.';
    }
  }
}
