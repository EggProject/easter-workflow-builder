/**
 * A JavaScript szkript beállítása (SPEC-014 5.3). A `timeoutMs` `null` értéke
 * az alapérték (60 000 ms); a megadott érték pozitív egész, legfeljebb
 * `MAX_SCRIPT_TIMEOUT_MS`. A `cwd` a fájl hozzáférés gyökere (SPEC-014 O-5), az
 * agent lépés `cwd` mezőjének mintájára; a `null` a szerver folyamat
 * munkakönyvtára.
 */
export interface JavaScriptScriptConfig {
  readonly source: string;
  readonly runtime: 'javascript';
  readonly timeoutMs: number | null;
  readonly cwd: string | null;
}
