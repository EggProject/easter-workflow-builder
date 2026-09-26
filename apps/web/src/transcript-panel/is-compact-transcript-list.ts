import { COLLAPSED_TRANSCRIPT_ROW_HEIGHT } from './collapsed-transcript-row-height.ts';

/**
 * Szűk-e a transcript lista a lebegő "ugrás az aljára" gombhoz (user döntés
 * 2026-09-25, SPEC-008 7.4, a 14.1 O-15 lezárása): igaz, ha a lista látható
 * magassága kisebb, mint a felső belső margó plusz egy összecsukott sor.
 * Ekkora listán a margó után egy sornál kevesebb marad, és a gomb a látható
 * sort takarná, ezért a gomb nem lebeg, hanem a lista mellett áll
 * (`transcript-panel.css`).
 *
 * A feltétel a `react-window` `onResize` méretéből dől el, nem a DOM-ból: a
 * könyvtár a `ResizeObserver` `contentRect` értékét adja át, ami a belső
 * margót NEM tartalmazza (MDN "contentRect": "the element's content box";
 * `transcript-panel.css`, research 21. szekció). "A lista magassága kisebb,
 * mint a margó plusz egy sor" tehát pontosan az, hogy a tartalom doboza
 * kisebb egy sornál; kitalált küszöb nincs, a sor magassága a mért
 * konstans (`collapsed-transcript-row-height.ts`).
 */
export function isCompactTranscriptList(listContentSize: Readonly<{ height: number }>): boolean {
  return listContentSize.height < COLLAPSED_TRANSCRIPT_ROW_HEIGHT;
}
