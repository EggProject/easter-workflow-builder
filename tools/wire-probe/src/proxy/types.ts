/**
 * A logoló reverse proxy artefaktum-formátuma: egy rögzített HTTP tranzakció.
 * SPEC-000 3. szekció "Artefaktumok" és a felhasználói feladat leírása szerint.
 */

/** Egy SSE sor, monoton (kéréshez viszonyított) időbélyeggel. */
export interface StreamEventRecord {
  /** A kérés indulásától eltelt idő ezredmásodpercben. */
  readonly t: number;
  /** A nyers SSE sor, parszolás nélkül. */
  readonly raw: string;
}

/** Egyetlen, a proxyn átment HTTP tranzakció teljes rögzítése. */
export interface RecordedTransaction {
  /** Monoton növekvő sorszám a proxy indulásától. */
  readonly seq: number;
  /** ISO időbélyeg a kérés érkezésekor. */
  readonly timestamp: string;
  readonly method: string;
  /** Útvonal, query string nélkül. */
  readonly path: string;
  /** Nyers query string, kérdőjel nélkül; üres string, ha nincs. */
  readonly query: string;
  /** A bejövő (nem a továbbított) kérés headerei, maszkolva. */
  readonly requestHeaders: Readonly<Record<string, string>>;
  /** A kérés törzse, JSON-ként parse-olva ha lehet, különben nyers string. */
  readonly requestBody: unknown;
  readonly responseStatus: number;
  readonly responseHeaders: Readonly<Record<string, string>>;
  /** Nem stream válasz törzse; stream válasznál `null`, mert azt a `streamEvents` hordozza. */
  readonly responseBody: unknown;
  /** Stream válasznál a nyers SSE sorok sorrendben; nem stream válasznál `null`. */
  readonly streamEvents: readonly StreamEventRecord[] | null;
  readonly durationMs: number;
}
