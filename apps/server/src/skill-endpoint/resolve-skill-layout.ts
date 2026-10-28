import type { Outcome } from '@easter-workflow-builder/core';
import type { PlannedZipEntry } from './planned-zip-entry.ts';
import { skillUploadFailure } from './skill-upload-failure.ts';

const MANIFEST_FILE_NAME = 'SKILL.md';

function firstSegment(entryPath: string): string {
  return entryPath.split('/', 1).join('');
}

/**
 * A skill gyökerének helye a csomagban (SPEC-009 5.4 4. pont, O-35): a zip
 * gyökere, ha ott áll a `SKILL.md`; különben pontosan egy legfelső szintű
 * mappa, amiben minden bejegyzés áll (a mappa nevét a rendszer lecsípi). A
 * visszaadott érték a lecsípendő előtag (`''` vagy `'<mappa>/'`). Utána a skill
 * gyökerében pontosan egy `SKILL.md` kötelező: a hiánya és a többszöröse saját
 * osztályt kap. A többszörös példány ezért itt, az ütközés ellenőrzés előtt
 * dől el (két azonos nevű `SKILL.md` bejegyzés).
 */
export function resolveSkillLayout(entries: readonly PlannedZipEntry[]): Outcome<string> {
  const isRootHasManifest = entries.some((entry) => entry.kind === 'file' && entry.path === MANIFEST_FILE_NAME);
  const topSegments = new Set(entries.map((entry) => firstSegment(entry.path)));
  const [onlyFolder] = topSegments;
  const isSingleFolder =
    topSegments.size === 1 &&
    entries.every((entry) =>
      entry.path === onlyFolder ? entry.kind === 'directory' : entry.path.startsWith(`${String(onlyFolder)}/`),
    );

  if (!isRootHasManifest && !isSingleFolder) {
    return skillUploadFailure(
      'skill_archive_layout_invalid',
      'A csomag gyökerében nincs SKILL.md, és nem pontosan egy legfelső szintű mappát tartalmaz',
    );
  }

  const prefix = isRootHasManifest ? '' : `${String(onlyFolder)}/`;
  const manifestCount = entries.filter(
    (entry) => entry.kind === 'file' && entry.path === `${prefix}${MANIFEST_FILE_NAME}`,
  ).length;
  if (manifestCount === 0) {
    return skillUploadFailure('skill_manifest_missing', 'A skill gyökerében nincs SKILL.md');
  }
  if (manifestCount > 1) {
    return skillUploadFailure('skill_manifest_duplicate', `A skill gyökerében ${String(manifestCount)} SKILL.md áll`);
  }
  return { kind: 'ok', value: prefix };
}
