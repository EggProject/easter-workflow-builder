/* eslint-disable unicorn/no-null -- a `ConcurrencyLimitLookup` `null` értéke valódi adat ("ehhez a providerhez nincs beállított korlát", SPEC-003 11.), ugyanaz az alak, mint a `ProviderConcurrencyRepository.readLimit` visszatérése, nem helyőrző `undefined` */
import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { ConcurrencyGate } from './concurrency-gate.ts';
import { createConcurrencyGate } from './create-concurrency-gate.ts';

/**
 * A teszt egyetlen időzítőt, mikrotask ürítést és valós időt sem használ: a
 * szabályozó a helyet szinkron osztja ki, ezért a `granted` tömb minden hívás
 * után azonnal olvasható (SPEC-004 14.2, "valós idő" és "a futtathatóvá válás
 * sorrendje" sor).
 *
 * A `limits` térkép a teszt közben módosítható, mert a beállított korlát
 * azonnal érvénybe lép (SPEC-003 11.), és ezt tesztelni kell.
 */
function createTestGate(): {
  readonly gate: ConcurrencyGate;
  readonly limits: Map<ProviderId, number>;
  readonly granted: readonly string[];
  // Nyílfüggvény mező, nem metódus szignatúra: a tesztek destruktúrálva veszik
  // ki, amit a `@typescript-eslint/unbound-method` metódus alakban jelezne.
  readonly request: (providerId: ProviderId, requestId: string) => void;
} {
  const limits = new Map<ProviderId, number>();
  const granted: string[] = [];
  const gate = createConcurrencyGate((providerId) => limits.get(providerId) ?? null);

  return {
    gate,
    limits,
    granted,
    request: (providerId, requestId) => {
      gate.requestSlot(providerId, requestId, () => {
        granted.push(requestId);
      });
    },
  };
}

