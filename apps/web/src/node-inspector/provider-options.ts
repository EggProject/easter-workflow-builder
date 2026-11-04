import type { ProviderConnectionTester } from '../provider-select/provider-connection-tester.ts';

/**
 * A "Provider felülírás" választó opciói és betöltési állapota (SPEC-008 9.
 * szekció 4. async pontja): a szerkesztő a szerver `GET /api/providers`
 * válaszából építi, a mező a `NodeInspector` fájának mélyén áll.
 *
 * - `isLoading`: a lista még töltődik, a mező letiltva, "Betöltés…" felirattal.
 * - `providerIds`: a választható provider azonosítók, a lista betöltése után a
 *   szerver válasza, hibás betöltéskor a protokoll `ProviderIdSchema`
 *   konstansa (a kettő ugyanazt az azonosító készletet írja le).
 * - `testConnection`: a mező "Kapcsolat teszt" gombjának hívása (SPEC-009
 *   3.2, O-2); a `GraphEditorScreen` az API origin és a `fetch` kötésével
 *   állítja elő. `undefined`, ha nincs szolgáltató: a gomb ilyenkor tiltott.
 *
 * **Típus-only fájl, nincs `.spec.ts` párja** (`apps/web/CLAUDE.md` ## Fájlok
 * konvenció).
 */
export interface ProviderOptions {
  readonly isLoading: boolean;
  readonly providerIds: readonly string[];
  readonly testConnection: ProviderConnectionTester | undefined;
}
