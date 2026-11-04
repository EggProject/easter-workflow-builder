import { z } from 'zod';

/**
 * A `timeoutMs` mező felső határa (SPEC-014 5.3): a Node `setTimeout` ennél
 * nagyobb késleltetést 1 ms-re állít, tehát a korlát azonnal lejárna (research
 * J-16, `docs/research/2026-11-03-szkript-kimenet-ertektipus.md`). A
 * `packages/db` azonos nevű konstansának SZÁNDÉKOS duplikátuma
 * (`.claude/CLAUDE.md` 5. szekció); a két érték egyezését az `apps/server`
 * `node-config-drift-protection` regressziós tesztje őrzi.
 */
export const MAX_SCRIPT_TIMEOUT_MS = 2_147_483_647;

/**
 * A `memoryLimitMb` mező alsó határa (SPEC-014 5.3): a pinelt QuickJS
 * WebAssembly modul a deklarált kezdő méreténél (16 MB) kisebb saját memóriával
 * nem példányosítható (research Q-9, `docs/research/2026-11-04-szkript-csomopont.md`).
 * A `packages/db` azonos nevű konstansának SZÁNDÉKOS duplikátuma; a két érték
 * egyezését az `apps/server` `node-config-drift-protection` regressziós tesztje
 * őrzi.
 */
export const MIN_SCRIPT_MEMORY_LIMIT_MB = 16;

/**
 * A `memoryLimitMb` mező felső határa (SPEC-014 5.3): a pinelt modul a
 * deklarált maximumánál (2048 MB) nagyobb saját memóriával nem példányosítható
 * (research Q-9). A `packages/db` azonos nevű konstansának SZÁNDÉKOS
 * duplikátuma, ugyanazzal a védelemmel.
 */
export const MAX_SCRIPT_MEMORY_LIMIT_MB = 2048;

/**
 * A JavaScript szkript beállítása (SPEC-014 5.3), a `packages/db`
 * `javascript-script-config.ts` mirror sémája. A `timeoutMs` olvasó oldali
 * szabálya csak a típus (`number | null`): a pozitív egész és a felső határ
 * írás oldali szabály a mentési sémában (`NodeConfigSaveSchema`), a `db`
 * `isNodeConfig` guard pedig mindkét irányban szigorú (O-37 mintája). A
 * `memoryLimitMb` ugyanígy: olvasáskor `number | null`, a 16 ... 2048 egész
 * tartomány írás oldali szabály.
 */
export const JavaScriptScriptConfigSchema = z
  .strictObject({
    source: z.string(),
    runtime: z.literal('javascript'),
    timeoutMs: z.number().nullable(),
    cwd: z.string().nullable(),
    memoryLimitMb: z.number().nullable(),
  })
  .readonly();

export type JavaScriptScriptConfig = z.infer<typeof JavaScriptScriptConfigSchema>;
