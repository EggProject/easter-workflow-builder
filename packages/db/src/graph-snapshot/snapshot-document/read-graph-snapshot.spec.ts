/* eslint-disable unicorn/no-null -- a tárolt JSON oszlopból `null` érkezhet, és a `workflow.description` nullázható mező (SPEC-003 4.1); az `undefined` nem éli túl a JSON oszlopot */
import { describe, expect, it } from 'vitest';
import { readGraphSnapshot } from './read-graph-snapshot.ts';

const VALID_DOCUMENT = {
  version: 1,
  sdkVersionPin: '0.3.245',
  workflow: { id: 'w1', name: 'Teszt', description: null },
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Indulás',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [] },
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [],
};

function errorMessage(stored: unknown): string {
  const outcome = readGraphSnapshot(stored);
  if (outcome.kind !== 'error') {
    throw new Error('a visszaolvasásnak hibaágat kellene adnia');
  }
  return outcome.message;
}

describe('readGraphSnapshot', () => {
  it('visszaadja az 1. verziójú dokumentumot', () => {
    const outcome = readGraphSnapshot(VALID_DOCUMENT);

    expect(outcome).toEqual({ kind: 'ok', value: VALID_DOCUMENT });
  });

  it('malformed_graph_document, ha a tárolt érték nem rekord', () => {
    expect(errorMessage(null)).toContain('malformed_graph_document');
    expect(errorMessage([VALID_DOCUMENT])).toContain('malformed_graph_document');
    expect(errorMessage('{}')).toContain('malformed_graph_document');
  });

  it('malformed_graph_document, ha a version hiányzik vagy nem egész szám', () => {
    expect(errorMessage({})).toContain('malformed_graph_document');
    expect(errorMessage({ ...VALID_DOCUMENT, version: '1' })).toContain('malformed_graph_document');
    expect(errorMessage({ ...VALID_DOCUMENT, version: 1.5 })).toContain('malformed_graph_document');
  });

  it('unknown_graph_document_version, ha a verzió ismeretlen', () => {
    const message = errorMessage({ ...VALID_DOCUMENT, version: 2 });

    expect(message).toContain('unknown_graph_document_version');
    expect(message).toContain('2');
  });

  it('malformed_graph_document, ha a verzió ismert, de az alak nem felel meg neki', () => {
    expect(errorMessage({ ...VALID_DOCUMENT, nodes: 'nem tömb' })).toContain('malformed_graph_document');
  });

  it('kivételt sosem dob', () => {
    const cyclic: Record<string, unknown> = { version: 1 };
    cyclic['self'] = cyclic;

    expect(() => readGraphSnapshot(cyclic)).not.toThrow();
    expect(readGraphSnapshot(cyclic).kind).toBe('error');
  });
});