describe('createConcurrencyGate', () => {
  it('korlát nélkül minden kérés azonnal helyet kap', () => {
    const { gate, granted, request } = createTestGate();

    request('minimax', 'l1');
    request('minimax', 'l2');
    request('minimax', 'l3');

    expect(granted).toStrictEqual(['l1', 'l2', 'l3']);
    expect(gate.occupiedSlotCount('minimax')).toBe(3);
    expect(gate.waitingRequestCount('minimax')).toBe(0);
  });

  it('a korlát fölötti kérés sorba áll, és a felszabaduló helyet a sor eleje kapja', () => {
    const { gate, limits, granted, request } = createTestGate();
    limits.set('minimax', 2);

    request('minimax', 'l1');
    request('minimax', 'l2');
    request('minimax', 'l3');

    expect(granted).toStrictEqual(['l1', 'l2']);
    expect(gate.occupiedSlotCount('minimax')).toBe(2);
    expect(gate.waitingRequestCount('minimax')).toBe(1);

    expect(gate.releaseSlot('l1')).toStrictEqual({ kind: 'ok', value: undefined });

    expect(granted).toStrictEqual(['l1', 'l2', 'l3']);
    expect(gate.occupiedSlotCount('minimax')).toBe(2);
    expect(gate.waitingRequestCount('minimax')).toBe(0);
  });

  it('három futás összefésült lépései szigorúan érkezési sorrendben kapnak helyet', () => {
    // A három "futás" itt csak az azonosítók előtagja: a szabályozó nem ismeri
    // a futás fogalmát, a sor mégis közös (SPEC-004 7.1, 7.4).
    const { gate, limits, granted, request } = createTestGate();
    limits.set('minimax', 2);

    request('minimax', 'a1');
    request('minimax', 'b1');
    request('minimax', 'c1');
    request('minimax', 'a2');
    request('minimax', 'b2');
    request('minimax', 'c2');

    expect(granted).toStrictEqual(['a1', 'b1']);
    expect(gate.waitingRequestCount('minimax')).toBe(4);

    // A felszabadítás sorrendje szándékosan más, mint az érkezésé: a
    // kiosztásnak ettől függetlenül az érkezési sorrendet kell követnie.
    gate.releaseSlot('b1');
    gate.releaseSlot('a1');
    gate.releaseSlot('c1');
    gate.releaseSlot('a2');

    expect(granted).toStrictEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'c2']);
    expect(gate.waitingRequestCount('minimax')).toBe(0);
  });

  it('a felszabadítás várakozó nélkül is sikeres, és a hely újra kiadható', () => {
    const { gate, limits, granted, request } = createTestGate();
    limits.set('minimax', 1);

    request('minimax', 'l1');
    expect(gate.releaseSlot('l1')).toStrictEqual({ kind: 'ok', value: undefined });
    expect(gate.occupiedSlotCount('minimax')).toBe(0);

    request('minimax', 'l2');

    expect(granted).toStrictEqual(['l1', 'l2']);
  });

  it('ismeretlen azonosító felszabadítása unknown_concurrency_slot hibaágat ad', () => {
    const { gate, limits, request } = createTestGate();
    limits.set('minimax', 1);

    expect(gate.releaseSlot('nincs-ilyen')).toStrictEqual({
      kind: 'error',
      message:
        'A(z) "nincs-ilyen" azonosítóhoz nem tartozik sem foglalt hely, sem várakozó kérés (unknown_concurrency_slot).',
    });

    // A kétszeres felszabadítás ugyanez az eset: enélkül a szabályozó a
    // korlát fölé engedne egy lépést.
    request('minimax', 'l1');
    expect(gate.releaseSlot('l1')).toStrictEqual({ kind: 'ok', value: undefined });
    expect(gate.releaseSlot('l1').kind).toBe('error');
  });

  it('a még várakozó kérés felszabadítása kiveszi a sorból, és soha nem kap helyet', () => {
    // A megszakítás útja: "a sorban álló lépései kiesnek" (SPEC-004 9. 2. pont).
    const { gate, limits, granted, request } = createTestGate();
    limits.set('minimax', 1);

    request('minimax', 'l1');
    request('minimax', 'l2');

    expect(gate.releaseSlot('l2')).toStrictEqual({ kind: 'ok', value: undefined });
    expect(gate.waitingRequestCount('minimax')).toBe(0);

    gate.releaseSlot('l1');

    expect(granted).toStrictEqual(['l1']);
    expect(gate.occupiedSlotCount('minimax')).toBe(0);
  });

  it('a providerek korlátja egymástól független', () => {
    const { gate, limits, granted, request } = createTestGate();
    limits.set('minimax', 1);
    limits.set('claude-subscription', 1);

    request('minimax', 'm1');
    request('minimax', 'm2');
    request('claude-subscription', 'c1');
    request('claude-subscription', 'c2');

    // A telített `minimax` nem tartja fel a másik providert.
    expect(granted).toStrictEqual(['m1', 'c1']);
    expect(gate.waitingRequestCount('minimax')).toBe(1);
    expect(gate.waitingRequestCount('claude-subscription')).toBe(1);

    // A felszabaduló hely a saját providerének várakozóját szolgálja ki, akkor
    // is, ha a sorban egy másik provider kérése áll előrébb.
    gate.releaseSlot('c1');

    expect(granted).toStrictEqual(['m1', 'c1', 'c2']);
    expect(gate.occupiedSlotCount('minimax')).toBe(1);

    gate.releaseSlot('m1');

    expect(granted).toStrictEqual(['m1', 'c1', 'c2', 'm2']);
  });

  it('a futás közben csökkentett korlát azonnal érvénybe lép', () => {
    const { gate, limits, granted, request } = createTestGate();
    limits.set('minimax', 2);

    request('minimax', 'l1');
    request('minimax', 'l2');
    request('minimax', 'l3');

    limits.set('minimax', 1);
    gate.releaseSlot('l1');

    // Egy hely szabadult fel, de a korlát közben egyre csökkent, tehát a
    // maradék egy foglalt hely már kimeríti: a várakozó nem indulhat.
    expect(granted).toStrictEqual(['l1', 'l2']);
    expect(gate.waitingRequestCount('minimax')).toBe(1);

    gate.releaseSlot('l2');

    expect(granted).toStrictEqual(['l1', 'l2', 'l3']);
  });
});
