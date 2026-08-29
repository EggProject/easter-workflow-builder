import { describe, expect, expectTypeOf, it } from 'vitest';
import { isApprovalDecision, isRunEventKind } from '@easter-workflow-builder/db';
import type {
  ApprovalDecision as DatabaseApprovalDecision,
  NodeType as DatabaseNodeType,
  RunEventKind as DatabaseRunEventKind,
  RunInterruptedReason as DatabaseRunInterruptedReason,
  RunStatus as DatabaseRunStatus,
  StepRunStatus as DatabaseStepRunStatus,
} from '@easter-workflow-builder/db';
import { ApprovalDecisionSchema, RunEventKindSchema } from '@easter-workflow-builder/protocol';
import type {
  ApprovalDecision as ProtocolApprovalDecision,
  NodeType as ProtocolNodeType,
  RunEventKind as ProtocolRunEventKind,
  RunInterruptedReason as ProtocolRunInterruptedReason,
  RunStatus as ProtocolRunStatus,
  StepRunStatus as ProtocolStepRunStatus,
} from '@easter-workflow-builder/protocol';

/**
 * A hat drótszintű felsorolás sodródás elleni védelme (SPEC-005 7.6 szekció,
 * PLAN-006 T-006-12). A `packages/protocol` L1 réteg, tehát nem
 * importálhatja a `packages/db` L2 réteg felsorolásait (SPEC-002 4.
 * szekció) - mindkét oldal önállóan deklarálja ugyanazt a hat halmazt. Az
 * `apps/server` az egyetlen csomag, ahol a két oldal egyszerre látszik,
 * ezért a védelem ide kerül.
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja**
 * (`enum-drift-protection.ts` nem létezik): a mappa neve azt nevezi meg,
 * amit őriz, ugyanaz a minta, mint a `tooling/scripts/src/turbo-e2e-coverage-outputs/`
 * és a `packages/db/src/sqlite-connection/barrel-exports.spec.ts` fájl
 * (`.claude/CLAUDE.md` 5. szekció "Van megvalósítás nélküli regressziós
 * teszt is"). A lefedettségi mérleget ezért ez a fájl nem érinti (SPEC-005
 * 10.3 szekció).
 *
 * **A típusszintű ág az erős védelem** (SPEC-005 7.6 1. pont): az
 * `expectTypeOf(...).toEqualTypeOf<...>()` hívás futásidőben csendben nem
 * csinál semmit, kizárólag a TypeScript fordító dönt a generikus
 * paraméterek illeszkedéséről. Ha a két oldal uniója akár egyetlen
 * értékben is eltér, a `bun run typecheck` kapu fordítási hibával bukik -
 * a védelem tehát nem attól függ, hogy ez a `.spec.ts` lefut-e Vitesttel,
 * hanem attól, hogy a fájl egyáltalán lefordul-e. Ezt a viselkedést a
 * végrehajtás során manuálisan is igazoltuk: egy pillanatra szándékosan
 * elrontott értéket (`'not_a_real_status'`) illesztve az egyik oldalra a
 * `bun run typecheck` valóban `TS2344`-es hibával bukott, majd az eredeti
 * tartalom visszaállítása után újra zöld lett.
 */
describe('a protokoll és a db hat drótszintű felsorolása kétirányban megegyezik', () => {
  it('RunStatus', () => {
    expectTypeOf<ProtocolRunStatus>().toEqualTypeOf<DatabaseRunStatus>();
  });

  it('StepRunStatus', () => {
    expectTypeOf<ProtocolStepRunStatus>().toEqualTypeOf<DatabaseStepRunStatus>();
  });

  it('NodeType', () => {
    expectTypeOf<ProtocolNodeType>().toEqualTypeOf<DatabaseNodeType>();
  });

  it('RunEventKind', () => {
    expectTypeOf<ProtocolRunEventKind>().toEqualTypeOf<DatabaseRunEventKind>();
  });

  it('ApprovalDecision', () => {
    expectTypeOf<ProtocolApprovalDecision>().toEqualTypeOf<DatabaseApprovalDecision>();
  });

  it('RunInterruptedReason', () => {
    expectTypeOf<ProtocolRunInterruptedReason>().toEqualTypeOf<DatabaseRunInterruptedReason>();
  });
});

/**
 * Ahol a `db` futásidejű guardot is exportál (`isRunEventKind`,
 * `isApprovalDecision`), a futásidejű ág is fut (SPEC-005 7.6 2. pont): a
 * protokoll séma minden felsorolt értékének át kell mennie a `db` guardján.
 * A `NodeType`, a `RunStatus`, a `StepRunStatus` és a `RunInterruptedReason`
 * oldalán a `db` nem exportál guardot (SPEC-003 4.2, 7.1, 7.2 szekció: ezek
 * a repository határon nem futásidejű guarddal, hanem a `compare and set`
 * állapotgép `WHERE` feltételével szűkülnek), ezért azokra nincs futásidejű
 * teszteset - a típusszintű ág önmagában is teljes védelem (16. sor fenti
 * megjegyzés).
 */
describe('ahol a db futásidejű guardot exportál, a protokoll minden felsorolt értéke átmegy rajta', () => {
  it('isRunEventKind elfogadja a protokoll mind a 25 RunEventKind értékét', () => {
    for (const value of RunEventKindSchema.options) {
      expect(isRunEventKind(value)).toBe(true);
    }
  });

  it('isApprovalDecision elfogadja a protokoll mindkét ApprovalDecision értékét', () => {
    for (const value of ApprovalDecisionSchema.options) {
      expect(isApprovalDecision(value)).toBe(true);
    }
  });
});
