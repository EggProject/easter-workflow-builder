import { useEffect, useState } from 'react';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import type { BranchDecision } from './branch-decision.ts';
import { readBranchDecision } from './read-branch-decision.ts';

const EMPTY_BRANCH_DECISIONS: ReadonlyMap<number, BranchDecision> = new Map();

/**
 * A nézett futás `branch_taken` döntései, az esemény `id` mezője szerint
 * kulcsolva (SPEC-008 6.6, 87.): ebből jön az ág kiemelés és az
 * alapértelmezett ág jelvény adata.
 *
 * **Keretenként, függvény alakú állapotfrissítéssel.** A keretek a
 * veszteségmentes `subscribeToFrames` úton jönnek, és minden döntés a saját
 * frissítő függvényén át kerül a térképbe, mert egy "legutóbbi érték" alakú
 * állapot egy löketben érkező keretsorozatból csak az utolsót adná át
 * (`.claude/CLAUDE.md` 12. szekció, "Frontend állapot és layout").
 *
 * **A kétszer érkező `id` egyszer számít.** A szerver újraindulása utáni
 * újrafeliratkozás a pótlást elölről kezdi (SPEC-005 5.2), tehát ugyanaz a
 * keret újra megérkezhet; ilyenkor a frissítő a korábbi térképet adja vissza,
 * és a React nem renderel újra.
 *
 * A képernyő ezt a hookot a futásra való szerver oldali feliratkozás ELŐTT
 * hívja, így a pótlás egyetlen kerete sem érkezhet feliratkozó nélkül. Másik
 * futásra váltáskor a térkép kiürül, a `useLiveStepRuns` mintájára.
 */
export function useBranchDecisions(
  runId: string | undefined,
  subscribeToFrames: SubscribeToStreamFrames,
): ReadonlyMap<number, BranchDecision> {
  const [decisions, setDecisions] = useState<ReadonlyMap<number, BranchDecision>>(EMPTY_BRANCH_DECISIONS);

  useEffect(() => {
    setDecisions(EMPTY_BRANCH_DECISIONS);
  }, [runId]);

  useEffect(() => {
    if (runId === undefined) {
      return;
    }
    return subscribeToFrames((frame) => {
      const decision = readBranchDecision(frame, runId);
      if (decision === undefined) {
        return;
      }
      setDecisions((previous) =>
        previous.has(decision.eventId) ? previous : new Map(previous).set(decision.eventId, decision),
      );
    });
  }, [runId, subscribeToFrames]);

  return decisions;
}
