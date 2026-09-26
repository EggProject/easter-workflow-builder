import { createContext } from 'react';

/**
 * Látszik-e a futás nézet transcript oldala (2026-09-25). A két osztott
 * sávban mindig igen; a fül sávban csak akkor, ha a "Transcript" fül az
 * aktív (`RunViewLayout`). A `RunViewTranscriptSide` csak látható oldalon
 * fedi fel a jóváhagyás kérdését: egy rejtett fül panelje nulla méretű, tehát
 * ott nincs mit mérni, és a felfedés a fül megnyitásakor indul (a
 * `Resizable` a rejtett oldalt nem látja, `ResizeObserver` a csomagban
 * tiltott, SPEC-007 16. szekció 24. kritérium).
 */
export const RunViewTranscriptVisibility = createContext(true);
