import type { RunEventKind, StreamFrame } from '@easter-workflow-builder/protocol';

/**
 * Azok a motor esemény fajták, amelyek kiírását egy `step_run` sor
 * változása ELŐZI meg (SPEC-008 6.2, PLAN-009 T-009-25a). A motor minden
 * eseményt az adatbázis módosítása UTÁN ír, és a kiírt sort küldi ki élőben
 * (`packages/engine` `emit-engine-event.ts`, `apps/server`
 * `handle-stream-connection.ts`), tehát egy ilyen keret megérkezésekor a
 * `GET /api/runs/{runId}/steps` válasza már a megváltozott sort adja.
 *
 * - `step_started`: `createStepRun` és `markStepRunning` (`begin-step-run.ts`,
 *   `agent-node-lifecycle.ts`).
 * - `step_finished`: `markStepSucceeded`/`markStepFailed`, illetve a
 *   jóváhagyás döntése (`finish-step-run-*.ts`, `execute-human-approval.ts`).
 * - `approval_requested`: a `requestApproval` a lépést `waiting_approval`
 *   állapotba viszi (`packages/db` `human-approval-repository.ts`).
 * - `sub_workflow_started`: `attachSubWorkflowRun`, ettől lesz a kártyán
 *   al-workflow link (`execute-sub-workflow.ts`).
 * - `run_finished`: a megszakítás (`cancelRunTree`) minden nem terminális
 *   lépést `cancelled` állapotba visz, lépés szintű esemény nélkül
 *   (`packages/db` `run-recovery.ts`).
 * - `run_interrupted`: a helyreállítás ugyanígy `interrupted` állapotba
 *   viszi őket (`packages/db` `run-recovery.ts`).
 *
 * Az ügynök lépés a párhuzamossági helyre várva `pending` sorként jön létre,
 * esemény nélkül (`agent-node-lifecycle.ts`): ezt az állapotot a rajz a
 * következő jelző keretig nem mutatja (SPEC-008 6.2).
 */
const STEP_RUN_CHANGING_KINDS: ReadonlySet<RunEventKind> = new Set([
  'step_started',
  'step_finished',
  'approval_requested',
  'sub_workflow_started',
  'run_finished',
  'run_interrupted',
]);

/**
 * Jelzi-e a keret, hogy a nézett futás lépés futás listája megváltozhatott,
 * tehát újra kell tölteni (SPEC-008 6.2, T-009-25a).
 *
 * **A pótolt (`replayed`) keret nem jelez, a pótlás végét jelző
 * `replay_complete` viszont igen.** A szerver a futás összes pótolt keretét
 * egy menetben írja ki, és a végén szinkron küldi a `replay_complete`
 * keretet (`apps/server` `handle-stream-connection.ts` `replayRun`), tehát
 * az erre indított EGYETLEN újratöltés a pótlásban szereplő minden változást
 * tartalmazza. Így egy tetszőleges hosszú pótlás pontosan egy újratöltést ad,
 * és az újracsatlakozás utáni pótlás (SPEC-005 5.6) is ugyanezen az úton
 * frissít.
 *
 * Az átmeneti (`run_event_transient`) keretnek nincs perzisztált sora, a
 * `step_run` változását pedig mindig perzisztált motor esemény követi; a
 * `stream_ready` és a `protocol_error` a lépés futásokról nem mond semmit.
 */
export function isStepRunListChangeFrame(frame: StreamFrame, runId: string): boolean {
  switch (frame.event) {
    case 'run_event': {
      return (
        frame.delivery === 'live' && frame.runEvent.runId === runId && STEP_RUN_CHANGING_KINDS.has(frame.runEvent.kind)
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
