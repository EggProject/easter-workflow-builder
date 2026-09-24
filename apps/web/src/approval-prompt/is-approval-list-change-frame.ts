import type { RunEventKind, StreamFrame } from '@easter-workflow-builder/protocol';

/**
 * Azok a motor esemény fajták, amelyek kiírását a nézett futás függő
 * jóváhagyás listájának változása ELŐZI meg (SPEC-008 8. szekció, T-009-27).
 * A motor minden eseményt az adatbázis módosítása UTÁN ír
 * (`packages/engine` `emit-engine-event.ts`), tehát egy ilyen keret
 * megérkezésekor a `GET /api/approvals` válasza már a megváltozott listát
 * adja. Függő az a jóváhagyás, aminek a lépése `waiting_approval` állapotú
 * (SPEC-008 8. szekció, SPEC-003 4.12).
 *
 * - `approval_requested`: új jóváhagyás került a listára
 *   (`execute-human-approval.ts`, a `requestApproval` után).
 * - `step_finished` és `approval_decided`: döntés érkezett, bármelyik
 *   klienstől; a motor ugyanabban a menetben mindkettőt kiírja
 *   (`execute-human-approval.ts` 8. pont), a lejárat pedig csak
 *   `step_finished` eseményt ad (`finish-step-run-failed.ts`).
 * - `run_finished` és `run_interrupted`: a megszakítás, a `fail_run` és a
 *   szabályos leállás a várakozó lépéseket lépés szintű esemény NÉLKÜL zárja
 *   le (`packages/engine` `close-waiting-approval-step-runs.ts`).
 */
const APPROVAL_LIST_CHANGING_KINDS: ReadonlySet<RunEventKind> = new Set([
  'approval_requested',
  'approval_decided',
  'step_finished',
  'run_finished',
  'run_interrupted',
]);

/**
 * Jelzi-e a keret, hogy a nézett futás függő jóváhagyás listája
 * megváltozhatott, tehát újra kell tölteni (SPEC-008 8. szekció, T-009-27).
 *
 * Ugyanaz a szabály, mint a lépés futás listánál
 * (`run-view/is-step-run-list-change-frame.ts`, T-009-25a): a pótolt
 * (`replayed`) keret nem jelez, a pótlás végét jelző `replay_complete` viszont
 * igen, mert a szerver a pótlás minden keretét egy menetben küldi, és a
 * végén szinkron a `replay_complete` keretet; így egy tetszőleges hosszú
 * pótlás, és a szerver újraindulása utáni újra feliratkozás pótlása is,
 * pontosan egy újratöltést ad. Az átmeneti keretnek nincs perzisztált sora, a
 * `stream_ready` és a `protocol_error` a jóváhagyásokról nem mond semmit.
 */
export function isApprovalListChangeFrame(frame: StreamFrame, runId: string): boolean {
  switch (frame.event) {
    case 'run_event': {
      return (
        frame.delivery === 'live' &&
        frame.runEvent.runId === runId &&
        APPROVAL_LIST_CHANGING_KINDS.has(frame.runEvent.kind)
      );
    }
    case 'replay_complete': {
      return frame.runId === runId;
    }
    case 'run_event_transient':
    case 'stream_ready':
    case 'protocol_error': {
      return false;
    }
  }
}
