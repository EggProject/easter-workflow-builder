import type { Fact } from '../evidence/fact.ts';

export interface StreamingCapability {
  readonly sse: Fact<boolean>;
  /**
  Q7: milyen alakban érkezik a tool argumentum.
  */
  readonly toolInputDelta: Fact<'input_json_delta' | 'whole_input_in_content_block_start' | 'other'>;
  /**
  Q7: az SDK helyesen rakja-e össze a tool inputot. Bájtszintű összevetés eredménye.
  */
  readonly sdkReassemblesToolInput: Fact<boolean>;
  /**
  Nem-first-party base URL mellett az SDK kikapcsolja.
  */
  readonly fineGrainedToolStreaming: Fact<boolean>;
  /**
   * Kikapcsolható-e a kimenő kérés `stream` mezője. Ez SDK szintű tulajdonság,
   * nem a provideré: ha az `Options` típusban nincs ilyen mező, a nem stream
   * válasz `usage` objektuma ezen az úton nem figyelhető meg.
   */
  readonly streamDisableable: Fact<boolean>;
}
