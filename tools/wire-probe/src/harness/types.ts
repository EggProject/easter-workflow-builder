/**
A mérési harness közös típusai.
*/

/**
Egy mérési eset futtatásának kontextusa: közös, minden esetre érvényes beállítások.
*/
export interface CaseContext {
  readonly proxyPort: number;
  /**
  A proxy bázis URL-je, amit az Options.env ANTHROPIC_BASE_URL mezőjébe kell tenni.
  */
  readonly proxyBaseUrl: string;
  readonly minimaxApiKey: string;
  /**
  Ide kerül a <caseId>/<runId>.sdk-messages.ndjson és a <caseId>/<runId>.meta.json.
  */
  readonly outDir: string;
  /**
  A telepített @anthropic-ai/claude-agent-sdk pontos verziója.
  */
  readonly sdkVersion: string;
}

/**
Egy mérési eset (vagy annak egy futása) lefutásának rövid, ember olvasható eredménye.
*/
export interface CaseRunOutcome {
  readonly runId: string;
  readonly ok: boolean;
  readonly note: string;
}

/**
 * Egy mérési eset: metaadat (SPEC-000 4. szekció) plusz a tényleges futtatás.
 * Minden eset saját fájlban van a src/cases/ alatt.
 */
export interface MeasurementCase {
  readonly id: string;
  readonly title: string;
  /**
  Melyik SPEC-000 kérdéshez (Q1-Q12) vagy descriptor mezőhöz tartozik.
  */
  readonly question: string;
  run(context: CaseContext): Promise<readonly CaseRunOutcome[]>;
}
