import { realpath } from 'node:fs/promises';
import { errorCodeOf } from './error-code-of.ts';

/**
 * Az útvonal `fs.realpath` alakja, vagy `undefined`, ha az útvonal (vagy egy
 * szimbolikus link célja) nem létezik (`ENOENT`). Minden más hiba továbbmegy.
 */
export async function realpathIfExists(target: string): Promise<string | undefined> {
  try {
    return await realpath(target);
  } catch (error) {
    if (errorCodeOf(error) === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}
