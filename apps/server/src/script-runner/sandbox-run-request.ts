/**
 * Egy JavaScript szkript lépés kérése a szkript folyamat felé (SPEC-017 4.2): a
 * motor `ScriptRunRequest`-jéből a szülő állítja elő
 * (`build-sandbox-run-request.ts`), és az IPC csatornán JSON-ként megy át.
 *
 * - `contextJson`: a futás kontextus hét nevének JSON szövege; a hiányzó
 *   (`undefined`) nevet a `JSON.stringify` kihagyja, tehát a sandboxban sem
 *   létezik (SPEC-010 7.3 táblázata).
 * - `root`: a fájl hozzáférés feloldott, abszolút gyökere (a `cwd`, üresen a
 *   szerver munkakönyvtára, SPEC-014 O-5); a szülő oldja fel, hogy a gyerek
 *   munkakönyvtára ne számítson.
 * - `timeoutMs`, `deadlineMs`: a feloldott időkorlát és a határidő (a szülő
 *   indulásától számítva, epoch ms), amit a gyerek és a szülő is ugyanarra az
 *   időpontra állít.
 * - a három korlát mező a tárolt érték változatlanul; a `null` alapértéket a
 *   gyerek oldja fel (SPEC-014 5.4).
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface SandboxRunRequest {
  readonly source: string;
  readonly contextJson: string;
  readonly root: string;
  readonly timeoutMs: number;
  readonly deadlineMs: number;
  readonly memoryLimitMb: number | null;
  readonly fetchResponseLimitMb: number | null;
  readonly fileReadLimitMb: number | null;
}
