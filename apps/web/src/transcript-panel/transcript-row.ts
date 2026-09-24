import type { RunEventRecord } from '@easter-workflow-builder/protocol';

/**
 * A transcript lista egy sora (SPEC-008 7.5, PLAN-009 T-009-26): vagy
 * perzisztált `run_event` sor, vagy élő, átmeneti (`run_event_transient`)
 * keretből épült sor. A két forrás a `source` mezőn különül el, és a panel
 * ebből dönti el, hogy a sort átmenetiként megjelöli-e.
 *
 * **A `key` a lista React kulcsa.** Perzisztált sornál az esemény
 * azonosítójából képződik (`event-<id>`); átmeneti sornál a transcript
 * kliens oldali, monoton `transientSequence` számlálójából
 * (`transient-<n>`), mert az átmeneti keretnek nincs azonosítója (SPEC-008
 * M-64, 7.5 3. szabály). A két előtag miatt a két kulcstér nem ütközhet.
 *
 * **Az átmeneti sor `record` mezője azonosító NÉLKÜLI rekord alak**, mert a
 * keretnek nincs `id` mezője, és egy kitalált azonosító összekeverhető
 * volna a perzisztált sorokéval (`to-transient-row-record.ts`).
 */
export type TranscriptRow =
  | {
      readonly source: 'persisted';
      readonly key: string;
      readonly record: RunEventRecord;
    }
  | {
      readonly source: 'transient';
      readonly key: string;
      readonly record: Omit<RunEventRecord, 'id'>;
    };
