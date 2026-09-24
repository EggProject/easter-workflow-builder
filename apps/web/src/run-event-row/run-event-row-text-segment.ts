/**
 * Egy transcript sor szövegének egy darabja (user döntés 2026-09-24, SPEC-008
 * 7.2 1. pont). A két fajta a design system két betűszerepe:
 *
 * - `code`: a meta, vagyis időbélyeg, eszköznév, azonosító (`toolUseId`,
 *   `parentToolUseId`, és az SDK gépi értékei: altípus, hook név, esemény
 *   típus, állapot) és szám (token számok, költség, `numTurns`). A design
 *   system Code szerepével jelenik meg (`--ep-text-code`, JetBrains Mono),
 *   mert a DESIGN.md szerint a mono "is reserved for code, tokens, timestamps
 *   and numeric meta".
 * - `text`: a sor szövege (eredet, címke, összefoglaló), a törzs betűjével.
 *
 * A darabok sorrendben összefűzve adják a sor teljes szövegét, szóközökkel
 * együtt, tehát a gomb hozzáférhető neve a darabolástól független.
 */
export interface RunEventRowTextSegment {
  readonly kind: 'text' | 'code';
  readonly text: string;
}
