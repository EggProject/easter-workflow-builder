/**
 * A JavaScript szkript beállítása (SPEC-014 5.3). A `timeoutMs` `null` értéke
 * az alapérték (60 000 ms); a megadott érték pozitív egész, legfeljebb
 * `MAX_SCRIPT_TIMEOUT_MS`. A `cwd` a fájl hozzáférés gyökere (SPEC-014 O-5), az
 * agent lépés `cwd` mezőjének mintájára; a `null` a szerver folyamat
 * munkakönyvtára. A `memoryLimitMb` a lépés memória korlátja egész MB-ban; a
 * `null` az alapérték (a rendszermemória, legfeljebb a modul plafonja), a
 * megadott érték egész, `MIN_SCRIPT_MEMORY_LIMIT_MB` és
 * `MAX_SCRIPT_MEMORY_LIMIT_MB` között (mindkét határ megengedett).
 *
 * A `fetchResponseLimitMb` és a `fileReadLimitMb` a gazda oldali olvasási
 * plafon egész MB-ban: a `fetch` válasz törzsének, illetve a `files.readText`
 * fájljának felső határa (user döntés 2026-11-04, "Igen, iparági alapértékkel",
 * SPEC-014 5.3, 5.4 "Olvasási plafon"). A `null` az alapérték (a futtatóban), a
 * megadott érték pozitív egész, legfeljebb `MAX_SCRIPT_MEMORY_LIMIT_MB`, mert a
 * modul plafonjánál nagyobb tartalom a sandboxba sosem férne be.
 */
export interface JavaScriptScriptConfig {
  readonly source: string;
  readonly runtime: 'javascript';
  readonly timeoutMs: number | null;
  readonly cwd: string | null;
  readonly memoryLimitMb: number | null;
  readonly fetchResponseLimitMb: number | null;
  readonly fileReadLimitMb: number | null;
}
