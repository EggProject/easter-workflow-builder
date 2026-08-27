/* eslint-disable unicorn/no-null -- a dokumentum nullázható mezői (`description`, `sourceHandle`, `targetHandle`, `branchKey`) a tárolt JSON-ban `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { isGraphSnapshotDocumentV1 } from './is-graph-snapshot-document-v1.ts';

type UnknownRecord = Readonly<Record<string, unknown>>;

const validNode = {
  id: 'n1',
  type: 'agent_step',
  label: 'Vázlat',
  position: { x: 1, y: 2.5 },
  config: { type: 'agent_step' },
  effectiveProviderId: 'minimax',
};

const validEdge = {
  id: 'e1',
  sourceNodeId: 'n1',
  targetNodeId: 'n2',
  sourceHandle: null,
  targetHandle: 'be',
  branchKey: null,
};

function documentWith(overrides: UnknownRecord): UnknownRecord {
  return {
    version: 1,
    sdkVersionPin: '0.3.245',
    workflow: { id: 'w1', name: 'Teszt', description: null },
    nodes: [validNode],
    edges: [validEdge],
    ...overrides,
  };
}

/**
 * A teljes dokumentum eredménye a megadott felülírásokkal.
 */
function isValidDocument(overrides: UnknownRecord): boolean {
  return isGraphSnapshotDocumentV1(documentWith(overrides));
}

/**
 * Az eredmény akkor, ha az egyetlen node mezőit felülírjuk.
 */
function isValidNode(overrides: UnknownRecord): boolean {
  return isGraphSnapshotDocumentV1(documentWith({ nodes: [{ ...validNode, ...overrides }] }));
}

/**
 * Az eredmény akkor, ha az egyetlen él mezőit felülírjuk.
 */
function isValidEdge(overrides: UnknownRecord): boolean {
  return isGraphSnapshotDocumentV1(documentWith({ edges: [{ ...validEdge, ...overrides }] }));
}

describe('isGraphSnapshotDocumentV1', () => {
  it('igazat ad a teljes, érvényes dokumentumra', () => {
    expect(isValidDocument({})).toBe(true);
    expect(isValidDocument({ nodes: [], edges: [] })).toBe(true);
    expect(isValidDocument({ workflow: { id: 'w1', name: 'Teszt', description: 'leírás' } })).toBe(true);
  });

  it('hamisat ad, ha a bemenet nem rekord vagy a verzió nem 1', () => {
    expect(isGraphSnapshotDocumentV1(null)).toBe(false);
    expect(isGraphSnapshotDocumentV1([])).toBe(false);
    expect(isGraphSnapshotDocumentV1('{}')).toBe(false);
    expect(isValidDocument({ version: 2 })).toBe(false);
  });

  it('hamisat ad hiányzó vagy rossz típusú fejléc mezőre', () => {
    expect(isValidDocument({ sdkVersionPin: 3 })).toBe(false);
    expect(isValidDocument({ workflow: null })).toBe(false);
    expect(isValidDocument({ workflow: { name: 'Teszt', description: null } })).toBe(false);
    expect(isValidDocument({ workflow: { id: 'w1', description: null } })).toBe(false);
    expect(isValidDocument({ workflow: { id: 'w1', name: 'Teszt', description: 7 } })).toBe(false);
  });

  it('hamisat ad, ha a nodes vagy az edges nem tömb', () => {
    expect(isValidDocument({ nodes: {} })).toBe(false);
    expect(isValidDocument({ edges: 'nincs' })).toBe(false);
  });

  it('hamisat ad hibás node alakra', () => {
    expect(isValidDocument({ nodes: [null] })).toBe(false);
    expect(isValidNode({ id: 1 })).toBe(false);
    expect(isValidNode({ type: 'nincs_ilyen' })).toBe(false);
    expect(isValidNode({ label: null })).toBe(false);
    expect(isValidNode({ effectiveProviderId: 'ismeretlen' })).toBe(false);
  });

  it('hamisat ad hibás node pozícióra', () => {
    expect(isValidNode({ position: null })).toBe(false);
    expect(isValidNode({ position: { x: 1 } })).toBe(false);
    expect(isValidNode({ position: { x: '1', y: 2 } })).toBe(false);
  });

  it('hamisat ad, ha a node config mezője hiányzik', () => {
    // A `config` alakját a dokumentum szándékosan nem szűkíti (SPEC-003 5.1),
    // a jelenlétét viszont igen: config nélküli node nem érvényes pillanatkép.
    const withoutConfig = {
      id: 'n1',
      type: 'agent_step',
      label: 'Vázlat',
      position: { x: 1, y: 2.5 },
      effectiveProviderId: 'minimax',
    };

    expect(isValidDocument({ nodes: [withoutConfig] })).toBe(false);
    expect(isValidNode({ config: null })).toBe(true);
  });

  it('hamisat ad hibás él alakra', () => {
    expect(isValidDocument({ edges: [null] })).toBe(false);
    expect(isValidEdge({ id: null })).toBe(false);
    expect(isValidEdge({ sourceNodeId: 1 })).toBe(false);
    expect(isValidEdge({ targetNodeId: undefined })).toBe(false);
    expect(isValidEdge({ sourceHandle: 7 })).toBe(false);
    expect(isValidEdge({ targetHandle: {} })).toBe(false);
    expect(isValidEdge({ branchKey: 3 })).toBe(false);
  });
});
