import type { Outcome } from '@easter-workflow-builder/core';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ConcurrencyGate } from './concurrency-gate.ts';
import type { ConcurrencyLimitLookup } from './concurrency-limit-lookup.ts';

/**
 * Egy helyre váró, még ki nem szolgált kérés a közös sorban.
 */
interface WaitingRequest {
  readonly providerId: ProviderId;
  readonly requestId: string;
  readonly onGranted: () => void;
}

/**
 * A providerenkénti, minden futásra közös párhuzamossági szabályozó
 * (SPEC-004 7.1 ... 7.3). Memóriában él, adatbázist nem érint és portot nem
 * hív: a korlátot a `limitLookup` adja, amit a hívó állít össze.
 *
 * **Miért állapotot tartó lezárás, és nem tiszta reducer, mint a
 * `scheduling` téma.** Az ütemező állapotát egyetlen futás léptetése
 * birtokolja, ezért ott az állapotot végig kézben lehet tartani. A
 * szabályozó ezzel szemben **egyetlen, minden futás által osztott** objektum,
 * és a felszabaduló helyet egy **másik** futás várakozójának kell átadnia:
 * ehhez értesítés kell, amit egy tiszta függvény nem tud kiadni. Az állapot
 * ezért a lezárásban él, a felület pedig semmit nem szivárogtat ki belőle,
 * csak a két számlálót.
 *
 * **A sor közös, a kiszolgálás providerenkénti.** A `waitingRequests` térkép
 * beszúrási sorrendje maga az érkezési sorrend (a `Map` iterációja
 * dokumentáltan beszúrási sorrendű), ezért nincs külön sorszám mező. Egy
 * felszabaduló hely az **adott providerre** várakozók közül a legrégebbit
 * szolgálja ki, függetlenül attól, melyik futásból jött; egy másik provider
 * telítettsége így soha nem tartja fel a szabad provider sorát (7.4 rajz).
 *
 * **Nincs szállított párhuzamossági szám.** A fájlban egyetlen korlát érték
 * sem szerepel: korlát híján (`null`) a szabályozó nem korlátoz
 * (17. szekció 37. kritérium).
 */
export function createConcurrencyGate(limitLookup: ConcurrencyLimitLookup): ConcurrencyGate {
  /**
   * `requestId` -> a foglalt hely providere. Egy bejegyzés egy foglalt hely.
   */
  const occupiedSlots = new Map<string, ProviderId>();
  /**
   * `requestId` -> a várakozó kérés, a térkép sorrendje az érkezési sorrend.
   */
  const waitingRequests = new Map<string, WaitingRequest>();

  function occupiedSlotCount(providerId: ProviderId): number {
    return occupiedSlots
      .values()
      .filter((occupiedProviderId) => occupiedProviderId === providerId)
      .toArray().length;
  }

  function waitingRequestCount(providerId: ProviderId): number {
    return waitingRequests
      .values()
      .filter((request) => request.providerId === providerId)
      .toArray().length;
  }

  /**
   * A korlátot minden döntés előtt újra kérdezzük, mert a beállított érték
   * azonnal érvénybe lép (SPEC-003 11.). Ebből következik, hogy egy futás
   * közben **csökkentett** korlát mellett a felszabaduló hely nem feltétlenül
   * megy tovább: előbb le kell épülnie a már kiosztott többletnek.
   */
  function hasFreeSlot(providerId: ProviderId): boolean {
    const limit = limitLookup(providerId);
    return limit === null || occupiedSlotCount(providerId) < limit;
  }

  function grantNextWaiting(providerId: ProviderId): void {
    if (!hasFreeSlot(providerId)) {
      return;
    }
    const next = waitingRequests.values().find((request) => request.providerId === providerId);
    if (next === undefined) {
      return;
    }
    waitingRequests.delete(next.requestId);
    occupiedSlots.set(next.requestId, providerId);
    next.onGranted();
  }

  function requestSlot(providerId: ProviderId, requestId: string, onGranted: () => void): void {
    if (hasFreeSlot(providerId)) {
      occupiedSlots.set(requestId, providerId);
      onGranted();
      return;
    }
    waitingRequests.set(requestId, { providerId, requestId, onGranted });
  }

  function releaseSlot(requestId: string): Outcome<void> {
    const providerId = occupiedSlots.get(requestId);
    if (providerId !== undefined) {
      occupiedSlots.delete(requestId);
      grantNextWaiting(providerId);
      return { kind: 'ok', value: undefined };
    }
    if (waitingRequests.delete(requestId)) {
      return { kind: 'ok', value: undefined };
    }
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'unknown_concurrency_slot',
        `A(z) "${requestId}" azonosítóhoz nem tartozik sem foglalt hely, sem várakozó kérés`,
      ),
    };
  }

  return { requestSlot, releaseSlot, occupiedSlotCount, waitingRequestCount };
}
