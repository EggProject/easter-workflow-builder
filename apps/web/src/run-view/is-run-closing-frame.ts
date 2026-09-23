import type { RunEventKind, StreamFrame } from '@easter-workflow-builder/protocol';

/**
 * Lezárja-e a futást az adott motor esemény fajta (SPEC-003 7.1, SPEC-004
 * 13. szekció táblázata).
 *
 * A futás állapotgépének négy terminális állapota van (`succeeded`,
 * `failed`, `cancelled`, `interrupted`), és mindegyikbe pontosan egy esemény
 * fajta visz:
 *
 * - `run_finished`: a `succeeded`, a `failed` és a felhasználói megszakítás
 *   utáni `cancelled` állapot (SPEC-004 9. 5. pontja, 13. szekció).
 * - `run_interrupted`: az `interrupted` állapot, az indulási helyreállítás
 *   és a szabályos leállás útján is (SPEC-004 10.1, 10.2).
 *
 * A többi huszonhárom érték nem lezáró: a `run_started` a futás létrejötte,
 * a lépés, ág, ciklus, jóváhagyás és al-workflow események a futáson BELÜLI
 * változások (az `sub_workflow_finished` a GYEREK futás lezárása, a szülő
 * futás tovább fut), az `sdk_*` események pedig az ügynök üzenetei.
 *
 * Kimerítő `switch`, `default` ág nélkül: a `switch-exhaustiveness-check`
 * szabály miatt egy új `RunEventKind` érték felvétele a `protocol`
 * csomagban itt lint hibát ad, és a TypeScript a hiányzó visszatérési ág
 * miatt fordítási hibát, tehát az új érték nem maradhat csendben besorolatlan.
 */
function isRunClosingKind(kind: RunEventKind): boolean {
  switch (kind) {
    case 'run_finished':
    case 'run_interrupted': {
      return true;
    }
    case 'run_started':
    case 'step_started':
    case 'step_finished':
    case 'branch_taken':
    case 'fan_out_expanded':
    case 'join_resolved':
    case 'loop_iteration_started':
    case 'approval_requested':
    case 'approval_decided':
    case 'sub_workflow_started':
    case 'sub_workflow_finished':
    case 'sdk_system':
    case 'sdk_assistant':
    case 'sdk_user':
    case 'sdk_stream_event':
    case 'sdk_result':
    case 'sdk_hook_started':
    case 'sdk_hook_progress':
    case 'sdk_hook_response':
    case 'sdk_informational':
    case 'sdk_commands_changed':
    case 'sdk_rate_limit':
    case 'sdk_context_usage': {
      return false;
    }
  }
}

/**
 * Az ADOTT futás lezárását jelző SSE keret-e (`isRunClosingKind`).
 *
 * Kizárólag a `run_event` keretet fogadja el: a `run_event_transient` keret
 * definíció szerint az, aminek nincs perzisztált sora (SPEC-005 5.4, 6.3), a
 * futás lezárása pedig mindig perzisztált esemény, ugyanabban a
 * tranzakcióban, amiben a futás sora terminálisra vált (SPEC-004 9. 5.
 * pontja, 10.1). A `runId` egyezés azért kell, mert egyetlen stream
 * kapcsolat több futásra is fel lehet iratkozva (SPEC-005 5.2).
 */
export function isRunClosingFrame(frame: StreamFrame, runId: string): boolean {
  return frame.event === 'run_event' && frame.runEvent.runId === runId && isRunClosingKind(frame.runEvent.kind);
}
