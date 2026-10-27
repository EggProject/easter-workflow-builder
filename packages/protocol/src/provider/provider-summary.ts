import { z } from 'zod';

/**
 * Egy követelmény elfogadott neveinek nem üres listája, elsőbbségi sorrendben (SPEC-013 4.8).
 */
const RequiredEnvironmentNameGroupSchema = z.tuple([z.string()], z.string()).readonly();

/**
 * `GET /api/providers` egy sora (SPEC-005 4.2 D táblázat 19. sora). Nincs
 * CRUD a providerekhez (`.claude/CLAUDE.md` 9.), a séma a megjelenítéshez
 * szükséges mezőkre szorítkozik: azonosító, megjelenítendő név, a modellek
 * (wire azonosító) listája, és a kötelező env változók **neve**. A
 * `requiredEnvNames` egy eleme egy követelmény elfogadott neveinek nem üres
 * listája, elsőbbségi sorrendben (SPEC-013 4.8): egy név, vagy több, ha a
 * kulcs alternatív néven is érkezhet (`ANTHROPIC_AUTH_TOKEN` vagy
 * `ANTHROPIC_API_KEY`).
 *
 * **Soha nem visz env változó értéket vagy API kulcsot** (9. és 29.
 * kritérium): a `requiredEnvNames` kizárólag a nevet hordozza, az érték a
 * szerver process környezetében marad. A képességleíró `Fact` mezőinek
 * bizonyíték listáját sem visszük ki (SPEC-005 4.2 D táblázat): az mérési
 * narratíva, aminek a helye a `docs/research/` alatt van, nem a dróton.
 */
export const ProviderSummarySchema = z
  .strictObject({
    id: z.string(),
    displayName: z.string(),
    models: z.array(z.string()).readonly(),
    requiredEnvNames: z.array(RequiredEnvironmentNameGroupSchema).readonly(),
  })
  .readonly();

export type ProviderSummary = z.infer<typeof ProviderSummarySchema>;
