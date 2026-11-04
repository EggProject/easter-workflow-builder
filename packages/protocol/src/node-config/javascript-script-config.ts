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
 * A JavaScript szkript beállítása (SPEC-014 5.3), a `packages/db`
 * `javascript-script-config.ts` mirror sémája. A `timeoutMs` olvasó oldali
 * szabálya csak a típus (`number | null`): a pozitív egész és a felső határ
 * írás oldali szabály a mentési sémában (`NodeConfigSaveSchema`), a `db`
 * `isNodeConfig` guard pedig mindkét irányban szigorú (O-37 mintája).
 */
export const JavaScriptScriptConfigSchema = z
  .strictObject({
    source: z.string(),
    runtime: z.literal('javascript'),
    timeoutMs: z.number().nullable(),
    cwd: z.string().nullable(),
  })
  .readonly();

export type JavaScriptScriptConfig = z.infer<typeof JavaScriptScriptConfigSchema>;
