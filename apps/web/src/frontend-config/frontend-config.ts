/**
 * A felület konfigurációja (SPEC-007 12.2). Minden mezőnek van egy `VITE_`
 * előtagú környezeti változó párja és egy alapértéke a
 * `default-frontend-config.ts` fájlban (SPEC-012 4.2, user döntés
 * 2026-10-26, ami a SPEC-007 O-4 és O-6 "alapérték nélkül" döntését
 * felülírta): a hiányzó változó az alapértéket adja, a megadott érvénytelen
 * érték hibaág.
 */
export interface FrontendConfig {
  /**
   * Az az origin, amin a szerver REST végpontjai elérhetők. Fejlesztéskor a
   * Vite dev szerver saját originje, mert a REST hívás a `/api` proxy
   * szabályon megy át; élesben a szerver origin (SPEC-008 3.3).
   */
  readonly apiOrigin: string;
  /**
   * Az az origin, amin a szerver SSE (`/events`) végpontja elérhető.
   * Fejlesztéskor a backend origin, a proxyt megkerülve (SPEC-005 5.8,
   * SPEC-008 3.1); élesben megegyezik az `apiOrigin` értékével.
   */
  readonly streamOrigin: string;
  /**
   * A lista végpontok `limit` paramétere (O-6).
   */
  readonly listLimit: number;
  /**
   * A stream feliratkozás `replayLimit` paramétere (O-6).
   */
  readonly streamReplayLimit: number;
}
