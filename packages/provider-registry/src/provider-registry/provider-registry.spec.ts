import { describe, expect, it } from 'vitest';
import {
  isKnownFact,
  isUnknownFact,
  measurementDocument,
  type Fact,
} from '@easter-workflow-builder/provider-capability';
import { providerRegistry } from './provider-registry.ts';

/**
 * Objektum-e (a tömb is az). Azért kell, mert a bejárás `unknown` értékeken
 * halad, és `as` nélkül csak typeguarddal lehet leszűkíteni.
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/**
 * Teljes `Fact` alak ellenőrzése: nem elég a `state` mező, a hozzá tartozó
 * ágnak a saját mezőit is hordoznia kell, különben a typeguard többet
 * állítana, mint amit valóban ellenőriz.
 */
function isFact(value: unknown): value is Fact<unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const state = value['state'];
  if (state === 'known') {
    return 'value' in value && 'evidence' in value;
  }
  return state === 'unknown' && 'reason' in value && 'blockedBy' in value;
}

/**
 * A leíró fában mélységi bejárással összegyűjti az összes `Fact` értéket.
 */
function collectFacts(node: unknown, found: Fact<unknown>[]): void {
  if (!isRecord(node)) {
    return;
  }
  if (isFact(node)) {
    found.push(node);
    return;
  }
  for (const child of Object.values(node)) {
    collectFacts(child, found);
  }
}

const allFacts: Fact<unknown>[] = [];
collectFacts(providerRegistry, allFacts);

const knownFacts = allFacts.filter((fact) => isKnownFact(fact));
const unknownFacts = allFacts.filter((fact) => isUnknownFact(fact));

describe('providerRegistry', () => {
  it('mindkét provider leírót tartalmazza', () => {
    const providerKeys = Object.keys(providerRegistry).toSorted((left, right) => left.localeCompare(right));
    expect(providerKeys).toStrictEqual(['claude-subscription', 'minimax']);
  });

  it('tartalmaz bejárható Fact értékeket', () => {
    expect(allFacts.length).toBeGreaterThan(0);
  });

  it('minden Fact pontosan az egyik ágon áll', () => {
    for (const fact of allFacts) {
      expect(isKnownFact(fact)).toBe(!isUnknownFact(fact));
    }
  });

  it('minden known Fact nem üres bizonyítéklistát hordoz', () => {
    expect(knownFacts.length).toBeGreaterThan(0);
    for (const fact of knownFacts) {
      expect(fact.evidence.length).toBeGreaterThan(0);
    }
  });

  it('minden unknown Fact indoklást és blokkoló mérést hordoz', () => {
    expect(unknownFacts.length).toBeGreaterThan(0);
    for (const fact of unknownFacts) {
      expect(fact.reason.length).toBeGreaterThan(0);
      expect(fact.blockedBy.length).toBeGreaterThan(0);
    }
  });

  // SPEC-001 16. szekció, 35. elfogadási kritérium: a leírókban nincs prózai
  // mérési hivatkozás, a mérésre az `evidence` mező mutat.
  it('egyetlen unknown indoklás sem tartalmaz M- mintájú mérési azonosítót', () => {
    for (const fact of unknownFacts) {
      expect(fact.reason).not.toMatch(/\bM-\d/);
    }
  });
});

describe('measurementDocument', () => {
  it('a leírókban hivatkozott minden mérési azonosító feloldható docs horgonyra', () => {
    const referenced = new Set<string>();
    for (const fact of knownFacts) {
      for (const reference of fact.evidence) {
        if (reference.kind === 'measurement') {
          referenced.add(reference.id);
        }
      }
    }

    expect(referenced.size).toBeGreaterThan(0);
    const unresolved = [...referenced].filter((id) => !Object.hasOwn(measurementDocument, id));
    expect(unresolved).toStrictEqual([]);
  });
});
