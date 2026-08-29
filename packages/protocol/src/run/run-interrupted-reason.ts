import { z } from 'zod';

/**
 * A `run_interrupted` esemény payloadjának oka (SPEC-004 13. szekció
 * táblázat, a `packages/db` `RunInterruptedReason` típusa,
 * `run-recovery/run-recovery.ts`). A `protocol` L1, tehát a `db` (L2)
 * típusát nem importálhatja: szándékos duplikáció, önálló `z.enum` alakban -
 * ez a hat sodródás védett felsorolás egyike (SPEC-005 7.6: "... és a
 * megszakítás okát"), a sodródás védelmét az `apps/server` regressziós
 * tesztje adja (T-006-12). A `run_event.payload` maga `z.unknown()` marad
 * (SPEC-005 T-006-7), mert a payload alakja `kind`-onként eltér; ez a séma
 * önmagában a drótszintű felsorolás sodródás elleni védelméhez kell, nem
 * egy konkrét mező típusához.
 */
export const RunInterruptedReasonSchema = z.enum(['startup_recovery', 'graceful_shutdown']);

export type RunInterruptedReason = z.infer<typeof RunInterruptedReasonSchema>;
