import type { RunEventTransientFrame } from '@easter-workflow-builder/protocol';

/**
 * A motor `eventPublisher.publish` hívásából származó JELZÉS (SPEC-006 6.5
 * szekció, "jelzés és lecsapolás" minta): a kiadott érték nem hordozza a
 * `run_event.id` mezőt (M-32), ezért a szerver a `runId` alapján lecsapol az
 * adatbázisból, nem a kiadott értéket küldi tovább.
 *
 * A `transientFrame` a `run_event_transient` keret KÉSZ, a `publish` hívás
 * pillanatában felépített jelöltje - kizárólag akkor kap értéket, ha az
 * eredeti kiadott érték `AgentStreamMessage` volt (SPEC-004 M-31): ha a
 * lecsapolás nem talál új sort erre a futásra (mert az üzenet nem
 * perzisztálódott, SPEC-005 6.1 táblázat "kikapcsolt kapcsoló" sora), a
 * kapcsolat ezt küldi ki helyette (O-6 elfogadott megoldása, SPEC-006 6.5).
 * `EngineEvent` eredetű jelzésnél `undefined`, mert M-32 szerint a motor a
 * `publish` hívást az írás UTÁN teszi, tehát a lecsapolás mindig talál sort.
 */
export interface RunSignal {
  readonly runId: string;
  readonly transientFrame: RunEventTransientFrame | undefined;
}
