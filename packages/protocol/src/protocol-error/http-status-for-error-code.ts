import type { ProtocolErrorCode } from './protocol-error-code.ts';

/**
 * A `ProtocolErrorCode` -> HTTP státusz leképezés, tiszta függvény (SPEC-005
 * 8.2 táblázat). A `switch-exhaustiveness-check` lint szabály kikényszeríti,
 * hogy egy jövőbeli hatodik kód felvétele fordítási hibát adjon mindaddig,
 * amíg ide nem kerül hozzá `case` ág.
 */
export function httpStatusForErrorCode(code: ProtocolErrorCode): number {
  switch (code) {
    case 'invalid_request': {
      return 400;
    }
    case 'not_found': {
      return 404;
    }
    case 'conflict': {
      return 409;
    }
    case 'unprocessable': {
      return 422;
    }
    case 'internal': {
      return 500;
    }
  }
}
