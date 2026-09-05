/**
 * A felület kötelező konfigurációja (SPEC-007 12.2). Minden mezőnek van egy
 * `VITE_` előtagú környezeti változó párja, és egyiknek sincs alapértéke: a
 * SPEC-007 O-4 és O-6 nyitott kérdése szerint sem az API originre, sem a
 * lapméretekre nincs forrásunk, tehát a szám a konfigurációban dől el, nem a
 * kódban (SPEC-007 16. szekció 45. kritérium).
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
