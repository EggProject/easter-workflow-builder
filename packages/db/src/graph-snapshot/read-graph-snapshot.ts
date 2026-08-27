import { isInt, isRecord } from '@easter-workflow-builder/typeguards';
import type { Outcome } from '@easter-workflow-builder/core';
import type { GraphSnapshotDocument } from './graph-snapshot-document.ts';
import { isGraphSnapshotDocumentV1 } from './is-graph-snapshot-document-v1.ts';
import { isGraphSnapshotDocumentVersion } from './is-graph-snapshot-document-version.ts';

const MALFORMED = 'malformed_graph_document';

function malformed(reason: string): Outcome<GraphSnapshotDocument> {
  return { kind: 'error', message: `A tárolt gráf pillanatkép nem olvasható: ${reason} (${MALFORMED}).` };
}

/**
 * A tárolt pillanatkép dokumentum visszaolvasása (SPEC-003 5.3, 17. kritérium).
 *
 * A lépések sorrendje kötött: rekord ellenőrzés, a `version` mező egész számra
 * szűkítése, az **ismeretlen verzió kizárása a `switch` előtt**, végül a
 * kimerítő `switch` az ismert verziók unióján. Ettől lesz a `switch`
 * ténylegesen kimerítő a `@typescript-eslint/switch-exhaustiveness-check`
 * szabály szerint: egy jövőbeli verzió felvétele a
 * `GraphSnapshotDocumentVersion` unióba fordítási hibát ad addig, amíg a hozzá
 * tartozó `case` ág (és az átalakító lánc) hiányzik.
 *
 * Az átalakítás kizárólag olvasáskor történik, és **soha nem íródik vissza**: a
 * tárolt sor bitre az marad, ami a futás indításakor keletkezett (SPEC-003 5.3).
 *
 * Kivételt sosem dob.
 */
export function readGraphSnapshot(stored: unknown): Outcome<GraphSnapshotDocument> {
  if (!isRecord(stored)) {
    return malformed('a tárolt érték nem kulcs-érték objektum');
  }

  const version = stored['version'];
  if (!isInt(version)) {
    return malformed('a version mező hiányzik vagy nem egész szám');
  }

  if (!isGraphSnapshotDocumentVersion(version)) {
    return {
      kind: 'error',
      message: `A futás egy újabb alkalmazás verzióval készült, a(z) ${String(version)}. dokumentumverzió ismeretlen (unknown_graph_document_version).`,
    };
  }

  // A `switch` szándékosan egyetlen ágú, és a két lint kivétel is szándékos: a
  // szerkezet nem olvashatósági díszítés, hanem a verziókezelés kikényszerítője
  // (SPEC-003 5.3, 3. lépés és 17. kritérium). Egy `if` ugyanezt nem tudja: a
  // `switch-exhaustiveness-check` csak `switch` szerkezetre ad hibát, ha a
  // `GraphSnapshotDocumentVersion` unió bővül, de az ág hiányzik.
  // eslint-disable-next-line sonarjs/no-small-switch -- lásd a fenti indoklást
  switch (version) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ma egytagú az unió, ezért a fordító szerint a feltétel mindig igaz; az ág a jövőbeli verziók miatt kell
    case 1: {
      return isGraphSnapshotDocumentV1(stored)
        ? { kind: 'ok', value: stored }
        : malformed('a dokumentum nem felel meg az 1. verzió alakjának');
    }
  }
}
