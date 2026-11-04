import { FORBIDDEN_SCRIPT_PATH_PREFIXES } from '@easter-workflow-builder/protocol';
import { isWithinRoot } from './is-within-root.ts';

/**
 * Az abszolút, normalizált `candidate` útvonal a `/proc` vagy a `/dev`
 * könyvtár, vagy alattuk áll-e (user döntés 2026-11-04, "/proc és /dev
 * tiltva", SPEC-014 5.4 "Fájl"). A hívó a `path.resolve` (lexikális) és az
 * `fs.realpath` (szimbolikus linkek feloldva) alakot is ellenőrzi, így a `..`
 * és a link sem vezet ide. A lista a `protocol` mentési sémájával közös.
 */
export function isForbiddenHostPath(candidate: string): boolean {
  return FORBIDDEN_SCRIPT_PATH_PREFIXES.some((prefix) => isWithinRoot(prefix, candidate, true));
}
