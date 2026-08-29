import type { EventPublisherPort } from '@easter-workflow-builder/engine';

/**
 * Ideiglenes, semmit sem tevő `eventPublisher` port (SPEC-004 3.2 táblázat,
 * `eventPublisher` sor). A valódi élő WebSocket/SSE nézet (SPEC-005 5.
 * szekció, `stream-registry`/`stream-connection` téma) ebben a lépésben
 * NEM készült el - ez explicit, dokumentált hiány (lásd a záró jelentés
 * hiánylistáját), nem elfogadott végállapot. A motor kilenc portja
 * kötelező, alapérték nélküli (SPEC-004 3.2), tehát a szerver indulásához
 * MOST ez a burkoló szükséges; a `publish` hívás célba nem ér, amíg a
 * stream réteg el nem készül.
 */
export function createNoopEventPublisher(): EventPublisherPort {
  return {
    publish: () => {
      // szándékosan üres: lásd a fájl fejlécének indoklását
    },
  };
}
