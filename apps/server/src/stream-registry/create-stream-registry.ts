import type { RunSubscriptionEntry } from '@easter-workflow-builder/protocol';
import type { IdGeneratorPort } from '@easter-workflow-builder/engine';
import type { RunSignal } from './run-signal.ts';

/**
 * Egy nyitott `/events` kapcsolat visszahívásai (`stream-connection` téma
 * regisztrálja). A `stream-registry` ezen keresztül szól a kapcsolatnak,
 * bájtot maga sosem ír (SPEC-006 6.1 táblázat).
 */
export interface StreamConnectionListener {
  /**
  A feliratkozás teljes cseréje történt erre a `streamId`-re (a `PUT` végpont hívása után).
  */
  onReplaced(entries: readonly RunSubscriptionEntry[]): void;
  /**
  Egy figyelt futáshoz új adat kerülhetett az adatbázisba, vagy élő, nem perzisztált üzenet érkezett.
  */
  onSignal(signal: RunSignal): void;
  /**
  A szerver kényszeríti a kapcsolat lezárását (szabályos leállás, SPEC-006 8.1 3. lépés).
  */
  forceClose(): void;
}

/**
 * A feliratkozás nyilvántartás és a kapcsolatok pub-sub csomópontja
 * (SPEC-006 6.1, 6.2 szekció). Memóriában él, a folyamattal együtt vész el
 * - a `serverInstanceId` ezt teszi láthatóvá a kliensnek.
 */
export interface StreamRegistry {
  readonly serverInstanceId: string;
  /**
  Az adott `streamId`-hez tartozó, jelenleg beállított feliratkozás lista. Ismeretlen `streamId`-ra üres lista.
  */
  getSubscriptions(streamId: string): readonly RunSubscriptionEntry[];
  /**
  Teljes csere: a kérés a feliratkozás teljes, kívánt állapotát írja le (SPEC-005 4.2 F táblázat 26. sora).
  */
  replaceSubscriptions(streamId: string, entries: readonly RunSubscriptionEntry[]): void;
  /**
  Egy `/events` kapcsolat regisztrálása; a visszaadott függvény a leiratkozás.
  */
  openConnection(streamId: string, listener: StreamConnectionListener): () => void;
  /**
  A motor `eventPublisher` jelzése: a `runId` futáshoz új adat kerülhetett az adatbázisba.
  */
  notifyRunChanged(signal: RunSignal): void;
  /**
  Minden nyitott kapcsolat kényszerített lezárása (SPEC-006 8.1 3. lépés).
  */
  closeAllConnections(): void;
}

/**
 * A `StreamRegistry` létrehozása (SPEC-006 9.1 `stream-registry` téma). A
 * `serverInstanceId` induláskor, egyszer generálódik az `idGenerator`
 * porton át, tehát a teszt determinisztikus (SPEC-006 6.1 "Az azonosítót a
 * szerver induláskor egyszer generálja").
 */
export function createStreamRegistry(idGenerator: IdGeneratorPort): StreamRegistry {
  const serverInstanceId = idGenerator.nextId();
  const subscriptions = new Map<string, Map<string, RunSubscriptionEntry>>();
  const connections = new Map<string, Set<StreamConnectionListener>>();

  function getSubscriptions(streamId: string): readonly RunSubscriptionEntry[] {
    const runMap = subscriptions.get(streamId);
    return runMap === undefined ? [] : runMap.values().toArray();
  }

  function replaceSubscriptions(streamId: string, entries: readonly RunSubscriptionEntry[]): void {
    subscriptions.set(streamId, new Map(entries.map((entry) => [entry.runId, entry])));
    const listeners = connections.get(streamId) ?? [];
    for (const listener of listeners) {
      listener.onReplaced(entries);
    }
  }

  function openConnection(streamId: string, listener: StreamConnectionListener): () => void {
    const listeners = connections.get(streamId) ?? new Set<StreamConnectionListener>();
    listeners.add(listener);
    connections.set(streamId, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  function notifyRunChanged(signal: RunSignal): void {
    for (const [streamId, runMap] of subscriptions) {
      if (!runMap.has(signal.runId)) {
        continue;
      }
      const listeners = connections.get(streamId) ?? [];
      for (const listener of listeners) {
        listener.onSignal(signal);
      }
    }
  }

  function closeAllConnections(): void {
    for (const listeners of connections.values()) {
      for (const listener of listeners) {
        listener.forceClose();
      }
    }
    connections.clear();
  }

  return {
    serverInstanceId,
    getSubscriptions,
    replaceSubscriptions,
    openConnection,
    notifyRunChanged,
    closeAllConnections,
  };
}
