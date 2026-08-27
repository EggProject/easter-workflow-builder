import type { MeasurementId } from '../../evidence/evidence-reference/measurement-id.ts';

/**
Egy mérési azonosító docs horgonya: a jegyzőkönyv fájl relatív útja és a pontos fejléc szövege.
*/
export interface MeasurementDocumentAnchor {
  readonly file: string;
  readonly heading: string;
}

const MEASUREMENT_JOURNAL = 'docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md';

/**
 * `MeasurementId` -> docs horgony leképezés. Csak a leírókban ténylegesen
 * hivatkozott azonosítókat tartalmazza. A mérés prózai leírása a horgonyzott
 * fejléc alatt van a jegyzőkönyvben, nem itt.
 */
export const measurementDocument: Readonly<Partial<Record<MeasurementId, MeasurementDocumentAnchor>>> = {
  'M-01': { file: MEASUREMENT_JOURNAL, heading: 'M-01 Alap body és header leltár' },
  'M-02': { file: MEASUREMENT_JOURNAL, heading: 'M-02 `outputFormat` drótalakja' },
  'M-03': { file: MEASUREMENT_JOURNAL, heading: 'M-03 `tool_choice` az `outputFormat` záró fázisában' },
  'M-04': { file: MEASUREMENT_JOURNAL, heading: 'M-04 `output_config` és `effort` kapcsolata' },
  'M-05': { file: MEASUREMENT_JOURNAL, heading: 'M-05 `thinking` bekapcsolva' },
  'M-06': { file: MEASUREMENT_JOURNAL, heading: 'M-06 `thinking` kikapcsolva' },
  'M-07': { file: MEASUREMENT_JOURNAL, heading: 'M-07 Háttér modellhívások' },
  'M-08': { file: MEASUREMENT_JOURNAL, heading: 'M-08 Env kapcsoló mátrix' },
  'M-09': { file: MEASUREMENT_JOURNAL, heading: 'M-09 Tool argumentum streaming' },
  'M-10': { file: MEASUREMENT_JOURNAL, heading: 'M-10 `Stop` hook kikényszerítés' },
  'M-11': { file: MEASUREMENT_JOURNAL, heading: 'M-11 `[1m]` suffix kezelése' },
  'M-12': { file: MEASUREMENT_JOURNAL, heading: 'M-12 Nem-Messages végpontok' },
  'M-13': { file: MEASUREMENT_JOURNAL, heading: 'M-13 Kontextusablak és auto-compact' },
  'M-14': { file: MEASUREMENT_JOURNAL, heading: 'M-14 `anthropic-beta` header leltár' },
  'M-15': { file: MEASUREMENT_JOURNAL, heading: 'M-15 Prompt caching drótalak' },
  'M-16': { file: MEASUREMENT_JOURNAL, heading: 'M-16 Kép bemenet' },
  'M-17': { file: MEASUREMENT_JOURNAL, heading: 'M-17 Szerver oldali tool' },
  'M-18': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-18 Hiba és rate limit header leltár (passzív)',
  },
  'M-19': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-19 `Stop` hook kikényszerítés emit_output említése nélkül',
  },
  'M-20': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-20 Kontextusablak felső korlátja bináris kereséssel',
  },
  'M-21': { file: MEASUREMENT_JOURNAL, heading: 'M-21 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` hatása' },
  'M-22': { file: MEASUREMENT_JOURNAL, heading: 'M-22 `CLAUDE_CODE_MAX_OUTPUT_TOKENS` felső korlátja' },
  'M-23': { file: MEASUREMENT_JOURNAL, heading: 'M-23 Kép bemenet felismerhető tartalommal' },
  'M-24': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-24 Prompt cache írás igazolása stream nélküli móddal',
  },
  'M-25': { file: MEASUREMENT_JOURNAL, heading: 'M-25 Szerver oldali tool magasabb `maxTurns` mellett' },
  'M-26': { file: MEASUREMENT_JOURNAL, heading: 'M-26 `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` hatása' },
  'M-29': {
    file: MEASUREMENT_JOURNAL,
    heading:
      'M-29 `ANTHROPIC_DEFAULT_HAIKU_MODEL` suffix nélkül, `ANTHROPIC_DEFAULT_SONNET_MODEL`/`ANTHROPIC_DEFAULT_OPUS_MODEL` suffixszel',
  },
  'M-31': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-31 `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` konkurrens subagentekkel',
  },
  'M-32': { file: MEASUREMENT_JOURNAL, heading: 'M-32 A teljes felhasználói parancs env változói együtt' },
  'M-33': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-33 `promptCaching.mode` -- implicit és explicit szétválasztási kísérlet',
  },
  'M-34': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-34 `toolChoice.rejectionBehaviour` közvetlen HTTP hívással',
  },
  'M-35': { file: MEASUREMENT_JOURNAL, heading: 'M-35 `listedByModelsEndpoint` közvetlen HTTP hívással' },
  'M-36': {
    file: MEASUREMENT_JOURNAL,
    heading: 'M-36 Rate limit header leltár (M-26 - M-35 kör, passzív)',
  },
};
