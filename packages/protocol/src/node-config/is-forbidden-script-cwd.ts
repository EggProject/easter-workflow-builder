import { FORBIDDEN_SCRIPT_PATH_PREFIXES } from './forbidden-script-path-prefixes.ts';

/**
 * Az abszolút `cwd` lexikálisan normalizált alakja a `FORBIDDEN_SCRIPT_PATH_PREFIXES`
 * valamelyike, vagy alatta áll-e (SPEC-014 5.4 "Fájl", 5.9). A normalizálás a
 * POSIX `path.normalize` szabálya szerint: az üres és a `.` szegmens kimarad, a
 * `..` a megelőzőt veszi le, a gyökér fölött hatástalan (`/..` = `/`), tehát a
 * `/srv/../proc` és a `//dev/` is tiltott.
 *
 * A relatív `cwd` a szerver munkakönyvtárához képest oldódik fel, ami a mentéskor
 * (a böngészőben is futó sémában) nem ismert, és a szimbolikus link sem látszik:
 * ezekre a futtató `fs.realpath` alapú ellenőrzése dönt, itt nincs találat.
 */
export function isForbiddenScriptCwd(cwd: string): boolean {
  if (!cwd.startsWith('/')) {
    return false;
  }
  const segments: string[] = [];
  for (const segment of cwd.split('/')) {
    if (segment === '..') {
      segments.pop();
    } else if (segment !== '' && segment !== '.') {
      segments.push(segment);
    }
  }
  const normalized = `/${segments.join('/')}`;
  return FORBIDDEN_SCRIPT_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
