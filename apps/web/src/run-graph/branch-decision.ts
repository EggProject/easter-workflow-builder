/**
 * Egy `branch` csomópont egyetlen döntése, a nézett futás egy `branch_taken`
 * motor eseményéből (SPEC-008 6.6, 87.).
 *
 * - `eventId`: a `run_event.id`; a gyűjtés kulcsa (a kétszer érkező keret
 *   egyszer számít), és a "legutóbbi" döntés ezen a sorrenden a legnagyobb.
 * - `stepRunId`: a döntést hozó lépés futás; a csomópont a lépés futás lista
 *   ennek megfelelő sorának `nodeId` mezőjéből jön
 *   (`group-branch-decisions-by-node.ts`).
 * - `branchKey`: a payload kulcsa; `null`, ha a motor az alapértelmezett ágra
 *   lépett (SPEC-008 2.8, a `branch_taken` payload sora).
 * - `usedDefault`: a payload jelzője, hogy az alapértelmezett ágra lépett-e.
 *
 * **Típus-only fájl, nincs `.spec.ts` párja** (`apps/web/CLAUDE.md` ## Fájlok
 * konvenció): futásidejű kód nélkül.
 */
export interface BranchDecision {
  readonly eventId: number;
  readonly stepRunId: string;
  readonly branchKey: string | null;
  readonly usedDefault: boolean;
}
