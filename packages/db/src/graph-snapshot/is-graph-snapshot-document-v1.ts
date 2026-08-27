import { isNumber, isRecord, isString } from '@easter-workflow-builder/typeguards';
import { isProviderId } from '@easter-workflow-builder/provider-capability';
import { isNodeType } from '../workflow-graph/is-node-type.ts';
import { GRAPH_DOCUMENT_VERSION } from './graph-snapshot-document.ts';
import type { GraphSnapshotDocumentV1 } from './graph-snapshot-document.ts';

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isSnapshotPosition(value: unknown): boolean {
  return isRecord(value) && isNumber(value['x']) && isNumber(value['y']);
}

/**
 * A `config` mező szándékosan `unknown` (SPEC-003 5.1), tehát az alakját itt
 * nem szűkítjük - a **jelenlétét** viszont igen, különben a guard átengedne egy
 * config nélküli node-ot is.
 */
function isSnapshotNode(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isNodeType(value['type']) &&
    isString(value['label']) &&
    isSnapshotPosition(value['position']) &&
    Object.hasOwn(value, 'config') &&
    isProviderId(value['effectiveProviderId'])
  );
}

function isSnapshotEdge(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['sourceNodeId']) &&
    isString(value['targetNodeId']) &&
    isNullableString(value['sourceHandle']) &&
    isNullableString(value['targetHandle']) &&
    isNullableString(value['branchKey'])
  );
}

function isSnapshotWorkflow(value: unknown): boolean {
  return isRecord(value) && isString(value['id']) && isString(value['name']) && isNullableString(value['description']);
}

function isArrayOf(value: unknown, isElement: (element: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every((element: unknown) => isElement(element));
}

/**
 * Az 1. verziójú pillanatkép dokumentum teljes alakjának typeguardja
 * (SPEC-003 5.3, 4. lépés és 9.4 szekció). Az adatbázisból jövő érték nem
 * bizonyíték a típusra, ezért a `readGraphSnapshot` ezzel szűkít, `as`
 * kényszerítés nélkül.
 */
export function isGraphSnapshotDocumentV1(value: unknown): value is GraphSnapshotDocumentV1 {
  return (
    isRecord(value) &&
    value['version'] === GRAPH_DOCUMENT_VERSION &&
    isString(value['sdkVersionPin']) &&
    isSnapshotWorkflow(value['workflow']) &&
    isArrayOf(value['nodes'], isSnapshotNode) &&
    isArrayOf(value['edges'], isSnapshotEdge)
  );
}
