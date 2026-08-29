import type { ClockPort, EventPublisherPort } from '@easter-workflow-builder/engine';
import type { StreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { classifyPublishedEvent } from './classify-published-event.ts';

/**
 * A valódi `eventPublisher` port (SPEC-004 3.2 táblázat, `eventPublisher`
 * sor; SPEC-006 6.5 szekció): a motor kiadott értékét a `stream-registry`
 * jelzésére alakítja, ami minden érdeklődő, nyitott `/events` kapcsolatot
 * lecsapolásra készteti. A `create-noop-event-publisher.ts` ezzel a
 * lépéssel megszűnt: az SSE réteg elkészült, a korábbi, semmit sem tevő
 * burkolóra már nincs szükség.
 */
export function createRealEventPublisher(registry: StreamRegistry, clock: ClockPort): EventPublisherPort {
  return {
    publish: (event) => {
      const signal = classifyPublishedEvent(event, clock.nowMs());
      if (signal === undefined) {
        return;
      }
      registry.notifyRunChanged(signal);
    },
  };
}
