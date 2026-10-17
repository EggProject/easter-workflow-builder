/* eslint-disable unicorn/no-null -- a Start `onUnhandledError` mezője a dróton ténylegesen `null`, nem `undefined` (SPEC-005 protokoll alak) */
import { omitKeylessBranchEdges } from '../graph-node-card/omit-keyless-branch-edges.ts';
import type { GraphEditorDocument } from './graph-edit-history.ts';
import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';

/**
 * A betöltött dokumentum normalizálása (SPEC-008 5.1 O-27, 5.8 O-28): a
 * szerkesztett, és egyben a visszavonás kiinduló dokumentuma ez az alak, a
 * mentetlen jelző alapja viszont a szerver nyers válasza marad (5.5), tehát
 * mindkét normalizálás a betöltéssel azonnal mentetlen változás.
 *
 * 1. A régi, kulcs nélküli elágazás élek kimaradnak (`omitKeylessBranchEdges`).
 * 2. Ha ezután egyetlen `start` csomópont sincs, egy Start kerül a lista
 *    végére: az azonosító a porton át jön, a `label` üres, a pozíció az
 *    origó, a `config` üres bemeneti listás és kezeletlen hiba szabály
 *    nélküli. Egy vagy több meglévő Start mellett a csomópontok változatlanok.
 *
 * Tiszta függvény, DOM és `@xyflow/react` hivatkozás nélkül.
 */
export function normalizeLoadedGraphDocument(
  document: GraphEditorDocument,
  generateId: GraphElementIdGenerator,
): GraphEditorDocument {
  const edges = omitKeylessBranchEdges(document.nodes, document.edges);
  if (document.nodes.some((node) => node.type === 'start')) {
    return { nodes: document.nodes, edges };
  }
  return {
    nodes: [
      ...document.nodes,
      {
        id: generateId(),
        type: 'start',
        label: '',
        positionX: 0,
        positionY: 0,
        config: { type: 'start', inputFields: [], onUnhandledError: null },
      },
    ],
    edges,
  };
}
